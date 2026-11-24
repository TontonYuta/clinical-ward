import pytest
import numpy as np
from app.schemas.copilot import CopilotResponse
from app.services.chatbot.grounded_web_search_cache import GroundedWebSearchCache


def test_grounded_web_search_cache_exact_hit():
    cache = GroundedWebSearchCache(max_size=10, ttl_sec=3600)
    resp = CopilotResponse(
        intent="GROUNDED_WEB_SEARCH",
        reply_text="Phác đồ sốt xuất huyết người lớn bao gồm bù dịch sớm...",
        answer_type="grounded_web_reference",
        confidence=0.9
    )

    cache.put("phác đồ điều trị sốt xuất huyết người lớn", resp)

    # Exact match
    cached = cache.get("phác đồ điều trị sốt xuất huyết người lớn")
    assert cached is not None
    assert cached.reply_text == resp.reply_text
    assert cached.source_status == "cache_exact_hit"
    assert cache.exact_hits == 1


def test_grounded_web_search_cache_semantic_hit():
    cache = GroundedWebSearchCache(max_size=10, ttl_sec=3600)
    resp = CopilotResponse(
        intent="GROUNDED_WEB_SEARCH",
        reply_text="Thông tin điều trị sốt xuất huyết...",
        answer_type="grounded_web_reference",
        confidence=0.9
    )

    # Vector giả lập 768 chiều
    np.random.seed(42)
    vec1 = np.random.randn(768).astype(np.float32)
    vec1 /= np.linalg.norm(vec1)

    # Vector tương tự (cosine sim > 0.98)
    vec2 = vec1 + np.random.randn(768).astype(np.float32) * 0.005
    vec2 /= np.linalg.norm(vec2)

    # Vector khác hoàn toàn (cosine sim thấp)
    vec3 = np.random.randn(768).astype(np.float32)
    vec3 /= np.linalg.norm(vec3)

    cache.put("hướng dẫn điều trị sốt xuất huyết", resp, query_vec=vec1)

    # Query diễn đạt khác nhưng vector gần (semantic hit)
    hit_resp = cache.get("phác đồ chữa sốt xuất huyết ở người lớn", query_vec=vec2)
    assert hit_resp is not None
    assert hit_resp.source_status == "semantic_cache_hit"
    assert cache.semantic_hits == 1

    # Query khác hẳn (semantic miss)
    miss_resp = cache.get("quy định khám chữa bệnh bảo hiểm y tế", query_vec=vec3)
    assert miss_resp is None
    assert cache.misses == 1


def test_grounded_web_search_cache_does_not_cache_abstentions():
    cache = GroundedWebSearchCache()
    safe_abs = CopilotResponse(
        intent="CLINICAL_SAFE_ABSTENTION",
        reply_text="Từ chối an toàn ngoài phạm vi",
        answer_type="safe_abstention"
    )
    cache.put("thời tiết hôm nay", safe_abs)
    assert cache.get("thời tiết hôm nay") is None


def test_cache_invalidate_session_and_quantitative_semantic_guard():
    import numpy as np
    from app.services.chatbot.grounded_web_search_cache import (
        GroundedWebSearchCache,
        should_allow_semantic_cache,
    )
    from app.schemas.copilot import CopilotResponse

    cache = GroundedWebSearchCache()
    resp = CopilotResponse(
        intent="GROUNDED_WEB_SEARCH",
        reply_text="Liều warfarin cho eGFR 22...",
        answer_type="grounded_web_reference",
        source_status="grounded_web_search",
    )
    vec = np.ones(768, dtype=np.float32)
    cache.put("warfarin egfr 22", resp, query_vec=vec, session_id="sess-1")
    assert cache.get("warfarin egfr 22", session_id="sess-1") is not None
    # New session must NOT hit cache from another session
    assert cache.get("warfarin egfr 22", session_id="sess-2") is None

    # Quantitative guard: must NOT allow semantic match for queries with numbers/genotypes
    assert should_allow_semantic_cache("Bệnh nhân eGFR 22 uống warfarin") is False
    assert should_allow_semantic_cache("Kiểu gen CYP2C9*3/*3 dùng liều nào") is False
    assert should_allow_semantic_cache("Tác dụng phụ của paracetamol là gì") is True
    assert cache.get("warfarin egfr 60", query_vec=vec, session_id="sess-1") is None

    # Session invalidation removes only entries of that session
    removed = cache.invalidate_session("sess-1")
    assert removed == 1
    assert cache.get("warfarin egfr 22", session_id="sess-1") is None


def test_compress_complex_web_query_handles_clinical_vignette_and_preserves_simple():
    from app.services.chatbot.grounded_web_search_handler import compress_complex_web_query

    # Simple 1-intent query (even 16 words) must NOT be compressed
    simple_q = "Tác dụng phụ của thuốc hạ sốt paracetamol cho trẻ em dưới 2 tuổi là gì?"
    p_simple, b_simple = compress_complex_web_query(simple_q)
    assert p_simple == simple_q
    assert b_simple is None

    # Complex multi-factor clinical vignette MUST be compressed into concise keywords + broad fallback
    complex_q = (
        "Một bệnh nhân nam 68 tuổi có đa hình kiểu gen CYP2C9*3/*3 và VKORC1 (AA), "
        "đang suy thận mạn giai đoạn 4 (eGFR 22 mL/phút), đồng thời sử dụng warfarin, "
        "amiodaron, kháng sinh metronidazol và uống đều đặn 150ml nước sắc lá cây hoàn ngọc mỗi ngày. "
        "Hãy tính toán chính xác mức độ biến thiên chỉ số INR sau 72 giờ và đề xuất liều khởi đầu warfarin tính theo mg/ngày cho bệnh nhân này?"
    )
    primary, broad = compress_complex_web_query(complex_q)
    assert len(primary.split()) <= 8
    assert "warfarin" in primary.lower()
    assert "cyp2c9" in primary.lower()
    assert broad is not None
    assert len(broad.split()) <= 5


def test_llm_provider_cooldown_and_sticky_healthy_model():
    from app.services.llm_provider import (
        _order_models_by_health,
        _mark_model_cooldown,
        _mark_model_healthy,
        _MODEL_COOLDOWN_UNTIL,
    )

    _MODEL_COOLDOWN_UNTIL.clear()
    models = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.5-flash"]

    _mark_model_cooldown("gemini-3.5-flash-lite")
    _mark_model_healthy("gemini-3.8-flash")
    ordered = _order_models_by_health(models, dead_models=set())
    # Sticky healthy model must be #1; cooling-down model must be pushed to the end
    assert ordered[0] == "gemini-3.8-flash"
    assert ordered[-1] == "gemini-3.5-flash-lite"
    _MODEL_COOLDOWN_UNTIL.clear()
