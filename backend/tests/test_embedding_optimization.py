"""
Test Suite: Embedding Optimization, Shared Memoization, Async Parallelism & Adaptive RRF
Verifies:
1. get_embedding_provider() returns a singleton instance and shares query cache across calls.
2. Embedding memoization prevents redundant computations for identical queries.
3. HybridRetriever.retrieve_async() executes concurrent sparse and dense search.
4. Adaptive RRF dynamically adjusts sparse vs dense weighting according to query characteristics.
"""
import pytest
import asyncio
import numpy as np

from app.services.rag.embeddings.provider import (
    get_embedding_provider,
    BaseEmbeddingProvider,
    GeminiEmbeddingProvider,
    MockEmbeddingProvider
)
from app.services.rag.hybrid_retriever import HybridRetriever, calculate_adaptive_rrf_weights


def test_embedding_provider_singleton():
    """Kiểm tra get_embedding_provider trả về cùng 1 singleton instance để chia sẻ cache."""
    provider1 = get_embedding_provider()
    provider2 = get_embedding_provider()
    assert provider1 is provider2, "get_embedding_provider() phải trả về cùng một singleton instance!"


@pytest.mark.asyncio
async def test_embedding_memoization_cache_hit():
    """Kiểm tra khi câu hỏi được embed lần đầu, lần gọi thứ 2 lấy từ cache tức thời."""
    provider = get_embedding_provider(mock=True)
    query = "Paracetamol 500mg hạ sốt người lớn"
    
    vec1 = await provider.embed_query(query)
    assert vec1 is not None
    assert len(vec1) == 768

    # Lần 2 phải lấy đúng từ cache nội bộ
    vec2 = await provider.embed_query(query)
    assert vec1 == vec2


def test_adaptive_rrf_weight_calculation():
    """Kiểm tra phân bổ trọng số động Adaptive RRF theo bản chất câu hỏi."""
    # 1. Câu hỏi Lexical (chứa SĐK thuốc hoặc mã đăng ký)
    w_sp1, w_de1 = calculate_adaptive_rrf_weights("Thông tin số đăng ký VN-12345-20 của Ciprofloxacin")
    assert w_sp1 >= 0.7, f"Câu hỏi chứa SĐK phải ưu tiên BM25 (w_sparse={w_sp1} < 0.7)"
    assert w_de1 <= 0.35

    # 2. Câu hỏi Semantic (triệu chứng lâm sàng, thay thế thuốc, tác dụng phụ)
    w_sp2, w_de2 = calculate_adaptive_rrf_weights("Bệnh nhân bị ho khan dai dẳng đổi sang thuốc nào an toàn")
    assert w_de2 >= 0.6, f"Câu hỏi suy luận triệu chứng phải ưu tiên Dense vector (w_dense={w_de2} < 0.6)"
    assert w_sp2 <= 0.4

    # 3. Câu hỏi cân bằng mặc định
    w_sp3, w_de3 = calculate_adaptive_rrf_weights("Chỉ định và liều dùng của Metformin")
    assert w_sp3 == 0.5 and w_de3 == 0.5


@pytest.mark.asyncio
async def test_hybrid_retriever_async_execution():
    """Kiểm tra hàm retrieve_async chạy mượt mà và trả về danh sách kết quả xếp hạng."""
    retriever = HybridRetriever()
    results = await retriever.retrieve_async("Paracetamol liều tối đa người lớn", top_k=3)
    assert isinstance(results, list)
    assert len(results) > 0
    # Kết quả đầu bảng phải liên quan đến Paracetamol
    top_chunk = results[0].chunk
    assert "paracetamol" in top_chunk.title.lower() or "paracetamol" in top_chunk.content.lower()
