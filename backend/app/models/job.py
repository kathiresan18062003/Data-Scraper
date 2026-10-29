import json
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    sheet_name = Column(String(100), nullable=False)
    file_path = Column(String(500), nullable=False)
    status = Column(String(50), default="PENDING", index=True)

    total_products = Column(Integer, default=0)
    processed_products = Column(Integer, default=0)
    successful_products = Column(Integer, default=0)
    review_products = Column(Integer, default=0)
    failed_products = Column(Integer, default=0)

    config = Column(Text, default="{}")
    column_mapping = Column(Text, default="{}")
    current_product_info = Column(Text, default="{}")
    logs = Column(Text, default="[]")

    output_scraped_path = Column(String(500), nullable=True)
    output_organized_path = Column(String(500), nullable=True)
    output_review_path = Column(String(500), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    results = relationship("ProductResult", back_populates="job", cascade="all, delete-orphan", order_by="ProductResult.row_index")

    def get_config(self) -> dict:
        try:
            return json.loads(self.config or "{}")
        except Exception:
            return {}

    def get_column_mapping(self) -> dict:
        try:
            return json.loads(self.column_mapping or "{}")
        except Exception:
            return {}

    def get_current_product_info(self) -> dict:
        try:
            return json.loads(self.current_product_info or "{}")
        except Exception:
            return {}

    def get_logs(self) -> list[str]:
        try:
            return json.loads(self.logs or "[]")
        except Exception:
            return []


class ProductResult(Base):
    __tablename__ = "product_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(String(36), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    row_index = Column(Integer, nullable=False, index=True)

    mpn = Column(String(100), nullable=False, index=True)
    manufacturer = Column(String(150), nullable=False, index=True)
    title = Column(String(300), default="")
    product_name = Column(String(300), default="")

    status = Column(String(50), default="PENDING", index=True)
    confidence = Column(String(50), default="REJECTED")
    tier = Column(String(100), default="MANUAL REVIEW")
    score = Column(Integer, default=0)

    image_url = Column(String(1000), default="")
    image_urls = Column(Text, default="[]")
    source_url = Column(String(1000), default="")
    source_urls = Column(Text, default="[]")
    data_source_urls = Column(Text, default="[]")

    overview = Column(Text, default="")
    features = Column(Text, default="[]")
    specifications = Column(Text, default="[]")
    fitments = Column(Text, default="[]")
    missing_fields = Column(Text, default="[]")
    validation_notes = Column(Text, default="[]")
    rework_reason = Column(Text, default="")
    google_search_url = Column(String(1000), default="")
    extraction_method = Column(String(50), default="deterministic")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    job = relationship("Job", back_populates="results")

    def to_dict(self) -> dict:
        def safe_json(val, default):
            if not val:
                return default
            try:
                return json.loads(val)
            except Exception:
                return default

        return {
            "id": self.id,
            "job_id": self.job_id,
            "row_index": self.row_index,
            "mpn": self.mpn,
            "manufacturer": self.manufacturer,
            "title": self.title,
            "product_name": self.product_name,
            "status": self.status,
            "confidence": self.confidence,
            "tier": self.tier,
            "score": self.score,
            "image_url": self.image_url,
            "image_urls": safe_json(self.image_urls, []),
            "source_url": self.source_url,
            "source_urls": safe_json(self.source_urls, []),
            "data_source_urls": safe_json(self.data_source_urls, []),
            "overview": self.overview,
            "features": safe_json(self.features, []),
            "specifications": safe_json(self.specifications, []),
            "fitments": safe_json(self.fitments, []),
            "missing_fields": safe_json(self.missing_fields, []),
            "validation_notes": safe_json(self.validation_notes, []),
            "rework_reason": self.rework_reason,
            "google_search_url": self.google_search_url,
            "extraction_method": self.extraction_method,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

