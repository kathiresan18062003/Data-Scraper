from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.api.endpoints import router as api_router
from backend.app.config import ROOT, get_cors_origins
from backend.app.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables
    init_db()
    yield


app = FastAPI(
    title="Product Data Scraper Dashboard API",
    description="FastAPI Backend for Product Data Scraper with SQLite, incremental Excel saving, and Gemini extraction.",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
origins = get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router)

# Serve built React frontend if available
DIST_DIR = ROOT / "frontend" / "dist"
ASSETS_DIR = DIST_DIR / "assets"
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/")
def root():
    index_file = DIST_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {
        "message": "Product Data Scraper Dashboard API is running.",
        "docs_url": "/docs",
        "health_url": "/api/health",
        "dashboard_url": "/api/dashboard",
    }
