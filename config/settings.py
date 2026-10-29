import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
CACHE_DIR, OUTPUT_DIR = ROOT / ".cache", ROOT / "output"
for _d in (CACHE_DIR, OUTPUT_DIR):
    _d.mkdir(exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "20"))
DOMAIN_DELAY = float(os.getenv("DOMAIN_DELAY", "1.5"))
VALID_SCORE = 35

MANUFACTURER_DOMAINS = {"wilwood": "wilwood.com", "moroso": "moroso.com",
                        "let's go aero": "letsgoaero.com", "mopar": "mopar.com"}
LINE_CODES = {"WLD": "Wilwood", "MOR": "Moroso", "MEC": "Marshall Excelsior", "LGA": "Let's Go Aero"}
