"""Gemini structured extraction (cached). Fills ONLY fields the parser missed."""
import hashlib, json
from pydantic import BaseModel, Field
from config import settings


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


PROMPT = ("Extract product data ONLY from the page text below. Never use outside knowledge. "
          "Leave fields empty and list them in missing_fields if absent.\n\nURL: {url}\n\n{text}")


def available():
    return bool(settings.GEMINI_API_KEY)


def extract(url, text):
    if not available():
        return None
    key = settings.CACHE_DIR / ("gemini_" + hashlib.md5((url + settings.GEMINI_MODEL).encode()).hexdigest() + ".json")
    if key.exists():
        return json.loads(key.read_text())
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL, contents=PROMPT.format(url=url, text=text[:15000]),
            config=types.GenerateContentConfig(response_mime_type="application/json",
                                               response_schema=GeminiProductExtraction))
        data = GeminiProductExtraction.model_validate_json(resp.text).model_dump()
        key.write_text(json.dumps(data))
        return data
    except Exception:
        return None


def merge(parsed, gem):
    """Deterministic values win; Gemini only fills gaps."""
    if not gem:
        return parsed
    out = dict(parsed)
    for k in ("product_title", "mpn", "manufacturer", "overview"):
        out[k] = parsed.get(k) or gem.get(k, "")
    for k in ("image_urls", "features", "specifications", "fitments"):
        out[k] = parsed.get(k) or gem.get(k, [])
    out["missing_fields"] = gem.get("missing_fields", [])
    return out
