"""Entrypoint shim for uvicorn backend.main:app and backend.app.main:app."""
from backend.app.main import app

__all__ = ["app"]

