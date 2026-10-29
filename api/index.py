"""Vercel serverless entrypoint forwarding to FastAPI app."""
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

try:
    from backend.app.main import app
except Exception as e:
    err_tb = traceback.format_exc()
    logging.exception(f"Failed to import backend.app.main: {e}\n{err_tb}")
    try:
        from fastapi import FastAPI
        from fastapi.responses import JSONResponse

        app = FastAPI(title="Diagnostic Fallback")

        @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        def fallback(path_name: str):
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Backend import failed",
                    "detail": str(e),
                    "traceback": err_tb,
                    "sys_path": sys.path[:5],
                    "root_exists": root_dir.exists(),
                    "backend_exists": backend_dir.exists(),
                }
            )
    except Exception:
        # Fallback WSGI application in case FastAPI itself failed to import
        def app(environ, start_response):
            status = '500 Internal Server Error'
            response_headers = [('Content-Type', 'application/json')]
            start_response(status, response_headers)
            body = json.dumps({
                "error": "Critical backend initialization crash",
                "detail": str(e),
                "traceback": err_tb,
            })
            return [body.encode('utf-8')]
