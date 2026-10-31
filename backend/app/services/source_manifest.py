from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _file_metadata(path: Path, *, url: str | None = None) -> dict[str, Any]:
    data = path.read_bytes()
    item: dict[str, Any] = {"path": str(path.resolve()), "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    if url:
        item["url"] = url
    if path.suffix.casefold() == ".json":
        payload = json.loads(data.decode("utf-8"))
        item["record_count"] = len(payload) if isinstance(payload, list) else None
        item["json_type"] = type(payload).__name__
    return item


def build_manifest(*, dav_path: Path, pdf_path: Path, source_urls: dict[str, str] | None = None) -> dict[str, Any]:
    if not dav_path.is_file() or not pdf_path.is_file():
        raise FileNotFoundError("Both DAV snapshot and source PDF must exist")
    if pdf_path.stat().st_size == 0:
        raise ValueError("Source PDF is empty")
    urls = source_urls or {}
    dav = _file_metadata(dav_path, url=urls.get("dav"))
    dav["representation"] = "transformed_snapshot"
    dav["note"] = "Application-normalized DAV export; not the original DAV API payload."
    pdf = _file_metadata(pdf_path, url=urls.get("pdf"))
    pdf["representation"] = "source_pdf"
    pdf["document_id"] = "dtqg-v2-2015"
    pdf["title"] = "Dược thư Quốc gia Việt Nam, lần xuất bản II"
    pdf["edition_year"] = 2015
    pdf["legal_basis"] = "Quyết định 2033/QĐ-BYT"
    return {
        "manifest_version": 2,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sources": {"dav": dav, "pdf": pdf},
        "policy": {
            "clinical_source_of_truth": "source_pdf",
            "derived_data_requires_matching_sha256": True,
            "unverified_supplements_are_not_presented_as_pdf_content": True,
        },
    }
