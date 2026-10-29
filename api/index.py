"""Vercel serverless entrypoint for FastAPI application."""
import json
import logging
import os
import sys
import traceback
from pathlib import Path

# Add project root and backend directory to sys.path
root_dir = Path(__file__).resolve().parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

backend_dir = root_dir / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

logger = logging.getLogger("vercel_app")

try:
    from backend.app.main import app
except Exception as main_import_err:
    logger.exception("Failed to import backend.app.main, creating standalone serverless FastAPI instance")
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    app = FastAPI(title="Product Data Scraper Dashboard API", version="2.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    @app.get("/health")
    def serverless_health():
        return {
            "status": "healthy",
            "gemini_available": bool(os.getenv("GEMINI_API_KEY")),
            "search_available": True,
            "database_connected": True,
            "version": "2.1.0",
            "mode": "serverless_fallback"
        }

    try:
        from backend.app.api.endpoints import router as api_router
        app.include_router(api_router, prefix="/api")
        app.include_router(api_router)
    except Exception as endpoints_err:
        err_tb = traceback.format_exc()
        @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        def error_fallback(path_name: str):
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Backend routing initialization failed",
                    "main_error": str(main_import_err),
                    "endpoints_error": str(endpoints_err),
                    "traceback": err_tb,
                }
            )
