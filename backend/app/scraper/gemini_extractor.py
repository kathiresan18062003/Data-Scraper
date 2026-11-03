"""Grounded Gemini extraction with page-content caching. Fills gaps deterministic parsing missed."""
import hashlib
import json
import logging
from pydantic import BaseModel, Field
from backend.app.config import GEMINI_API_KEY, GEMINI_MODEL, CACHE_DIR, is_gemini_available

logger = logging.getLogger(__name__)


class SpecificationItem(BaseModel):
    name: str
    value: str


class GeminiProductExtraction(BaseModel):
    product_title: str = ""
    mpn: str = ""
    manufacturer: str = ""
    image_urls: list[str] = Field(default_factory=list)
    overview: str = ""
    features: list[str] = Field(default_factory=list)
    specifications: list[SpecificationItem] = Field(default_factory=list)
    fitments: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    validation_notes: str = ""


PROMPT = (
    "Extract product data ONLY from the verified page text below. Never invent or assume outside knowledge.\n"
    "Copy values verbatim; do not normalize, infer, summarize, or add outside knowledge.\n"
    "Only extract specifications and features explicitly stated in the text.\n"
    "Leave fields empty and list them in missing_fields if absent.\n\n"
    "URL: {url}\n\n{text}"
)


def available() -> bool:
    return is_gemini_available()


def extract(url: str, text: str) -> dict | None:
    active_key = GEMINI_API_KEY
    if not active_key:
        return None

    cache_key = hashlib.sha256(f"{url}\0{GEMINI_MODEL}\0{text}".encode()).hexdigest()
    cache_file = CACHE_DIR / f"gemini_{cache_key}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=active_key)
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=PROMPT.format(url=url, text=text[:15000]),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiProductExtraction
            )
        )
        data = GeminiProductExtraction.model_validate_json(resp.text).model_dump()
        try:
            cache_file.write_text(json.dumps(data), encoding="utf-8")
        except Exception:
            pass
        return data
    except Exception as exc:
        err_msg = str(exc)
        if "429" in err_msg or "RESOURCE_EXHAUSTED" in err_msg:
            logger.warning("Gemini API quota exhausted (429 RESOURCE_EXHAUSTED). Falling back to deterministic data.")
        else:
            logger.warning(f"Gemini extraction failed: {err_msg}")
        return None


def _grounded_text(value: str, page_text: str) -> bool:
    normalized_value = " ".join((value or "").split()).casefold()
    normalized_page = " ".join((page_text or "").split()).casefold()
    return len(normalized_value) >= 2 and normalized_value in normalized_page


def _grounded_values(key: str, value, page_text: str):
    if key == "specifications":
        return [
            item for item in value or []
            if item.get("name") and item.get("value")
            and _grounded_text(item["name"], page_text)
            and _grounded_text(item["value"], page_text)
        ]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str) and _grounded_text(item, page_text)]
    if isinstance(value, str) and _grounded_text(value, page_text):
        return value
    return None


def merge(parsed: dict, gem: dict | None, page_text: str = "") -> tuple[dict, str]:
    """Keep deterministic values and use Gemini only for text grounded in the page."""
    if not gem:
        return parsed, "deterministic"
    out = dict(parsed)
    used_gemini = False
    for k in ("product_title", "mpn", "manufacturer", "overview", "features", "specifications", "fitments", "image_urls"):
        if not out.get(k) and gem.get(k):
            grounded_value = _grounded_values(k, gem[k], page_text)
            if grounded_value:
                out[k] = grounded_value
                used_gemini = True
    out["missing_fields"] = gem.get("missing_fields", [])
    method = "gemini_enhanced" if used_gemini else "deterministic"
    return out, method
