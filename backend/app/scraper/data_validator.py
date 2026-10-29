"""Identity validation: rigorous model number & manufacturer verification with variant detection."""
import re
from urllib.parse import urlparse
from backend.app.config import VALID_SCORE, LINE_CODES

NEG = re.compile(
    r"/(search|cart|checkout|login|account|category|categories|collections?)(/|\?|$)|[?&](q|s|search)=",
    re.I
)


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def strip_line_code(mpn: str) -> str:
    m = re.sub(r"^'", "", (mpn or "").strip())
    return m[3:] if m[:3].upper() in LINE_CODES and len(m) > 4 else m


def variants(mpn: str) -> tuple[str, str, str]:
    full = norm(mpn)
    line_stripped = norm(strip_line_code(mpn))
    no_punct = re.sub(r"[^a-z0-9]", "", full)
    return full, line_stripped, no_punct


def validate(
    mpn: str,
    manufacturer: str,
    url: str,
    parsed: dict,
    preferred_domains=(),
    mfr_domain=None
) -> dict:
    notes = []
    score = 0
    mpn_hit = False
    is_variant = False

    # 1. Reject PDF or document URLs immediately
    if url.lower().endswith(".pdf"):
        return {
            "score": 0,
            "confidence": "REJECTED",
            "is_valid": False,
            "is_variant": False,
            "notes": ["PDF document rejected (product pages only)"],
            "rejection_reason": "PDF document rejected",
        }

    full, stripped, no_punct = variants(mpn)
    slug = norm(url) + norm(parsed.get("product_title", ""))
    page_mpn_raw = (parsed.get("mpn") or "").strip()
    page_mpn = norm(page_mpn_raw)
    body = norm(parsed.get("text", ""))

    # 2. Reject search / category listing pages unless exact MPN is in the path
    if NEG.search(url) and full not in norm(urlparse(url).path):
        return {
            "score": 0,
            "confidence": "REJECTED",
            "is_valid": False,
            "is_variant": False,
            "notes": ["search/category/cart page rejected"],
            "rejection_reason": "Search or category listing page",
        }

    # 3. Model number / MPN verification
    if full and (page_mpn == full or full in slug):
        score += 40
        mpn_hit = True
        notes.append("exact MPN match")
    elif stripped and len(stripped) >= 4 and (page_mpn == stripped or stripped in slug):
        score += 35
        mpn_hit = True
        notes.append("line-code-stripped MPN match")
    elif no_punct and len(no_punct) >= 4 and (page_mpn == no_punct or no_punct in slug):
        score += 30
        mpn_hit = True
        notes.append("normalized MPN match")
    elif (full and full in body) or (len(stripped) >= 4 and stripped in body):
        score += 20
        mpn_hit = True
        notes.append("MPN in body text")

    # 4. Variant / Model mismatch detection
    if page_mpn and full:
        # Check if page MPN has an extra suffix indicating a different variant
        if page_mpn != full and page_mpn != stripped:
            if page_mpn.startswith(full) and len(page_mpn) > len(full):
                # E.g. requested 140-13303, page has 140-13303-BK or 140-13303-R
                is_variant = True
                score -= 25
                notes.append(f"variant mismatch: page has '{page_mpn_raw}' vs '{mpn}'")
            elif full not in page_mpn and stripped not in page_mpn:
                # Completely different model number
                score -= 45
                notes.append(f"different model number: '{page_mpn_raw}'")

    # 5. Manufacturer / Brand verification
    m = norm(manufacturer)
    page_mfr = norm(parsed.get("manufacturer", ""))
    if m and m not in ("unknown", "none", "na"):
        if m in page_mfr or m in slug:
            score += 20
            notes.append("brand match")
        elif page_mfr and m not in page_mfr and page_mfr not in m:
            score -= 20
            notes.append(f"brand mismatch: page brand '{parsed.get('manufacturer')}' vs '{manufacturer}'")

    # 6. Domain trust bonuses
    dom = urlparse(url).netloc.lower().removeprefix("www.")
    if preferred_domains and dom in preferred_domains:
        score += 15
        notes.append("preferred source domain")
    if mfr_domain and dom.endswith(mfr_domain):
        score += 15
        notes.append("official manufacturer domain")

    # 7. Final validity and confidence grading
    ok = mpn_hit and score >= VALID_SCORE and not (is_variant and score < 50)
    conf = "HIGH" if score >= 75 else "MEDIUM" if score >= 50 else "LOW" if score >= 35 else "REJECTED"

    rejection_reason = ""
    if not ok:
        if not mpn_hit:
            rejection_reason = "Model number / MPN not found on page"
        elif is_variant:
            rejection_reason = f"Page describes different variant ({page_mpn_raw})"
        else:
            rejection_reason = f"Verification score {score}/35: " + ", ".join(notes)

    return {
        "score": max(score, 0),
        "confidence": conf,
        "is_valid": ok,
        "is_variant": is_variant,
        "notes": notes,
        "rejection_reason": rejection_reason,
    }
