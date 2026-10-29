import json
import logging
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from backend.app.config import OUTPUT_DIR
from backend.app.database import SessionLocal
from backend.app.models.job import Job, ProductResult
from backend.app.scraper import (
    data_validator as dv,
    gemini_extractor as gx,
    scraper,
    source_discovery as sd,
)
from backend.app.services import excel_service

logger = logging.getLogger(__name__)

MAX_CANDIDATES = 20
MAX_SOURCES = 3


class JobController:
    def __init__(self, job_id: str):
        self.job_id = job_id
        self._pause_event = threading.Event()
        self._pause_event.set()  # set = running, clear = paused
        self._cancel_event = threading.Event()  # set = cancelled
        self.is_running = False
        self.thread: threading.Thread | None = None

    def pause(self):
        self._pause_event.clear()

    def resume(self):
        self._pause_event.set()

    def cancel(self):
        self._cancel_event.set()
        self._pause_event.set()  # unblock if paused so thread can exit

    def is_paused(self) -> bool:
        return not self._pause_event.is_set()

    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def wait_if_paused(self):
        while not self._pause_event.is_set():
            if self._cancel_event.is_set():
                break
            time.sleep(0.5)


_ACTIVE_CONTROLLERS: dict[str, JobController] = {}
_CONTROLLER_LOCK = threading.Lock()


def get_controller(job_id: str) -> JobController:
    with _CONTROLLER_LOCK:
        if job_id not in _ACTIVE_CONTROLLERS:
            _ACTIVE_CONTROLLERS[job_id] = JobController(job_id)
        return _ACTIVE_CONTROLLERS[job_id]


def process_single_row(
    row: dict,
    use_gemini: bool = True,
    retries: int = 2,
    timeout: int | None = None,
    on_stage: Callable[[str, str], None] = lambda s, u="": None,
) -> dict:
    mpn = row["mpn"]
    mfr = row["mfr"]
    google_url = excel_service.google_link(mfr, mpn)

    res = {
        "status": "FAILED",
        "tier": "MANUAL REVIEW",
        "sources": [],
        "score": 0,
        "confidence": "REJECTED",
        "google": google_url,
        "reason": "No candidate passed identity validation",
        "product_title": row.get("title", ""),
        "overview": "",
        "features": [],
        "specifications": [],
        "fitments": [],
        "image": "",
        "notes": [],
        "missing": ["overview", "features", "specifications", "image"],
        "extraction_method": "deterministic",
    }

    valids = []
    tried = 0
    on_stage("Discover Sources", "")

    for tier, url in sd.candidates(row):
        if tried >= MAX_CANDIDATES or len(res["sources"]) >= MAX_SOURCES:
            break
        tried += 1

        on_stage("Fetch Page", url)
        html = scraper.fetch(url, timeout, retries)
        if not html:
            continue

        on_stage("Extract Data", url)
        parsed = scraper.parse(html, url)
        gaps = not (parsed["overview"] and parsed["features"] and parsed["specifications"])
        extraction_method = "deterministic"

        if use_gemini and gx.available() and gaps:
            on_stage("AI Interpretation (Gemini)", url)
            gem_res = gx.extract(url, parsed["text"])
            parsed, extraction_method = gx.merge(parsed, gem_res)

        on_stage("Validate Product", url)
        v = dv.validate(mpn, mfr, url, parsed, (), sd.mfr_domain(mfr))

        if v["is_valid"] and url not in res["sources"]:
            res["sources"].append(url)
            valids.append((parsed, v, tier, url, extraction_method))

    if valids:
        valids.sort(key=lambda x: -x[1]["score"])  # Highest score first
        parsed, v, tier, url, extraction_method = valids[0]
        parsed = dict(parsed, image_urls=list(parsed["image_urls"]))
        res["sources"] = [x[3] for x in valids]

        # Fill any remaining field gaps from other verified candidate pages
        for key in ("overview", "features", "specifications", "fitments", "image_urls"):
            if not parsed.get(key):
                for p2, _, _, u2, _ in valids[1:]:
                    if p2.get(key):
                        parsed[key] = p2[key]
                        v["notes"].append(f"{key} taken from {u2}")
                        break

        missing = [k for k in ("overview", "features", "specifications", "image") if not parsed.get(k if k != "image" else "image_urls")]
        status = "SUCCESS" if not missing else "REVIEW"
        reason = "" if not missing else "Missing: " + ", ".join(missing)

        res.update({
            "status": status,
            "tier": tier,
            "score": v["score"],
            "confidence": v["confidence"],
            "product_title": parsed["product_title"] or row.get("title", ""),
            "overview": parsed["overview"],
            "features": parsed["features"],
            "specifications": parsed["specifications"],
            "fitments": parsed["fitments"],
            "image": (parsed["image_urls"] or [""])[0],
            "notes": v["notes"],
            "missing": missing,
            "reason": reason,
            "extraction_method": extraction_method,
        })

    return res


def run_job_sync(job_id: str, retry_failed_only: bool = False):
    controller = get_controller(job_id)
    controller.is_running = True

    db = SessionLocal()
    try:
        job: Job | None = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return

        cfg = job.get_config()
        cmap = job.get_column_mapping()
        src_path = Path(job.file_path)
        sheet_name = job.sheet_name
        limit = cfg.get("limit")
        timeout = cfg.get("timeout", 20)
        retries = cfg.get("retries", 2)
        use_gemini = cfg.get("use_gemini", True)
        save_every = cfg.get("save_every", 1)

        import openpyxl
        wb = openpyxl.load_workbook(src_path, data_only=True)
        ws = wb[sheet_name]
        rows = excel_service.read_rows(ws, cmap, limit=limit)
        wb.close()

        # Load existing results from database
        existing_results = {
            r.row_index: r for r in db.query(ProductResult).filter(ProductResult.job_id == job_id).all()
        }

        # In-memory dict formatted for Excel export
        export_results = {}
        for row_idx, r in existing_results.items():
            if retry_failed_only and r.status == "FAILED":
                continue  # will re-run
            export_results[row_idx] = {
                "status": r.status,
                "confidence": r.confidence,
                "tier": r.tier,
                "score": r.score,
                "product_title": r.product_name or r.title,
                "overview": r.overview,
                "features": json.loads(r.features or "[]"),
                "specifications": json.loads(r.specifications or "[]"),
                "fitments": json.loads(r.fitments or "[]"),
                "image": r.image_url,
                "sources": json.loads(r.source_urls or "[]"),
                "notes": json.loads(r.validation_notes or "[]"),
                "reason": r.rework_reason,
                "google": r.google_search_url,
            }

        job.status = "RUNNING"
        job.total_products = len(rows)
        db.commit()

        def add_log(msg: str):
            now_str = datetime.now().strftime("%H:%M:%S")
            entry = f"[{now_str}] {msg}"
            current_logs = job.get_logs()
            current_logs.append(entry)
            job.logs = json.dumps(current_logs[-100:])  # keep last 100 logs
            db.commit()

        def update_current_info(stage: str, url: str, row: dict, index: int, total: int):
            job.current_product_info = json.dumps({
                "stage": stage,
                "url": url,
                "mpn": row["mpn"],
                "mfr": row["mfr"],
                "index": index + 1,
                "total": total
            })
            db.commit()

        add_log(f"Started scraping job for {len(rows)} products.")

        # Create output files immediately
        try:
            excel_paths = excel_service.export_all(src_path, sheet_name, rows, export_results, job_id=job_id)
            job.output_scraped_path = str(excel_paths["scraped"])
            job.output_organized_path = str(excel_paths["organized"])
            job.output_review_path = str(excel_paths["review"])
            db.commit()
        except Exception as e:
            add_log(f"Warning: Initial Excel export creation failed: {e}")

        newly_processed = 0

        for i, row in enumerate(rows):
            # Check pause / cancel
            if controller.is_cancelled():
                job.status = "CANCELLED"
                add_log("Job was cancelled by user.")
                break

            controller.wait_if_paused()
            if controller.is_paused():
                job.status = "PAUSED"
                add_log("Job is paused.")
                db.commit()
                while controller.is_paused() and not controller.is_cancelled():
                    time.sleep(0.5)
                if controller.is_cancelled():
                    job.status = "CANCELLED"
                    add_log("Job was cancelled while paused.")
                    break
                job.status = "RUNNING"
                add_log("Job resumed.")
                db.commit()

            row_idx = row["row"]

            # If already processed and not retrying this row, skip
            if row_idx in export_results and not (retry_failed_only and existing_results.get(row_idx) and existing_results[row_idx].status == "FAILED"):
                continue

            stage_fn = lambda stg, u="": update_current_info(stg, u, row, i, len(rows))
            add_log(f"Row {row_idx} ({i+1}/{len(rows)}): {row['mfr']} {row['mpn']}")

            try:
                res = process_single_row(
                    row,
                    use_gemini=use_gemini,
                    retries=retries,
                    timeout=timeout,
                    on_stage=stage_fn,
                )
            except Exception as e:
                add_log(f"Error processing row {row_idx}: {e}")
                res = {
                    "status": "FAILED",
                    "tier": "MANUAL REVIEW",
                    "sources": [],
                    "score": 0,
                    "confidence": "REJECTED",
                    "google": excel_service.google_link(row["mfr"], row["mpn"]),
                    "reason": f"Processing error: {str(e)}",
                    "product_title": row.get("title", ""),
                    "overview": "",
                    "features": [],
                    "specifications": [],
                    "fitments": [],
                    "image": "",
                    "notes": [str(e)],
                    "missing": ["overview", "features", "specifications", "image"],
                    "extraction_method": "deterministic",
                }

            # Update SQLite ProductResult
            db_res = existing_results.get(row_idx)
            if not db_res:
                db_res = ProductResult(job_id=job_id, row_index=row_idx, mpn=row["mpn"], manufacturer=row["mfr"])
                db.add(db_res)
                existing_results[row_idx] = db_res

            db_res.mpn = row["mpn"]
            db_res.manufacturer = row["mfr"]
            db_res.title = row.get("title", "")
            db_res.product_name = res.get("product_title", "")
            db_res.status = res.get("status", "FAILED")
            db_res.confidence = res.get("confidence", "REJECTED")
            db_res.tier = res.get("tier", "MANUAL REVIEW")
            db_res.score = res.get("score", 0)
            db_res.image_url = res.get("image", "")
            db_res.image_urls = json.dumps([res.get("image")] if res.get("image") else [])
            db_res.source_url = res.get("sources", [""])[0] if res.get("sources") else ""
            db_res.source_urls = json.dumps(res.get("sources", []))
            db_res.data_source_urls = json.dumps(res.get("sources", []))
            db_res.overview = res.get("overview", "")
            db_res.features = json.dumps(res.get("features", []))
            db_res.specifications = json.dumps(res.get("specifications", []))
            db_res.fitments = json.dumps(res.get("fitments", []))
            db_res.missing_fields = json.dumps(res.get("missing", []))
            db_res.validation_notes = json.dumps(res.get("notes", []))
            db_res.rework_reason = res.get("reason", "")
            db_res.google_search_url = res.get("google", "")
            db_res.extraction_method = res.get("extraction_method", "deterministic")

            # Update in-memory export dict
            export_results[row_idx] = res

            # Update Job statistics
            newly_processed += 1
            all_statuses = [r["status"] for r in export_results.values()]
            job.processed_products = len(export_results)
            job.successful_products = all_statuses.count("SUCCESS")
            job.review_products = all_statuses.count("REVIEW")
            job.failed_products = all_statuses.count("FAILED")

            db.commit()

            add_log(f"-> {res['status']} ({res.get('tier')}) {res.get('reason', '')}")

            # Incremental save to Excel
            if save_every > 0 and (newly_processed % save_every == 0):
                try:
                    excel_paths = excel_service.export_all(src_path, sheet_name, rows, export_results, job_id=job_id)
                    job.output_scraped_path = str(excel_paths["scraped"])
                    job.output_organized_path = str(excel_paths["organized"])
                    job.output_review_path = str(excel_paths["review"])
                    db.commit()
                except Exception as e:
                    add_log(f"Warning: Incremental Excel save failed: {e}")

        # Finalize job status if not already cancelled or paused
        if job.status not in ("CANCELLED", "PAUSED"):
            job.status = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            add_log(f"Finished scraping job. Processed: {job.processed_products}/{job.total_products} products.")

        # Final export
        try:
            excel_paths = excel_service.export_all(src_path, sheet_name, rows, export_results, job_id=job_id)
            job.output_scraped_path = str(excel_paths["scraped"])
            job.output_organized_path = str(excel_paths["organized"])
            job.output_review_path = str(excel_paths["review"])
            db.commit()
        except Exception as e:
            add_log(f"Warning: Final Excel export failed: {e}")

    except Exception as e:
        logger.exception("Error in job runner")
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if job:
                job.status = "FAILED"
                add_log(f"Fatal error: {e}")
                db.commit()
        except Exception:
            pass
    finally:
        controller.is_running = False
        db.close()


def start_job_in_background(job_id: str, retry_failed_only: bool = False):
    controller = get_controller(job_id)
    if controller.is_running:
        return
    controller._cancel_event.clear()
    controller._pause_event.set()
    t = threading.Thread(target=run_job_sync, args=(job_id, retry_failed_only), daemon=True)
    controller.thread = t
    t.start()

