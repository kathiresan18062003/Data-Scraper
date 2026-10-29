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


def web_search(q: str, n: int = 4) -> list[str]:
    try:
        ddgs_cls = _get_ddgs()
        if not ddgs_cls:
            return []
        with ddgs_cls() as d:
            return [r["href"] for r in d.text(q, max_results=n) if r.get("href")]
    except Exception:
        return []


def usable(u: str) -> bool:
    if not u or not isinstance(u, str):
        return False
    p = urlparse(u)
    return (
        p.scheme.startswith("http")
        and not p.path.lower().endswith(".pdf")
        and not any(s in p.netloc.lower() for s in SKIP_DOMAINS)
    )


def mfr_domain(mfr: str) -> str | None:
    return MANUFACTURER_DOMAINS.get((mfr or "").lower())


def candidates(row: dict, _unused=None):
    """Yield (source_type, url). If existing workbook URL is provided, use it directly. Otherwise check manufacturer and web search."""
    seen = set()

    def new(u: str) -> bool:
        if u and usable(u) and u not in seen:
            seen.add(u)
            return True
        return False

    # 1. Existing workbook URL
    direct_url = (row.get("url") or "").strip()
    if direct_url.startswith("http") and new(direct_url):
        yield "EXISTING URL", direct_url
        return

    mpn, mfr = row.get("mpn", ""), row.get("mfr", "")
    alt = dv.strip_line_code(mpn)

    # 2. Manufacturer official site
    d = mfr_domain(mfr)
    if d:
        for u in web_search(f'site:{d} "{mpn}"', 2):
            if new(u):
                yield "MANUFACTURER", u
                if len(seen) >= 2:
                    return

    # 3. Targeted Web Search (fast top results)
    queries = []
    if mfr and mfr.lower() not in ("unknown", "n/a", "none", ""):
        queries.append(f'"{mfr}" "{mpn}"')
        if alt != mpn:
            queries.append(f'"{mfr}" "{alt}"')
    queries.append(f'"{mpn}"')
    if alt != mpn:
        queries.append(f'"{alt}"')

    for q in queries:
        for u in web_search(q, 3):
            if new(u):
                yield "WEB SEARCH", u
                if len(seen) >= 3:
                    return
