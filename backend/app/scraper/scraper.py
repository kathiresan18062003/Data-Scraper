"""Resilient fetcher + deterministic Schema.org / HTML parser."""
import json
import logging
import re
import time
from urllib.parse import urlparse, urljoin
import requests
from bs4 import BeautifulSoup
from backend.app.config import REQUEST_TIMEOUT, DOMAIN_DELAY

logger = logging.getLogger(__name__)

_last_hit: dict = {}
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
    )
}
BAD_IMG = re.compile(r"logo|icon|sprite|pixel|placeholder|spacer|blank|\.svg|\.gif", re.I)


def fetch(url: str, timeout: int | None = None, retries: int = 2) -> str | None:
    timeout = timeout or REQUEST_TIMEOUT
    dom = urlparse(url).netloc
    for attempt in range(retries + 1):
        wait = DOMAIN_DELAY - (time.time() - _last_hit.get(dom, 0))
        if wait > 0:
            time.sleep(wait)
        _last_hit[dom] = time.time()
        try:
            r = requests.get(url, headers=UA, timeout=timeout)
            if r.status_code == 200 and "html" in r.headers.get("content-type", "html"):
                return r.text
            if r.status_code in (403, 404, 410):
                return None
        except requests.RequestException:
            pass
        time.sleep(1 + attempt)
    return None


def valid_image(u: str) -> bool:
    return bool(u) and isinstance(u, str) and u.startswith("http") and not BAD_IMG.search(u)


def _jsonld_products(soup: BeautifulSoup) -> list[dict]:
    out = []
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(s.string or "")
        except (ValueError, TypeError):
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            n = stack.pop()
            if isinstance(n, dict):
                if "@graph" in n:
                    stack.extend(n["@graph"])
                t = n.get("@type")
                if t == "Product" or (isinstance(t, list) and "Product" in t):
                    out.append(n)
    return out


def _items(container_re, soup: BeautifulSoup, tag: str = "li") -> list[str]:
    seen, res = set(), []
    for c in soup.find_all(attrs={"class": container_re}) + soup.find_all(attrs={"id": container_re}):
        for li in c.find_all(tag):
            t = " ".join(li.get_text(" ", strip=True).split())
            if 3 < len(t) < 400 and t not in seen:
                seen.add(t)
                res.append(t)
    return res


def parse(html: str, url: str) -> dict:
    if not html:
        return {
            "product_title": "",
            "mpn": "",
            "manufacturer": "",
            "image_urls": [],
            "overview": "",
            "features": [],
            "specifications": [],
            "fitments": [],
            "text": "",
        }

    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

    # 1. JSON-LD structured data
    prod = (_jsonld_products(soup) or [{}])[0]
    brand = prod.get("brand")
    brand = brand.get("name") if isinstance(brand, dict) else brand
    imgs = prod.get("image") or []
    imgs = [imgs] if isinstance(imgs, (str, dict)) else imgs
    imgs = [i.get("url") if isinstance(i, dict) else i for i in imgs if i]

    # OpenGraph & Twitter metadata
    for prop in ("og:image", "twitter:image", "og:image:secure_url"):
        meta_img = soup.find("meta", property=prop) or soup.find("meta", attrs={"name": prop})
        if meta_img and meta_img.get("content"):
            imgs.append(urljoin(url, meta_img["content"]))

    # Additional image tags in product galleries
    for img_tag in soup.find_all("img"):
        src = img_tag.get("data-zoom-image") or img_tag.get("data-src") or img_tag.get("src")
        if src and valid_image(src):
            cls_or_id = (img_tag.get("class", []) if isinstance(img_tag.get("class"), list) else [img_tag.get("class") or ""]) + [img_tag.get("id") or ""]
            cls_str = " ".join(cls_or_id).lower()
            if any(k in cls_str for k in ("product", "main", "gallery", "hero", "zoom", "photo")):
                imgs.append(urljoin(url, src))

    # Decompose script/style/noscript before extracting text/title/specs
    for t in soup(["script", "style", "noscript"]):
        t.decompose()

    # 2. Product Title
    og_title = soup.find("meta", property="og:title")
    title = (
        prod.get("name") or
        (og_title.get("content") if og_title else "") or
        (soup.find("h1").get_text(strip=True) if soup.find("h1") else "") or
        (soup.title.string.strip() if soup.title and soup.title.string else "")
    )
    if title and (" | " in title or " - " in title):
        parts = [p.strip() for p in re.split(r" \| | - ", title)]
        if len(parts) > 1 and len(parts[0]) > 10:
            title = parts[0]

    # 3. Overview / Description
    meta_desc = soup.find("meta", attrs={"name": "description"}) or soup.find("meta", property="og:description")
    overview = (prod.get("description") or (meta_desc.get("content") if meta_desc else "") or "").strip()
    if not overview or len(overview) < 30:
        desc_block = (
            soup.find(attrs={"class": re.compile(r"product.*desc|overview|description|details|about", re.I)}) or
            soup.find(attrs={"id": re.compile(r"product.*desc|overview|description|details", re.I)})
        )
        if desc_block:
            p = desc_block.find("p")
            if p and len(p.get_text(strip=True)) > 20:
                overview = " ".join(p.get_text(" ", strip=True).split())
            else:
                overview = " ".join(desc_block.get_text(" ", strip=True).split())[:1000]

    # 4. Specifications Extraction (Tables, Definition lists, and JSON-LD additionalProperty)
    specs = []
    seen_specs = set()

    # A. JSON-LD additionalProperty
    additional_props = prod.get("additionalProperty") or []
    if isinstance(additional_props, list):
        for prop in additional_props:
            if isinstance(prop, dict) and prop.get("name") and prop.get("value"):
                k = str(prop["name"]).strip()
                v = str(prop["value"]).strip()
                if k.lower() not in seen_specs and v:
                    seen_specs.add(k.lower())
                    specs.append({"name": k, "value": v})

    # B. Any 2-column or key-value table rows
    for tr in soup.find_all("tr"):
        cells = [x.get_text(" ", strip=True) for x in tr.find_all(["th", "td"])]
        if len(cells) == 2 and cells[0] and cells[1]:
            k = cells[0].rstrip(":").strip()
            v = cells[1].strip()
            if 2 <= len(k) <= 60 and 0 < len(v) <= 400 and k.lower() not in seen_specs:
                if not re.search(r"search|cart|privacy|terms|cookie|copyright|login|account", k, re.I):
                    seen_specs.add(k.lower())
                    specs.append({"name": k, "value": v})

    # C. Definition lists <dl><dt><dd>
    for dt in soup.find_all("dt"):
        dd = dt.find_next_sibling("dd")
        if dd:
            k = dt.get_text(" ", strip=True).rstrip(":").strip()
            v = dd.get_text(" ", strip=True).strip()
            if 2 <= len(k) <= 60 and 0 < len(v) <= 400 and k.lower() not in seen_specs:
                seen_specs.add(k.lower())
                specs.append({"name": k, "value": v})

    # D. Key-value div/span pairs (e.g. label + value)
    for row_div in soup.find_all(attrs={"class": re.compile(r"spec|attribute|property|detail-row|spec-item", re.I)}):
        labels = row_div.find_all(attrs={"class": re.compile(r"label|name|title|key", re.I)})
        values = row_div.find_all(attrs={"class": re.compile(r"val|value|data", re.I)})
        if len(labels) == 1 and len(values) == 1:
            k = labels[0].get_text(" ", strip=True).rstrip(":").strip()
            v = values[0].get_text(" ", strip=True).strip()
            if 2 <= len(k) <= 60 and 0 < len(v) <= 400 and k.lower() not in seen_specs:
                seen_specs.add(k.lower())
                specs.append({"name": k, "value": v})

    # 5. Features / Highlights Extraction
    features = _items(re.compile(r"feature|bullet|highlight|benefit|include", re.I), soup)
    if not features:
        for container in soup.find_all(attrs={"class": re.compile(r"description|product-.*desc|product-info|product-detail|overview|content", re.I)}) + soup.find_all(attrs={"id": re.compile(r"description|product-.*desc|product-info|product-detail|overview|content", re.I)}):
            for li in container.find_all("li"):
                txt = " ".join(li.get_text(" ", strip=True).split())
                if 5 <= len(txt) <= 400 and txt not in features:
                    features.append(txt)
            if len(features) >= 3:
                break

    if not features:
        for li in soup.find_all("li"):
            txt = " ".join(li.get_text(" ", strip=True).split())
            if 15 <= len(txt) <= 300 and txt not in features:
                if not re.search(r"search|cart|privacy|terms|cookie|copyright|login|account|sign in|home|contact|menu", txt, re.I):
                    features.append(txt)

    # 6. Fitments / Compatibility Extraction
    fitments = _items(re.compile(r"fitment|compatib|fits|application", re.I), soup)
    if not fitments:
        for t in soup.find_all("table"):
            t_txt = t.get_text(" ", strip=True)
            if any(w in t_txt.lower() for w in ("compatible vehicle", "spindle type", "applications", "fits vehicle")):
                for tr in t.find_all("tr"):
                    row_txt = " ".join(tr.get_text(" ", strip=True).split())
                    if 5 <= len(row_txt) <= 250 and row_txt not in fitments:
                        fitments.append(row_txt)

    return {
        "product_title": title or "",
        "mpn": str(prod.get("mpn") or prod.get("sku") or ""),
        "manufacturer": brand or "",
        "image_urls": [i for i in dict.fromkeys(imgs) if valid_image(i)],
        "overview": overview,
        "features": features[:30],
        "specifications": specs[:60],
        "fitments": fitments[:30],
        "text": " ".join(soup.get_text(" ", strip=True).split())[:20000],
    }
