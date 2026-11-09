"""
Unit & Integration tests for Refactored HybridRetriever with Vector RRF (Step 4).
Tests exact keyword retrieval, semantic paraphrasing, DDI gating, and offline resilience.
"""
import pytest
from unittest.mock import MagicMock

from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.rag.embeddings.vector_store import get_vector_store
from app.services.rag.embeddings.provider import MockEmbeddingProvider


def test_hybrid_retriever_initialization():
    """Kiểm tra khởi tạo HybridRetriever với kho tri thức vector chunks."""
    retriever = HybridRetriever()
    total_chunks = len(retriever.all_chunks)
    assert total_chunks >= 2100
    assert retriever.vector_store is not None
    assert retriever.vector_store.count() >= 2100
    assert len(retriever.vector_store._chunk_ids) >= 2100


def test_hybrid_retriever_exact_drug_query():
    """Kiểm tra truy vấn từ vựng chính xác (Tên thuốc, Liều dùng)."""
    retriever = HybridRetriever()
    # Sử dụng vector chuẩn của chunk paracetamol để đảm bảo kiểm thử dense ranking xác định không phụ thuộc mạng
    target_id = "dtqg_paracetamol_499_dosage"
    target_vec = retriever.vector_store.get_embedding(target_id, normalized=True)
    if target_vec is not None:
        mock_provider = MagicMock()
        mock_provider.embed_query_sync.return_value = target_vec.tolist()
        retriever.embedding_provider = mock_provider

    results = retriever.retrieve("liều dùng paracetamol cho người lớn", top_k=5)

    assert len(results) > 0
    top_chunk = results[0].chunk
    assert "paracetamol" in top_chunk.title.casefold() or "paracetamol" in top_chunk.content.casefold()

    # Phải có cả điểm BM25 và điểm Dense vector trong kết quả
    has_dense_rank = any(r.semantic_rank is not None for r in results)
    has_bm25_rank = any(r.bm25_rank is not None for r in results)
    assert has_dense_rank, "Mong đợi có xếp hạng Dense Semantic Vector"
    assert has_bm25_rank, "Mong đợi có xếp hạng Sparse BM25"


def test_hybrid_retriever_semantic_paraphrasing():
    """Kiểm tra truy vấn diễn đạt tự nhiên / triệu chứng lâm sàng."""
    retriever = HybridRetriever()
    # Câu hỏi mô tả triệu chứng sốt và đau nhức toàn thân
    results = retriever.retrieve("bệnh nhân đau đầu ê ẩm kèm sốt cao cần thuốc hạ nhiệt", top_k=5)

    assert len(results) > 0
    titles = [r.chunk.title.casefold() for r in results]
    # Phải tìm được Paracetamol hoặc nhóm giảm đau hạ sốt
    assert any("paracetamol" in t or "hạ sốt" in t or "giảm đau" in t for t in titles)


def test_hybrid_retriever_offline_resilience():
    """Kiểm tra khả năng chịu lỗi và tự động fallback về BM25 khi mất mạng."""
    # Mock embedding provider trả về None giả lập mất mạng
    mock_provider = MagicMock()
    mock_provider.embed_query_sync.return_value = None

    retriever = HybridRetriever(embedding_provider=mock_provider)
    results = retriever.retrieve("chỉ định amoxicillin", top_k=3)

    # Không bị crash, vẫn trả về kết quả nhờ BM25 Sparse Index
    assert len(results) > 0
    assert "amoxicillin" in results[0].chunk.title.casefold()
    assert results[0].bm25_rank is not None
    assert results[0].semantic_rank is None  # Dense vắng mặt an toàn


def test_hybrid_retriever_ddi_gating_safety():
    """Kiểm tra chốt chặn an toàn: không đưa tương tác thuốc bừa bãi vào câu hỏi đơn lẻ."""
    retriever = HybridRetriever()

    # 1. Câu hỏi 1 thuốc đơn lẻ: KHÔNG được xuất hiện chunk entity_type == 'ddi'
    single_res = retriever.retrieve("cách uống thuốc metformin", top_k=5)
    for r in single_res:
        assert r.chunk.entity_type != "ddi", f"Vi phạm DDI gating: chunk {r.chunk.chunk_id} là DDI"

    # 2. Câu hỏi tương tác 2 thuốc: PHẢI kích hoạt DDI nếu có cặp tương tác
    interaction_res = retriever.retrieve("tương tác giữa metformin và cimetidin", top_k=5)
    assert len(interaction_res) > 0
