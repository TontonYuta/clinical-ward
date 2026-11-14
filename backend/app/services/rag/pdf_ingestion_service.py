"""
Dịch vụ nạp, trích xuất và lập chỉ mục PDF tự động (Dynamic PDF Ingestion Pipeline).
Đáp ứng Bước 6: Kiến thức mới từ tài liệu PDF tải lên được trích xuất trang/đoạn,
lưu provenance mật mã (SHA256, source_id, chunk_id), cập nhật manifest và nạp trực tiếp vào SQLite FTS.
Không yêu cầu hardcode hay sửa đổi mã nguồn khi có văn bản y tế mới.
"""
import io
import os
import re
import json
import hashlib
from pathlib import Path
from typing import Optional, Dict, Any, List

import pypdf

from app.services.rag.types import RagChunk
from app.services.rag.sqlite_fts import SqliteFtsIndex

KB_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "knowledge_base"
PUBLIC_PDF_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent / "public" / "pdf"
MANIFEST_PATH = KB_DIR / "clinical_source_manifest.json"

STOPWORDS = {
    "căn", "cứ", "pháp", "lý", "quy", "định", "theo", "khoản", "điều", "trong",
    "cho", "của", "các", "thuộc", "được", "người", "bệnh", "những", "khi", "hoặc",
    "dùng", "với", "không", "thành", "phần", "tính", "chất", "tham", "khảo", "thông", "tin",
    "dưới", "đây", "dạng", "dược", "lâm", "sàng", "chuyên", "luận", "thuốc"
}


def _extract_keywords(text: str) -> list[str]:
    tokens = re.findall(r"\w+", text, flags=re.UNICODE)
    keywords = {t.strip().lower() for t in tokens if len(t.strip()) >= 3 and t.strip().lower() not in STOPWORDS}
    return sorted(list(keywords))[:40]


def _chunk_page_text(text: str, max_chars: int = 1200) -> list[str]:
    clean = re.sub(r"\r\n", "\n", text).strip()
    if not clean:
        return []
    paragraphs = re.split(r"\n\s*\n", clean)
    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        p = para.strip()
        if not p:
            continue
        if len(p) > max_chars:
            if current:
                chunks.append(current)
                current = ""
            lines = p.splitlines()
            line_chunk = ""
            for line in lines:
                l = line.strip()
                if len(line_chunk) + len(l) + 1 > max_chars:
                    if line_chunk:
                        chunks.append(line_chunk)
                    line_chunk = l
                else:
                    line_chunk = f"{line_chunk}\n{l}".strip()
            if line_chunk:
                chunks.append(line_chunk)
        elif current and len(current) + len(p) + 2 > max_chars:
            chunks.append(current)
            current = p
        else:
            current = f"{current}\n\n{p}".strip()
    if current:
        chunks.append(current)
    return chunks


def _update_manifest(
    doc_id: str,
    title: str,
    legal_basis: str,
    edition_year: int,
    filename: str,
    sha256_hex: str,
    file_bytes_len: int,
    category: str = "",
    representation: str = "source_pdf"
) -> None:
    KB_DIR.mkdir(parents=True, exist_ok=True)
    manifest_data = {"manifest_version": 1, "sources": []}
    if MANIFEST_PATH.exists():
        try:
            manifest_data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    sources = manifest_data.get("sources", [])
    entry = {
        "id": doc_id,
        "title": title,
        "edition_year": edition_year,
        "category": category,
        "legal_basis": legal_basis,
        "public_path": f"public/pdf/{filename}",
        "backend_copy": f"backend/data/knowledge_base/{filename}",
        "sha256": sha256_hex,
        "bytes": file_bytes_len,
        "representation": representation
    }

    replaced = False
    for i, s in enumerate(sources):
        if s.get("id") == doc_id or s.get("backend_copy") == entry["backend_copy"]:
            sources[i] = entry
            replaced = True
            break
    if not replaced:
        sources.append(entry)

    manifest_data["sources"] = sources
    MANIFEST_PATH.write_text(json.dumps(manifest_data, ensure_ascii=False, indent=2), encoding="utf-8")


def ingest_pdf_bytes(
    file_bytes: bytes,
    filename: str,
    title: str,
    legal_basis: str,
    edition_year: int = 2026,
    doc_id: Optional[str] = None,
    category: str = ""
) -> Dict[str, Any]:
    """
    Nạp tài liệu PDF từ byte stream:
    1. Tính băm SHA256 định danh nguồn độc lập.
    2. Lưu bản sao vật lý vào kho tài liệu knowledge_base & public/pdf.
    3. Trích xuất văn bản từng trang bằng pypdf.
    4. Phân đoạn ngữ nghĩa thành các RagChunk kèm đầy đủ provenance.
    5. Cập nhật clinical_source_manifest.json.
    6. Index trực tiếp vào SqliteFtsIndex để tìm kiếm tức thì.
    """
    if not file_bytes:
        raise ValueError("File bytes rỗng, không thể trích xuất PDF.")

    sha256_hex = hashlib.sha256(file_bytes).hexdigest()
    safe_filename = re.sub(r"[^\w\-.]", "_", filename)
    if not safe_filename.lower().endswith(".pdf"):
        safe_filename += ".pdf"

    if not doc_id:
        doc_id = re.sub(r"[^\w\-]", "_", Path(safe_filename).stem).lower()

    # Lưu bản sao backend
    KB_DIR.mkdir(parents=True, exist_ok=True)
    target_backend_path = KB_DIR / safe_filename
    target_backend_path.write_bytes(file_bytes)

    # Giữ URL xem PDF hoạt động trên local và production, kể cả khi public/pdf
    # chưa được tạo trước lúc ứng dụng khởi động.
    PUBLIC_PDF_DIR.mkdir(parents=True, exist_ok=True)
    (PUBLIC_PDF_DIR / safe_filename).write_bytes(file_bytes)

    # Trích xuất PDF qua pypdf
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    total_pages = len(reader.pages)
    chunks: List[RagChunk] = []

    source_id = f"backend/data/knowledge_base/{safe_filename}"
    source_ver = f"sha256:{sha256_hex}"

    for page_idx, page in enumerate(reader.pages, start=1):
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""

        if not page_text.strip():
            continue

        page_chunks = _chunk_page_text(page_text)
        for chunk_idx, chunk_text in enumerate(page_chunks, start=1):
            cid = f"{doc_id}_p{page_idx}_{chunk_idx}"
            title_line = f"{title} (Trang {page_idx})"
            keywords = _extract_keywords(f"{title} {legal_basis} {chunk_text[:300]}")

            chunks.append(RagChunk(
                chunk_id=cid,
                source_doc=safe_filename,
                legal_basis=legal_basis,
                page_or_section=f"Trang {page_idx}",
                title=title_line,
                content=chunk_text,
                keywords=keywords,
                entity_type="regulatory_pdf",
                source_id=source_id,
                source_version=source_ver,
            ))

    # Cập nhật manifest
    _update_manifest(
        doc_id=doc_id,
        title=title,
        legal_basis=legal_basis,
        edition_year=edition_year,
        filename=safe_filename,
        sha256_hex=sha256_hex,
        file_bytes_len=len(file_bytes),
        category=category,
        representation="source_pdf"
    )

    # Index vào FTS
    fts_index = SqliteFtsIndex()
    fts_index.upsert_chunks(chunks)

    return {
        "status": "success",
        "doc_id": doc_id,
        "title": title,
        "legal_basis": legal_basis,
        "filename": safe_filename,
        "sha256": sha256_hex,
        "source_id": source_id,
        "source_version": source_ver,
        "total_pages": total_pages,
        "extracted_chunks_count": len(chunks),
        "file_bytes": len(file_bytes),
        "public_url": f"/api/v1/pdf/{safe_filename}",
    }
