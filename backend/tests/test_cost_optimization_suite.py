"""
Comprehensive Verification Suite for Chatbot Cost Optimization & Token Frugality.
Kiểm thử 5 trụ cột tối ưu chi phí:
1. Adaptive Query Complexity & Dynamic Top-K Budgeting (NAACL 2024 Adaptive-RAG)
2. Context Window History Bounds (Google AMIE Nature 2024 - <= 1.500 chars)
3. SQLite Persistent Semantic Cache Survival (GPTCache arXiv:2303.17580)
4. Semantic Paraphrase Cache Hit (Cosine/Trigram >= 0.85)
5. Evidence Token Pruning in RAG Pipeline
"""
import os
import tempfile
import pytest
from app.schemas.copilot import CopilotResponse
from app.services.rag.adaptive_retriever import classify_query_complexity
from app.services.session_context import SessionState
from app.services.cache.clinical_cache import ClinicalLRUCache
from app.services.cache.cache_storage_sqlite import CacheStorageSqlite

def test_adaptive_query_complexity_classification():
    # 1. Câu hỏi tra cứu liều/thuộc tính đơn lẻ -> Level 1, Top-1 chunk, No KG
    cfg_dosage = classify_query_complexity("Liều tối đa của Paracetamol trong một ngày là bao nhiêu?")
    assert cfg_dosage.complexity_level == 1
    assert cfg_dosage.top_k == 1
    assert cfg_dosage.include_graph is False
    assert cfg_dosage.max_context_chars <= 1600

    cfg_indic = classify_query_complexity("Augmentin dùng cho bệnh gì?")
    assert cfg_indic.complexity_level == 1
    assert cfg_indic.top_k == 1

    # 2. Câu hỏi tương tác thuốc / đa thực thể -> Level 2, Top-3 chunks, Include KG
    cfg_ddi = classify_query_complexity("Clopidogrel có dùng chung với Omeprazol được không?")
    assert cfg_ddi.complexity_level == 2
    assert cfg_ddi.top_k == 3
    assert cfg_ddi.include_graph is True
    assert cfg_ddi.max_context_chars >= 3000

    # 3. Câu hỏi suy tạng / eGFR -> Level 2
    cfg_renal = classify_query_complexity("Bệnh nhân suy thận eGFR 25 cần chỉnh liều Cefuroxim thế nào?")
    assert cfg_renal.complexity_level == 2
    assert cfg_renal.include_graph is True

def test_history_length_budget_enforcement():
    session = SessionState("test-session-cost", "dr_test", "doctor")
    # Thêm 10 lượt hội thoại với câu trả lời dài
    for i in range(10):
        long_answer = f"Lượt #{i}: " + ("Thông tin chi tiết Dược thư Quốc gia DĐVN V... " * 25)
        session.append_conversation_turn(f"Câu hỏi số {i} của bác sĩ về liều dùng thuốc", long_answer)

    rendered = session.render_recent_history()
    # Khóa cứng trần <= 1.500 ký tự (thay vì 8.000 ký tự)
    assert len(rendered) <= 1500
    assert "Bác sĩ: Câu hỏi số 9" in rendered

def test_sqlite_cache_persistence_across_instances():
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = os.path.join(tmp_dir, "test_cache.sqlite")

        # Cache instance 1: Lưu câu trả lời
        cache1 = ClinicalLRUCache(max_size=50, default_ttl_sec=3600, db_path=db_path)
        dummy_resp = CopilotResponse(
            intent="MEDICATION_DOSAGE_LOOKUP",
            reply_text="Liều dùng Paracetamol người lớn là 500mg - 1000mg mỗi 4-6 giờ, tối đa 4g/ngày.",
            legal_basis="Dược thư Quốc gia Việt Nam",
            confidence=1.0
        )
        saved = cache1.set("Liều dùng của Paracetamol cho người lớn", "doctor", dummy_resp)
        assert saved is True

        # Cache instance 2: Mô phỏng server khởi động lại từ cùng file SQLite
        cache2 = ClinicalLRUCache(max_size=50, default_ttl_sec=3600, db_path=db_path)
        hit_resp = cache2.get("Liều dùng của Paracetamol cho người lớn", "doctor")
        assert hit_resp is not None
        assert "Paracetamol" in hit_resp.reply_text
        assert hit_resp.source_status == "cache_exact"
        assert cache2.exact_hits == 1

def test_semantic_paraphrase_cache_hit():
    with tempfile.TemporaryDirectory() as tmp_dir:
        db_path = os.path.join(tmp_dir, "test_semantic_cache.sqlite")
        cache = ClinicalLRUCache(max_size=50, default_ttl_sec=3600, similarity_threshold=0.85, db_path=db_path)

        dummy_resp = CopilotResponse(
            intent="MEDICATION_DOSAGE_LOOKUP",
            reply_text="Paracetamol hạ sốt cho trẻ em 10-15mg/kg mỗi 4-6 giờ.",
            legal_basis="Dược thư Quốc gia Việt Nam",
            confidence=1.0
        )
        cache.set("Bác sĩ cho hỏi liều paracetamol cho trẻ em hạ sốt với ạ", "doctor", dummy_resp)

        # Hỏi một câu đồng nghĩa bỏ từ đệm
        synonym_query = "Paracetamol cho trẻ em hạ sốt uống liều bao nhiêu"
        semantic_hit = cache.get(synonym_query, "doctor")
        assert semantic_hit is not None
        assert semantic_hit.source_status == "cache_semantic"
        assert cache.semantic_hits >= 1

@pytest.mark.asyncio
async def test_adaptive_rag_pipeline_token_budgeting():
    from app.services.rag.rag_pipeline import execute_clinical_rag

    # Chạy câu hỏi đơn tính chất
    res_single = await execute_clinical_rag("Liều dùng Paracetamol 500mg cho người lớn")
    assert res_single is not None
    # Xác nhận các trích dẫn và kết quả hợp lệ
    assert len(res_single.retrieved_chunks) <= 2
