import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.chatbot.web_search_engine import (
    WebSearchResult,
    unwrap_search_url,
    sanitize_ai_response_urls,
    standardize_web_references
)
from app.services.chatbot.grounded_web_search_handler import (
    handle_grounded_web_search_turn,
    is_internal_operational_query
)
from app.services.chatbot.evidence_contract_validator import validate_response_evidence_contract


def test_is_internal_operational_query():
    assert is_internal_operational_query("Bàn giao ca trực đêm") is True
    assert is_internal_operational_query("Kiểm tra tủ vắc xin số 2") is True
    assert is_internal_operational_query("Thu hồi vỏ morphin") is True
    assert is_internal_operational_query("Phác đồ điều trị sốt xuất huyết 2026") is False
    assert is_internal_operational_query("Thuốc mới trị tiểu đường Mounjaro") is False


@pytest.mark.asyncio
async def test_handle_grounded_web_search_turn_disabled():
    payload = CopilotQuery(query="Tin tức y tế", enable_web_search=False)
    resp = await handle_grounded_web_search_turn(payload)
    assert resp is None


@pytest.mark.asyncio
async def test_handle_grounded_web_search_turn_bypasses_internal_ops():
    payload = CopilotQuery(query="Báo cáo bàn giao ca trực tối nay", enable_web_search=True)
    resp = await handle_grounded_web_search_turn(payload)
    # Nghiệp vụ ca trực nội bộ phải trả về None để database bệnh viện xử lý
    assert resp is None


@pytest.mark.asyncio
async def test_handle_grounded_web_search_turn_success_with_llm():
    payload = CopilotQuery(query="Cập nhật khuyến cáo cúm mùa 2026", enable_web_search=True)

    mock_search_results = [
        WebSearchResult(
            title="Khuyến cáo phòng chống cúm mùa 2026 - Cục Y tế Dự phòng",
            url="https://vncdc.gov.vn/khuyen-cao-cum-mua-2026",
            snippet="Cục Y tế Dự phòng khuyến cáo người dân chủ động tiêm vắc xin cúm mùa hàng năm...",
            source_domain="vncdc.gov.vn",
            is_live=True
        ),
        WebSearchResult(
            title="Hướng dẫn tiêm vắc xin cúm mới nhất - Bệnh viện Bạch Mai",
            url="https://bachmai.gov.vn/tiem-vac-xin-cum",
            snippet="Vắc xin cúm tứ giá thế hệ mới bảo vệ chống lại 4 chủng virus cúm lưu hành...",
            source_domain="bachmai.gov.vn",
            is_live=True
        )
    ]

    mock_llm_reply = (
        "Theo khuyến cáo mới từ Cục Y tế Dự phòng và Bệnh viện Bạch Mai, người dân nên tiêm vắc xin cúm mùa hàng năm. "
        "Chi tiết xem tại [Cục Y Tế Dự Phòng](https://vncdc.gov.vn/khuyen-cao-cum-mua-2026) "
        "và [Nguồn Bịa Đặt](https://scam-site.fake/phishing).\n\n"
        "⚠️ *Lưu ý: Thông tin tìm kiếm từ Internet mang tính chất tham khảo.*"
    )

    with patch("app.services.chatbot.grounded_web_search_handler.search_and_verify_web", return_value=(mock_search_results, "serper")), \
         patch("app.services.llm_provider.query_clinical_llm", return_value=mock_llm_reply):

        resp = await handle_grounded_web_search_turn(payload, user_role="doctor")
        assert resp is not None
        assert resp.intent == "GROUNDED_WEB_SEARCH"
        assert resp.source_status == "grounded_web_search"
        assert len(resp.citations) == 2
        assert resp.citations[0]["domain"] == "vncdc.gov.vn"

        # Kiểm tra tính năng chống link ảo: URL scam-site.fake phải bị gỡ bỏ
        assert "scam-site.fake" not in resp.reply_text
        assert "Nguồn chưa được xác thực" in resp.reply_text
        assert "https://vncdc.gov.vn/khuyen-cao-cum-mua-2026" in resp.reply_text


@pytest.mark.asyncio
async def test_handle_grounded_web_search_turn_offline_llm_fallback():
    payload = CopilotQuery(query="Thuốc mới điều trị Alzheimer", enable_web_search=True)

    mock_search_results = [
        WebSearchResult(
            title="FDA chấp thuận kháng thể đơn dòng mới điều trị Alzheimer",
            url="https://fda.gov/drugs/alzheimer-treatment",
            snippet="FDA vừa cấp phép sử dụng kháng thể đơn dòng làm chậm tiến triển suy giảm trí nhớ...",
            source_domain="fda.gov",
            is_live=True
        )
    ]

    # Giả lập LLM offline (None)
    with patch("app.services.chatbot.grounded_web_search_handler.search_and_verify_web", return_value=(mock_search_results, "duckduckgo")), \
         patch("app.services.llm_provider.query_clinical_llm", return_value=None):

        resp = await handle_grounded_web_search_turn(payload, user_role="doctor")
        assert resp is not None
        assert resp.intent == "GROUNDED_WEB_SEARCH"
        assert "Kết quả tìm kiếm Internet cho \"Thuốc mới điều trị Alzheimer\"" in resp.reply_text
        assert "fda.gov" in resp.reply_text
        assert len(resp.citations) == 1


def test_evidence_contract_validator_allows_grounded_web_search():
    resp = CopilotResponse(
        intent="GROUNDED_WEB_SEARCH",
        reply_text="Phác đồ tham khảo từ Cổng thông tin Bộ Y Tế",
        answer_type="grounded_web_reference",
        source_status="grounded_web_search",
        confidence=0.92,
        citations=[{"title": "Bộ Y Tế", "url": "https://moh.gov.vn", "domain": "moh.gov.vn"}]
    )

    validated = validate_response_evidence_contract(resp)
    assert validated.intent == "GROUNDED_WEB_SEARCH"
    assert validated.reply_text == "Phác đồ tham khảo từ Cổng thông tin Bộ Y Tế"
    assert len(validated.citations) == 1


def test_unwrap_search_url_google_translate_and_redirect():
    # Google Translate proxy url
    t_url = "https://translate.google.com/translate?u=https://pmc.ncbi.nlm.nih.gov/articles/PMC10455514/&hl=vi&sl=en&tl=vi&client=srp"
    assert unwrap_search_url(t_url) == "https://pmc.ncbi.nlm.nih.gov/articles/PMC10455514/"

    # Google redirect url
    r_url = "https://www.google.com/url?q=https://vinmec.com/bai-viet&sa=U&ved=2ahUKE"
    assert unwrap_search_url(r_url) == "https://vinmec.com/bai-viet"

    # Standard direct url
    normal = "https://bvdhydcantho.com/detail_article?id=291"
    assert unwrap_search_url(normal) == normal


def test_sanitize_ai_response_urls_nested_and_parentheses():
    allowed = {"https://pmc.ncbi.nlm.nih.gov/articles/PMC10455514/"}
    # Raw URL wrapped in parentheses
    text = "Xem tại (https://pmc.ncbi.nlm.nih.gov/articles/PMC10455514/) và (https://phishing.bad/evil)"
    sanitized = sanitize_ai_response_urls(text, allowed)
    assert "https://pmc.ncbi.nlm.nih.gov/articles/PMC10455514/" in sanitized
    assert "phishing.bad" not in sanitized
    assert "[Link đã ẩn do không nằm trong nguồn tìm kiếm xác minh]" in sanitized


def test_standardize_web_references_replaces_messy_citations():
    results = [
        WebSearchResult("Warfarin và kháng sinh", "https://pmc.ncbi.nlm.nih.gov/1", "snippet", "pmc.ncbi.nlm.nih.gov"),
        WebSearchResult("10 tương tác", "https://goodrx.com/2", "snippet", "goodrx.com"),
    ]
    messy_ai_text = (
        "Cần theo dõi chỉ số INR khi phối hợp Warfarin và Ciprofloxacin [1].\n\n"
        "Tham khảo chi tiết tại:\n"
        "* (https://translate.google.com/translate?u=[Link đã ẩn do không nằm trong nguồn tìm kiếm xác minh])\n"
        "* [5]\n\n"
        "⚠️ *Lưu ý: Thông tin mang tính tham khảo.*"
    )
    clean = standardize_web_references(messy_ai_text, results)
    assert "[Link đã ẩn" not in clean
    assert "* [5]" not in clean
    assert "### Nguồn tham khảo y khoa:" in clean
    assert "1. [Warfarin và kháng sinh](https://pmc.ncbi.nlm.nih.gov/1) - *pmc.ncbi.nlm.nih.gov*" in clean
