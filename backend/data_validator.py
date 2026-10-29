"""Identity validation: score >= 35 with at least one MPN signal."""
import re
from urllib.parse import urlparse
from config import settings

NEG = re.compile(r"/(search|cart|checkout|login|account|category|categories|collections?)(/|\?|$)|[?&](q|s|search)=", re.I)


def norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def strip_line_code(mpn):
    m = re.sub(r"^'", "", (mpn or "").strip())
    return m[3:] if m[:3].upper() in settings.LINE_CODES and len(m) > 4 else m


def variants(mpn):
    return norm(mpn), norm(strip_line_code(mpn))


def validate(mpn, manufacturer, url, parsed, preferred_domains=(), mfr_domain=None):
    full, stripped = variants(mpn)
    slug = norm(url) + norm(parsed.get("product_title", ""))
    page_mpn, body = norm(parsed.get("mpn")), norm(parsed.get("text", ""))
    score, notes, mpn_hit = 0, [], False
    if NEG.search(url) and full not in norm(urlparse(url).path):
        return {"score": 0, "confidence": "REJECTED", "is_valid": False, "notes": ["search/category/cart page"]}
    if full and (page_mpn == full or full in slug):
        score, mpn_hit = score + 40, True; notes.append("exact MPN match")
    elif stripped and len(stripped) >= 4 and (page_mpn == stripped or stripped in slug):
        score, mpn_hit = score + 35, True; notes.append("line-code-stripped MPN match")
    elif (full and full in body) or (len(stripped) >= 4 and stripped in body):
        score, mpn_hit = score + 20, True; notes.append("MPN in body text")
    if page_mpn and page_mpn not in (full, stripped) and full not in page_mpn and stripped not in page_mpn:
        score -= 40; notes.append(f"page MPN differs: {parsed.get('mpn')}")
    m = norm(manufacturer)
    if m and (m in norm(parsed.get("manufacturer")) or m in slug):
        score += 20; notes.append("brand match")
    dom = urlparse(url).netloc.lower().removeprefix("www.")
    if dom in preferred_domains:
        score += 15; notes.append("preferred source")
    if mfr_domain and dom.endswith(mfr_domain):
        score += 15; notes.append("manufacturer domain")
    ok = mpn_hit and score >= settings.VALID_SCORE
    conf = "HIGH" if score >= 75 else "MEDIUM" if score >= 50 else "LOW" if score >= 35 else "REJECTED"
    return {"score": score, "confidence": conf, "is_valid": ok, "notes": notes}
