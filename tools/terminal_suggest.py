"""Terminal Suggestion Tool for Product Data Scraper Dashboard.

Usage:
    python tools/terminal_suggest.py backend
    python tools/terminal_suggest.py frontend
    python tools/terminal_suggest.py both
    python tools/terminal_suggest.py git
    python tools/terminal_suggest.py status
"""

import sys
import socket
from pathlib import Path

# Ensure UTF-8 output on Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent.parent

# ANSI Colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
BOLD = "\033[1m"
RESET = "\033[0m"


def check_port(host: str, port: int) -> bool:
    try:
        with socket.create_connection((host, port), timeout=0.8):
            return True
    except OSError:
        return False


def print_header(title: str):
    print(f"\n{BOLD}{CYAN}=== {title} ==={RESET}\n")


def print_section(heading: str, cmd: str, note: str = ""):
    print(f"{YELLOW}> {heading}:{RESET}")
    print(f"  {GREEN}{cmd}{RESET}")
    if note:
        print(f"  {BLUE}  [Note: {note}]{RESET}")
    print()


def show_backend():
    print_header("BACKEND TERMINAL COMMANDS (FastAPI + Uvicorn)")
    is_live = check_port("127.0.0.1", 8001)
    status_str = f"{GREEN}[RUNNING - Port 8001]{RESET}" if is_live else f"{YELLOW}[STOPPED - Port 8001]{RESET}"
    print(f"Backend Status: {status_str}\n")

    print_section(
        "Run Backend Server (with auto-reload)",
        r".\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001",
        "Starts FastAPI server at http://127.0.0.1:8001"
    )

    print_section(
        "Check Backend Health Endpoint",
        r"curl http://127.0.0.1:8001/api/health",
        "Returns JSON status, database connectivity, and Gemini status"
    )

    print_section(
        "Run Full Test Suite (21 tests)",
        r".\.venv\Scripts\python.exe -m pytest",
        "Executes all unit tests in tests/test_api.py and test_smoke.py"
    )

    print_section(
        "Open Interactive API Docs (Swagger UI)",
        r"Start-Process 'http://127.0.0.1:8001/docs'",
        "Opens Swagger documentation in default web browser"
    )


def show_frontend():
    print_header("FRONTEND TERMINAL COMMANDS (React + Vite + Tailwind)")
    is_live = check_port("127.0.0.1", 5173)
    status_str = f"{GREEN}[RUNNING - Port 5173]{RESET}" if is_live else f"{YELLOW}[STOPPED - Port 5173]{RESET}"
    print(f"Frontend Status: {status_str}\n")

    print_section(
        "Run Frontend Dev Server (PowerShell)",
        r'$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;" + $env:PATH; cd frontend; npm run dev -- --host 127.0.0.1 --port 5173',
        "Serves React dashboard at http://127.0.0.1:5173"
    )

    print_section(
        "Build Frontend for Production",
        r'$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;" + $env:PATH; cd frontend; npm run build',
        "Compiles TypeScript and outputs production bundle to frontend/dist/"
    )

    print_section(
        "Install Frontend Package",
        r'$env:PATH = "$env:LOCALAPPDATA\Programs\nodejs;" + $env:PATH; cd frontend; npm install <package-name>',
        "Adds dependency to frontend/package.json"
    )


def show_both():
    print_header("RUN BOTH BACKEND & FRONTEND TOGETHER")
    b_live = check_port("127.0.0.1", 8001)
    f_live = check_port("127.0.0.1", 5173)

    print(f"Backend  (127.0.0.1:8001): {GREEN + '[RUNNING]' if b_live else YELLOW + '[STOPPED]'}{RESET}")
    print(f"Frontend (127.0.0.1:5173): {GREEN + '[RUNNING]' if f_live else YELLOW + '[STOPPED]'}{RESET}\n")

    print_section(
        "Launch Both in Separate Windows (PowerShell one-liner)",
        (
            'Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd \'$PWD\'; .\\.venv\\Scripts\\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001"; '
            'Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd \'$PWD\\frontend\'; `$env:PATH = \'`$env:LOCALAPPDATA\\Programs\\nodejs;\' + `$env:PATH; npm run dev -- --host 127.0.0.1 --port 5173"'
        ),
        "Opens two persistent PowerShell terminal tabs/windows, one for backend, one for frontend"
    )

    print_section(
        "Open App in Browser",
        r"Start-Process 'http://127.0.0.1:5173'",
        "Opens fullstack Product Data Scraper Dashboard in browser"
    )


def show_git():
    print_header("GIT & VERCEL DEPLOYMENT COMMANDS")

    print_section(
        "Check Repository Status",
        r'& "C:\Program Files\Git\cmd\git.exe" status',
        "Shows staged, unstaged, and untracked files"
    )

    print_section(
        "Stage and Commit Changes",
        r'& "C:\Program Files\Git\cmd\git.exe" add . ; & "C:\Program Files\Git\cmd\git.exe" commit -m "Your commit message"',
        "Prepares changes for GitHub"
    )

    print_section(
        "Push to GitHub & Auto-Deploy to Vercel",
        r'& "C:\Program Files\Git\cmd\git.exe" push -u origin main',
        "Pushes to https://github.com/kathiresan18062003/Data-Scraper.git and triggers Vercel CI/CD"
    )

    print_section(
        "Vercel Dashboard URL",
        r"https://vercel.com/kathiresan-m1/data-scraper",
        "View live build logs, functions, and deployment domains"
    )


def show_status():
    print_header("FULLSTACK STATUS CHECK")
    b_live = check_port("127.0.0.1", 8001)
    f_live = check_port("127.0.0.1", 5173)

    print(f"Backend Server  (http://127.0.0.1:8001): {GREEN + '[ONLINE]' if b_live else YELLOW + '[OFFLINE]'}{RESET}")
    print(f"Frontend Server (http://127.0.0.1:5173): {GREEN + '[ONLINE]' if f_live else YELLOW + '[OFFLINE]'}{RESET}")
    print()


def show_help():
    print_header("TERMINAL SUGGEST HELPER")
    print("Available commands:")
    print(f"  {GREEN}python tools/terminal_suggest.py backend{RESET}   - Show backend start & test commands")
    print(f"  {GREEN}python tools/terminal_suggest.py frontend{RESET}  - Show frontend start & build commands")
    print(f"  {GREEN}python tools/terminal_suggest.py both{RESET}      - Show one-liner to run both services")
    print(f"  {GREEN}python tools/terminal_suggest.py git{RESET}       - Show Git staging, commit & Vercel deploy commands")
    print(f"  {GREEN}python tools/terminal_suggest.py status{RESET}    - Check port 8001 and 5173 live status\n")


def main():
    target = sys.argv[1].lower() if len(sys.argv) > 1 else "help"

    if target in ("backend", "api", "server"):
        show_backend()
    elif target in ("frontend", "ui", "client"):
        show_frontend()
    elif target in ("both", "all", "fullstack"):
        show_both()
    elif target in ("git", "deploy", "vercel"):
        show_git()
    elif target in ("status", "check"):
        show_status()
    else:
        show_help()


if __name__ == "__main__":
    main()
