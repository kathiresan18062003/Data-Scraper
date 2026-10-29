"""Batch orchestrator: discover -> fetch -> extract -> validate -> checkpoint."""
import time
from backend import scraper, gemini_extractor as gx, data_validator as dv, source_discovery as sd, excel_handler as xh
from config import settings

MAX_CANDIDATES, MAX_SOURCES = 20, 3


def process_row(row, use_gemini=True, retries=2, timeout=None, enabled=None, on_stage=lambda s, u="": None):
    res = {"status": "FAILED", "tier": "MANUAL REVIEW", "sources": [], "score": 0, "confidence": "REJECTED",
           "google": xh.google_link(row["mfr"], row["mpn"]), "reason": "No candidate passed identity validation"}
    valids, tried = [], 0
    on_stage("Discover Sources")
    for tier, url in sd.candidates(row, enabled):
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
        if use_gemini and gx.available() and gaps:
            parsed = gx.merge(parsed, gx.extract(url, parsed["text"]))
        on_stage("Validate Product", url)
        v = dv.validate(row["mpn"], row["mfr"], url, parsed, (), sd.mfr_domain(row["mfr"]))
        if v["is_valid"] and url not in res["sources"]:
            res["sources"].append(url)
            valids.append((parsed, v, tier, url))
    if valids:
        valids.sort(key=lambda x: -x[1]["score"])          # best verified source first
        parsed, v, tier, url = valids[0]
        parsed = dict(parsed, image_urls=list(parsed["image_urls"]))
        res["sources"] = [x[3] for x in valids]
        for key in ("overview", "features", "specifications", "fitments", "image_urls"):
            if not parsed.get(key):                          # fill gaps from other VERIFIED pages only
                for p2, _, _, u2 in valids[1:]:
                    if p2.get(key):
                        parsed[key] = p2[key]; v["notes"].append(f"{key} taken from {u2}"); break
        res.update(tier=tier, score=v["score"], confidence=v["confidence"],
                   product_title=parsed["product_title"], overview=parsed["overview"],
                   features=parsed["features"], specifications=parsed["specifications"],
                   fitments=parsed["fitments"], image=(parsed["image_urls"] or [""])[0], notes=v["notes"])
        missing = [k for k in ("overview", "features", "specifications", "image") if not res.get(k)]
        res["missing"] = missing
        res["status"] = "SUCCESS" if not missing else "REVIEW"
        res["reason"] = "" if not missing else "Missing: " + ", ".join(missing)
    return res


def _safe_export(on_export, rows, results, on_log=None, is_final=False):
    if not on_export:
        return
    try:
        try:
            on_export(rows, results, is_final=is_final)
        except TypeError:
            on_export(rows, results)
    except Exception as e:
        if on_log:
            on_log(f"[{time.strftime('%H:%M:%S')}] Export error: {e}")


def run_batch(rows, results, ckpt, cfg, on_progress=lambda *a: None, on_log=lambda m: None, on_export=None):
    on_export = on_export or cfg.get("on_export")
    save_every = cfg.get("save_every", 1)
    should_stop = cfg.get("should_stop", lambda: False)
    try:
        save_every = int(save_every) if save_every is not None else 1
    except (ValueError, TypeError):
        save_every = 1

    newly_processed = 0
    try:
        for i, row in enumerate(rows):
            if should_stop and should_stop():
                on_log(f"[{time.strftime('%H:%M:%S')}] Scraping stopped by user request.")
                break
            if row["row"] in results:           # resume: reuse completed rows
                continue
            on_log(f"[{time.strftime('%H:%M:%S')}] Row {row['row']}/{len(rows)}: {row['mfr']} {row['mpn']}")
            on_progress(i, len(rows), row, "Discover Sources", "")
            stage = lambda s, u="", i=i, row=row: on_progress(i, len(rows), row, s, u)
            try:
                res = process_row(row, cfg.get("gemini", True), cfg.get("retries", 2), cfg.get("timeout"),
                                  cfg.get("enabled"), stage)
            except Exception as e:                 # never abort the batch
                res = {"status": "FAILED", "tier": "MANUAL REVIEW", "sources": [], "reason": f"Error: {e}",
                       "google": xh.google_link(row["mfr"], row["mpn"])}
            results[row["row"]] = res
            xh.save_ckpt(ckpt, results)
            on_log(f"[{time.strftime('%H:%M:%S')}] -> {res['status']} ({res.get('tier')}) {res.get('reason','')}")
            newly_processed += 1

            if save_every > 0 and (newly_processed % save_every == 0):
                on_progress(i + 1, len(rows), row, "Saved to Excel", "")
                _safe_export(on_export, rows, results, on_log, is_final=False)
            else:
                on_progress(i + 1, len(rows), row, "Processed", "")

        _safe_export(on_export, rows, results, on_log, is_final=True)
    except BaseException:
        _safe_export(on_export, rows, results, on_log, is_final=True)
        raise
    return results
