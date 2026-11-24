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
            enable_web_search=False
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
            enable_web_search=False
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
            enable_web_search=False
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


def test_flash_lite_prioritized_over_low_quota_3_8_flash():
    """Verify Flash Lite models (500 RPD) rank above 20-RPD non-lite models."""
    from app.services.gemini_model_discovery import filter_and_rank_gemini_models

    models = [
        "gemini-3.8-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
    ]
    ranked = filter_and_rank_gemini_models(models)
    assert ranked[0] == "gemini-3.5-flash-lite"
    assert ranked[1] == "gemini-3.1-flash-lite"
    assert ranked.index("gemini-3.5-flash-lite") < ranked.index("gemini-3.8-flash")


@pytest.mark.asyncio
async def test_explanatory_drug_query_synthesizes_natural_focused_answer(monkeypatch):
    """Verify causal/explanatory questions ('Tại sao...') synthesize natural grounded answer at top."""
    from unittest.mock import AsyncMock
    from app.services.rag.claim_attributor import PaperQASynthesisResult
    from app.services.copilot_drug_lookup import lookup_drug_authoritative
    from app.database import AsyncSessionLocal

    mock_synth = AsyncMock(return_value=PaperQASynthesisResult(
        conversational_answer=(
            "Không được dùng Aspirin cho trẻ em dưới 16 tuổi bị sốt do nhiễm virus vì nguy cơ khởi phát **Hội chứng Reye** "
            "(tổn thương gan cấp tính và phù não nguy hiểm tính mạng). [Dược thư Quốc gia Việt Nam]"
        ),
        citations=[],
        grounded_confidence=0.95,
        source_status="exact_match",
    ))
    monkeypatch.setattr(
        "app.services.rag.paperqa_synthesizer.synthesize_grounded_clinical_response",
        mock_synth,
    )

    q = "Tại sao không được dùng thuốc hạ sốt, giảm đau aspirin cho trẻ em dưới 16 tuổi bị sốt do nhiễm virus (như cúm, thủy đậu)?"
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative(
            q, db, session_id="test-aspirin-reye", user_role="doctor",
            requested_fields=["pediatric_dosage", "contraindications"]
        )

    assert resp.rag_grounded is True
    assert resp.claims, "Claims must remain attached for evidence provenance"
    assert "Hội chứng Reye" in resp.reply_text
    assert resp.reply_text.startswith("Không được dùng Aspirin")
    assert "Đối chiếu nguyên văn Dược Thư" in resp.reply_text
    mock_synth.assert_awaited_once()


def test_trie_matcher_does_not_extract_generic_giai_doc_as_drug():
    """Verify generic medical terms like 'giải độc' are never matched as herbal brand names."""
    from app.services.chatbot.lexical_trie_matcher import DrugLexicalMatcher
    matcher = DrugLexicalMatcher()
    matcher.load_from_db()
    q = "Khi một bệnh nhân uống quá liều thuốc giảm đau, hạ sốt paracetamol (acetaminophen) dẫn đến nguy cơ hoại tử gan cấp tính, thuốc giải độc đặc hiệu nào được chỉ định?"
    meds = matcher.extract_medications(q)
    assert any("paracetamol" in m.lower() for m in meds)
    assert not any("giải độc" in m.lower() for m in meds)


def test_attach_database_claims_clears_chips_on_abstention():
    """Verify safe_abstention due to missing provenance clears stale suggested_chips."""
    from app.services.copilot_drug_lookup import _attach_database_claims
    resp = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="Nội dung chưa xác minh",
        answer_type="medication_summary",
        rag_grounded=True,
        suggested_chips=["Thuốc giải độc đặc hiệu cho Giải độc gan xuân quang"],
        active_medication_name="Giải độc gan xuân quang",
        citations=[],
        evidence=[],
    )
    out = _attach_database_claims(resp)
    assert out.answer_type == "safe_abstention"
    assert out.suggested_chips == []
    assert out.active_medication_name is None
