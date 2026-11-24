import pytest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.session_context import get_or_create_session
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from starlette.requests import Request


def _create_mock_request():
    scope = {"type": "http", "app": None, "state": {}}
    return Request(scope)


@pytest.mark.asyncio
async def test_ddi_paracetamol_and_ibuprofen_grounded_contract():
    """Kiểm tra tương tác thuốc Paracetamol + Ibuprofen không bị wipe out mà giữ nguyên grounded_reference kèm claims."""
    req = _create_mock_request()
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("s_test_ddi_para_ibu", "Bác sĩ", "doctor")
        payload = CopilotQuery(
            query="Paracetamol và Ibuprofen dùng chung được không?",
            enable_web_search=True
        )
        resp = await handle_copilot_chat(payload, req, db, session=session, history="")

        assert resp.answer_type in ("grounded_reference", "medication_field", "cdss_alert")
        assert resp.rag_grounded is True
        assert len(resp.claims or []) >= 1
        assert resp.answer_type != "safe_abstention"
        assert "Paracetamol" in resp.reply_text or "Ibuprofen" in resp.reply_text


@pytest.mark.asyncio
async def test_zithromax_timing_monograph_grounded_lookup():
    """Kiểm tra câu hỏi thời điểm uống Zithromax được trả lời trực tiếp từ Dược thư Quốc gia DĐVN V."""
    req = _create_mock_request()
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("s_test_zith_timing", "Bác sĩ", "doctor")
        payload = CopilotQuery(
            query="Kháng sinh Zithromax uống trước hay sau ăn?",
            enable_web_search=True
        )
        resp = await handle_copilot_chat(payload, req, db, session=session, history="")

        assert resp.answer_type == "medication_field"
        assert resp.rag_grounded is True
        assert len(resp.claims or []) >= 1
        assert "thức ăn" in resp.reply_text.lower() or "bữa ăn" in resp.reply_text.lower()
        assert resp.answer_type != "safe_abstention"


@pytest.mark.asyncio
async def test_circular_22_crash_cart_regulation_grounded():
    """Kiểm tra câu hỏi quy định Thông tư 22 tủ trực cấp cứu được trả lời từ tài liệu nội viện đã lập chỉ mục."""
    req = _create_mock_request()
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("s_test_tt22_cart", "Bác sĩ", "doctor")
        payload = CopilotQuery(
            query="Quy định về tủ trực cấp cứu tại khoa lâm sàng theo Thông tư 22/TT-BYT",
            enable_web_search=True
        )
        resp = await handle_copilot_chat(payload, req, db, session=session, history="")

        assert resp.answer_type == "grounded_reference"
        assert resp.rag_grounded is True
        assert len(resp.claims or []) >= 1
        assert resp.answer_type != "safe_abstention"
        assert "22" in resp.reply_text or "tủ thuốc" in resp.reply_text.lower() or "cấp cứu" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_online_unindexed_drug_never_request_unavailable():
    """Kiểm tra khi ở chế độ online, thuốc chưa có trong CSDL nội viện tự động fallback sang Web Search và không trả về Request_Unavailable."""
    mock_web_response = CopilotResponse(
        intent="GROUNDED_WEB_SEARCH",
        reply_text="Lecanemab là kháng thể đơn dòng điều trị bệnh Alzheimer giai đoạn sớm.",
        answer_type="grounded_web_reference",
        source_status="grounded_web_search",
        rag_grounded=True,
        confidence=0.9,
        citations=[{
            "title": "Lecanemab trong điều trị Alzheimer",
            "url": "https://vinmec.com/lecanemab-alzheimer",
            "snippet": "Thuốc lecanemab giúp làm chậm suy giảm nhận thức...",
            "source_domain": "vinmec.com"
        }]
    )

    req = _create_mock_request()
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("s_test_online_unindexed", "Bác sĩ", "doctor")
        payload = CopilotQuery(
            query="Thuốc Lecanemab điều trị Alzheimer liều dùng thế nào?",
            enable_web_search=True
        )
        with patch("app.services.chatbot.grounded_web_search_handler.handle_grounded_web_search_turn", return_value=mock_web_response):
            resp = await handle_copilot_chat(payload, req, db, session=session, history="")

            assert resp.answer_type == "grounded_web_reference"
            assert resp.intent == "GROUNDED_WEB_SEARCH"
            assert resp.rag_grounded is True
            assert resp.answer_type != "safe_abstention"


def test_copilot_router_settings_import():
    """Kiểm tra copilot router có cấu hình settings được import an toàn."""
    from app.routers import copilot
    assert hasattr(copilot, "settings")
    assert getattr(copilot.settings, "API_V1_STR", None) is not None
