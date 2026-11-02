import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any

def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()

def extract_pdf_pages(pdf_path: Path) -> list[str]:
    result = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"], check=True, capture_output=True, text=True)
    return result.stdout.split("")

def read_dav_records(dav_json: Path) -> list[dict[str, Any]]:
    with dav_json.open(encoding="utf-8") as stream:
        payload = json.load(stream)
    if not isinstance(payload, list):
        raise ValueError("DAV snapshot must be a JSON list")
    return payload

def read_raw_dav_pages(snapshot_dir: Path) -> tuple[list[dict[str, Any]], str]:
    manifest = json.loads((snapshot_dir / "manifest.json").read_text(encoding="utf-8"))
    records = []
    for page in manifest.get("pages", []):
        payload = json.loads((snapshot_dir / page["path"]).read_text(encoding="utf-8"))
        records.extend((payload.get("result") or {}).get("items") or [])
    if len(records) != int(manifest.get("records", -1)):
        raise ValueError("DAV raw snapshot record count does not match its manifest")
    return records, str(manifest.get("source", ""))

def raw_snapshot_digest(snapshot_dir: Path) -> tuple[str, int]:
    manifest = json.loads((snapshot_dir / "manifest.json").read_text(encoding="utf-8"))
    digest = hashlib.sha256()
    byte_count = 0
    for page in manifest.get("pages", []):
        page_path = snapshot_dir / page["path"]
        digest.update(bytes.fromhex(file_sha256(page_path)))
        byte_count += page_path.stat().st_size
    return digest.hexdigest(), byte_count
