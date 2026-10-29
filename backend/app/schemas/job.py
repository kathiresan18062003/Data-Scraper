from typing import Any, Optional
from pydantic import BaseModel, Field


class SpecificationItem(BaseModel):
    name: str
    value: str


class SheetInfo(BaseModel):
    name: str
    row_count: int
    column_count: int
    detected_columns: dict[str, Optional[str]]
    headers: list[str]
    preview_rows: list[list[Any]]


class UploadResponse(BaseModel):
    file_token: str
    original_filename: str
    sheets: list[SheetInfo]


class JobStartRequest(BaseModel):
    file_token: str
    sheet_name: str
    column_mapping: dict[str, str]
    limit: Optional[int] = Field(default=None, description="Max products to scrape")
    start_row: Optional[int] = Field(default=None, description="Optional start row index (1-based)")
    end_row: Optional[int] = Field(default=None, description="Optional end row index (1-based)")
    sno_start: Optional[int] = Field(default=None, description="Optional start S.No")
    sno_end: Optional[int] = Field(default=None, description="Optional end S.No")
    timeout: int = Field(default=20, ge=5, le=120)
    retries: int = Field(default=2, ge=0, le=5)
    use_gemini: bool = Field(default=True)
    gemini_api_key: Optional[str] = Field(default=None)
    save_every: int = Field(default=1, ge=1, le=100)


class JobResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    sheet_name: str
    status: str
    total_products: int
    processed_products: int
    successful_products: int
    review_products: int
    failed_products: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    completed_at: Optional[str] = None
    current_product_info: dict[str, Any] = Field(default_factory=dict)
    logs: list[str] = Field(default_factory=list)
    has_output: bool = False


class JobListResponse(BaseModel):
    jobs: list[JobResponse]


class ProductResultResponse(BaseModel):
    id: int
    job_id: str
    row_index: int
    mpn: str
    manufacturer: str
    title: str = ""
    product_name: str = ""
    status: str
    confidence: str
    tier: str
    score: int
    image_url: str = ""
    image_urls: list[str] = Field(default_factory=list)
    source_url: str = ""
    source_urls: list[str] = Field(default_factory=list)
    data_source_urls: list[str] = Field(default_factory=list)
    overview: str = ""
    features: list[str] = Field(default_factory=list)
    specifications: list[dict[str, Any]] = Field(default_factory=list)
    fitments: list[str] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    validation_notes: list[str] = Field(default_factory=list)
    rework_reason: str = ""
    google_search_url: str = ""
    extraction_method: str = "deterministic"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ProductResultsPage(BaseModel):
    items: list[ProductResultResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class DashboardStatsResponse(BaseModel):
    total_products: int
    completed_jobs: int
    pending_jobs: int
    running_jobs: int
    failed_jobs: int
    successful_products: int
    review_products: int
    failed_products: int
    recent_jobs: list[JobResponse]


class HealthResponse(BaseModel):
    status: str
    gemini_available: bool
    search_available: bool
    database_connected: bool
    version: str

