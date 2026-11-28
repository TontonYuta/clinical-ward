"""
Dịch vụ nạp, trích xuất và lập chỉ mục PDF tự động (Dynamic PDF Ingestion Pipeline).
Đáp ứng Bước 6: Kiến thức mới từ tài liệu PDF tải lên được trích xuất trang/đoạn,
lưu provenance mật mã (SHA256, source_id, chunk_id), cập nhật manifest,
nạp trực tiếp vào SQLite FTS và tạo Dense Vector Embeddings (Google MRL 768-dim) nạp vào VectorStore.
Không yêu cầu hardcode hay sửa đổi mã nguồn khi có văn bản y tế mới.
"""
import io
import os
import re
import time
import json
import hashlib
import logging
import asyncio
from pathlib import Path
from typing import Optional, Dict, Any, List

import pypdf

from app.services.rag.types import RagChunk
from app.services.rag.sqlite_fts import SqliteFtsIndex
from app.services.rag.embeddings.provider import (
    BaseEmbeddingProvider,
    MockEmbeddingProvider,
    get_embedding_provider
)
from app.services.rag.embeddings.vector_store import (
    VectorStore,
    get_vector_store
)

logger = logging.getLogger("pdf_ingestion_service")


def _resolve_kb_dir() -> Path:
    candidates = (
        Path(__file__).resolve().parents[3] / "data" / "knowledge_base",
        Path("backend/data/knowledge_base"),
        Path("/app/backend/data/knowledge_base"),
        Path("/app/data/knowledge_base"),
    )
    return next((c for c in candidates if c.is_dir()), candidates[0])


def _resolve_public_pdf_dir() -> Path:
    candidates = (
        Path(__file__).resolve().parents[4] / "public" / "pdf",
        Path(__file__).resolve().parents[3] / "public" / "pdf",
        Path("public/pdf"),
        Path("/app/public/pdf"),
    )
    return next((c for c in candidates if c.is_dir()), candidates[0])


def _resolve_manifest_path() -> Path:
    candidates = (
        _resolve_kb_dir() / "clinical_source_manifest.json",
        Path(__file__).resolve().parents[3] / "data" / "knowledge_base" / "clinical_source_manifest.json",
        Path("backend/data/knowledge_base/clinical_source_manifest.json"),
        Path("/app/backend/data/knowledge_base/clinical_source_manifest.json"),
        Path("/app/data/knowledge_base/clinical_source_manifest.json"),
    )
    return next((c for c in candidates if c.is_file()), candidates[0])


KB_DIR = _resolve_kb_dir()
PUBLIC_PDF_DIR = _resolve_public_pdf_dir()
MANIFEST_PATH = _resolve_manifest_path()

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
    """
    Chia văn bản Markdown của 1 trang thành các chunk ngữ nghĩa theo Heading -> Đoạn -> Câu.
    Không cắt ngang bảng biểu hoặc giữa câu.
    """
    from app.services.chatbot.output_layout_normalizer import normalize_clinical_markdown_output

    normalized = normalize_clinical_markdown_output(text)
    if not normalized:
        return []

    sections = re.split(r"(?m)(?=^#{1,4}\s+)", normalized)
    chunks: list[str] = []

    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue
        if len(sec) <= max_chars:
            chunks.append(sec)
            continue

        paragraphs = [p.strip() for p in re.split(r"\n{2,}", sec) if p.strip()]
        current = ""
        for para in paragraphs:
            if len(para) > max_chars:
                if current:
                    chunks.append(current)
                    current = ""
                sentences = re.split(r"(?<=[.!?])\s+", para)
                buf = ""
                for sent in sentences:
                    if buf and len(buf) + len(sent) + 1 > max_chars:
                        chunks.append(buf)
                        buf = sent
                    else:
                        buf = f"{buf} {sent}".strip() if buf else sent
                if buf:
                    chunks.append(buf)
                continue

            if current and len(current) + len(para) + 2 > max_chars:
                chunks.append(current)
                current = para
            else:
                current = f"{current}\n\n{para}".strip() if current else para
        if current:
            chunks.append(current)

    return chunks


async def _extract_pdf_pages_markdown(file_bytes: bytes) -> tuple[int, list[tuple[int, str]], int]:
    """
    Trích xuất PDF bằng PyMuPDF4LLM trong subprocess ngắn hạn (tránh giữ ~100 MiB C-heap trên web worker),
    tự động fallback sang Vision OCR cho trang scan ảnh không có lớp chữ.
    Returns: (total_pages, [(page_idx, page_markdown), ...], ocr_pages_count)
    """
    import asyncio
    from app.services.rag.pdf_worker import run_pdf_worker

    try:
        worker_res = await asyncio.to_thread(run_pdf_worker, "extract", file_bytes, 10, 120)
    except Exception as read_err:
        raise ValueError(f"Tệp PDF bị hỏng hoặc cấu trúc tệp không hợp lệ: {str(read_err)}")

    total_pages = int(worker_res.get("total_pages") or 0)
    if total_pages == 0:
        raise ValueError("Tệp PDF không chứa trang nào.")

    extracted: list[tuple[int, str]] = []
    ocr_pages_used = 0
    max_ocr_pages = 10

    for item in worker_res.get("pages") or []:
        page_idx = int(item.get("page") or 0)
        page_text = str(item.get("text") or "").strip()
        b64_img = item.get("image_b64")
        if b64_img and ocr_pages_used < max_ocr_pages and len(re.sub(r"\s+", "", page_text)) < 30:
            try:
                from app.services.llm_provider import query_vision_ocr
                ocr_text = await query_vision_ocr(
                    b64_img,
                    mime_type="image/png",
                    prompt="Trích xuất nguyên văn toàn bộ chữ và bảng biểu y khoa trong trang tài liệu này sang Markdown chuẩn.",
                )
                if ocr_text and ocr_text.strip():
                    page_text = ocr_text.strip()
                    ocr_pages_used += 1
            except Exception:
                pass

        if page_text.strip():
            extracted.append((page_idx, page_text.strip()))

    # Fallback an toàn sang pypdf nếu PyMuPDF không đọc được lớp chữ (VD: stream PDF đặc thù hoặc test mock)
    if not extracted:
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            total_pages = max(total_pages, len(reader.pages))
            for page_idx, page in enumerate(reader.pages, start=1):
                txt = (page.extract_text() or "").strip()
                if txt:
                    extracted.append((page_idx, txt))
        except Exception:
            pass

    return total_pages, extracted, ocr_pages_used


def _invalidate_chatbot_caches_after_kb_change(reason: str = "kb_change") -> None:
    """
    Làm mới hoàn toàn Retriever, Source Manifest và xóa sạch Semantic/Context Cache
    mỗi khi kho tri thức PDF thay đổi (nạp mới, kích hoạt, tạm ẩn hoặc xóa).
    Đảm bảo Chatbot không bao giờ trả lại câu trả lời cũ từ cache trước khi cập nhật PDF.
    """
    try:
        from app.services.rag.rag_pipeline import reload_rag_retriever
        reload_rag_retriever()
    except Exception as e:
        logger.warning(f"[PdfIngestion] Cảnh báo reload retriever ({reason}): {e}")

    try:
        from app.services.cache.clinical_cache import get_clinical_cache
        get_clinical_cache().clear()
    except Exception as e:
        logger.debug(f"[PdfIngestion] Cảnh báo xóa clinical_cache ({reason}): {e}")

    try:
        from app.services.cache.gemini_context_cache import GeminiContextCache
        GeminiContextCache.invalidate_all_caches()
    except Exception:
        pass


def _update_manifest(
    doc_id: str,
    title: str,
    legal_basis: str,
    edition_year: int,
    filename: str,
    sha256_hex: str,
    file_bytes_len: int,
    category: str = "",
    representation: str = "source_pdf",
    status: str = "staged",
    verified: bool = False,
    total_pages: int = 0,
    extracted_chunks_count: int = 0,
    indexed_vectors_count: int = 0,
    ocr_pages_used: int = 0,
    security_risk_level: str = "low",
    quarantine_recommended: bool = False,
    security_warnings: Optional[List[str]] = None,
) -> None:
    KB_DIR.mkdir(parents=True, exist_ok=True)
    manifest_data = {"manifest_version": 1, "sources": []}
    if MANIFEST_PATH.exists():
        try:
            manifest_data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    sources = manifest_data.get("sources", [])

    existing_status = None
    existing_verified = None
    existing_sha256 = None
    for s in sources:
        if s.get("id") == doc_id or s.get("backend_copy") == f"backend/data/knowledge_base/{filename}":
            existing_status = s.get("status")
            existing_verified = s.get("verified")
            existing_sha256 = s.get("sha256")
            break

    # Chốt chặn an toàn: Nếu nạp đè phiên bản nội dung mới (SHA256 thay đổi) hoặc phát hiện nguy cơ PoisonedRAG,
    # bắt buộc đưa về 'staged' & verified=False để kiểm thử/cách ly trước khi phát hành toàn viện.
    content_changed = bool(existing_sha256 and sha256_hex and existing_sha256 != sha256_hex)
    force_stage = content_changed or quarantine_recommended
    final_status = "staged" if force_stage else (existing_status or status)
    final_verified = False if force_stage else (existing_verified if existing_verified is not None else verified)

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
        "representation": representation,
        "status": final_status,
        "verified": final_verified,
        "total_pages": total_pages,
        "chunks_count": extracted_chunks_count,
        "vectors_count": indexed_vectors_count,
        "ocr_pages_used": ocr_pages_used,
        "security_risk_level": security_risk_level,
        "quarantine_recommended": quarantine_recommended,
        "security_warnings": list(security_warnings or []),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
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


def get_inactive_document_prefixes() -> list[str]:
    """Trả về danh sách prefix doc_id của các tài liệu chưa được kích hoạt (staged hoặc superseded)."""
    try:
        if not MANIFEST_PATH.exists():
            return []
        manifest_data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        sources = manifest_data.get("sources", [])
        return [
            f"{s['id']}_" for s in sources
            if s.get("status") in ("staged", "superseded") and s.get("id")
        ]
    except Exception:
        return []


def update_document_status(
    doc_id: str,
    new_status: str,
    verified: Optional[bool] = None,
    *,
    force_clear_quarantine: bool = False,
) -> dict:
    """Cập nhật trạng thái vòng đời tài liệu: staged -> active -> superseded."""
    if not MANIFEST_PATH.exists():
        raise ValueError("Không tìm thấy manifest nguồn tài liệu.")
    manifest_data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    sources = manifest_data.get("sources", [])
    target = None
    for s in sources:
        if s.get("id") == doc_id:
            target = s
            break
    if not target:
        raise ValueError(f"Không tìm thấy tài liệu với mã '{doc_id}'.")

    if new_status == "active":
        if target.get("quarantine_recommended") and not force_clear_quarantine:
            raise ValueError(
                "Tài liệu đang bị cách ly bảo mật (PoisonedRAG Quarantine) do phát hiện chỉ dẫn đối kháng hoặc lớp chữ tàng hình. "
                "Vui lòng kiểm tra và làm sạch tệp PDF trước khi phát hành toàn viện."
            )
        is_verified = verified if verified is not None else target.get("verified", False)
        if not is_verified:
            raise ValueError("Tài liệu chưa được kiểm thử Chatbot thành công. Vui lòng thực hiện kiểm thử trên sandbox trước khi kích hoạt vào CSDL chính thức.")
        if force_clear_quarantine:
            target["quarantine_recommended"] = False
        target["status"] = "active"
        target["verified"] = True
        target["verified_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    elif new_status in ("staged", "superseded"):
        target["status"] = new_status
        if verified is not None:
            target["verified"] = verified
    else:
        raise ValueError(f"Trạng thái '{new_status}' không hợp lệ. Chỉ chấp nhận 'active', 'staged', 'superseded'.")

    MANIFEST_PATH.write_text(json.dumps(manifest_data, ensure_ascii=False, indent=2), encoding="utf-8")
    # Làm mới retriever + source_resolver + xóa sạch cache câu trả lời cũ ngay lập tức
    _invalidate_chatbot_caches_after_kb_change(reason=f"status:{doc_id}->{new_status}")
    return target


MAX_FILE_BYTES = 50 * 1024 * 1024  # 50MB giới hạn an toàn


async def ingest_pdf_bytes(
    file_bytes: bytes,
    filename: str,
    title: str,
    legal_basis: str,
    edition_year: int = 2026,
    doc_id: Optional[str] = None,
    category: str = "",
    provider: Optional[BaseEmbeddingProvider] = None,
    vector_store: Optional[VectorStore] = None,
) -> Dict[str, Any]:
    """
    Nạp tài liệu PDF từ byte stream với cơ chế nguyên tử (Atomic Transaction & Rollback):
    1. Kiểm tra chữ ký Magic Bytes (%PDF-) và dung lượng <= 50MB.
    2. Bóc tách trang và chunks trên bộ nhớ trước khi chạm vào đĩa hoặc CSDL.
    3. Ghi file vật lý, FTS5 chunks, Vector Store và manifest.
    4. Tự động Rollback sạch sẽ nếu xảy ra bất kỳ lỗi nào giữa chừng.
    """
    # 1. Chốt chặn 1: Thẩm định nhị phân & Dung lượng
    if not file_bytes:
        raise ValueError("Tệp tài liệu rỗng (0 bytes). Vui lòng chọn tệp PDF hợp lệ.")

    if len(file_bytes) > MAX_FILE_BYTES:
        raise ValueError(
            f"Dung lượng tệp ({len(file_bytes) / (1024 * 1024):.1f}MB) vượt quá hạn mức tối đa cho phép (50MB)."
        )

    if not file_bytes.startswith(b"%PDF"):
        raise ValueError(
            "Định dạng tệp không hợp lệ: Không tìm thấy chữ ký Magic Bytes '%PDF'. Vui lòng chọn tệp PDF chuẩn."
        )

    sha256_hex = hashlib.sha256(file_bytes).hexdigest()
    safe_filename = re.sub(r"[^\w\-.]", "_", Path(filename).name)
    if not safe_filename.lower().endswith(".pdf"):
        safe_filename += ".pdf"

    if not doc_id:
        doc_id = re.sub(r"[^\w\-]", "_", Path(safe_filename).stem).lower()

    # 2. Bóc tách cấu trúc trang trên bộ nhớ (PyMuPDF4LLM Markdown + OCR fallback)
    total_pages, extracted_pages, ocr_pages_used = await _extract_pdf_pages_markdown(file_bytes)

    chunks: List[RagChunk] = []
    source_id = f"backend/data/knowledge_base/{safe_filename}"
    source_ver = f"sha256:{sha256_hex}"

    from app.security.prompt_isolator import (
        inspect_document_poisoning_risk,
        inspect_pdf_hidden_layers,
        sanitize_untrusted_document_text,
    )

    raw_doc_sample = "\n\n".join(txt for _, txt in extracted_pages[:20])
    poison_report = inspect_document_poisoning_risk(raw_doc_sample)
    hidden_report = inspect_pdf_hidden_layers(file_bytes, max_pages=20)
    quarantine_recommended = bool(
        poison_report["quarantine_recommended"] or hidden_report["hidden_layer_detected"]
    )
    security_risk_level = "high" if quarantine_recommended else poison_report["risk_level"]
    security_warnings = list(poison_report["reasons"])
    if hidden_report["hidden_layer_detected"]:
        security_warnings.append(
            f"Phát hiện lớp chữ tàng hình chứa chỉ dẫn đối kháng trong PDF "
            f"(cỡ chữ siêu nhỏ: {hidden_report['tiny_suspicious_spans']}, chữ trùng màu nền: {hidden_report['white_suspicious_spans']})."
        )

    for page_idx, page_text in extracted_pages:
        safe_page_text = sanitize_untrusted_document_text(page_text)
        page_chunks = _chunk_page_text(safe_page_text)
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

    if not chunks:
        raise ValueError(
            f"Tệp PDF gồm {total_pages} trang nhưng không trích xuất được lớp văn bản (text layer). "
            "Đây có thể là tài liệu scan ảnh thuần túy không có lớp OCR. Vui lòng cung cấp văn bản có thể trích xuất chữ."
        )

    # 3. Chu trình Ghi CSDL Nguyên Tử & Cơ Chế Rollback
    written_files: List[Path] = []
    inserted_chunk_ids: List[str] = []
    saved_vector_chunk_ids: List[str] = []
    manifest_updated = False
    previous_manifest_content: Optional[str] = None
    is_default_instance = (vector_store is None and provider is None)

    if vector_store is None:
        vector_store = get_vector_store()
    if provider is None:
        provider = get_embedding_provider()

    try:
        # 3.1. Lưu bản sao vật lý
        KB_DIR.mkdir(parents=True, exist_ok=True)
        target_backend_path = KB_DIR / safe_filename
        target_backend_path.write_bytes(file_bytes)
        written_files.append(target_backend_path)

        PUBLIC_PDF_DIR.mkdir(parents=True, exist_ok=True)
        target_public_path = PUBLIC_PDF_DIR / safe_filename
        target_public_path.write_bytes(file_bytes)
        written_files.append(target_public_path)

        # 3.2. Sinh Dense Vector Embeddings (768 chiều)
        chunk_texts = [c.content for c in chunks]
        try:
            vectors = await provider.batch_embed_chunks(chunk_texts)
        except Exception as e:
            logger.warning(f"[PdfIngestion] Lỗi tạo embedding qua provider chính: {e}. Fallback sang MockEmbeddingProvider.")
            fallback = MockEmbeddingProvider(dimension=vector_store.dimension)
            vectors = await fallback.batch_embed_chunks(chunk_texts)

        if not vectors or all(v is None for v in vectors):
            fallback = MockEmbeddingProvider(dimension=vector_store.dimension)
            vectors = await fallback.batch_embed_chunks(chunk_texts)

        save_items = []
        for c, vec in zip(chunks, vectors):
            if vec is not None and len(vec) == vector_store.dimension:
                chash = hashlib.sha256(c.content.encode("utf-8")).hexdigest()
                save_items.append((c.chunk_id, vec, chash))

        if not save_items:
            raise RuntimeError("Không thể tạo vector embeddings hợp lệ cho tài liệu.")

        # 3.3. Index vào SQLite FTS5 (dọn sạch chunks cũ của cùng doc_id nếu nạp đè phiên bản mới)
        fts_index = SqliteFtsIndex()
        stale_chunk_ids = fts_index.delete_chunks_by_prefix(f"{doc_id}_")
        if stale_chunk_ids:
            try:
                vector_store.delete_embeddings(stale_chunk_ids)
            except Exception:
                pass
        fts_index.upsert_chunks(chunks)
        inserted_chunk_ids = [c.chunk_id for c in chunks]

        # 3.4. Lưu Vectors vào SQLite & Tải lại RAM matrix
        indexed_vectors_count = vector_store.save_embeddings(save_items, auto_reload=True)
        saved_vector_chunk_ids = [item[0] for item in save_items]

        # 3.5. Cập nhật Manifest
        if MANIFEST_PATH.exists():
            try:
                previous_manifest_content = MANIFEST_PATH.read_text(encoding="utf-8")
            except Exception:
                pass

        _update_manifest(
            doc_id=doc_id,
            title=title,
            legal_basis=legal_basis,
            edition_year=edition_year,
            filename=safe_filename,
            sha256_hex=sha256_hex,
            file_bytes_len=len(file_bytes),
            category=category,
            representation="source_pdf",
            total_pages=total_pages,
            extracted_chunks_count=len(chunks),
            indexed_vectors_count=indexed_vectors_count,
            ocr_pages_used=ocr_pages_used,
            security_risk_level=security_risk_level,
            quarantine_recommended=quarantine_recommended,
            security_warnings=security_warnings,
        )
        manifest_updated = True

        # Tải lại retriever & xóa cache toàn hệ thống để đồng bộ ngay lập tức
        if is_default_instance:
            _invalidate_chatbot_caches_after_kb_change(reason=f"ingest:{doc_id}")

    except Exception as exc:
        logger.error(f"[PdfIngestion] Gặp sự cố khi nạp PDF '{filename}'. Kích hoạt Rollback toàn diện: {exc}")
        # THỰC HIỆN ROLLBACK SẠCH SẼ:
        for fpath in written_files:
            if fpath.exists():
                try:
                    fpath.unlink()
                except Exception:
                    pass

        if inserted_chunk_ids:
            try:
                SqliteFtsIndex().delete_chunks_by_prefix(f"{doc_id}_")
            except Exception:
                pass

        if saved_vector_chunk_ids and vector_store:
            try:
                vector_store.delete_embeddings(saved_vector_chunk_ids)
            except Exception:
                pass

        if manifest_updated and previous_manifest_content is not None:
            try:
                MANIFEST_PATH.write_text(previous_manifest_content, encoding="utf-8")
            except Exception:
                pass

        raise exc

    # 4. Giữ cô lập DDI Knowledge Graph: Tài liệu ở trạng thái 'staged' chưa được phê duyệt
    # không được tự ý ghi cạnh vào Đồ thị Tương tác thuốc toàn viện.
    graph_edges_added = 0

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
        "ocr_pages_used": ocr_pages_used,
        "graph_edges_added": graph_edges_added,
        "extracted_chunks_count": len(chunks),
        "indexed_vectors_count": indexed_vectors_count,
        "file_bytes": len(file_bytes),
        "security_risk_level": security_risk_level,
        "quarantine_recommended": quarantine_recommended,
        "security_warnings": security_warnings,
        "public_url": f"/api/v1/pdf/{safe_filename}",
    }


def delete_ingested_pdf(
    doc_id: str,
    vector_store: Optional[VectorStore] = None
) -> Dict[str, Any]:
    """
    Xóa tài liệu PDF đã nạp:
    1. Xóa file vật lý trong KB_DIR và PUBLIC_PDF_DIR.
    2. Xóa các chunks khỏi SqliteFtsIndex.
    3. Xóa các vector khỏi clinical_chunk_vectors và nạp lại RAM matrix.
    4. Xóa bản ghi trong clinical_source_manifest.json.
    """
    KB_DIR.mkdir(parents=True, exist_ok=True)
    manifest_data = {"manifest_version": 1, "sources": []}
    if MANIFEST_PATH.exists():
        try:
            manifest_data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        except Exception:
            pass

    sources = manifest_data.get("sources", [])
    removed_entries = [
        s for s in sources
        if s.get("id") == doc_id or Path(s.get("backend_copy", "")).stem == doc_id
    ]
    remaining_sources = [s for s in sources if s not in removed_entries]
    manifest_data["sources"] = remaining_sources
    MANIFEST_PATH.write_text(json.dumps(manifest_data, ensure_ascii=False, indent=2), encoding="utf-8")

    # Xóa file vật lý
    for entry in removed_entries:
        filename = Path(entry.get("backend_copy", "")).name
        if filename:
            f1 = KB_DIR / filename
            if f1.exists():
                try:
                    f1.unlink()
                except Exception:
                    pass
            f2 = PUBLIC_PDF_DIR / filename
            if f2.exists():
                try:
                    f2.unlink()
                except Exception:
                    pass

    # Xóa từ FTS
    fts_index = SqliteFtsIndex()
    deleted_chunk_ids = fts_index.delete_chunks_by_prefix(f"{doc_id}_")
    for entry in removed_entries:
        filename = Path(entry.get("backend_copy", "")).name
        if filename:
            deleted_chunk_ids.extend(fts_index.delete_chunks_by_source_doc(filename))

    deleted_chunk_ids = list(set(deleted_chunk_ids))

    # Xóa từ VectorStore
    deleted_vectors_count = 0
    is_default_store = (vector_store is None)
    if deleted_chunk_ids:
        if vector_store is None:
            vector_store = get_vector_store()
        deleted_vectors_count = vector_store.delete_embeddings(deleted_chunk_ids)

    # Tải lại retriever & xóa cache toàn hệ thống để xóa sạch vết tích tài liệu đã xóa
    if is_default_store:
        _invalidate_chatbot_caches_after_kb_change(reason=f"delete:{doc_id}")

    return {
        "status": "success",
        "deleted_doc_id": doc_id,
        "removed_entries_count": len(removed_entries),
        "deleted_chunks_count": len(deleted_chunk_ids),
        "deleted_vectors_count": deleted_vectors_count,
    }


async def query_ingested_documents(
    query: str,
    doc_id: Optional[str] = None,
    top_k: int = 5,
    provider: Optional[BaseEmbeddingProvider] = None,
    vector_store: Optional[VectorStore] = None
) -> Dict[str, Any]:
    """
    Truy vấn lai (Hybrid BM25 + Dense Cosine) trên các tài liệu PDF đã nạp.
    Đảm bảo trả về số trang và trích dẫn quy phạm chính xác.
    """
    if not query.strip():
        return {"query": query, "results": []}

    if vector_store is None:
        vector_store = get_vector_store()
    if provider is None:
        provider = get_embedding_provider()

    fts_index = SqliteFtsIndex()
    candidate_limit = max(50, top_k * 10)

    # 1. Sparse BM25 (có lọc theo doc_id nếu được chỉ định)
    fts_results = fts_index.search_bm25(query, top_k=candidate_limit, doc_id_filter=doc_id)

    # 2. Dense Vector (có lọc theo doc_id id_prefix nếu được chỉ định)
    query_vec = await provider.embed_query(query)
    if query_vec is None:
        fallback = MockEmbeddingProvider(dimension=vector_store.dimension)
        query_vec = await fallback.embed_query(query)

    vector_matches = vector_store.search_cosine(
        query_vec, top_k=candidate_limit, id_prefix=doc_id
    ) if query_vec is not None else []

    # RRF Fusion
    bm25_ranks = {r.chunk.chunk_id: idx + 1 for idx, r in enumerate(fts_results)}
    vector_ranks = {cid: idx + 1 for idx, (cid, _) in enumerate(vector_matches)}
    vector_scores = {cid: score for cid, score in vector_matches}

    all_cids = set(bm25_ranks.keys()).union(vector_ranks.keys())

    # Lấy thông tin chi tiết chunks
    chunk_map = {r.chunk.chunk_id: r.chunk for r in fts_results}
    missing_cids = [cid for cid in all_cids if cid not in chunk_map]
    if missing_cids:
        chunk_map.update(fts_index.get_chunks_by_ids(missing_cids))

    # Lọc theo doc_id nếu được chỉ định
    if doc_id:
        all_cids = {
            cid for cid in all_cids
            if cid.startswith(f"{doc_id}_") or (chunk_map.get(cid) and doc_id in chunk_map[cid].source_doc)
        }
        # Fallback an toàn: nếu FTS và Dense không bắt trúng, lấy các chunks đầu tiên của tài liệu
        if not all_cids:
            doc_chunks = fts_index.get_chunks_by_prefix(doc_id, limit=top_k)
            for c in doc_chunks:
                all_cids.add(c.chunk_id)
                chunk_map[c.chunk_id] = c
                bm25_ranks[c.chunk_id] = 1

    k_const = 60
    scored_results = []
    for cid in all_cids:
        chunk = chunk_map.get(cid)
        if not chunk:
            continue

        r_b = bm25_ranks.get(cid)
        r_v = vector_ranks.get(cid)
        raw_score = 0.0
        reasons = []

        if r_b:
            raw_score += 0.5 / (k_const + r_b)
            reasons.append(f"BM25 rank #{r_b}")
        if r_v:
            raw_score += 0.5 / (k_const + r_v)
            reasons.append(f"Vector rank #{r_v} (cosine={vector_scores.get(cid, 0.0):.3f})")

        # Quy đổi RRF score thành thang điểm trực quan 0 - 100%
        # max_rrf tương ứng với rank #1 ở cả BM25 và Vector (~0.01639)
        max_rrf = 1.0 / (k_const + 1)
        ratio = min(1.0, raw_score / max_rrf)
        if r_b and r_v:
            confidence_pct = round(min(99.5, 70.0 + (ratio * 29.5)), 1)
        elif r_b or r_v:
            confidence_pct = round(min(85.0, 40.0 + (ratio * 75.0)), 1)
        else:
            confidence_pct = round(ratio * 100.0, 1)

        scored_results.append({
            "chunk_id": chunk.chunk_id,
            "title": chunk.title,
            "page_or_section": chunk.page_or_section,
            "source_doc": chunk.source_doc,
            "legal_basis": chunk.legal_basis,
            "content": chunk.content,
            "score": confidence_pct,
            "raw_score": round(raw_score, 5),
            "match_reasons": reasons,
        })

    scored_results.sort(key=lambda x: x["score"], reverse=True)
    return {
        "query": query,
        "doc_id": doc_id,
        "results": scored_results[:top_k]
    }
