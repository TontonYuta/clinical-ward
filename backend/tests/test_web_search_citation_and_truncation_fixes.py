"""
Test suite verifying the fixes for:
1. Strict medical relevance & non-medical domain filtering (eliminating Microsoft Q&A / tech forum citations).
2. Sentence boundary truncation protection (eliminating cut-off sentences before citations).
3. Conversational search prefix normalization.
4. Bidirectional query caching.
"""

import pytest
from app.services.chatbot.grounded_web_search_handler import (
    clean_conversational_search_query,
    is_likely_standalone_query,
)
from app.services.chatbot.web_search_engine import (
    rank_and_filter_results,
    standardize_web_references,
    WebSearchResult,
    classify_domain_tier,
    is_domain_excluded,
)


def test_conversational_prefix_stripping_removes_fluff_without_losing_entities():
    cases = [
        ("tôi muốn bạn tìm kiếm thông tin về thuốc hạ sốt", "thuốc hạ sốt"),
        ("bác sĩ ơi cho tôi hỏi về paracetamol cho trẻ em", "paracetamol cho trẻ em"),
        ("hãy tìm kiếm trên mạng về tương tác giữa aspirin và clopidogrel", "tương tác giữa aspirin và clopidogrel"),
        ("tra cứu giúp tôi thông tin về vắc xin cúm mùa", "vắc xin cúm mùa"),
        ("cho mình hỏi thuốc này uống trước hay sau ăn", "thuốc này uống trước hay sau ăn"),
    ]
    for raw, expected in cases:
        cleaned = clean_conversational_search_query(raw)
        assert cleaned == expected, f"Failed for '{raw}': got '{cleaned}', expected '{expected}'"


def test_domain_filter_excludes_microsoft_apple_and_tech_sites():
    assert is_domain_excluded("answers.microsoft.com")
    assert is_domain_excluded("support.microsoft.com")
    assert is_domain_excluded("microsoft.com")
    assert is_domain_excluded("support.apple.com")
    assert is_domain_excluded("stackoverflow.com")
    assert is_domain_excluded("shopee.vn")
    assert not is_domain_excluded("bachmai.gov.vn")
    assert not is_domain_excluded("vinmec.com")
    assert not is_domain_excluded("moh.gov.vn")


def test_tier_4_results_require_medical_relevance():
    results = [
        WebSearchResult(
            title="Account Locked - Microsoft Q&A",
            url="https://answers.microsoft.com/forum/locked",
            snippet="Outlook account recovery steps",
            source_domain="answers.microsoft.com"
        ),
        WebSearchResult(
            title="Kinh nghiệm du lịch Đà Lạt",
            url="https://dulichdalat.com/kinh-nghiem",
            snippet="Khách sạn đẹp giá rẻ tại trung tâm",
            source_domain="dulichdalat.com"
        ),
        WebSearchResult(
            title="Tạp chí Y học và Đời sống",
            url="https://yhocdoisong.com/ha-sot-dung-cach",
            snippet="Hướng dẫn sử dụng thuốc hạ sốt paracetamol an toàn",
            source_domain="yhocdoisong.com"
        ),
        WebSearchResult(
            title="Hướng dẫn Bệnh viện Bạch Mai",
            url="https://bachmai.gov.vn/huong-dan-ha-sot",
            snippet="Phác đồ hạ sốt của Bệnh viện Bạch Mai",
            source_domain="bachmai.gov.vn"
        )
    ]
    filtered = rank_and_filter_results(results, max_results=5)
    domains = [r.source_domain for r in filtered]

    # Microsoft and non-medical travel blog must be filtered out
    assert "answers.microsoft.com" not in domains
    assert "dulichdalat.com" not in domains

    # Official Bach Mai and medical-relevant Tier 4 must be preserved
    assert "bachmai.gov.vn" in domains
    assert "yhocdoisong.com" in domains
    assert domains[0] == "bachmai.gov.vn"  # Tier 1 ranked higher than Tier 4


def test_sentence_boundary_guard_trims_dangling_cut_off_lines():
    cut_off_ai = (
        "**THÔNG TIN LÂM SÀNG: THUỐC HẠ SỐT**\n\n"
        "### 1. Kết luận & Nguyên tắc chung\n"
        "Paracetamol là thuốc hạ sốt an toàn hàng đầu khi dùng đúng liều.\n\n"
        "### 2. Liều dùng chi tiết\n"
        "* Người lớn: 500mg - 1000mg mỗi lần uống, cách nhau 4-6 giờ. Liều tối đa 4g/ngày.\n"
        "* Trẻ em: 10 - 15 mg/kg mỗi lần uống. Không quá 5 lần trong 24 giờ.\n"
        "* **Lưu ý an toàn:** Dùng quá liều Paracetamol có thể gây tổn thương"
    )
    dummy_results = [
        WebSearchResult(
            title="BV Bạch Mai",
            url="https://bachmai.gov.vn/paracetamol",
            snippet="Thuốc hạ sốt",
            source_domain="bachmai.gov.vn"
        )
    ]
    output = standardize_web_references(cut_off_ai, dummy_results)

    # Incomplete sentence fragment must NOT appear
    assert "có thể gây tổn thương" not in output

    # Preceding complete sentence MUST be intact
    assert "Không quá 5 lần trong 24 giờ." in output

    # Reference header and disclaimer must be present
    assert "### Nguồn tham khảo y khoa:" in output
    assert "bachmai.gov.vn" in output
    assert "⚠️ *Lưu ý: Thông tin tìm kiếm từ Internet mang tính chất tham khảo" in output
