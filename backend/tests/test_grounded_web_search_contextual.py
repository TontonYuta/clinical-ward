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
