"""
Unit tests for SQLite Vector Store & In-Memory NumPy Matrix Engine (Step 2).
Tests table creation, BLOB float32 serialization, search latency (<2ms), and NPZ backup.
"""
import os
import tempfile
import time
import pytest
import numpy as np

from app.services.rag.embeddings.vector_store import VectorStore
from app.services.rag.embeddings.provider import cosine_similarity


@pytest.fixture
def temp_db_path():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        path = f.name
    yield path
    if os.path.exists(path):
        os.remove(path)


def test_vector_store_initialization_and_crud(temp_db_path):
    """Kiểm tra khởi tạo bảng và lưu trữ CRUD trên SQLite."""
    store = VectorStore(db_path=temp_db_path, auto_load=False)
    assert store.count() == 0

    # 1. Lưu 1 vector mẫu
    vec1 = np.random.randn(768).astype(np.float32)
    store.save_embedding("chunk_01", vec1, content_hash="hash_01")
    assert store.count() == 1

    # Đọc lại vector
    retrieved = store.get_embedding("chunk_01")
    assert retrieved is not None
    assert retrieved.shape == (768,)
    # Đảm bảo bảo toàn 100% giá trị số thực (Zero Loss)
    assert np.allclose(vec1, retrieved, atol=1e-6)

    # 2. Lưu batch
    vec2 = np.random.randn(768).astype(np.float32)
    vec3 = np.random.randn(768).astype(np.float32)
    store.save_embeddings([
        ("chunk_02", vec2, "hash_02"),
        ("chunk_03", vec3, "hash_03"),
    ])
    assert store.count() == 3

    # Kiểm tra hash map
    hashes = store.get_all_content_hashes()
    assert hashes == {"chunk_01": "hash_01", "chunk_02": "hash_02", "chunk_03": "hash_03"}


def test_in_memory_index_and_cosine_search(temp_db_path):
    """Kiểm tra độ chính xác của tìm kiếm Cosine Similarity trên RAM."""
    store = VectorStore(db_path=temp_db_path, auto_load=False)

    # Tạo 3 vector có hướng xác định
    base_vec = np.zeros(768, dtype=np.float32)
    base_vec[0] = 1.0  # Vector theo trục X

    similar_vec = base_vec.copy()
    similar_vec[1] = 0.2  # Rất gần base_vec

    orthogonal_vec = np.zeros(768, dtype=np.float32)
    orthogonal_vec[10] = 1.0  # Vuông góc với base_vec

    store.save_embeddings([
        ("exact_match", base_vec, "h1"),
        ("similar_match", similar_vec, "h2"),
        ("orthogonal_match", orthogonal_vec, "h3"),
    ])

    # Nạp vào RAM
    loaded_count = store.load_in_memory_index()
    assert loaded_count == 3

    # Tìm kiếm với base_vec
    results = store.search_cosine(base_vec, top_k=3)
    assert len(results) == 3

    # exact_match phải đứng đầu với điểm ~ 1.0
    top_chunk, top_score = results[0]
    assert top_chunk == "exact_match"
    assert pytest.approx(top_score, 0.001) == 1.0

    # similar_match phải đứng thứ hai
    sec_chunk, sec_score = results[1]
    assert sec_chunk == "similar_match"
    assert sec_score > 0.90

    # orthogonal_match phải đứng cuối với điểm ~ 0.0
    third_chunk, third_score = results[2]
    assert third_chunk == "orthogonal_match"
    assert pytest.approx(third_score, 0.01) == 0.0

    # Test lọc theo min_score
    filtered_results = store.search_cosine(base_vec, top_k=3, min_score=0.5)
    assert len(filtered_results) == 2
    assert "orthogonal_match" not in [cid for cid, _ in filtered_results]


def test_search_latency_benchmark(temp_db_path):
    """
    Benchmark hiệu năng tìm kiếm trên ma trận quy mô 2.500 chunks (dim=768).
    Tiêu chuẩn: thời gian tìm kiếm < 2.0 mili-giây.
    """
    store = VectorStore(db_path=temp_db_path, auto_load=False)

    n_chunks = 2500
    dim = 768
    np.random.seed(42)
    random_matrix = np.random.randn(n_chunks, dim).astype(np.float32)

    items = [
        (f"chunk_{i:04d}", random_matrix[i], f"hash_{i}")
        for i in range(n_chunks)
    ]
    store.save_embeddings(items)
    store.load_in_memory_index()

    query_vec = np.random.randn(dim).astype(np.float32)

    # Chạy warm-up
    store.search_cosine(query_vec, top_k=50)

    # Đo thời gian trung bình qua 20 lần truy vấn liên tiếp
    durations = []
    for _ in range(20):
        t0 = time.perf_counter()
        res = store.search_cosine(query_vec, top_k=50)
        t1 = time.perf_counter()
        durations.append((t1 - t0) * 1000)  # ms
        assert len(res) == 50

    avg_ms = sum(durations) / len(durations)
    max_ms = max(durations)
    print(f"\n[Benchmark] 2,500 vectors x 768 dim: Avg = {avg_ms:.3f} ms, Max = {max_ms:.3f} ms")

    # Bắt buộc đạt chuẩn < 2.0 ms
    assert avg_ms < 2.0, f"Độ trễ trung bình {avg_ms:.3f} ms vượt quá ngưỡng 2.0 ms"


def test_export_and_import_npz(temp_db_path):
    """Kiểm tra sao lưu và nạp nhanh ma trận bằng file .npz nén."""
    store = VectorStore(db_path=temp_db_path, auto_load=False)
    vec1 = np.ones(768, dtype=np.float32)
    vec2 = np.ones(768, dtype=np.float32) * 2
    store.save_embeddings([("c1", vec1, "h1"), ("c2", vec2, "h2")])
    store.load_in_memory_index()

    with tempfile.NamedTemporaryFile(suffix=".npz", delete=False) as tmp_npz:
        npz_path = tmp_npz.name

    try:
        store.export_npz(npz_path)
        assert os.path.exists(npz_path)

        # Tạo một store mới và import thẳng từ npz
        store2 = VectorStore(db_path=":memory:", auto_load=False)
        success = store2.import_npz(npz_path)
        assert success is True
        assert len(store2._chunk_ids) == 2
        assert store2._chunk_ids == ["c1", "c2"]
        assert store2._matrix.shape == (2, 768)
    finally:
        if os.path.exists(npz_path):
            os.remove(npz_path)
