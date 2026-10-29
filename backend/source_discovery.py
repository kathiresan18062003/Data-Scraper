"""Root compatibility wrapper for source_discovery."""
from backend.app.scraper.source_discovery import (
    candidates,
    web_search,
    usable,
    mfr_domain,
    get_alternative_mpns,
    SKIP_DOMAINS,
)

__all__ = ["candidates", "web_search", "usable", "mfr_domain", "get_alternative_mpns", "SKIP_DOMAINS"]
