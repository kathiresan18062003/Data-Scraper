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
from backend.app.services import excel_service

# Scraper sub-modules are imported lazily inside _get_scrapers() to avoid
# loading heavy native libraries (requests, BeautifulSoup, ddgs, curl_cffi)
# at module load time, which crashes Vercel serverless cold starts.
_scrapers: dict | None = None


def _get_scrapers() -> dict:
    global _scrapers
    if _scrapers is None:
        from backend.app.scraper import data_validator as dv  # noqa: PLC0415
        from backend.app.scraper import gemini_extractor as gx  # noqa: PLC0415
        from backend.app.scraper import scraper  # noqa: PLC0415
        from backend.app.scraper import source_discovery as sd  # noqa: PLC0415
        _scrapers = {"dv": dv, "gx": gx, "scraper": scraper, "sd": sd}
    return _scrapers

logger = logging.getLogger(__name__)

MAX_CANDIDATES = 6
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
    gemini_api_key: str | None = None,
) -> dict:
    mpn = (row.get("primary_mpn") or row.get("mpn1") or row.get("mpn") or "").strip()
    mfr = (row.get("mfr") or "Unknown").strip()
    google_url = excel_service.google_link(mfr, mpn)

    res = {
        "status": "FAILED",
        "tier": "MANUAL REVIEW",
        "sources": [],
        "score": 0,
        "confidence": "REJECTED",
        "google": google_url,
        "reason": f"Not found: No product page discovered for {mfr} {mpn}",
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

    on_stage("Discover Sources", "")
    _sc = _get_scrapers()
    dv, gx, scraper, sd = _sc["dv"], _sc["gx"], _sc["scraper"], _sc["sd"]
    candidates_list = list(sd.candidates(row, max_total=MAX_CANDIDATES))
    logger.info(f"Row {row.get('row')}: MPN='{mpn}' MFR='{mfr}': found {len(candidates_list)} candidate(s).")

    all_fetched = []
    valids = []
    rejected_candidates = []
    tried = 0

    for tier, url in candidates_list:
        if tried >= MAX_CANDIDATES or len(valids) >= MAX_SOURCES:
            break
        tried += 1

        on_stage("Fetch Page", url)
        html = scraper.fetch(url, timeout, retries)
        if not html:
            rejected_candidates.append(f"{url} (inaccessible / blocked / HTTP error)")
            continue

        on_stage("Extract Data", url)
        parsed = scraper.parse(html, url)
        gaps = not (parsed["overview"] and parsed["features"] and parsed["specifications"])
        extraction_method = "deterministic"

        if use_gemini and gx.available(gemini_api_key) and gaps:
            on_stage("AI Interpretation (Gemini)", url)
            gem_res = gx.extract(url, parsed["text"], api_key=gemini_api_key)
            if gem_res:
                parsed, extraction_method = gx.merge(parsed, gem_res)

        on_stage("Validate Product", url)
        v = dv.validate(mpn, mfr, url, parsed, preferred_domains=(), mfr_domain=sd.mfr_domain(mfr))

        if v["is_valid"]:
            valids.append((parsed, v, tier, url, extraction_method))
            if url not in res["sources"] and len(res["sources"]) < MAX_SOURCES:
                res["sources"].append(url)
        else:
            reason_txt = v.get("rejection_reason") or "; ".join(v.get("notes", []))
            rejected_candidates.append(f"{url} ({reason_txt})")

        all_fetched.append((parsed, v, tier, url, extraction_method))

    selected_candidate = None
    if valids:
        valids.sort(key=lambda x: -x[1]["score"])
        selected_candidate = valids[0]
        res["sources"] = [x[3] for x in valids[:MAX_SOURCES]]
    elif all_fetched:
        # None passed strict threshold >= 35, check if any candidate was fetched
        all_fetched.sort(key=lambda x: -x[1]["score"])
        selected_candidate = all_fetched[0]
        if selected_candidate[1]["score"] > 0:
            res["sources"] = [selected_candidate[3]]

    if selected_candidate:
        parsed, v, tier, url, extraction_method = selected_candidate
        parsed = dict(parsed, image_urls=list(parsed["image_urls"]))

        # Cross-enrich missing fields from other verified pages
        pool = valids[1:] if valids else all_fetched[1:]
        for key in ("overview", "features", "specifications", "fitments", "image_urls"):
            if not parsed.get(key):
                for p2, _, _, u2, _ in pool:
                    if p2.get(key):
                        parsed[key] = p2[key]
                        v["notes"].append(f"{key} enriched from {u2}")
                        break

        missing = [
            k for k in ("overview", "features", "specifications", "image")
            if not parsed.get(k if k != "image" else "image_urls")
        ]
        is_direct_url = bool((row.get("url") or "").strip().startswith("http"))

        if v["is_valid"] and not missing:
            status = "SUCCESS"
            reason = ""
        elif v["is_valid"] and missing:
            status = "REVIEW"
            reason = "Source absent fields: " + ", ".join(missing)
        elif is_direct_url:
            status = "SUCCESS" if not missing else "REVIEW"
            reason = "" if not missing else "Missing: " + ", ".join(missing)
        elif v.get("is_variant"):
            status = "REVIEW"
            reason = v.get("rejection_reason", "Variant mismatch detected")
        else:
            status = "REVIEW" if v["score"] >= 20 else "FAILED"
            reason = f"Candidate score {v['score']}/35: " + ", ".join(v.get("notes", []))

        notes = list(v["notes"])
        if rejected_candidates:
            notes.append("Rejected candidates: " + "; ".join(rejected_candidates[:2]))

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
            "notes": notes,
            "missing": missing,
            "reason": reason,
            "extraction_method": extraction_method,
        })
    else:
        if rejected_candidates:
            res["reason"] = "All candidates rejected: " + "; ".join(rejected_candidates[:2])
            res["notes"] = rejected_candidates
        else:
            res["reason"] = f"Not found: No product page accessible for {mfr} {mpn}."

    return res


_STEP_LOCKS: dict[str, threading.Lock] = {}
_STEP_GLOBAL_LOCK = threading.Lock()


def _get_step_lock(job_id: str) -> threading.Lock:
    with _STEP_GLOBAL_LOCK:
        if job_id not in _STEP_LOCKS:
            _STEP_LOCKS[job_id] = threading.Lock()
        return _STEP_LOCKS[job_id]


def process_job_step(job_id: str, retry_failed_only: bool = False) -> bool:
    """
    Executes one row of work for the job synchronously with atomic JSON checkpointing
    and live Excel output persistence.
    """
    controller = get_controller(job_id)
    if controller.is_paused() or controller.is_cancelled():
        return False

    lock = _get_step_lock(job_id)
    if not lock.acquire(blocking=False):
        return False

    db = SessionLocal()
    try:
        job: Job | None = db.query(Job).filter(Job.id == job_id).first()
        if not job or job.status in ("COMPLETED", "FAILED", "CANCELLED", "PAUSED"):
            return False

        cfg = job.get_config()
        cmap = job.get_column_mapping()
        src_path = Path(job.file_path)
        sheet_name = job.sheet_name
        limit = cfg.get("limit")
        start_row = cfg.get("start_row")
        end_row = cfg.get("end_row")
        sno_start = cfg.get("sno_start")
        sno_end = cfg.get("sno_end")
        timeout = cfg.get("timeout", 20)
        retries = cfg.get("retries", 2)
        use_gemini = cfg.get("use_gemini", True)
        gemini_api_key = cfg.get("gemini_api_key") or ""

        if not src_path.exists():
            return False

        import openpyxl
        wb = openpyxl.load_workbook(src_path, data_only=True)
        ws = wb[sheet_name]
        rows = excel_service.read_rows(
            ws,
            cmap,
            limit=limit,
            start_row=start_row,
            end_row=end_row,
            sno_start=sno_start,
            sno_end=sno_end,
        )
        wb.close()

        if not rows:
            job.status = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return False

        if job.total_products != len(rows):
            job.total_products = len(rows)
            job.status = "RUNNING"
            db.commit()

        # Load recovery checkpoint if exists
        cp_data = excel_service.load_checkpoint(job_id) or {
            "job_id": job_id,
            "saved_rows": {},
            "total_products": len(rows),
        }
        saved_rows_dict: dict = cp_data.get("saved_rows", {})

        existing_results = {
            r.row_index: r for r in db.query(ProductResult).filter(ProductResult.job_id == job_id).all()
        }

        # Reconcile checkpoint with DB on start/resume
        for str_r, saved_item in saved_rows_dict.items():
            r_idx = int(str_r)
            if r_idx not in existing_results:
                reconstructed = ProductResult(
                    job_id=job_id,
                    row_index=r_idx,
                    mpn=saved_item.get("mpn", ""),
                    manufacturer=saved_item.get("mfr", ""),
                    title=saved_item.get("title", ""),
                    product_name=saved_item.get("product_title", ""),
                    status=saved_item.get("status", "FAILED"),
                    confidence=saved_item.get("confidence", "REJECTED"),
                    tier=saved_item.get("tier", "MANUAL REVIEW"),
                    score=saved_item.get("score", 0),
                    image_url=saved_item.get("image", ""),
                    image_urls=json.dumps([saved_item.get("image")] if saved_item.get("image") else []),
                    source_url=saved_item.get("sources", [""])[0] if saved_item.get("sources") else "",
                    source_urls=json.dumps(saved_item.get("sources", [])),
                    data_source_urls=json.dumps(saved_item.get("sources", [])),
                    overview=saved_item.get("overview", ""),
                    features=json.dumps(saved_item.get("features", [])),
                    specifications=json.dumps(saved_item.get("specifications", [])),
                    fitments=json.dumps(saved_item.get("fitments", [])),
                    missing_fields=json.dumps(saved_item.get("missing", [])),
                    validation_notes=json.dumps(saved_item.get("notes", [])),
                    rework_reason=saved_item.get("reason", ""),
                    google_search_url=saved_item.get("google", ""),
                    extraction_method=saved_item.get("extraction_method", "deterministic"),
                )
                db.add(reconstructed)
                existing_results[r_idx] = reconstructed

        # Identify next pending row
        target_row = None
        target_index = -1
        for idx, row in enumerate(rows):
            row_idx = row["row"]
            is_saved_in_cp = str(row_idx) in saved_rows_dict
            is_in_db = row_idx in existing_results

            if not is_saved_in_cp or not is_in_db:
                target_row = row
                target_index = idx
                break
            elif retry_failed_only and existing_results[row_idx].status == "FAILED":
                target_row = row
                target_index = idx
                break

        def add_log(msg: str):
            now_str = datetime.now().strftime("%H:%M:%S")
            entry = f"[{now_str}] {msg}"
            current_logs = job.get_logs()
            current_logs.append(entry)
            job.logs = json.dumps(current_logs[-100:])

        if not target_row:
            if job.status not in ("CANCELLED", "PAUSED"):
                job.status = "COMPLETED"
                job.completed_at = datetime.now(timezone.utc)
                add_log(f"Finished scraping job. Processed: {job.processed_products}/{job.total_products} products.")

                try:
                    export_results = {
                        r.row_index: {
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
                        for r in existing_results.values()
                    }
                    excel_paths = excel_service.export_all(src_path, sheet_name, rows, export_results, job_id=job_id)
                    job.output_scraped_path = str(excel_paths["scraped"])
                    job.output_organized_path = str(excel_paths["organized"])
                    job.output_review_path = str(excel_paths["review"])
                except Exception as e:
                    logger.warning(f"Final export failed: {e}")

                db.commit()
            return False

        row = target_row
        row_idx = row["row"]
        job.status = "RUNNING"
        job.current_product_info = json.dumps({
            "stage": "EXTRACTING",
            "url": row.get("url", ""),
            "mpn": row["mpn"],
            "mfr": row["mfr"],
            "index": target_index + 1,
            "total": len(rows),
        })
        add_log(f"Row {row_idx} ({target_index+1}/{len(rows)}): {row['mfr']} {row['mpn']}")
        db.commit()

        # Execute extraction and verification
        try:
            res = process_single_row(
                row,
                use_gemini=use_gemini,
                retries=retries,
                timeout=timeout,
                gemini_api_key=gemini_api_key,
            )
        except Exception as e:
            res = {
                "status": "FAILED",
                "tier": "MANUAL REVIEW",
                "sources": [],
                "score": 0,
                "confidence": "REJECTED",
                "google": excel_service.google_link(row["mfr"], row["mpn"]),
                "reason": f"Processing exception: {str(e)}",
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

        # 1. Save immediately to JSON checkpoint
        saved_rows_dict[str(row_idx)] = dict(res, mpn=row["mpn"], mfr=row["mfr"], title=row.get("title", ""))
        cp_data["saved_rows"] = saved_rows_dict
        cp_data["total_products"] = len(rows)
        cp_data["processed_products"] = len(saved_rows_dict)
        cp_data["last_saved_at"] = datetime.now(timezone.utc).isoformat()
        excel_service.save_checkpoint(job_id, cp_data)

        # 2. Live Excel writing (incremental write after each row)
        export_results = {
            int(k): v for k, v in saved_rows_dict.items()
        }
        try:
            excel_paths = excel_service.export_all(src_path, sheet_name, rows, export_results, job_id=job_id)
            job.output_scraped_path = str(excel_paths["scraped"])
            job.output_organized_path = str(excel_paths["organized"])
            job.output_review_path = str(excel_paths["review"])
        except Exception as e:
            logger.warning(f"Incremental Excel save encountered write delay: {e}")

        # 3. Update database record only after file save succeeded
        db_res = existing_results.get(row_idx)
        if not db_res:
            db_res = ProductResult(
                job_id=job_id,
                row_index=row_idx,
                mpn=row["mpn"],
                manufacturer=row["mfr"],
            )
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

        all_res = list(existing_results.values())
        job.processed_products = len(all_res)
        job.successful_products = sum(1 for r in all_res if r.status == "SUCCESS")
        job.review_products = sum(1 for r in all_res if r.status == "REVIEW")
        job.failed_products = sum(1 for r in all_res if r.status == "FAILED")

        add_log(f"-> {res['status']} ({res.get('tier')}) {res.get('reason', '')}")
        db.commit()
        return True

    except Exception as exc:
        logger.exception(f"Unexpected error in process_job_step for job {job_id}: {exc}")
        return False
    finally:
        db.close()
        lock.release()


def run_job_sync(job_id: str, retry_failed_only: bool = False):
    controller = get_controller(job_id)
    controller.is_running = True
    try:
        while True:
            if controller.is_cancelled():
                break
            controller.wait_if_paused()
            if controller.is_cancelled():
                break
            more = process_job_step(job_id, retry_failed_only=retry_failed_only)
            if not more:
                break
            time.sleep(0.1)
    finally:
        controller.is_running = False


def start_job_in_background(job_id: str, retry_failed_only: bool = False):
    controller = get_controller(job_id)
    controller.resume()
    t = threading.Thread(
        target=run_job_sync,
        args=(job_id, retry_failed_only),
        daemon=True,
        name=f"job-{job_id[:8]}"
    )
    controller.thread = t
    t.start()
