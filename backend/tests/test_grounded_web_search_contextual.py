"""
Kiểm thử tự động cho Contextual Query Rewriting, Dynamic Suggested Chips & Turn Memory
của luồng Grounded Web Search (Google Search qua Serper).
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.chatbot.web_search_engine import WebSearchResult
from app.services.chatbot.grounded_web_search_handler import (
    contextualize_web_query,
    extract_previous_medical_subject,
    generate_dynamic_web_chips,
    handle_grounded_web_search_turn
)
from app.services.session_context import SessionState


def test_extract_previous_medical_subject():
    """Kiểm tra khả năng trích xuất chủ đề y khoa từ lượt hỏi trước."""
    history = (
        "Bác sĩ: Tôi muốn bạn cho tôi thông tin về 3 loại thuốc hạ sốt\n"
        "Trợ lý: Dưới đây là thông tin về 2 loại thuốc hạ sốt phổ biến..."
    )
    subject = extract_previous_medical_subject(history)
    assert subject is not None
    assert "hạ sốt" in subject.lower()

    history_tri = (
        "Bác sĩ: thuốc cho người bị trĩ\n"
        "Trợ lý: Đối với người bị bệnh trĩ, việc sử dụng thuốc..."
    )
    subject_tri = extract_previous_medical_subject(history_tri)
    assert subject_tri is not None
    assert "trĩ" in subject_tri.lower()


@pytest.mark.asyncio
async def test_contextualize_web_query_without_history():
    """Khi không có lịch sử hội thoại, query được giữ nguyên 100%."""
    q, rewritten = await contextualize_web_query("thuốc hạ sốt", history="")
    assert q == "thuốc hạ sốt"
    assert rewritten is False


@pytest.mark.asyncio
async def test_contextualize_web_query_with_follow_up():
    """
    Khi có câu hỏi nối tiếp 'sao mới có 2 loại' sau câu 'thuốc hạ sốt',
    query phải được viết lại mang theo thực thể 'thuốc hạ sốt' thay vì tìm kiếm trần.
    """
    history = (
        "Bác sĩ: Tôi muốn bạn cho tôi thông tin về 3 loại thuốc hạ sốt\n"
        "Trợ lý: Dưới đây là Paracetamol và Ibuprofen..."
    )
    rewritten_q, is_rewritten = await contextualize_web_query(
        "sao mới có 2 loại",
        history=history,
        api_key=None  # Test deterministic heuristic
    )
    assert is_rewritten is True
    assert "hạ sốt" in rewritten_q.lower()
    # Tuyệt đối không được giữ nguyên 'sao mới có 2 loại' trần trụi
    assert rewritten_q != "sao mới có 2 loại"


def test_dynamic_suggested_chips_topics():
    """Kiểm tra Suggested Chips sinh động theo chủ đề thay vì hardcoded tĩnh."""
    # 1. Chủ đề Hạ sốt
    fever_chips = generate_dynamic_web_chips("thuốc hạ sốt", "Paracetamol và Ibuprofen", [])
    assert len(fever_chips) == 3
    assert any("Paracetamol" in c for c in fever_chips)
    assert any("Ibuprofen" in c or "sốt xuất huyết" in c for c in fever_chips)

    # 2. Chủ đề Bệnh trĩ
    hemorrhoid_chips = generate_dynamic_web_chips("thuốc cho người bị trĩ", "Daflon 500mg, thuốc bôi trĩ", [])
    assert len(hemorrhoid_chips) == 3
    assert any("Daflon" in c for c in hemorrhoid_chips)
    assert any("phẫu thuật" in c or "táo bón" in c for c in hemorrhoid_chips)

    # 3. Chủ đề Cúm mùa
    flu_chips = generate_dynamic_web_chips("Khuyến cáo tiêm phòng cúm mùa 2026", "WHO khuyến nghị vắc xin cúm tam giá loại bỏ Yamagata", [])
    assert len(flu_chips) == 3
    assert any("cúm" in c.lower() or "tam giá" in c.lower() for c in flu_chips)


@pytest.mark.asyncio
async def test_handle_grounded_web_search_turn_full_flow():
    """Kiểm thử trọn vẹn luồng Web Search có kèm Session State và Dynamic Chips."""
    session = SessionState("test_session_user:s1", user_name="Bác sĩ Test", user_role="doctor")
    session.append_conversation_turn(
        "Tôi muốn bạn cho tôi thông tin về 3 loại thuốc hạ sốt",
        "Paracetamol và Ibuprofen là 2 loại phổ biến..."
    )

    fake_results = [
        WebSearchResult(
            title="Các loại thuốc hạ sốt phổ biến",
            url="https://suckhoedoisong.vn/thuoc-ha-sot.htm",
            snippet="Aspirin và Paracetamol là các thuốc hạ sốt...",
            source_domain="suckhoedoisong.vn",
            is_live=True
        )
    ]

    with patch("app.services.chatbot.grounded_web_search_handler.search_and_verify_web", new=AsyncMock(return_value=(fake_results, "serper"))), \
         patch("app.services.llm_provider.query_clinical_llm", new=AsyncMock(return_value="Dưới đây là thông tin về các loại thuốc hạ sốt [1].\n\n[Sức khỏe Đời sống](https://suckhoedoisong.vn/thuoc-ha-sot.htm)\n\n⚠️ *Lưu ý: Thông tin tìm kiếm từ Internet mang tính chất tham khảo, không thay thế chỉ định chuyên môn của bác sĩ.*")):

        payload = CopilotQuery(
            query="sao mới có 2 loại",
            enable_web_search=True,
            session_id="s1"
        )
        resp = await handle_grounded_web_search_turn(
            payload,
            user_role="director",
            session=session,
            history=session.render_recent_history()
        )

        assert resp is not None
        assert resp.intent == "GROUNDED_WEB_SEARCH"
        assert len(resp.citations) == 1
        assert resp.citations[0]["url"] == "https://suckhoedoisong.vn/thuoc-ha-sot.htm"
        assert len(resp.suggested_chips) == 3
        # Phải là dynamic chips về hạ sốt
        assert any("Paracetamol" in c for c in resp.suggested_chips)


@pytest.mark.asyncio
async def test_contextualize_web_query_skips_long_standalone_queries():
    """
    Câu hỏi lâm sàng dài và hoàn chỉnh (>= 10 từ) dù có chứa 'Tại sao'
    vẫn được xác định là standalone query và giữ nguyên 100%, không bị rewrite hay cắt cụt.
    """
    history = (
        "Bác sĩ: Tra cứu thông tin thuốc\n"
        "Trợ lý: Tôi có thể giúp bác sĩ tra cứu liều dùng, chỉ định, chống chỉ định, tương tác thuốc."
    )
    long_q = (
        "Chống chỉ định trên nhóm đối tượng đặc biệt: Tại sao nhóm thuốc ức chế men chuyển "
        "(ACEi - như Enalapril, Lisinopril) và nhóm Statin lại nằm trong danh mục chống chỉ định "
        "tuyệt đối đối với phụ nữ có thai?"
    )
    q, rewritten = await contextualize_web_query(long_q, history=history, api_key="dummy_key_123456789")
    assert q == long_q
    assert rewritten is False


def test_standardize_web_references_cleans_dangling_lines():
    """
    Kiểm tra hàm standardize_web_references tự động lọc bỏ các dòng dở dang do chạm trần token
    (như thẻ bold không đóng hoặc ngoặc đơn chưa đóng).
    """
    from app.services.chatbot.web_search_engine import standardize_web_references
    raw_ai = (
        "Chào bạn, dưới đây là lý do:\n\n"
        "### 1. Nhóm thuốc ức chế men chuyển (ACEi)\n"
        "* **Cơ chế:** Tác động lên hệ RAAS.\n\n"
        "### 2. Nhóm thuốc Statin (Thuốc điều trị rối loạn"
    )
    fake_results = [
        WebSearchResult(
            title="Tài liệu y khoa",
            url="https://benhvien108.vn/tai-lieu.htm",
            snippet="Hướng dẫn điều trị...",
            source_domain="benhvien108.vn",
            is_live=True
        )
    ]
    out = standardize_web_references(raw_ai, fake_results)
    assert "### 2. Nhóm thuốc Statin" not in out
    assert "### 1. Nhóm thuốc ức chế men chuyển (ACEi)" in out
    assert "### Nguồn tham khảo y khoa:" in out
    assert "1. [Tài liệu y khoa](https://benhvien108.vn/tai-lieu.htm)" in out
