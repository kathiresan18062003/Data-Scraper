"""Vercel serverless entrypoint forwarding to FastAPI app."""
from backend.app.main import app

__all__ = ["app"]
