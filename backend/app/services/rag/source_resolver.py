import re
import json
from pathlib import Path
from functools import lru_cache

_BACKEND_DIR = Path(__file__).resolve().parents[3]
_SOURCE_MANIFEST_PATH = _BACKEND_DIR / "data" / "knowledge_base" / "clinical_source_manifest.json"

@lru_cache(maxsize=1)
def load_source_documents() -> tuple[list[dict], dict[str, dict]]:
    try:
        manifest = json.loads(_SOURCE_MANIFEST_PATH.read_text(encoding="utf-8"))
        records_path = _BACKEND_DIR / "data" / "knowledge_base" / "dtqg_monographs_extracted.json"
        records = json.loads(records_path.read_text(encoding="utf-8"))
        by_inn = {str(item.get("inn", "")).casefold(): item for item in records if item.get("inn")}
        return manifest.get("sources", []), by_inn
    except (OSError, ValueError, TypeError):
        return [], {}

def resolve_citation_document(source: str, legal_basis: str, section: str) -> tuple[str | None, str | None, int | None]:
    normalized_basis = legal_basis.casefold()
    normalized_source = source.casefold()
    candidates, monographs = load_source_documents()
    source_text = f"{normalized_source} {normalized_basis}"
    match = next((
        item for item in candidates
        if (item.get("id") == "dtqg-v2-2015" and ("dược thư" in source_text or "2033/qđ-byt" in source_text))
        or (item.get("legal_basis", "").casefold() and item.get("legal_basis", "").casefold() in source_text)
    ), None)
    if match is None:
        return None, None, None

    page = None
    if match.get("id") == "dtqg-v2-2015":
        section_inn = re.sub(r"^\s*\d+\.\s*", "", section).split("(")[0].split("-")[0].strip().casefold()
        record = monographs.get(section_inn)
        source_text = str(record.get("source", "")) if record else ""
        page_match = re.search(r"Trang\s*(\d+)", source_text, re.IGNORECASE)
        if not page_match and record and record.get("start_page"):
            page_match = re.match(r"(\d+)", str(record["start_page"]))
        page = int(page_match.group(1)) if page_match else None
    public_path = match.get("public_path")
    url = f"/{public_path.removeprefix('public/')}" if public_path else None
    if url and page:
        url += f"#page={page}"
    return url, match.get("id"), page
