"""Helper formatting and citation extraction for drug profiles (<=65 LOC)."""
import re
import json
from pathlib import Path
from app.models.registry import DavNationalDrug


def format_clinical_text(text: str) -> str:
    """Join PDF line wraps while preserving blank line paragraphs and list items."""
    lines = [line.rstrip() for line in text.splitlines()]
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        if re.match(r"^(?:[-•*]|[0-9]+[.)])", stripped):
            if current:
                paragraphs.append(" ".join(current))
                current = []
            paragraphs.append(stripped)
        else:
            current.append(stripped)
    if current:
        paragraphs.append(" ".join(current))
    return "\n\n".join(paragraphs)


def build_drug_citation(matched: DavNationalDrug, monograph: object | None, source: str) -> dict:
    legal = source or getattr(monograph, "source", None) or getattr(matched, "clinical_source", None) or ""
    page_match = re.search(r"Trang\s*(\d+)", legal, re.IGNORECASE)
    page = int(page_match.group(1)) if page_match else None
    manifest_path = Path(__file__).resolve().parents[2] / "data" / "knowledge_base" / "clinical_source_manifest.json"
    try:
        sources = json.loads(manifest_path.read_text(encoding="utf-8")).get("sources", [])
    except (OSError, ValueError, TypeError):
        sources = []
    dtqg = next((item for item in sources if item.get("id") == "dtqg-v2-2015"), None)
    has_dtqg_provenance = bool(legal and "dược thư" in legal.casefold() and dtqg)
    title = "Dược thư Quốc gia Việt Nam, lần xuất bản II" if has_dtqg_provenance else "Cơ sở dữ liệu đăng ký thuốc Cục Quản lý Dược"
    url = f"/{dtqg['public_path'].removeprefix('public/')}" if has_dtqg_provenance else "https://dichvucong.dav.gov.vn/congbothuoc/index"
    document_id = "dtqg-v2-2015" if has_dtqg_provenance else "dav-registry"
    if has_dtqg_provenance and page:
        url += f"#page={page}"
    excerpt = ""
    if monograph is not None:
        for field in ("indications", "contraindications", "adult_dosage", "adverse_effects", "composition", "description"):
            value = getattr(monograph, field, None)
            if value and str(value).strip():
                excerpt = format_clinical_text(str(value)).strip()
                break
    if not excerpt:
        excerpt = str(getattr(matched, "indications", "") or "").strip()
    if len(excerpt) > 240:
        excerpt = excerpt[:239].rstrip() + "…"
    return {
        "source": title, "legal_basis": legal or "Cục Quản lý Dược (DAV)",
        "section": getattr(monograph, "title", None) or matched.active_ingredient,
        "excerpt": excerpt, "document_id": document_id, "url": url, "page": page if has_dtqg_provenance else None,
    }
