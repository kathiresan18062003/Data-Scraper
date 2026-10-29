"""Gemini structured extraction with local MD5 caching. Fills gaps deterministic parser missed."""
import hashlib
import json
from pydantic import BaseModel, Field
from backend.app.config import GEMINI_API_KEY, GEMINI_MODEL, CACHE_DIR, is_gemini_available


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


def available() -> bool:
    return is_gemini_available()


def extract(url: str, text: str) -> dict | None:
    if not available():
        return None
    cache_file = CACHE_DIR / ("gemini_" + hashlib.md5((url + GEMINI_MODEL).encode()).hexdigest() + ".json")
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=GEMINI_API_KEY)
        resp = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=PROMPT.format(url=url, text=text[:15000]),
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=GeminiProductExtraction
            )
        )
        data = GeminiProductExtraction.model_validate_json(resp.text).model_dump()
        cache_file.write_text(json.dumps(data), encoding="utf-8")
        return data
    except Exception:
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

