import io
import json
from types import SimpleNamespace

import openpyxl
from fastapi.testclient import TestClient

from backend.app.api import endpoints
from backend.main import app
from backend.app.scraper import gemini_extractor
from backend.app.scraper.data_validator import validate
from backend.app.scraper.scraper import parse
from backend.app.services import excel_service
from backend.app.services import job_runner
from backend.app.services.job_runner import _evidence_snippet


def test_scraped_export_preserves_original_cells_and_appends_namespaced_columns(tmp_path, monkeypatch):
    monkeypatch.setattr(excel_service, "OUTPUT_DIR", tmp_path / "output")
    source = tmp_path / "catalog.xlsx"
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    worksheet.title = "Catalog"
    worksheet.append(["MPN", "Manufacturer", "Overview", "Source 1", "Completed", "Scraped - Overview"])
    worksheet.append(["PART-1", "Acme", "Catalog overview", "Catalog source", "Original", "User-owned data"])
    workbook.save(source)

    rows = [{"row": 2, "mpn": "PART-1", "mfr": "Acme"}]
    results = {
        2: {
            "status": "SUCCESS",
            "overview": "Page overview",
            "sources": ["https://acme.example/products/part-1"],
            "field_evidence": {
                "overview": {
                    "source_url": "https://acme.example/products/part-1",
                    "extraction_method": "deterministic",
                    "snippet": "Page overview",
                }
            },
        }
    }

    outputs = excel_service.export_all(source, "Catalog", rows, results, job_id="job-1")

    original = openpyxl.load_workbook(source)["Catalog"]
    assert [original.cell(2, col).value for col in range(1, 7)] == [
        "PART-1", "Acme", "Catalog overview", "Catalog source", "Original", "User-owned data"
    ]

    exported = openpyxl.load_workbook(outputs["scraped"])["Catalog"]
    headers = [cell.value for cell in exported[1]]
    assert exported.cell(2, headers.index("Overview") + 1).value == "Catalog overview"
    assert exported.cell(2, headers.index("Source 1") + 1).value == "Catalog source"
    assert exported.cell(2, headers.index("Completed") + 1).value == "Original"
    assert exported.cell(2, headers.index("Scraped - Overview") + 1).value == "User-owned data"
    assert exported.cell(2, headers.index("Scraped - Overview (2)") + 1).value == "Page overview"
    assert json.loads(exported.cell(2, headers.index("Scraped - Field Evidence") + 1).value) == results[2]["field_evidence"]


def test_second_row_headers_are_not_processed_as_product_data():
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    worksheet.append(["Catalog title"])
    worksheet.append(["MPN", "Manufacturer"])
    worksheet.append(["PART-1", "Acme"])

    rows = excel_service.read_rows(worksheet, {"mpn": "mpn", "mfr": "manufacturer"})

    assert rows == [
        {
            "row": 3,
            "sno": "2",
            "mpn": "PART-1",
            "mpn1": "",
            "base_mpn": "PART-1",
            "mfr": "Acme",
            "title": "",
            "upc": "",
            "url": "",
        }
    ]


def test_gtin_check_digit_validation():
    assert excel_service.valid_gtin("036000291452")
    assert not excel_service.valid_gtin("036000291453")
    assert not excel_service.valid_gtin("123")
    assert excel_service.valid_gtin("")


def test_parser_excludes_page_widgets_from_features_and_fitments():
    html = """
    <html><body>
      <h1>Acme Part X-100</h1>
      <section class="product-features"><ul>
        <li>Forged aluminum construction for reduced weight.</li>
        <li>Email a Friend About This Item</li>
      </ul></section>
      <section class="fitment-list"><ul>
        <li>2018-2022 Acme Coupe</li>
        <li>Hover over the image to zoom</li>
      </ul></section>
      <div class="customer-reviews"><ul><li>Login to Submit a Review</li></ul></div>
    </body></html>
    """

    product = parse(html, "https://acme.example/products/x-100")

    assert product["features"] == ["Forged aluminum construction for reduced weight."]
    assert product["fitments"] == ["2018-2022 Acme Coupe"]
    assert "Login to Submit a Review" not in product["text"]


def test_validator_penalizes_mpn_used_as_compatibility_reference():
    product = {
        "mpn": "",
        "product_title": "Replacement adapter for X-100",
        "manufacturer": "Acme",
        "text": "Compatible with X-100. This adapter is sold separately.",
    }

    result = validate(
        "X-100",
        "Acme",
        "https://acme.example/products/adapter-for-x-100",
        product,
        mfr_domain="acme.example",
    )

    assert not result["is_valid"]
    assert "MPN appears in a compatibility reference" in result["notes"]


def test_validator_uses_matching_upc_as_identity_evidence():
    product = {
        "mpn": "X-100",
        "product_title": "Acme Part X-100",
        "manufacturer": "Acme",
        "upc": "036000291452",
        "text": "Acme Part X-100",
    }

    result = validate(
        "X-100",
        "Acme",
        "https://acme.example/products/x-100",
        product,
        mfr_domain="acme.example",
        upc="036000291452",
    )

    assert result["is_valid"]
    assert "UPC/GTIN match" in result["notes"]


def test_job_preflight_reports_row_issues_and_query_templates(tmp_path, monkeypatch):
    monkeypatch.setattr(endpoints, "UPLOAD_DIR", tmp_path)
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    worksheet.title = "Products"
    worksheet.append(["MPN", "Manufacturer", "UPC", "URL"])
    worksheet.append(["PART-1", "Acme", "036000291452", ""])
    worksheet.append(["PART-1", "Acme", "123", "https://acme.example/part-1"])
    worksheet.append(["", "", "123", ""])
    content = io.BytesIO()
    workbook.save(content)
    content.seek(0)

    client = TestClient(app)
    uploaded = client.post(
        "/api/jobs/upload",
        files={"file": ("catalog.xlsx", content.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
    )
    assert uploaded.status_code == 200
    file_token = uploaded.json()["file_token"]

    preview = client.post("/api/jobs/preview", json={
        "file_token": file_token,
        "sheet_name": "Products",
        "column_mapping": {
            "mpn": "mpn",
            "mfr": "manufacturer",
            "upc": "upc",
            "url": "url",
        },
    })
    assert preview.status_code == 200
    data = preview.json()
    assert data["total_rows"] == 1
    assert data["missing_identifier_rows"] == [4]
    assert data["duplicate_rows"] == [3]
    assert data["invalid_gtin_rows"] == [3, 4]
    assert data["missing_manufacturer_rows"] == [4]
    assert data["existing_url_rows"] == [3]
    assert data["query_preview"][0]["row"] == 2
    assert data["query_preview"][0]["queries"][0]["tier"] == "EXACT QUOTE"

    excluded = client.post("/api/jobs/preview", json={
        "file_token": file_token,
        "sheet_name": "Products",
        "column_mapping": {
            "mpn": "mpn",
            "mfr": "manufacturer",
            "upc": "upc",
            "url": "url",
        },
        "exclude_rows": [3],
    })
    assert excluded.status_code == 200
    excluded_data = excluded.json()
    assert excluded_data["total_rows"] == 1
    assert excluded_data["excluded_rows_count"] == 1
    assert excluded_data["duplicate_rows"] == []


def test_deterministic_evidence_snippet_comes_from_page_text():
    snippet = _evidence_snippet(
        "The item includes a forged aluminum housing and stainless steel fittings.",
        ["forged aluminum housing", "stainless steel fittings"],
        "deterministic",
    )

    assert "forged aluminum housing" in snippet
    assert "stainless steel fittings" in snippet


def test_unmatched_gemini_value_is_not_presented_as_page_evidence():
    assert _evidence_snippet("Page text without that claim.", "Unsupported claim", "gemini_enhanced") == ""


def test_gemini_only_fills_fields_with_values_present_in_page_text():
    page_text = "Acme brake kit. Includes steel fittings. Material Steel."
    parsed = {
        "product_title": "",
        "overview": "",
        "features": [],
        "specifications": [],
        "fitments": [],
        "image_urls": [],
    }
    gemini_data = {
        "product_title": "Acme brake kit",
        "overview": "This kit fits every vehicle.",
        "features": ["Includes steel fittings", "Guaranteed to last forever"],
        "specifications": [
            {"name": "Material", "value": "Steel"},
            {"name": "Vehicle", "value": "Every vehicle"},
        ],
        "fitments": [],
        "image_urls": ["https://example.com/image.jpg"],
    }

    merged, method = gemini_extractor.merge(parsed, gemini_data, page_text)

    assert merged["product_title"] == "Acme brake kit"
    assert merged["overview"] == ""
    assert merged["features"] == ["Includes steel fittings"]
    assert merged["specifications"] == [{"name": "Material", "value": "Steel"}]
    assert merged["image_urls"] == []
    assert method == "gemini_enhanced"




def test_secondary_source_does_not_fill_primary_source_gaps(monkeypatch):
    primary_url = "https://manufacturer.example/part-1"
    secondary_url = "https://retailer.example/part-1"
    parsed_pages = {
        primary_url: {
            "product_title": "Part 1",
            "mpn": "PART-1",
            "manufacturer": "Acme",
            "image_urls": [],
            "overview": "Primary source overview",
            "features": [],
            "specifications": [],
            "fitments": [],
            "text": "Part 1 Primary source overview",
        },
        secondary_url: {
            "product_title": "Part 1",
            "mpn": "PART-1",
            "manufacturer": "Acme",
            "image_urls": ["https://retailer.example/image.jpg"],
            "overview": "Secondary source overview",
            "features": ["Secondary feature"],
            "specifications": [{"name": "Material", "value": "Steel"}],
            "fitments": ["Secondary fitment"],
            "text": "Part 1 Secondary source overview Secondary feature Material Steel Secondary fitment",
        },
    }
    fake_scrapers = {
        "dv": SimpleNamespace(
            validate=lambda *args, **kwargs: {
                "is_valid": True,
                "score": 40 if args[2] == primary_url else 39,
                "confidence": "HIGH",
                "notes": [],
                "is_variant": False,
            }
        ),
        "gx": SimpleNamespace(available=lambda: False),
        "scraper": SimpleNamespace(
            fetch=lambda url, *args: url,
            parse=lambda html, url: parsed_pages[url],
        ),
        "sd": SimpleNamespace(
            candidates=lambda *args, **kwargs: iter([
                ("MANUFACTURER", primary_url),
                ("WEB SEARCH", secondary_url),
            ]),
            mfr_domain=lambda manufacturer: "manufacturer.example",
        ),
    }
    monkeypatch.setattr(job_runner, "_get_scrapers", lambda: fake_scrapers)

    result = job_runner.process_single_row(
        {"mpn": "PART-1", "mfr": "Acme"},
        use_gemini=False,
    )

    assert result["overview"] == "Primary source overview"
    assert result["features"] == []
    assert result["specifications"] == []
    assert result["fitments"] == []
    assert result["image"] == ""
    assert result["field_evidence"]["overview"]["source_url"] == primary_url
    assert "features" not in result["field_evidence"]
