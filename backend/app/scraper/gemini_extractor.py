"""Gemini structured extraction with local MD5 caching. Fills gaps deterministic parser missed."""
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
    "Only extract specifications and features explicitly stated in the text.\n"
    "Leave fields empty and list them in missing_fields if absent.\n\n"
    "URL: {url}\n\n{text}"
)


def available(api_key: str | None = None) -> bool:
    if api_key and api_key.strip():
        return True
    return is_gemini_available()


def extract(url: str, text: str, api_key: str | None = None) -> dict | None:
    active_key = (api_key or "").strip() or GEMINI_API_KEY
    if not active_key:
        return None

    cache_key = hashlib.md5((url + GEMINI_MODEL + active_key[:8]).encode()).hexdigest()
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


def merge(parsed: dict, gem: dict | None) -> tuple[dict, str]:
    """Deterministic values win; Gemini only fills gaps."""
    if not gem:
        return parsed, "deterministic"
    out = dict(parsed)
    used_gemini = False
    for k in ("product_title", "mpn", "manufacturer", "overview"):
        if not out.get(k) and gem.get(k):
            out[k] = gem[k]
            used_gemini = True
    for k in ("image_urls", "features", "specifications", "fitments"):
        if not out.get(k) and gem.get(k):
            out[k] = gem[k]
            used_gemini = True
    out["missing_fields"] = gem.get("missing_fields", [])
    method = "gemini_enhanced" if used_gemini else "deterministic"
    return out, method
