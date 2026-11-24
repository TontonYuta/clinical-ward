import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.session_context import get_or_create_session
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from app.database import AsyncSessionLocal


@pytest.mark.asyncio
async def test_crag_web_fallback_triggers_for_unindexed_real_drug(monkeypatch):
    """
    Khi thuốc không có trong Dược thư CSDL nội bộ, nếu là thuốc thực có kết quả tìm kiếm web
    đã được xác minh, hệ thống tự động kích hoạt Grounded Web Search mà không cần người dùng tự bật nút.
    """
    mock_web_response = CopilotResponse(
        intent="GROUNDED_WEB_SEARCH",
        reply_text="Lecanemab là kháng thể đơn dòng điều trị Alzheimer giai đoạn đầu.",
        answer_type="grounded_web_reference",
        source_status="grounded_web_search",
        rag_grounded=True,
        confidence=0.9,
        citations=[{
            "title": "Lecanemab điều trị Alzheimer",
            "url": "https://vinmec.com/lecanemab-alzheimer",
            "snippet": "Thuốc lecanemab giúp làm chậm tiến triển của bệnh Alzheimer...",
            "source_domain": "vinmec.com"
        }]
    )

    monkeypatch.setattr(
        "app.services.chatbot.grounded_web_search_handler.handle_grounded_web_search_turn",
        AsyncMock(return_value=mock_web_response)
    )

    async with AsyncSessionLocal() as db:
        session = get_or_create_session("s_test_crag_lecan", "doctor", "doctor")
        req = SimpleNamespace(state=SimpleNamespace(), scope={"app": None})
        payload = CopilotQuery(
            query="Thuốc Lecanemab điều trị Alzheimer liều dùng thế nào?",
            enable_web_search=False
        )
        resp = await handle_copilot_chat(payload, req, db, session=session, history="")
        assert resp.intent == "GROUNDED_WEB_SEARCH"
        assert resp.answer_type == "grounded_web_reference"
        assert resp.source_status == "grounded_web_search"
        assert len(resp.citations or []) == 1
        assert "Lecanemab" in resp.reply_text


@pytest.mark.asyncio
async def test_crag_web_fallback_blocks_internal_inventory_queries():
    """
    Nghiệp vụ nội bộ (kho dược, tồn kho, tủ trực) nếu không tìm thấy trong DB thì tuyệt đối
    CẤM không được tự động search web ra bên ngoài.
    """
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("s_test_crag_inv", "doctor", "doctor")
        req = SimpleNamespace(state=SimpleNamespace(), scope={"app": None})
        payload = CopilotQuery(
            query="Kho dược còn bao nhiêu viên Lecanemab tồn kho?",
            enable_web_search=False
        )
        resp = await handle_copilot_chat(payload, req, db, session=session, history="")
        assert resp.intent != "GROUNDED_WEB_SEARCH"
        assert resp.answer_type != "grounded_web_reference"


@pytest.mark.asyncio
async def test_crag_web_fallback_blocks_non_medical_queries():
    """
    Câu hỏi phi y tế (lập trình, thơ ca, thời tiết) nếu không có trong DB
    phải bị chặn lại, không được kích hoạt search web.
    """
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("s_test_crag_code", "doctor", "doctor")
        req = SimpleNamespace(state=SimpleNamespace(), scope={"app": None})
        payload = CopilotQuery(
            query="Viết code Python kiểm tra số nguyên tố cho tôi",
            enable_web_search=False
        )
        resp = await handle_copilot_chat(payload, req, db, session=session, history="")
        assert resp.intent != "GROUNDED_WEB_SEARCH"
        assert resp.answer_type != "grounded_web_reference"


@pytest.mark.asyncio
async def test_crag_web_fallback_safely_abstains_for_fabricated_drug(monkeypatch):
    """
    Đối với thuốc bịa đặt / không tồn tại, khi search web không chứa thực thể ứng viên trong
    kết quả snippet/title, hệ thống giữ nguyên quyết định từ chối an toàn CLINICAL_SAFE_ABSTENTION.
    """
    # Giả lập kết quả search web trả về các thuốc 500mg khác mà KHÔNG chứa từ khóa 'xzylophone'
    mock_unrelated_web_resp = CopilotResponse(
        intent="GROUNDED_WEB_SEARCH",
        reply_text="Kết quả các thuốc 500mg phổ biến gồm Daflon và Glexil...",
        answer_type="grounded_web_reference",
        source_status="grounded_web_search",
        rag_grounded=True,
        confidence=0.5,
        citations=[{
            "title": "Công dụng thuốc Glexil 500mg",
            "url": "https://vinmec.com/glexil-500",
            "snippet": "Thuốc Glexil 500mg kháng sinh điều trị nhiễm khuẩn...",
            "source_domain": "vinmec.com"
        }]
    )

    monkeypatch.setattr(
        "app.services.chatbot.grounded_web_search_handler.handle_grounded_web_search_turn",
        AsyncMock(return_value=mock_unrelated_web_resp)
    )

    async with AsyncSessionLocal() as db:
        session = get_or_create_session("s_test_crag_fake", "nurse", "nurse")
        req = SimpleNamespace(state=SimpleNamespace(), scope={"app": None})
        payload = CopilotQuery(
            query="Thuốc Xzylophone 500mg liều dùng thế nào",
            enable_web_search=False
        )
        resp = await handle_copilot_chat(payload, req, db, session=session, history="")
        # Thuốc bịa đặt không xuất hiện trong citations -> Giữ nguyên quyết định an toàn của CSDL (safe_abstention / clarification)
        assert resp.intent in ("CLINICAL_SAFE_ABSTENTION", "MEDICATION_LOOKUP_CLARIFICATION")
        assert resp.answer_type in ("safe_abstention", "clarification")
