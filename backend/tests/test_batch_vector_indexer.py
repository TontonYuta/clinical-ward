"""
Unit tests for Batch Vector Indexing Pipeline (Step 3).
Verifies formatting, incremental hashing, batch processing, and NPZ caching.
"""
import os
import tempfile
import pytest
from pathlib import Path

from app.services.rag.types import RagChunk
from app.scripts.index_clinical_vectors import (
    format_chunk_for_embedding,
    compute_content_hash,
    run_indexing
)
from app.services.rag.embeddings.vector_store import VectorStore


def test_format_chunk_for_embedding():
    """Kiểm tra định dạng văn bản đưa vào mô hình nhúng vector."""
    chunk = RagChunk(
        chunk_id="test_01",
        source_doc="Dược thư Quốc gia Việt Nam",
        legal_basis="DĐVN V",
        page_or_section="Trang 100",
        title="Chỉ định: Paracetamol",
        content="Hạ sốt và giảm đau mức độ nhẹ đến vừa.",
        keywords=["paracetamol", "hạ sốt", "giảm đau", "a"],
        entity_type="monograph"
    )
    formatted = format_chunk_for_embedding(chunk)
    assert "Chỉ định: Paracetamol" in formatted
    assert "Hạ sốt và giảm đau mức độ nhẹ đến vừa." in formatted
    assert "Từ khóa: paracetamol, hạ sốt, giảm đau" in formatted
    # Không đưa từ khóa 1 ký tự ('a') vào
    assert "Từ khóa: paracetamol, hạ sốt, giảm đau, a" not in formatted


def test_compute_content_hash():
    """Kiểm tra tính xác thực mã băm SHA-256."""
    t1 = "Paracetamol 500mg"
    t2 = "Paracetamol 500mg"
    t3 = "Aspirin 500mg"
    assert compute_content_hash(t1) == compute_content_hash(t2)
    assert compute_content_hash(t1) != compute_content_hash(t3)


@pytest.mark.asyncio
async def test_run_indexing_incremental_and_caching():
    """Kiểm tra toàn bộ pipeline vector hóa có cơ chế Incremental và lưu cache NPZ."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f_db, \
         tempfile.NamedTemporaryFile(suffix=".npz", delete=False) as f_npz:
        db_path = f_db.name
        cache_path = Path(f_npz.name)

    try:
        # 1. Lần 1: Index 15 chunks đầu tiên với mock=True
        total, newly, skipped = await run_indexing(
            batch_size=5,
            limit=15,
            mock=True,
            cache_path=cache_path,
            db_path=db_path
        )
        assert total == 15
        assert newly == 15
        assert skipped == 0

        # Kiểm tra CSDL SQLite và file NPZ
        store = VectorStore(db_path=db_path, auto_load=False)
        assert store.count() == 15
        assert cache_path.exists()
        assert cache_path.stat().st_size > 0

        # 2. Lần 2: Chạy lại không có force -> Phải skip 100% 15 chunks (Incremental Indexing)
        total2, newly2, skipped2 = await run_indexing(
            batch_size=5,
            limit=15,
            mock=True,
            cache_path=cache_path,
            db_path=db_path
        )
        assert total2 == 15
        assert newly2 == 0
        assert skipped2 == 15

        # 3. Lần 3: Chạy lại với force_reindex=True -> Phải re-index lại toàn bộ 15 chunks
        total3, newly3, skipped3 = await run_indexing(
            batch_size=5,
            limit=15,
            force_reindex=True,
            mock=True,
            cache_path=cache_path,
            db_path=db_path
        )
        assert total3 == 15
        assert newly3 == 15
        assert skipped3 == 0

    finally:
        if os.path.exists(db_path):
            os.remove(db_path)
        if os.path.exists(cache_path):
            os.remove(cache_path)
