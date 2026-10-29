from fastapi.testclient import TestClient
import io
import openpyxl
from backend.main import app
from backend.app.database import init_db

client = TestClient(app)


def setup_module():
    init_db()


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "gemini_available" in data
    assert "search_available" in data


def test_dashboard():
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()
    assert "total_products" in data
    assert "completed_jobs" in data
    assert "recent_jobs" in data


def test_invalid_upload():
    # Attempt to upload a text file instead of Excel
    files = {"file": ("malicious.txt", b"plain text content", "text/plain")}
    res = client.post("/api/jobs/upload", files=files)
    assert res.status_code == 400
    assert "Only Excel" in res.json()["detail"]


def test_invalid_job_start():
    # Attempt to start with invalid file token
    res = client.post("/api/jobs", json={
        "file_token": "non-existent-token",
        "sheet_name": "Sheet1",
        "column_mapping": {"mpn": "mpn", "mfr": "mfr"}
    })
    assert res.status_code == 404


def test_nonexistent_job_endpoints():
    fake_id = "00000000-0000-0000-0000-000000000000"
    assert client.get(f"/api/jobs/{fake_id}").status_code == 404
    assert client.post(f"/api/jobs/{fake_id}/start").status_code == 404
    assert client.post(f"/api/jobs/{fake_id}/pause").status_code == 404
    assert client.post(f"/api/jobs/{fake_id}/resume").status_code == 404
    assert client.post(f"/api/jobs/{fake_id}/cancel").status_code == 404
    assert client.post(f"/api/jobs/{fake_id}/stop").status_code == 404
    assert client.get(f"/api/jobs/{fake_id}/download").status_code == 404
    assert client.get(f"/api/jobs/{fake_id}/downloads/organized").status_code == 404


def test_upload_and_job_flow():
    # Create test excel in memory
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Products"
    ws.append(["Part Number", "Brand", "Product Title", "Page URL"])
    ws.append(["140-13303-R", "Wilwood", "Wilwood Caliper Kit", "https://wilwood.com/calipers/140-13303-R"])
    ws.append(["20140", "Moroso", "Oil Pan", "https://moroso.com/oil-pan-20140"])
    
    bio = io.BytesIO()
    wb.save(bio)
    bio.seek(0)

    # 1. Upload
    files = {"file": ("test_catalog.xlsx", bio.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    up_res = client.post("/api/jobs/upload", files=files)
    assert up_res.status_code == 200
    up_data = up_res.json()
    assert "file_token" in up_data
    assert len(up_data["sheets"]) == 1
    sheet = up_data["sheets"][0]
    assert sheet["name"] == "Products"
    assert sheet["detected_columns"]["mpn"] == "part number"
    assert sheet["detected_columns"]["mfr"] == "brand"

    # 2. Create Job
    job_req = {
        "file_token": up_data["file_token"],
        "sheet_name": "Products",
        "column_mapping": {
            "mpn": "part number",
            "mfr": "brand",
            "title": "product title",
            "url": "page url"
        },
        "limit": 2,
        "timeout": 10,
        "retries": 1,
        "use_gemini": False,
        "save_every": 1
    }
    job_res = client.post("/api/jobs", json=job_req)
    assert job_res.status_code == 200
    job_data = job_res.json()
    job_id = job_data["id"]
    assert job_data["status"] in ("PENDING", "RUNNING")

    # 3. Get Job
    get_res = client.get(f"/api/jobs/{job_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == job_id

    # 4. List Jobs
    list_res = client.get("/api/jobs")
    assert list_res.status_code == 200
    assert any(j["id"] == job_id for j in list_res.json()["jobs"])

    # 5. Pause & Resume
    pause_res = client.post(f"/api/jobs/{job_id}/pause")
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] in ("PAUSED", "COMPLETED", "RUNNING")

    resume_res = client.post(f"/api/jobs/{job_id}/resume")
    assert resume_res.status_code == 200

    # 6. Stop
    stop_res = client.post(f"/api/jobs/{job_id}/stop")
    assert stop_res.status_code == 200
    assert stop_res.json()["status"] in ("CANCELLED", "COMPLETED", "RUNNING")

    # 7. Get Results
    results_res = client.get(f"/api/jobs/{job_id}/results")
    assert results_res.status_code == 200
    assert "items" in results_res.json()


def test_controlled_scraping_fixture():
    """Verify deterministic HTML extraction and validation on a controlled local fixture."""
    from backend.app.scraper.scraper import parse
    from backend.app.scraper.data_validator import validate

    html_fixture = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Apex Performance Brake Kit Model APX-9000 - High Output</title>
        <meta name="description" content="High performance 6-piston brake caliper kit engineered for endurance racing." />
        <meta property="og:image" content="https://apexperformance.example.com/images/apx-9000-front.jpg" />
    </head>
    <body>
        <h1>Apex Performance Brake Kit APX-9000</h1>
        <div class="product-info">
            <span class="mfr">Apex Performance</span>
            <span class="part-no">Part: APX-9000</span>
        </div>
        <div class="product-description">
            <p>Designed for severe track duty with forged aerospace aluminum calipers and vented slotted rotors.</p>
            <ul>
                <li>Forged 6-piston monobloc caliper design</li>
                <li>Carbon-ceramic 355mm directional slotted rotors</li>
                <li>DOT-compliant braided stainless steel brake lines</li>
            </ul>
        </div>
        <div class="specifications">
            <table>
                <tr><th>Caliper Piston Count</th><td>6 Pistons</td></tr>
                <tr><th>Rotor Diameter</th><td>355 mm (14.0 in)</td></tr>
                <tr><th>Piston Material</th><td>Stainless Steel</td></tr>
                <tr><th>Finish</th><td>Hard Anodized Red</td></tr>
            </table>
        </div>
        <div class="compatibility">
            <table>
                <tr><td>Compatible Vehicles</td><td>2015-2023 Ford Mustang GT</td></tr>
                <tr><td>Fitment Type</td><td>Direct Bolt-on Replacement</td></tr>
            </table>
        </div>
    </body>
    </html>
    """

    url = "https://apexperformance.example.com/products/apx-9000"
    parsed = parse(html_fixture, url)

    assert "Apex Performance Brake Kit APX-9000" in parsed["product_title"]
    assert "High performance 6-piston" in parsed["overview"] or "Designed for severe track" in parsed["overview"]
    assert len(parsed["image_urls"]) >= 1
    assert "https://apexperformance.example.com/images/apx-9000-front.jpg" in parsed["image_urls"]
    assert len(parsed["features"]) >= 3
    assert any("Forged 6-piston" in f for f in parsed["features"])
    assert len(parsed["specifications"]) >= 4
    spec_dict = {s["name"]: s["value"] for s in parsed["specifications"]}
    assert spec_dict.get("Caliper Piston Count") == "6 Pistons"
    assert spec_dict.get("Rotor Diameter") == "355 mm (14.0 in)"
    assert len(parsed["fitments"]) >= 1

    v = validate("APX-9000", "Apex Performance", url, parsed, (), "apexperformance.example.com")
    assert v["is_valid"] is True
    assert v["score"] >= 35
