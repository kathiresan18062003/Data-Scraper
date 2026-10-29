@echo off
title Launch Fullstack App
cd /d "%~dp0"
echo Starting Backend and Frontend servers in separate windows...
start "Backend (FastAPI)" run_backend.bat
start "Frontend (React Vite)" run_frontend.bat
echo Both servers started!
