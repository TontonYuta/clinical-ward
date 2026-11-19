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

    # 2. Bóc tách cấu trúc trang trên bộ nhớ (In-Memory Pre-Extraction)
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        total_pages = len(reader.pages)
    except Exception as read_err:
        raise ValueError(f"Tệp PDF bị hỏng hoặc cấu trúc tệp không hợp lệ: {str(read_err)}")

    if total_pages == 0:
        raise ValueError("Tệp PDF không chứa trang nào.")

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

        # 3.3. Index vào SQLite FTS5
        fts_index = SqliteFtsIndex()
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
            representation="source_pdf"
        )
        manifest_updated = True

        # Tải lại retriever toàn hệ thống để lập tức truy xuất tài liệu mới
        if is_default_instance:
            try:
                from app.services.rag.rag_pipeline import reload_rag_retriever
                reload_rag_retriever()
            except Exception as e:
                logger.warning(f"[PdfIngestion] Cảnh báo reload retriever: {e}")

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
        "indexed_vectors_count": indexed_vectors_count,
        "file_bytes": len(file_bytes),
        "public_url": f"/api/v1/pdf/{safe_filename}",
    }


def ingest_pdf_bytes_sync(
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
    """Phiên bản đồng bộ của ingest_pdf_bytes dành cho CLI/scripts."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(ingest_pdf_bytes(
            file_bytes=file_bytes,
            filename=filename,
            title=title,
            legal_basis=legal_basis,
            edition_year=edition_year,
            doc_id=doc_id,
            category=category,
            provider=provider,
            vector_store=vector_store,
        ))

    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(
            asyncio.run,
            ingest_pdf_bytes(
                file_bytes=file_bytes,
                filename=filename,
                title=title,
                legal_basis=legal_basis,
                edition_year=edition_year,
                doc_id=doc_id,
                category=category,
                provider=provider,
                vector_store=vector_store,
            )
        ).result()


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

    # Tải lại retriever toàn hệ thống để xóa sạch vết tích tài liệu đã xóa
    if is_default_store:
        try:
            from app.services.rag.rag_pipeline import reload_rag_retriever
            reload_rag_retriever()
        except Exception as e:
            logger.warning(f"[PdfIngestion] Cảnh báo reload retriever khi xóa: {e}")

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

    # 1. Sparse BM25
    fts_results = fts_index.search_bm25(query, top_k=candidate_limit)

    # 2. Dense Vector
    query_vec = await provider.embed_query(query)
    if query_vec is None:
        fallback = MockEmbeddingProvider(dimension=vector_store.dimension)
        query_vec = await fallback.embed_query(query)

    vector_matches = vector_store.search_cosine(query_vec, top_k=candidate_limit) if query_vec is not None else []

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
