# Product Data Scraper Dashboard

Modern enterprise-grade web application for automated product data scraping and e-commerce catalog enrichment, built with **React, TypeScript, Vite, and Tailwind CSS** for the frontend, and **Python, FastAPI, and SQLite** for the backend.

---

## Architecture Overview

```text
product_data_scraper_dashboard/
├── frontend/                     # React + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/           # Navbar, MetricsCards, ActiveJobCard, ResultsTable, etc.
│   │   ├── pages/                # DashboardPage, UploadPage, JobsPage, ResultsPage, SettingsPage
│   │   ├── services/             # api.ts (REST client with type safety)
│   │   ├── hooks/                # useJobProgress.ts (Live polling & job controls)
│   │   ├── types/                # TypeScript interfaces (Job, ProductResult, etc.)
│   │   ├── App.tsx               # Root tab navigation
│   │   └── main.tsx              # React DOM entrypoint
│   ├── package.json
│   ├── vite.config.ts            # Proxy configured for /api -> 127.0.0.1:8001
│   ├── tailwind.config.js
│   └── index.html
├── backend/                      # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                  # REST endpoints (health, upload, jobs, results, download)
│   │   ├── models/               # SQLAlchemy models (Job, ProductResult)
│   │   ├── schemas/              # Pydantic schemas for request/response validation
│   │   ├── services/             # excel_service.py (atomic OpenPyXL), job_runner.py (threading)
│   │   ├── scraper/              # scraper.py, source_discovery.py, data_validator.py, gemini_extractor.py
│   │   ├── database.py           # SQLite connection & table initialization
│   │   ├── config.py             # App settings, paths, environment loader
│   │   └── main.py               # FastAPI application factory
│   ├── main.py                   # Shim supporting uvicorn backend.main:app
│   ├── requirements.txt          # Python dependencies
│   └── .env.example              # Environment template
├── data/                         # SQLite database (data/scraper.db) and uploads
├── output/                       # Output Excel reports (.xlsx)
├── tests/                        # FastAPI & scraping tests (pytest)
├── .env.example
├── .gitignore
└── README.md
```

---

## Key Features

1. **Deterministic HTML + AI Hybrid Extraction Engine:**
   - Multi-tier search: checks existing Excel URLs, manufacturer domains, and DuckDuckGo search queries.
   - Extracts Schema.org JSON-LD, OpenGraph images, meta descriptions, specification tables, and bullet features deterministically.
   - Optional Google Gemini AI synthesis fills missing specifications and overviews without hallucinating unverified links or specs.
   - Rigorous identity validation scoring (minimum 35 points with MPN signals) prevents false-positive product matches.

2. **Persistent Jobs & Asynchronous Background Runner:**
   - Long-running jobs run non-blocking in background threads with pause, resume, cancel, and retry failed products controls.
   - Full persistence in SQLite database (`data/scraper.db`).

3. **Simultaneous Incremental Excel Saving:**
   - Automatically initializes and updates three Excel files incrementally as scraping runs:
     1. `Final_Organized_Output.xlsx`: Formatted, styled table with hyperlinks and status colors.
     2. `Data_collection_scraped.xlsx`: In-place enrichment of the original uploaded catalog sheet.
     3. `Scrape_Review_Report.xlsx`: Comprehensive audit report with failure reasons and Google search fallback links.

4. **Modern React Dashboard UI:**
   - Real-time progress bar with live active product stage and URL monitor.
   - Searchable, filterable, and paginated results table.
   - Comprehensive product inspection modal showing images, confidence scores, specifications, and evidence.
   - One-click downloads for all generated Excel workbooks.

---

## Prerequisites

- **Python:** 3.11+
- **Node.js:** 18+ or 20+ LTS

---

## Installation & Setup (PowerShell)

### 1. Environment Configuration

Copy `.env.example` to `.env` in the project root:

```powershell
Copy-Item .env.example .env
```

Edit `.env` to configure your Gemini API Key and settings:

```ini
GEMINI_API_KEY="your_actual_gemini_api_key_here"
GEMINI_MODEL=gemini-2.5-flash
REQUEST_TIMEOUT=20
DOMAIN_DELAY=1.5
VALID_SCORE=35
DATABASE_URL=sqlite:///./data/scraper.db
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

---

### 2. Backend Installation

From the project root directory:

```powershell
cd "C:\Users\Velmurugan T\Downloads\product_data_scraper_dashboard"
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

---

### 3. Frontend Installation

From the `frontend` directory:

```powershell
cd "C:\Users\Velmurugan T\Downloads\product_data_scraper_dashboard\frontend"
npm install
```

---

## Running the Application

The application is designed to run with two separate development servers:

### Terminal 1: Backend Startup

From the project root directory:

```powershell
cd "C:\Users\Velmurugan T\Downloads\product_data_scraper_dashboard"
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8001
```

*(Note: `.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8001` also works seamlessly).*

- **Backend API:** `http://127.0.0.1:8001`
- **Interactive Swagger Docs:** `http://127.0.0.1:8001/docs`
- **Health Check:** `http://127.0.0.1:8001/api/health`

---

### Terminal 2: Frontend Startup

In a second PowerShell terminal:

```powershell
cd "C:\Users\Velmurugan T\Downloads\product_data_scraper_dashboard\frontend"
npm run dev
```

- **Frontend Dashboard:** `http://127.0.0.1:5173`

---

## Running Automated Tests

Run the full automated test suite (API endpoints + extraction & Excel persistence logic):

```powershell
cd "C:\Users\Velmurugan T\Downloads\product_data_scraper_dashboard"
.\.venv\Scripts\python.exe -m pytest tests/test_api.py test_smoke.py -v
```

All 21 unit and integration tests will execute.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend readiness, database status, Gemini API status |
| `GET` | `/api/dashboard` | Aggregated metrics, total products, recent jobs |
| `POST` | `/api/jobs/upload` | Upload `.xlsx` catalog, parse sheets & headers |
| `POST` | `/api/jobs` | Create and start a background scraping job |
| `GET` | `/api/jobs` | List all historical scraping jobs |
| `GET` | `/api/jobs/{job_id}` | Detailed job status, progress, and logs |
| `POST` | `/api/jobs/{job_id}/start` | Start an unstarted job |
| `POST` | `/api/jobs/{job_id}/pause` | Pause a running scraping job |
| `POST` | `/api/jobs/{job_id}/resume` | Resume a paused scraping job |
| `POST` | `/api/jobs/{job_id}/cancel` | Cancel a running scraping job |
| `POST` | `/api/jobs/{job_id}/retry` | Retry failed products in a completed/interrupted job |
| `GET` | `/api/jobs/{job_id}/results` | Paginated product results (supports search & status filters) |
| `GET` | `/api/jobs/{job_id}/results/{result_id}` | Detailed product view with specs & evidence |
| `GET` | `/api/jobs/{job_id}/download` | Download Excel output (`type=organized`, `scraped`, `review`) |
| `GET` | `/api/jobs/{job_id}/events` | Server-Sent Events (SSE) for live streaming progress |

