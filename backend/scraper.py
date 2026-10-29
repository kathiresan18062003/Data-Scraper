"""Resilient fetcher + deterministic Schema.org / HTML parser."""
import json, re, time
from urllib.parse import urlparse, urljoin
import requests
from bs4 import BeautifulSoup
from config import settings

_last_hit: dict = {}
UA = {"User-Agent": "Mozilla/5.0 (compatible; ProductDataScraper/1.0)"}
BAD_IMG = re.compile(r"logo|icon|sprite|pixel|placeholder|spacer|blank|\.svg|\.gif", re.I)


def fetch(url, timeout=None, retries=2):
    timeout = timeout or settings.REQUEST_TIMEOUT
    dom = urlparse(url).netloc
    for attempt in range(retries + 1):
        wait = settings.DOMAIN_DELAY - (time.time() - _last_hit.get(dom, 0))
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


def valid_image(u):
    return bool(u) and isinstance(u, str) and u.startswith("http") and not BAD_IMG.search(u)


def _jsonld_products(soup):
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


def _items(container_re, soup, tag="li"):
    seen, res = set(), []
    for c in soup.find_all(attrs={"class": container_re}) + soup.find_all(attrs={"id": container_re}):
        for li in c.find_all(tag):
            t = " ".join(li.get_text(" ", strip=True).split())
            if 3 < len(t) < 400 and t not in seen:
                seen.add(t); res.append(t)
    return res


def parse(html, url):
    soup = BeautifulSoup(html, "html.parser")
    prod = (_jsonld_products(soup) or [{}])[0]
    brand = prod.get("brand")
    brand = brand.get("name") if isinstance(brand, dict) else brand
    imgs = prod.get("image") or []
    imgs = [imgs] if isinstance(imgs, (str, dict)) else imgs
    imgs = [i.get("url") if isinstance(i, dict) else i for i in imgs]
    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        imgs.append(urljoin(url, og["content"]))
    meta = soup.find("meta", attrs={"name": "description"})
    for t in soup(["script", "style", "noscript"]):
        t.decompose()
    title = prod.get("name") or (soup.find("h1").get_text(strip=True) if soup.find("h1") else
                                 (soup.title.string.strip() if soup.title and soup.title.string else ""))
    specs = []
    for c in soup.find_all(attrs={"class": re.compile("spec", re.I)}) + soup.find_all(attrs={"id": re.compile("spec", re.I)}):
        for tr in c.find_all("tr"):
            cells = [x.get_text(" ", strip=True) for x in tr.find_all(["th", "td"])]
            if len(cells) >= 2 and cells[0]:
                specs.append({"name": cells[0], "value": cells[1]})
        for dt in c.find_all("dt"):
            dd = dt.find_next_sibling("dd")
            if dd:
                specs.append({"name": dt.get_text(strip=True), "value": dd.get_text(" ", strip=True)})
    return {
        "product_title": title or "", "mpn": str(prod.get("mpn") or prod.get("sku") or ""),
        "manufacturer": brand or "",
        "image_urls": [i for i in dict.fromkeys(imgs) if valid_image(i)],
        "overview": (prod.get("description") or (meta.get("content") if meta else "") or "").strip(),
        "features": _items(re.compile("feature|bullet|highlight", re.I), soup),
        "specifications": specs,
        "fitments": _items(re.compile("fitment|compatib|fits", re.I), soup),
        "text": " ".join(soup.get_text(" ", strip=True).split())[:20000],
    }
