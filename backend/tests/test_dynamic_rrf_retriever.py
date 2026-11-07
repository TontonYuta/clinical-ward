"""
Unit & Dynamic Cut-off Tests for DynamicHybridRetriever (Technique 5).
Kiểm thử ngưỡng cắt động theo độ dốc RRF và loại bỏ fixed top_k.
"""
import pytest
from app.services.rag.types import RagChunk, RetrievedChunk
from app.services.rag.dynamic_rrf_retriever import (
    calculate_dynamic_cutoff,
    DynamicHybridRetriever
)

def _make_dummy_chunk(chunk_id: str, score: float) -> RetrievedChunk:
    chunk = RagChunk(
        chunk_id=chunk_id,
        source_doc="DĐVN V",
        legal_basis="Dược thư Quốc gia V",
        page_or_section="1",
        title=f"Title {chunk_id}",
        content="Nội dung chuyên luận",
        keywords=["thuốc", "liều dùng"],
        entity_type="monograph"
    )
    return RetrievedChunk(chunk=chunk, score=score)

def test_dynamic_cutoff_prunes_distant_irrelevant_chunks():
    """Khi có 1 chunk điểm số vượt trội, tự động cắt bỏ các chunk đuôi xa."""
    chunks = [
        _make_dummy_chunk("c1", 0.95),
        _make_dummy_chunk("c2", 0.40),  # < 0.95 * 0.65 -> cắt tại đây
        _make_dummy_chunk("c3", 0.20),
        _make_dummy_chunk("c4", 0.10)
    ]
    selected = calculate_dynamic_cutoff(chunks, min_k=1, max_k=5, relative_threshold=0.65)
    assert len(selected) == 1
    assert selected[0].chunk.chunk_id == "c1"

def test_dynamic_cutoff_retains_close_relevant_chunks():
    """Khi các chunk đều có điểm số cao và sát nhau (đa bệnh lý), giữ lại đầy đủ."""
    chunks = [
        _make_dummy_chunk("c1", 0.88),
        _make_dummy_chunk("c2", 0.85),
        _make_dummy_chunk("c3", 0.82),
        _make_dummy_chunk("c4", 0.79),
        _make_dummy_chunk("c5", 0.25)  # Rơi tự do -> cắt tại c4
    ]
    selected = calculate_dynamic_cutoff(chunks, min_k=1, max_k=5, relative_threshold=0.65)
    assert len(selected) == 4
    assert [c.chunk.chunk_id for c in selected] == ["c1", "c2", "c3", "c4"]

def test_dynamic_hybrid_retriever_real_query():
    """Kiểm thử truy xuất thực tế với câu hỏi Dược thư Quốc gia."""
    retriever = DynamicHybridRetriever()
    results = retriever.retrieve("Chuyên luận Paracetamol chỉ định liều dùng", max_k=6)
    assert len(results) >= 1
    assert any("paracetamol" in r.chunk.title.lower() for r in results)
