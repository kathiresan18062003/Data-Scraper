@echo off
title Frontend Dev Server (React + Vite)
cd /d "%~dp0frontend"
set PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%
echo ========================================================
echo Starting Frontend Dev Server on http://127.0.0.1:5173
echo ========================================================
npm run dev -- --host 127.0.0.1 --port 5173
pause

