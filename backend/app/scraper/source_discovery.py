"""Open web discovery: multi-strategy search for genuine product pages by MPN1, MPN, and Manufacturer."""
import re
from urllib.parse import urlparse
from backend.app.config import MANUFACTURER_DOMAINS
from backend.app.scraper import data_validator as dv

import importlib

SKIP_DOMAINS = (
    "google.", "bing.", "duckduckgo.", "yahoo.", "baidu.", "yandex.",
    "facebook.", "youtube.", "pinterest.", "instagram.", "twitter.", "x.com",
    "reddit.", "linkedin.", "wikipedia.", "tiktok.", "ebay.", "walmart."
)

DOC_EXTENSIONS = (
    ".pdf", ".ashx", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".zip", ".tar", ".gz", ".png", ".jpg", ".jpeg", ".gif", ".svg"
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


def web_search(q: str, n: int = 5) -> list[str]:
    try:
        ddgs_cls = _get_ddgs()
        if not ddgs_cls:
            return []
        with ddgs_cls() as d:
            results = d.text(q, max_results=n)
            return [r["href"] for r in results if r.get("href")]
    except Exception:
        return []


def usable(u: str) -> bool:
    if not u or not isinstance(u, str):
        return False
    u_lower = u.lower().strip()
    if not u_lower.startswith("http"):
        return False
    p = urlparse(u_lower)
    if any(p.path.endswith(ext) for ext in DOC_EXTENSIONS):
        return False
    if any(s in p.netloc for s in SKIP_DOMAINS):
        return False
    return True


def mfr_domain(mfr: str) -> str | None:
    return MANUFACTURER_DOMAINS.get((mfr or "").lower().strip())


def get_alternative_mpns(mpn: str) -> list[str]:
    """Generates alternative representations of an MPN (e.g. without hyphens, stripped line code)."""
    alts = []
    clean = (mpn or "").strip()
    if not clean:
        return []

    # 1. Line code stripped (e.g. WLD140-13303-R -> 140-13303-R)
    line_stripped = dv.strip_line_code(clean)
    if line_stripped != clean:
        alts.append(line_stripped)

    # 2. Hyphens/spaces removed (e.g. 140-13303-R -> 14013303R)
    no_punct = re.sub(r"[\s\-_/.]+", "", clean)
    if no_punct != clean and len(no_punct) >= 4:
        alts.append(no_punct)

    if line_stripped != clean:
        no_punct_line = re.sub(r"[\s\-_/.]+", "", line_stripped)
        if no_punct_line != line_stripped and len(no_punct_line) >= 4 and no_punct_line not in alts:
            alts.append(no_punct_line)

    return alts


def candidates(row: dict, max_total: int = 6):
    """
    Yields (source_type, url) through multi-strategy discovery:
    1. Direct URL from input workbook (if provided).
    2. Manufacturer official domain query.
    3. Exact quoted search: "{mfr}" "{mpn}".
    4. Alternative model-number format search.
    5. Exact quoted MPN search: "{mpn}".
    6. Specialist retailer search.
    7. UPC search (if provided).
    """
    seen = set()

    def new(u: str) -> bool:
        if u and usable(u) and u not in seen:
            seen.add(u)
            return True
        return False

    # Primary MPN: prioritize MPN1, then MPN
    mpn = (row.get("primary_mpn") or row.get("mpn1") or row.get("mpn") or "").strip()
    mfr = (row.get("mfr") or "").strip()
    upc = (row.get("upc") or "").strip()

    # 1. Existing workbook URL (prioritized candidate, but allow searching for more)
    direct_url = (row.get("url") or "").strip()
    if direct_url.startswith("http") and new(direct_url):
        yield "EXISTING URL", direct_url

    if not mpn:
        return

    # 2. Manufacturer official site search
    m_domain = mfr_domain(mfr)
    if m_domain:
        for u in web_search(f'site:{m_domain} "{mpn}"', 3):
            if new(u):
                yield "MANUFACTURER", u
                if len(seen) >= max_total:
                    return

    # 3. Exact quoted MPN + Manufacturer
    has_mfr = bool(mfr and mfr.lower() not in ("unknown", "n/a", "none", ""))
    if has_mfr:
        for u in web_search(f'"{mfr}" "{mpn}"', 4):
            if new(u):
                yield "EXACT QUOTE", u
                if len(seen) >= max_total:
                    return

    # 4. Alternative model-number formats
    alts = get_alternative_mpns(mpn)
    for alt in alts:
        q = f'"{mfr}" "{alt}"' if has_mfr else f'"{alt}"'
        for u in web_search(q, 3):
            if new(u):
                yield "ALT FORMAT", u
                if len(seen) >= max_total:
                    return

    # 5. Exact quoted MPN alone
    for u in web_search(f'"{mpn}"', 3):
        if new(u):
            yield "WEB SEARCH", u
            if len(seen) >= max_total:
                return

    # 6. Specialist retailer search
    if has_mfr and len(seen) < 3:
        for u in web_search(f'"{mfr}" "{mpn}" (summitracing OR jegs OR autozone OR amazon)', 3):
            if new(u):
                yield "RETAILER", u
                if len(seen) >= max_total:
                    return

    # 7. UPC search
    if upc and len(seen) < 3:
        for u in web_search(f'"{upc}"', 2):
            if new(u):
                yield "UPC SEARCH", u
                if len(seen) >= max_total:
                    return
