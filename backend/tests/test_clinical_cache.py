"""
Unit test for ClinicalLRUCache
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.cache.clinical_cache import ClinicalLRUCache, get_clinical_cache
from app.schemas.copilot import CopilotResponse, CopilotActionCard

def test_cache_normalization():
    cache = ClinicalLRUCache(max_size=5)

    # 1. Normalization equality
    q1 = "Paracetamol 500mg uống thế nào?"
    q2 = "Cho tôi hỏi Paracetamol 500mg uống thế nào với ạ?"
    q3 = "Xin hỏi paracetamol 500mg uống thế nào?"

    key1 = cache.make_key(q1, "doctor")
    key2 = cache.make_key(q2, "doctor")
    key3 = cache.make_key(q3, "doctor")

    assert key1 == key2 == key3 == "doctor:paracetamol 500mg uống thế nào", f"Mismatch: {key1} vs {key2} vs {key3}"
    print(f"✅ Normalization test passed: '{key1}'")

def test_mutation_queries_rejected():
    cache = ClinicalLRUCache(max_size=5)

    assert not cache.is_cacheable_query("Cho 1 lọ morphin"), "Should reject borrow query"
    assert not cache.is_cacheable_query("Báo hỏng máy thở phòng mổ 2"), "Should reject equipment query"
    assert not cache.is_cacheable_query("Thuốc nào cận hạn"), "Should reject expiry inventory query"
    assert not cache.is_cacheable_query("Giao ban ca trực sáng"), "Should reject handover query"
    assert not cache.is_cacheable_query("Kê đơn ceftriaxone 1g"), "Should reject CPOE query"

    assert cache.is_cacheable_query("Paracetamol 500mg uống thế nào"), "Should accept clinical query"
    assert cache.is_cacheable_query("Tương tác thuốc giữa Plavix và Nexium"), "Should accept interaction query"
    print("✅ Mutation query rejection test passed!")

def test_lru_and_retrieval():
    cache = ClinicalLRUCache(max_size=2)

    resp1 = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều dùng Paracetamol là 500mg mỗi 4-6 giờ.",
        legal_basis="DĐVN V"
    )
    resp2 = CopilotResponse(
        intent="DRUG_INTERACTION",
        reply_text="Plavix và Nexium tương tác chuyển hóa qua CYP2C19.",
        legal_basis="QĐ 5948/QĐ-BYT"
    )
    resp3 = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều dùng Morphin cấp cứu.",
        legal_basis="TT 20/2017"
    )

    # Set 1 & 2
    cache.set("Paracetamol 500mg uống thế nào", "doctor", resp1)
    cache.set("Plavix và Nexium tương tác", "doctor", resp2)

    # Hit 1
    hit1 = cache.get("Cho tôi hỏi Paracetamol 500mg uống thế nào với ạ?", "doctor")
    assert hit1 is not None
    assert hit1.reply_text == resp1.reply_text
    print("✅ Cache hit test passed!")

    # Set 3 -> Evicts item 2 (because item 1 was just touched)
    cache.set("Morphin liều dùng", "doctor", resp3)

    assert cache.get("Plavix và Nexium tương tác", "doctor") is None, "Item 2 should have been evicted"
    assert cache.get("Paracetamol 500mg uống thế nào", "doctor") is not None, "Item 1 should remain"
    assert cache.get("Morphin liều dùng", "doctor") is not None, "Item 3 should exist"
    print("✅ LRU eviction test passed!")

    stats = cache.get_stats()
    assert stats["hits"] >= 2
    assert stats["evictions"] == 1
    print(f"✅ Cache stats test passed: {stats}")

if __name__ == "__main__":
    test_cache_normalization()
    test_mutation_queries_rejected()
    test_lru_and_retrieval()
    print("🎉 ALL CLINICAL CACHE TESTS PASSED 100%!")
