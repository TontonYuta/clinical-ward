#!/usr/bin/env python3
"""
CLI Script: Batch Vector Indexing for Clinical Knowledge Base.
Processes 2,163 clinical chunks (Dược thư DĐVN V, QĐ 5948/QĐ-BYT, Bộ Y Tế).
Generates 768-dim embeddings via Google Gemini MRL, stores in SQLite,
and exports compressed NPZ cache for ultra-fast server cold starts.
"""
import argparse
import asyncio
import hashlib
import logging
import sys
import time
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

from app.services.rag.clinical_indexer import load_all_clinical_chunks
from app.services.rag.types import RagChunk
from app.services.rag.embeddings.provider import (
    BaseEmbeddingProvider,
    GeminiEmbeddingProvider,
    MockEmbeddingProvider,
    get_embedding_provider,
    DEFAULT_EMBEDDING_DIM
)
from app.services.rag.embeddings.vector_store import (
    VectorStore,
    get_vector_store
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("index_clinical_vectors")

DEFAULT_CACHE_NPZ = Path(__file__).resolve().parent.parent / "services" / "rag" / "embeddings" / "clinical_embeddings_cache.npz"


def format_chunk_for_embedding(chunk: RagChunk) -> str:
    """
    Định dạng nội dung chunk tối ưu cho Dense Retrieval.
    Bao gồm Tiêu đề + Nội dung chuyên luận + Từ khóa chuyên môn (đến 15 keywords).
    """
    text_parts = [chunk.title.strip(), chunk.content.strip()]
    if chunk.keywords:
        kw_clean = [k for k in chunk.keywords if len(k) >= 2][:15]
        if kw_clean:
            text_parts.append(f"Từ khóa: {', '.join(kw_clean)}")
    return "\n".join(text_parts)


def compute_content_hash(text: str) -> str:
    """Tính mã băm SHA-256 để kiểm tra thay đổi nội dung (Incremental Indexing)."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def run_indexing(
    batch_size: int = 40,
    force_reindex: bool = False,
    limit: Optional[int] = None,
    mock: bool = False,
    cache_path: Optional[Path] = None,
    db_path: Optional[str] = None,
    api_key: Optional[str] = None
) -> Tuple[int, int, int]:
    """
    Quy trình vector hóa toàn bộ kho tri thức y khoa lâm sàng.
    Returns: (total_chunks, newly_indexed, skipped_chunks)
    """
    logger.info("=== BẮT ĐẦU QUY TRÌNH VECTOR HÓA KHO TRI THỨC LÂM SÀNG ===")
    
    # 1. Tải toàn bộ chunks
    t0 = time.perf_counter()
    all_chunks = load_all_clinical_chunks()
    if limit and limit > 0:
        all_chunks = all_chunks[:limit]
        logger.info(f"Giới hạn xử lý: {limit} chunks")

    total_count = len(all_chunks)
    logger.info(f"Đã nạp {total_count} chunks y văn từ hệ thống.")

    # 2. Khởi tạo Vector Store & Provider
    store = VectorStore(db_path=db_path, auto_load=False)
    if mock:
        provider = MockEmbeddingProvider()
    elif api_key:
        provider = GeminiEmbeddingProvider(api_key=api_key)
    else:
        provider = get_embedding_provider()
    logger.info(f"Sử dụng Provider: {provider.__class__.__name__} (dim={provider.dimension})")

    # 3. Lấy danh sách hash hiện có trong CSDL
    existing_hashes = {} if force_reindex else store.get_all_content_hashes()
    logger.info(f"Đã tìm thấy {len(existing_hashes)} vectors có sẵn trong CSDL SQLite.")

    # 4. Phân loại chunks cần embed mới vs chunks giữ nguyên
    chunks_to_embed: List[Tuple[RagChunk, str, str]] = []  # (chunk, text, hash)
    skipped_count = 0

    for chunk in all_chunks:
        text = format_chunk_for_embedding(chunk)
        chash = compute_content_hash(text)

        if not force_reindex and chunk.chunk_id in existing_hashes and existing_hashes[chunk.chunk_id] == chash:
            skipped_count += 1
        else:
            chunks_to_embed.append((chunk, text, chash))

    logger.info(f"Số chunks đã cập nhật (bỏ qua): {skipped_count}")
    logger.info(f"Số chunks cần sinh vector mới: {len(chunks_to_embed)}")

    if not chunks_to_embed:
        logger.info("Tất cả chunks đều đã có vector mới nhất. Không cần gọi API.")
        # Đảm bảo xuất file cache NPZ từ SQLite
        out_npz = cache_path or DEFAULT_CACHE_NPZ
        store.load_in_memory_index(prefer_cache=False)
        store.export_npz(out_npz)
        return total_count, 0, skipped_count

    # 5. Xử lý theo từng batch
    newly_indexed = 0
    num_batches = (len(chunks_to_embed) + batch_size - 1) // batch_size

    for b_idx in range(num_batches):
        start_i = b_idx * batch_size
        end_i = min(start_i + batch_size, len(chunks_to_embed))
        batch_slice = chunks_to_embed[start_i:end_i]

        batch_texts = [item[1] for item in batch_slice]
        batch_meta = [(item[0].chunk_id, item[2]) for item in batch_slice]

        logger.info(f"Đang xử lý Batch {b_idx + 1}/{num_batches} ({len(batch_texts)} chunks)...")

        # Gọi Embedding API
        vectors = await provider.batch_embed_chunks(batch_texts)

        # Chuẩn bị lưu vào CSDL
        save_items = []
        for (cid, chash), vec in zip(batch_meta, vectors):
            if vec is not None and len(vec) == provider.dimension:
                save_items.append((cid, vec, chash))
            else:
                logger.warning(f"Lỗi tạo vector cho chunk {cid}, bỏ qua.")

        if save_items:
            saved_n = store.save_embeddings(save_items, auto_reload=False)
            newly_indexed += saved_n

        # Nghỉ giữa các batch để tuân thủ giới hạn 15 RPM của Google API
        if b_idx < num_batches - 1 and not mock:
            await asyncio.sleep(3.0)

    # 6. Nạp lại RAM từ CSDL SQLite (bỏ qua cache cũ) và Xuất NPZ Cache mới
    store.load_in_memory_index(prefer_cache=False)
    out_npz = cache_path or DEFAULT_CACHE_NPZ
    store.export_npz(out_npz)

    total_time = time.perf_counter() - t0
    logger.info(f"=== HOÀN THÀNH QUY TRÌNH VECTOR HÓA ===")
    logger.info(f"- Tổng số chunks: {total_count}")
    logger.info(f"- Chunks vector hóa mới: {newly_indexed}")
    logger.info(f"- Chunks tái sử dụng (skip): {skipped_count}")
    logger.info(f"- Tổng số vectors trong CSDL: {store.count()}")
    logger.info(f"- File cache NPZ: {out_npz} (tồn tại: {Path(out_npz).exists()})")
    logger.info(f"- Tổng thời gian: {total_time:.2f}s")

    return total_count, newly_indexed, skipped_count


def main():
    parser = argparse.ArgumentParser(description="Batch Vector Indexing for Clinical RAG")
    parser.add_argument("--batch-size", type=int, default=40, help="Số chunks trên mỗi batch API (default: 40)")
    parser.add_argument("--limit", type=int, default=None, help="Giới hạn số chunks xử lý (cho test)")
    parser.add_argument("--force", action="store_true", help="Bắt buộc vector hóa lại toàn bộ")
    parser.add_argument("--mock", action="store_true", help="Dùng MockEmbeddingProvider (offline test)")
    parser.add_argument("--cache-path", type=str, default=None, help="Đường dẫn file cache .npz")
    parser.add_argument("--db-path", type=str, default=None, help="Đường dẫn file SQLite DB")
    parser.add_argument("--api-key", type=str, default=None, help="Khóa API tạm thời cho phiên chạy này")
    args = parser.parse_args()

    cache_path = Path(args.cache_path) if args.cache_path else None
    asyncio.run(run_indexing(
        batch_size=args.batch_size,
        force_reindex=args.force,
        limit=args.limit,
        mock=args.mock,
        cache_path=cache_path,
        db_path=args.db_path,
        api_key=args.api_key
    ))


if __name__ == "__main__":
    main()
