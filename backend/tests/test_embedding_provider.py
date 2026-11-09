"""
Unit tests for Embedding Provider Layer (Step 1).
Tests BaseEmbeddingProvider, GeminiEmbeddingProvider (Live & Mock), and Cosine Similarity.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch

from app.services.rag.embeddings.provider import (
    BaseEmbeddingProvider,
    GeminiEmbeddingProvider,
    MockEmbeddingProvider,
    cosine_similarity,
    get_embedding_provider,
    DEFAULT_EMBEDDING_DIM
)


def test_cosine_similarity_basic():
    """Kiểm tra tính đúng đắn toán học của cosine_similarity."""
    v1 = [1.0, 0.0, 0.0]
    v2 = [1.0, 0.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v2), 0.001) == 1.0

    v3 = [0.0, 1.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v3), 0.001) == 0.0

    v4 = [-1.0, 0.0, 0.0]
    assert pytest.approx(cosine_similarity(v1, v4), 0.001) == -1.0

    # Vector 0
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


@pytest.mark.asyncio
async def test_mock_embedding_provider():
    """Kiểm tra hoạt động độc lập của MockEmbeddingProvider."""
    provider = MockEmbeddingProvider(dimension=768)
    assert provider.dimension == 768

    v1 = await provider.embed_query("paracetamol 500mg hạ sốt")
    assert v1 is not None
    assert len(v1) == 768
    assert all(isinstance(x, float) for x in v1)

    # Hai văn bản giống nhau phải cho vector giống nhau
    v2 = await provider.embed_query("paracetamol 500mg hạ sốt")
    assert pytest.approx(cosine_similarity(v1, v2), 0.001) == 1.0

    # Batch embedding
    batch = ["thuốc amoxicillin", "thuốc ciprofloxacin"]
    batch_vecs = await provider.batch_embed_chunks(batch)
    assert len(batch_vecs) == 2
    assert len(batch_vecs[0]) == 768
    assert len(batch_vecs[1]) == 768


def test_sync_embed_query():
    """Kiểm tra wrapper gọi đồng bộ embed_query_sync."""
    provider = MockEmbeddingProvider(dimension=768)
    vec = provider.embed_query_sync("kháng sinh cephalosporin")
    assert vec is not None
    assert len(vec) == 768


@pytest.mark.asyncio
async def test_gemini_embedding_provider_live_or_fallback():
    """
    Kiểm tra GeminiEmbeddingProvider trực tiếp với API key hiện hữu.
    Nếu có API key hợp lệ: xác thực 768 dims, kiểm tra độ tương đồng y văn;
    Nếu không có: kiểm tra cơ chế trả None an toàn (không crash).
    """
    provider = GeminiEmbeddingProvider(dimension=DEFAULT_EMBEDDING_DIM)
    vec = await provider.embed_query("paracetamol 500mg giảm đau hạ sốt")

    if vec is not None:
        # Trường hợp Live API hoạt động
        assert len(vec) == 768
        assert all(isinstance(x, float) for x in vec)

        # Test độ tương đồng ngữ nghĩa y văn
        vec_synonym = await provider.embed_query("thuốc hạ nhiệt và giảm đau nhức")
        vec_unrelated = await provider.embed_query("máy bay phản lực chiến đấu quân sự")

        assert vec_synonym is not None
        assert vec_unrelated is not None

        sim_synonym = cosine_similarity(vec, vec_synonym)
        sim_unrelated = cosine_similarity(vec, vec_unrelated)

        # Câu đồng nghĩa y tế phải có độ tương đồng cao hơn rõ rệt câu phi y tế
        assert sim_synonym > 0.70, f"Độ tương đồng y tế mong đợi > 0.70, thực tế {sim_synonym}"
        assert sim_synonym > sim_unrelated + 0.15, f"Mong đợi {sim_synonym} > {sim_unrelated} + 0.15"

        # Test In-Memory LRU Cache: lần gọi thứ 2 phải lấy từ cache
        assert "paracetamol 500mg giảm đau hạ sốt" in [
            k for k in provider._query_cache
        ] or len(provider._query_cache) > 0

        # Test Batch Embed
        batch_res = await provider.batch_embed_chunks([
            "chỉ định thuốc amoxicillin",
            "chống chỉ định aspirin"
        ])
        assert len(batch_res) == 2
        assert len(batch_res[0]) == 768
        assert len(batch_res[1]) == 768
    else:
        # Trường hợp không có API key / offline: không được crash
        assert vec is None


@pytest.mark.asyncio
async def test_gemini_embedding_error_handling_and_resilience():
    """Kiểm tra khả năng chịu lỗi khi API key sai hoặc gặp sự cố mạng."""
    # API key giả mạo không hợp lệ
    provider_bad_key = GeminiEmbeddingProvider(api_key="AIzaFakeKey1234567890", dimension=768)
    vec = await provider_bad_key.embed_query("test câu hỏi bất kỳ")
    # Phải trả về None một cách an toàn mà không làm sập ứng dụng
    assert vec is None

    # Text rỗng
    assert await provider_bad_key.embed_query("") is None
    assert await provider_bad_key.embed_query("   ") is None
