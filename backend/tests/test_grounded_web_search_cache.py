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
