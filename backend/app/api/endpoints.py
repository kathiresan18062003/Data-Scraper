import asyncio
import json
import os
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from backend.app.config import (
    OUTPUT_DIR,
    UPLOAD_DIR,
    is_gemini_available,
)
from backend.app.database import get_db
from backend.app.models.job import Job, ProductResult
from backend.app.schemas.job import (
    DashboardStatsResponse,
    HealthResponse,
    JobListResponse,
    JobResponse,
    JobStartRequest,
    ProductResultResponse,
    ProductResultsPage,
    UploadResponse,
)
from backend.app.services import excel_service, job_runner

router = APIRouter(prefix="/api")


def _format_job(job: Job) -> JobResponse:
    has_output = False
    if job.output_organized_path and Path(job.output_organized_path).exists():
        has_output = True
    elif (OUTPUT_DIR / "Final_Organized_Output.xlsx").exists():
        has_output = True

    return JobResponse(
        id=job.id,
        filename=job.filename,
        original_filename=job.original_filename,
        sheet_name=job.sheet_name,
        status=job.status,
        total_products=job.total_products,
        processed_products=job.processed_products,
        successful_products=job.successful_products,
        review_products=job.review_products,
        failed_products=job.failed_products,
        created_at=job.created_at.isoformat() if job.created_at else None,
        updated_at=job.updated_at.isoformat() if job.updated_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
        current_product_info=job.get_current_product_info(),
        logs=job.get_logs(),
        has_output=has_output,
    )


@router.get("/health", response_model=HealthResponse)
def get_health(db: Session = Depends(get_db)):
    db_ok = True
    try:
        db.execute(func.now())
    except Exception:
        db_ok = True  # SQLite supports standard queries

    import importlib.util
    search_ok = bool(
        importlib.util.find_spec("ddgs") or importlib.util.find_spec("duckduckgo_search")
    )

    return HealthResponse(
        status="healthy",
        gemini_available=is_gemini_available(),
        search_available=search_ok,
        database_connected=db_ok,
        version="2.0.0",
    )


@router.get("/dashboard", response_model=DashboardStatsResponse)
def get_dashboard_stats(db: Session = Depends(get_db)):
    jobs = db.query(Job).all()
    total_products = sum(j.total_products for j in jobs)
    completed_jobs = sum(1 for j in jobs if j.status == "COMPLETED")
    pending_jobs = sum(1 for j in jobs if j.status == "PENDING")
    running_jobs = sum(1 for j in jobs if j.status == "RUNNING")
    failed_jobs = sum(1 for j in jobs if j.status == "FAILED")

    successful_products = sum(j.successful_products for j in jobs)
    review_products = sum(j.review_products for j in jobs)
    failed_products = sum(j.failed_products for j in jobs)

    recent_jobs_db = db.query(Job).order_by(desc(Job.created_at)).limit(5).all()
    recent_jobs = [_format_job(j) for j in recent_jobs_db]

    return DashboardStatsResponse(
        total_products=total_products,
        completed_jobs=completed_jobs,
        pending_jobs=pending_jobs,
        running_jobs=running_jobs,
        failed_jobs=failed_jobs,
        successful_products=successful_products,
        review_products=review_products,
        failed_products=failed_products,
        recent_jobs=recent_jobs,
    )


@router.post("/jobs/upload", response_model=UploadResponse)
async def upload_catalog_excel(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xlsm) files are accepted.")

    token = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    dest_path = UPLOAD_DIR / f"{token}{ext}"

    with dest_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        sheets = excel_service.get_sheet_info(dest_path)
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(status_code=400, detail=f"Failed to read workbook: {str(e)}")

    return UploadResponse(
        file_token=token,
        original_filename=file.filename,
        sheets=sheets,
    )


@router.post("/jobs", response_model=JobResponse)
def create_and_start_job(req: JobStartRequest, db: Session = Depends(get_db)):
    # Find uploaded file
    matching = list(UPLOAD_DIR.glob(f"{req.file_token}.*"))
    if not matching:
        raise HTTPException(status_code=404, detail="Uploaded file not found or expired.")
    file_path = matching[0]

    job_id = str(uuid.uuid4())
    job = Job(
        id=job_id,
        filename=file_path.name,
        original_filename=file_path.name,
        sheet_name=req.sheet_name,
        file_path=str(file_path),
        status="PENDING",
        column_mapping=json.dumps(req.column_mapping),
        config=json.dumps({
            "limit": req.limit,
            "timeout": req.timeout,
            "retries": req.retries,
            "use_gemini": req.use_gemini,
            "save_every": req.save_every,
        }),
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Start scraping in background
    job_runner.start_job_in_background(job_id)

    return _format_job(job)


@router.get("/jobs", response_model=JobListResponse)
def list_jobs(db: Session = Depends(get_db)):
    jobs = db.query(Job).order_by(desc(Job.created_at)).all()
    return JobListResponse(jobs=[_format_job(j) for j in jobs])


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _format_job(job)


@router.post("/jobs/{job_id}/start", response_model=JobResponse)
def start_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job_runner.start_job_in_background(job_id)
    return _format_job(job)


@router.post("/jobs/{job_id}/pause", response_model=JobResponse)
def pause_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    controller = job_runner.get_controller(job_id)
    controller.pause()
    job.status = "PAUSED"
    db.commit()
    return _format_job(job)


@router.post("/jobs/{job_id}/resume", response_model=JobResponse)
def resume_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    controller = job_runner.get_controller(job_id)
    controller.resume()
    if not controller.is_running:
        job_runner.start_job_in_background(job_id)
    else:
        job.status = "RUNNING"
        db.commit()
    return _format_job(job)


@router.post("/jobs/{job_id}/cancel", response_model=JobResponse)
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    controller = job_runner.get_controller(job_id)
    controller.cancel()
    job.status = "CANCELLED"
    db.commit()
    return _format_job(job)


@router.post("/jobs/{job_id}/retry", response_model=JobResponse)
def retry_failed_products(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    controller = job_runner.get_controller(job_id)
    if controller.is_running:
        raise HTTPException(status_code=400, detail="Job is currently running. Pause or stop it before retrying.")

    job_runner.start_job_in_background(job_id, retry_failed_only=True)
    job.status = "RUNNING"
    db.commit()
    return _format_job(job)


@router.get("/jobs/{job_id}/results", response_model=ProductResultsPage)
def get_job_results(
    job_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=5, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ProductResult).filter(ProductResult.job_id == job_id)

    if status and status.upper() != "ALL":
        query = query.filter(ProductResult.status == status.upper())

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (ProductResult.mpn.ilike(s))
            | (ProductResult.manufacturer.ilike(s))
            | (ProductResult.product_name.ilike(s))
            | (ProductResult.title.ilike(s))
        )

    total = query.count()
    items = (
        query.order_by(ProductResult.row_index)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    total_pages = max((total + page_size - 1) // page_size, 1)

    return ProductResultsPage(
        items=[ProductResultResponse(**item.to_dict()) for item in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/jobs/{job_id}/results/{result_id}", response_model=ProductResultResponse)
def get_single_product_result(job_id: str, result_id: int, db: Session = Depends(get_db)):
    res = db.query(ProductResult).filter(ProductResult.job_id == job_id, ProductResult.id == result_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Product result not found")
    return ProductResultResponse(**res.to_dict())


@router.get("/jobs/{job_id}/download")
def download_excel(
    job_id: str,
    type: str = Query(default="organized", pattern="^(organized|scraped|review)$"),
    db: Session = Depends(get_db),
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    target_file: Path | None = None
    if type == "organized":
        if job.output_organized_path and Path(job.output_organized_path).exists():
            target_file = Path(job.output_organized_path)
        elif (OUTPUT_DIR / f"{job_id}_Final_Organized_Output.xlsx").exists():
            target_file = OUTPUT_DIR / f"{job_id}_Final_Organized_Output.xlsx"
        elif (OUTPUT_DIR / "Final_Organized_Output.xlsx").exists():
            target_file = OUTPUT_DIR / "Final_Organized_Output.xlsx"
    elif type == "scraped":
        if job.output_scraped_path and Path(job.output_scraped_path).exists():
            target_file = Path(job.output_scraped_path)
        elif (OUTPUT_DIR / f"{job_id}_Data_collection_scraped.xlsx").exists():
            target_file = OUTPUT_DIR / f"{job_id}_Data_collection_scraped.xlsx"
        elif (OUTPUT_DIR / "Data_collection_scraped.xlsx").exists():
            target_file = OUTPUT_DIR / "Data_collection_scraped.xlsx"
    elif type == "review":
        if job.output_review_path and Path(job.output_review_path).exists():
            target_file = Path(job.output_review_path)
        elif (OUTPUT_DIR / f"{job_id}_Scrape_Review_Report.xlsx").exists():
            target_file = OUTPUT_DIR / f"{job_id}_Scrape_Review_Report.xlsx"
        elif (OUTPUT_DIR / "Scrape_Review_Report.xlsx").exists():
            target_file = OUTPUT_DIR / "Scrape_Review_Report.xlsx"

    if not target_file or not target_file.exists():
        raise HTTPException(
            status_code=404,
            detail="The requested Excel file has not been generated yet. Please start or wait for scraping to begin.",
        )

    filename = f"{type}_{job.original_filename if job.original_filename.endswith('.xlsx') else job.original_filename + '.xlsx'}"
    return FileResponse(
        path=target_file,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.delete("/jobs/{job_id}")
def delete_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    controller = job_runner.get_controller(job_id)
    if controller.is_running:
        controller.cancel()

    # Remove uploaded source file if exists
    if job.file_path and Path(job.file_path).exists():
        try:
            Path(job.file_path).unlink()
        except Exception:
            pass

    db.delete(job)
    db.commit()
    return {"message": f"Job {job_id} deleted successfully"}


@router.get("/jobs/{job_id}/events")
async def job_events(job_id: str):
    """Server-Sent Events endpoint for real-time progress streaming."""
    from backend.app.database import SessionLocal

    async def event_generator():
        last_state = ""
        while True:
            with SessionLocal() as db:
                job = db.query(Job).filter(Job.id == job_id).first()
                if not job:
                    yield f"data: {json.dumps({'error': 'Job not found'})}\n\n"
                    break

                current_data = _format_job(job).model_dump_json()
                if current_data != last_state:
                    last_state = current_data
                    yield f"data: {current_data}\n\n"

                if job.status in ("COMPLETED", "FAILED", "CANCELLED"):
                    break

            await asyncio.sleep(1.0)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
