"""
Tests for Step 1: LightRAG Dual-Level Knowledge Graph Ingestion & Vectorization.
Verifies that macro-level graph taxonomy, class DDI, organ risk, and therapeutic
substitutions are correctly structured into RagChunk objects and loaded into VectorStore.
"""
import pytest
import numpy as np

from app.services.rag.lightrag_graph_builder import build_lightrag_graph_chunks
from app.services.rag.clinical_indexer import load_all_clinical_chunks
from app.services.rag.embeddings.vector_store import get_vector_store
from app.services.rag.embeddings.provider import MockEmbeddingProvider


def test_build_lightrag_graph_chunks_structure():
    """Kiểm tra cấu trúc và tính toàn vẹn của Graph Chunks."""
    chunks = build_lightrag_graph_chunks()
    assert len(chunks) >= 28, f"Kỳ vọng ít nhất 28 graph chunks, nhận được {len(chunks)}"

    entity_types = {c.entity_type for c in chunks}
    assert entity_types == {"graph_class", "graph_class_ddi", "graph_condition_risk", "graph_substitution"}

    for chunk in chunks:
        assert chunk.chunk_id.startswith("lightrag_")
        assert len(chunk.source_doc) > 0
        assert len(chunk.title) > 0
        assert len(chunk.content) > 50
        assert len(chunk.keywords) >= 3
        assert len(chunk.legal_basis) > 0


def test_clinical_indexer_incorporates_graph_chunks():
    """Kiểm tra clinical_indexer nạp đầy đủ các chunks (micro + graph)."""
    all_chunks = load_all_clinical_chunks()
    assert len(all_chunks) >= 2191

    graph_chunks = [c for c in all_chunks if c.chunk_id.startswith("lightrag_")]
    assert len(graph_chunks) >= 28

    # Đảm bảo không trùng lặp ID
    ids = [c.chunk_id for c in all_chunks]
    assert len(ids) == len(set(ids)), "Phát hiện chunk_id trùng lặp!"


def test_vector_store_contains_lightrag_vectors():
    """Kiểm tra VectorStore nạp và truy vấn được các vector LightRAG."""
    store = get_vector_store()
    count = store.load_in_memory_index(prefer_cache=True)
    assert count == 2191

    # Kiểm tra các ID LightRAG có trong store
    graph_ids = [cid for cid in store._chunk_ids if cid.startswith("lightrag_")]
    assert len(graph_ids) == 28

    # Kiểm tra tính toán Cosine Similarity không bị lỗi
    mock_vec = np.random.randn(768).astype(np.float32)
    results = store.search_cosine(mock_vec, top_k=10)
    assert len(results) == 10
    for cid, score in results:
        assert isinstance(cid, str)
        assert -1.0 <= score <= 1.0
