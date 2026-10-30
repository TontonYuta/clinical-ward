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
    urls = source_urls or {}
    dav = _file_metadata(dav_path, url=urls.get("dav"))
    dav["representation"] = "transformed_snapshot"
    dav["note"] = "Application-normalized DAV export; not the original DAV API payload."
    pdf = _file_metadata(pdf_path, url=urls.get("pdf"))
    pdf["representation"] = "source_pdf"
    return {"manifest_version": 1, "created_at": datetime.now(timezone.utc).isoformat(), "sources": {"dav": dav, "pdf": pdf}}
