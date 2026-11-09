"""
Comprehensive Unit Tests for Vector-Enhanced Clinical LRU & Semantic Cache.
Paper: GPTCache (Bang et al., 2023 / arXiv:2303.17580).
Adheres to Medical SOTA Standards (Self-MedRAG, Jan 2026; MedRAG, arXiv:2402.13178).
"""
import os
import sys
import tempfile
import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.cache.clinical_cache import ClinicalLRUCache
from app.services.rag.embeddings.provider import MockEmbeddingProvider
from app.schemas.copilot import CopilotResponse


def test_vector_cache_exact_hit():
    """Kiểm tra Exact Match O(1) hoạt động tức thời mà không cần tính vector."""
    cache = ClinicalLRUCache(max_size=10, db_path=False)
    resp = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều dùng Paracetamol 500mg: 1-2 viên mỗi 4-6 giờ.",
        legal_basis="Dược thư Quốc gia Việt Nam 2015"
    )
    cache.set("Paracetamol 500mg uống thế nào", "doctor", resp)

    # 1. Exact Hit (có chuẩn hóa trợ từ)
    hit = cache.get("Bác sĩ cho hỏi Paracetamol 500mg uống thế nào với ạ?", "doctor")
    assert hit is not None
    assert hit.source_status == "cache_exact"
    assert hit.reply_text == resp.reply_text
    assert cache.exact_hits == 1
    assert cache.semantic_hits == 0


def test_vector_cache_semantic_hit_with_mock_embeddings():
    """Kiểm tra Semantic Hit khi câu hỏi được paraphrase có cùng thực thể và ý định."""
    provider = MockEmbeddingProvider(dimension=768)
    cache = ClinicalLRUCache(
        max_size=10,
        similarity_threshold=0.50,
        vector_similarity_threshold=0.50,
        db_path=False,
        embedding_provider=provider
    )

    resp = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều Paracetamol 500mg: uống cách nhau 4-6 giờ, tối đa 4g/ngày.",
        legal_basis="DĐVN V"
    )

    # Lưu câu hỏi gốc
    cache.set("Paracetamol 500mg uống thế nào", "doctor", resp)

    # Truy vấn paraphrase có cùng intent, cùng thuốc, cùng liều
    rephrased_query = "Cách dùng và liều uống Paracetamol 500mg"
    hit = cache.get(rephrased_query, "doctor")

    assert hit is not None, "Phải kích hoạt semantic cache hit"
    assert hit.source_status == "cache_semantic"
    assert hit.reply_text == resp.reply_text
    assert cache.semantic_hits == 1


def test_vector_cache_semantic_hit_explicit_high_cosine():
    """Kiểm tra Semantic Hit khi truyền vector 768 chiều có độ tương đồng Cosine cao >= 0.90."""
    cache = ClinicalLRUCache(
        max_size=10,
        similarity_threshold=0.85,
        vector_similarity_threshold=0.88,
        db_path=False
    )

    resp = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều Paracetamol 500mg hạ sốt: 1 viên mỗi 4-6 giờ.",
        legal_basis="DĐVN V"
    )

    # Vector cơ sở (768 chiều chuẩn hóa)
    np.random.seed(42)
    base_vec = np.random.randn(768).astype(np.float32)
    base_vec /= np.linalg.norm(base_vec)

    # Tạo vector trực giao và tổ hợp tuyến tính để đạt đúng Cosine = 0.94
    rand_vec = np.random.randn(768).astype(np.float32)
    v_perp = rand_vec - np.dot(rand_vec, base_vec) * base_vec
    v_perp /= np.linalg.norm(v_perp)

    target_cos = 0.94
    rephrased_vec = target_cos * base_vec + np.sqrt(1.0 - target_cos**2) * v_perp
    rephrased_vec /= np.linalg.norm(rephrased_vec)

    sim = float(np.dot(base_vec, rephrased_vec))
    assert sim >= 0.90, f"Cosine phải >= 0.90 (thực tế: {sim})"

    cache.set("Paracetamol 500mg uống thế nào", "doctor", resp, vector=base_vec)

    # Tra cứu với vector tương đương (cùng intent, cùng thuốc Paracetamol 500mg)
    hit = cache.get("Cách dùng và liều uống Paracetamol 500mg", "doctor", vector=rephrased_vec)
    assert hit is not None, f"Phải hit cache semantic khi cosine >= 0.88 (sim={sim})"
    assert hit.source_status == "cache_semantic"
    assert hit.reply_text == resp.reply_text


def test_vector_cache_medical_safety_guardrails():
    """
    Kiểm tra 5 chốt chặn an toàn y khoa tuyệt đối (Medical Safety Guardrails).
    Dù vector similarity có thể cao, các sai khác lâm sàng cốt lõi BẮT BUỘC bị REJECT 100%.
    """
    provider = MockEmbeddingProvider(dimension=768)
    cache = ClinicalLRUCache(
        max_size=20,
        similarity_threshold=0.50,
        vector_similarity_threshold=0.50,
        db_path=False,
        embedding_provider=provider
    )

    para_resp = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều Paracetamol 500mg cho người lớn.",
        legal_basis="DĐVN V"
    )
    cache.set("Paracetamol 500mg uống thế nào", "doctor", para_resp)

    # Chốt 1: Lệch liều lượng (500mg vs 250mg)
    assert cache.get("Paracetamol 250mg uống thế nào", "doctor") is None, "CẤM dùng chung cache khi khác biệt liều!"

    # Chốt 2: Lệch đối tượng nhân khẩu học / độ tuổi (người lớn vs trẻ 2 tuổi)
    assert cache.get("Paracetamol cho trẻ 2 tuổi uống thế nào", "doctor") is None, "CẤM dùng chung cache nhi khoa cho người lớn!"

    # Chốt 3: Lệch ý định lâm sàng (dosage vs contraindication)
    assert cache.get("Chống chỉ định của Paracetamol 500mg", "doctor") is None, "CẤM dùng chung cache khi khác biệt ý định!"

    # Chốt 4: Lệch thực thể thuốc (Paracetamol vs Morphin)
    assert cache.get("Morphin 500mg uống thế nào", "doctor") is None, "CẤM dùng chung cache khi khác thuốc!"

    # Chốt 5: Lệch bệnh lý lâm sàng (Hạ sốt vs Bệnh trĩ)
    f1 = cache.extract_clinical_features("Thuốc hạ sốt Paracetamol")
    f2 = cache.extract_clinical_features("Thuốc trị trĩ Paracetamol")
    score = cache.compute_clinical_similarity(f1, f2)
    assert score == 0.0, "CẤM dùng chung cache giữa bệnh lý hạ sốt và trĩ!"


def test_vector_cache_offline_fallback():
    """Kiểm tra cơ chế Graceful Fallback khi không có embedding provider (hoàn toàn offline)."""
    cache = ClinicalLRUCache(
        max_size=10,
        similarity_threshold=0.60,
        db_path=False,
        embedding_provider=None
    )

    resp = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều dùng Paracetamol 500mg: 1 viên mỗi 4-6 giờ.",
        legal_basis="DĐVN V"
    )
    cache.set("Paracetamol 500mg uống thế nào", "doctor", resp)

    # Fallback Lexical Matching
    hit = cache.get("Cách dùng và liều uống Paracetamol 500mg", "doctor")
    assert hit is not None
    assert hit.source_status == "cache_semantic"
    assert hit.reply_text == resp.reply_text


def test_vector_cache_sqlite_persistence():
    """Kiểm tra lưu trữ bền vững SQLite và phục hồi vector float32 sau khi restart cache."""
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
        temp_db = f.name

    try:
        # Khởi tạo cache 1 và lưu 1 mục có vector
        cache1 = ClinicalLRUCache(max_size=10, db_path=temp_db)
        resp = CopilotResponse(
            intent="DRUG_INFO",
            reply_text="Liều dùng Ciprofloxacin 500mg trong nhiễm khuẩn đường tiết niệu.",
            legal_basis="DĐVN V"
        )
        fake_vector = np.random.randn(768).astype(np.float32)
        fake_vector /= np.linalg.norm(fake_vector)

        cache1.set("Ciprofloxacin 500mg liều dùng", "doctor", resp, vector=fake_vector)

        # Khởi tạo cache 2 trỏ cùng database SQLite (giả lập restart app)
        cache2 = ClinicalLRUCache(max_size=10, db_path=temp_db)
        key = cache2.make_key("Ciprofloxacin 500mg liều dùng", "doctor")

        assert key in cache2._cache, "Entry phải được nạp từ SQLite"
        cached_entry = cache2._cache[key]
        cached_features = cached_entry["features"]

        assert "vector" in cached_features, "Vector phải tồn tại trong deserialized features"
        restored_vector = cached_features["vector"]
        assert isinstance(restored_vector, np.ndarray), "Vector phục hồi phải là numpy ndarray"
        assert restored_vector.dtype == np.float32, "Vector phải có kiểu float32"
        assert len(restored_vector) == 768, "Vector phải đúng 768 chiều"

        # Kiểm tra tính đồng nhất của vector
        cosine_dist = np.dot(fake_vector, restored_vector)
        assert cosine_dist > 0.999, f"Vector khôi phục phải gần như tuyệt đối (cosine={cosine_dist})"

    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)
