import os
from pathlib import Path
from dotenv import load_dotenv

# Project root directory: product_data_scraper_dashboard
ROOT = Path(__file__).resolve().parent.parent.parent

# Load .env file
load_dotenv(ROOT / ".env")

# Detect Vercel serverless environment (read-only filesystem except /tmp)
def _detect_serverless() -> bool:
    if os.getenv("VERCEL") or os.getenv("VERCEL_ENV") or os.getenv("AWS_LAMBDA_FUNCTION_NAME") or os.getenv("LAMBDA_TASK_ROOT"):
        return True
    try:
        test_file = ROOT / ".probe_write"
        test_file.touch()
        test_file.unlink()
        return False
    except Exception:
        return True

IS_VERCEL = _detect_serverless()

# Directories
if IS_VERCEL:
    DATA_DIR = Path("/tmp/data")
    OUTPUT_DIR = Path("/tmp/output")
    CACHE_DIR = Path("/tmp/cache")
else:
    DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT / "data")))
    OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", str(ROOT / "output")))
    CACHE_DIR = ROOT / ".cache"

UPLOAD_DIR = DATA_DIR / "uploads"

for _d in (DATA_DIR, UPLOAD_DIR, OUTPUT_DIR, CACHE_DIR):
    try:
        _d.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

# Database
if IS_VERCEL:
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:////tmp/scraper.db")
else:
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'scraper.db'}")

# Scraping & AI settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "20"))
DOMAIN_DELAY = float(os.getenv("DOMAIN_DELAY", "1.5"))
VALID_SCORE = int(os.getenv("VALID_SCORE", "35"))

# CORS settings
FRONTEND_ORIGIN = os.getenv(
    "FRONTEND_ORIGIN",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
)

# Known domain rules & line codes
MANUFACTURER_DOMAINS = {
    "wilwood": "wilwood.com",
    "moroso": "moroso.com",
    "let's go aero": "letsgoaero.com",
    "mopar": "mopar.com"
}
LINE_CODES = {
    "WLD": "Wilwood",
    "MOR": "Moroso",
    "MEC": "Marshall Excelsior",
    "LGA": "Let's Go Aero"
}


def is_gemini_available() -> bool:
    return bool(GEMINI_API_KEY and GEMINI_API_KEY.strip())


def get_cors_origins() -> list[str]:
    return [orig.strip() for orig in FRONTEND_ORIGIN.split(",") if orig.strip()]
