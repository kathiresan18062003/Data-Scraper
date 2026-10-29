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
    env_db = os.getenv("DATABASE_URL", "")
    if env_db and not env_db.startswith("sqlite"):
        DATABASE_URL = env_db
    else:
        DATABASE_URL = "sqlite:////tmp/scraper.db"
else:
    env_db = os.getenv("DATABASE_URL", "")
    if env_db and env_db.startswith("sqlite:///"):
        raw_path = env_db[len("sqlite:///"):]
        if raw_path.startswith("./"):
            raw_path = raw_path[2:]
        path_obj = Path(raw_path)
        if not path_obj.is_absolute():
            path_obj = (ROOT / path_obj).resolve()
        path_obj.parent.mkdir(parents=True, exist_ok=True)
        DATABASE_URL = f"sqlite:///{path_obj.as_posix()}"
    elif env_db:
        DATABASE_URL = env_db
    else:
        db_file = (DATA_DIR / "scraper.db").resolve()
        db_file.parent.mkdir(parents=True, exist_ok=True)
        DATABASE_URL = f"sqlite:///{db_file.as_posix()}"

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
