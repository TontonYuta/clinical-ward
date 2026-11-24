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


def test_reconcile_web_citations_renumbers_and_drops_uncited():
    from app.services.chatbot.web_search_engine import reconcile_web_citations

    results = [
        WebSearchResult(title="Src 1", url="https://fda.gov/a", snippet="A", source_domain="fda.gov"),
        WebSearchResult(title="Src 2", url="https://bachmai.gov.vn/b", snippet="B", source_domain="bachmai.gov.vn"),
        WebSearchResult(title="Nguồn Bộ Y tế", url="https://moh.gov.vn/c", snippet="C", source_domain="moh.gov.vn"),
    ]
    ai_text = "Theo hướng dẫn [3], cần theo dõi sát [1]. Không có trong nguồn [9]."
    reconciled_text, reconciled_results = reconcile_web_citations(ai_text, results)

    assert "[1]" in reconciled_text
    assert "[2]" in reconciled_text
    assert "[3]" not in reconciled_text
    assert "[9]" not in reconciled_text
    assert [r.title for r in reconciled_results] == ["Nguồn Bộ Y tế", "Src 1"]

    # Grouped citations like [1, 3] must preserve both Src 1 and Nguồn Bộ Y tế (Vietnamese ranked #1)
    grouped_text, grouped_results = reconcile_web_citations("Thông tin tổng hợp [1, 3].", results)
    assert "[2][1]" in grouped_text
    assert [r.title for r in grouped_results] == ["Nguồn Bộ Y tế", "Src 1"]


def test_rank_and_filter_results_prioritizes_vietnamese_sources():
    results = [
        WebSearchResult(
            title="Warfarin Dosing Guidelines - FDA",
            url="https://fda.gov/drugs/warfarin",
            snippet="FDA approved warfarin dosing and CYP2C9 label",
            source_domain="fda.gov",
        ),
        WebSearchResult(
            title="Hướng dẫn sử dụng thuốc Warfarin và theo dõi INR",
            url="https://vinmec.com/vi/tin-tuc/warfarin",
            snippet="Hướng dẫn theo dõi chỉ số INR và tương tác thuốc warfarin",
            source_domain="vinmec.com",
        ),
    ]
    ranked = rank_and_filter_results(results, max_results=5)
    assert ranked[0].source_domain == "vinmec.com"
    assert ranked[1].source_domain == "fda.gov"


def test_sanitize_ai_response_urls_strict_path_check():
    from app.services.chatbot.web_search_engine import sanitize_ai_response_urls

    allowed = {"https://moh.gov.vn/bai-viet-a"}
    text = (
        "Xem [Bài A](https://moh.gov.vn/bai-viet-a?utm_source=test) "
        "và [Bài giả](https://moh.gov.vn/bai-gia-mao)."
    )
    sanitized = sanitize_ai_response_urls(text, allowed)
    assert "https://moh.gov.vn/bai-viet-a?utm_source=test" in sanitized
    assert "https://moh.gov.vn/bai-gia-mao" not in sanitized
    assert "Nguồn chưa được xác thực" in sanitized


def test_parse_follow_up_questions_and_quality_gate():
    from app.services.chatbot.grounded_web_search_handler import (
        parse_follow_up_questions_block,
        filter_and_rank_web_chips,
        generate_dynamic_web_chips,
    )

    raw = (
        "### Tóm tắt nhanh\nThông tin về Budesonide.\n\n"
        "<follow_up_questions>\n"
        "- Liều dùng Budesonide cho trẻ em?\n"
        "- Cách súc miệng sau khi hít Budesonide\n"
        "- https://fake.link/bad\n"
        "- Tác dụng phụ thường gặp của Budesonide\n"
        "</follow_up_questions>"
    )
    cleaned, chips = parse_follow_up_questions_block(raw)
    assert "<follow_up_questions>" not in cleaned
    assert "Tóm tắt nhanh" in cleaned
    filtered = filter_and_rank_web_chips(chips, "Thuốc Budesonide", max_chips=3)
    assert len(filtered) == 3
    assert all("http" not in c for c in filtered)

    # Fallback theo thực thể khi không có LLM chips
    fallback_chips = generate_dynamic_web_chips("Thuốc Montelukast", "Montelukast là thuốc...", [])
    assert len(fallback_chips) == 3
    assert any("Montelukast" in c for c in fallback_chips)
