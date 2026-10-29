# Lazy imports — sub-modules are imported on first use to avoid loading
# heavy native dependencies (requests, BeautifulSoup, ddgs) at cold-start time.

__all__ = ["scraper", "source_discovery", "data_validator", "gemini_extractor"]
