@echo off
title Backend Server (FastAPI)
cd /d "%~dp0"
echo ========================================================
echo Starting Backend Server on http://127.0.0.1:8001
echo ========================================================
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001
) else (
    python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001
)
pause

