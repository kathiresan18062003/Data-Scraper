"""Open web discovery: search e-commerce / manufacturer sites by MPN + Manufacturer."""
from urllib.parse import urlparse
from backend.app.config import MANUFACTURER_DOMAINS
from backend.app.scraper import data_validator as dv

import importlib

SKIP_DOMAINS = (
    "google.", "bing.", "duckduckgo.", "facebook.", "youtube.", "pinterest.", "instagram.",
    "twitter.", "x.com", "reddit.", "linkedin.", "wikipedia.", "tiktok."
)


def _get_ddgs():
    for name in ("ddgs", "duckduckgo_search"):
        try:
            mod = importlib.import_module(name)
            if hasattr(mod, "DDGS"):
                return getattr(mod, "DDGS")
        except ImportError:
            continue
    return None


def web_search(q: str, n: int = 8) -> list[str]:
    try:
        ddgs_cls = _get_ddgs()
        if not ddgs_cls:
            return []
        with ddgs_cls() as d:
            return [r["href"] for r in d.text(q, max_results=n) if r.get("href")]
    except Exception:
        return []


def usable(u: str) -> bool:
    p = urlparse(u)
    return (
        p.scheme.startswith("http")
        and not p.path.lower().endswith(".pdf")
        and not any(s in p.netloc.lower() for s in SKIP_DOMAINS)
    )


def mfr_domain(mfr: str) -> str | None:
    return MANUFACTURER_DOMAINS.get((mfr or "").lower())


def candidates(row: dict, _unused=None):
    """Yield (source_type, url). Existing workbook URL, manufacturer site, then search hits."""
    seen = set()

    def new(u: str) -> bool:
        if u and usable(u) and u not in seen:
            seen.add(u)
            return True
        return False

    mpn, mfr = row.get("mpn", ""), row.get("mfr", "")
    alt = dv.strip_line_code(mpn)

    if row.get("url", "").startswith("http") and new(row["url"]):
        yield "EXISTING URL", row["url"]

    d = mfr_domain(mfr)
    if d:
        for u in web_search(f'site:{d} "{mpn}"', 4):
            if new(u):
                yield "MANUFACTURER", u

    queries = [f'"{mfr}" "{mpn}"', f'{mfr} {mpn} buy', f'"{mpn}" {mfr} specifications']
    if alt != mpn:
        queries += [f'"{mfr}" "{alt}"', f'{mfr} {alt} buy']

    for q in queries:
        for u in web_search(q):
            if new(u):
                yield "WEB SEARCH", u

