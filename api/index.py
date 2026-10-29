"""Vercel serverless entrypoint forwarding to FastAPI app."""
import sys
from pathlib import Path

# Add project root to sys.path so backend package can always be found
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from backend.app.main import app

__all__ = ["app"]
