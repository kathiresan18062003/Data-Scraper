"""Root compatibility wrapper for data_validator."""
from backend.app.scraper.data_validator import (
    validate,
    strip_line_code,
    variants,
    norm,
    LINE_CODES,
    VALID_SCORE,
)

__all__ = ["validate", "strip_line_code", "variants", "norm", "LINE_CODES", "VALID_SCORE"]
