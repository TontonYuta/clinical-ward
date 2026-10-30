from __future__ import annotations
import hashlib, json, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
import httpx
DAV_API_URL = 'https://dichvucong.dav.gov.vn/api/services/app/soDangKy/GetAllPublicServerPaging'

def fetch_dav_snapshot(*, output_dir: Path, page_size: int = 200, max_records: int | None = None, sleep_seconds: float = 0.25, timeout_seconds: float = 30.0, client: Any = None) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True); pages_dir = output_dir / 'pages'; pages_dir.mkdir(exist_ok=True)
    total_count = None; records = 0; manifest_pages = []; own_client = client is None; http = client or httpx
    try:
        while max_records is None or records < max_records:
            size = min(page_size, max_records - records) if max_records is not None else page_size; skip = records
            response = http.post(DAV_API_URL, json={'skipCount': skip, 'maxResultCount': size, 'filterText': '', 'SoDangKyThuoc': {}, 'KichHoat': True}, headers={'Accept': 'application/json', 'Content-Type': 'application/json; charset=utf-8', 'User-Agent': 'ClinicalWard-DavRawSnapshot/1.0'}, timeout=timeout_seconds)
            response.raise_for_status(); payload = response.json(); result = payload.get('result') or {}; items = result.get('items') or []
            total_count = int(result.get('totalCount') or total_count or 0)
            if not items: break
            page_no = len(manifest_pages) + 1; page_path = pages_dir / f'page-{page_no:06d}.json'; raw = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'; page_path.write_text(raw, encoding='utf-8')
            manifest_pages.append({'page': page_no, 'skip_count': skip, 'requested_count': size, 'returned_count': len(items), 'path': str(page_path.relative_to(output_dir)), 'sha256': hashlib.sha256(raw.encode()).hexdigest()}); records += len(items)
            if total_count and records >= total_count: break
            if sleep_seconds: time.sleep(sleep_seconds)
    finally:
        if own_client and hasattr(http, 'close'): http.close()
    manifest = {'manifest_version': 1, 'source': DAV_API_URL, 'captured_at': datetime.now(timezone.utc).isoformat(), 'page_size': page_size, 'total_count': total_count or 0, 'records': records, 'pages': manifest_pages}
    (output_dir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'); return manifest
