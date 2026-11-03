"""
Unit tests for anti-drift off-target guardrails in Clinical Copilot (<=150 LOC).
"""
import pytest
from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from app.services.session_context import get_or_create_session

class DummyState:
    authenticated_user = None

class DummyRequest:
    state = DummyState()

@pytest.mark.asyncio
async def test_propranolol_asthma_contraindication_not_morphine():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_prop", "test_user", "doctor")
        q = CopilotQuery(query="Bệnh nhân bị hen phế quản có dùng được Propranolol không?", user_name="test_user", user_role="doctor", session_id="test_prop")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert "morphin" not in res.reply_text.lower()
        assert "propranolol" in res.reply_text.lower()
        assert "hen phế quản" in res.reply_text.lower()

@pytest.mark.asyncio
async def test_hypertension_pregnancy_no_tang_suc_herb():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_hyp", "test_user", "doctor")
        q = CopilotQuery(query="Thuốc điều trị tăng huyết áp ở phụ nữ có thai", user_name="test_user", user_role="doctor", session_id="test_hyp")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert "tăng sức" not in res.reply_text.lower()
        assert "sơn tra" not in res.reply_text.lower()
        assert "morphin" not in res.reply_text.lower()

@pytest.mark.asyncio
async def test_ward_narcotic_cabinet_regulation_not_claforan():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_cab", "test_user", "doctor")
        q = CopilotQuery(query="Quy chế quản lý thuốc gây nghiện tại tủ trực", user_name="test_user", user_role="doctor", session_id="test_cab")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert "claforan" not in res.reply_text.lower()
        assert res.intent == "LEGAL_GUIDANCE"
        assert "thông tư" in res.reply_text.lower()

@pytest.mark.asyncio
async def test_pediatric_paracetamol_dose_shows_children_dose():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_ped", "test_user", "doctor")
        q = CopilotQuery(query="Liều dùng Paracetamol cho trẻ em 15kg", user_name="test_user", user_role="doctor", session_id="test_ped")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert "liều dùng trẻ em" in res.reply_text.lower()
        assert "trẻ em" in res.reply_text.lower()

@pytest.mark.asyncio
async def test_venclexta_interaction_monograph_grounding():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_venc", "test_user", "doctor")
        q = CopilotQuery(query="Tôi muốn hỏi về tương tác thuốc của Venclexta", user_name="test_user", user_role="doctor", session_id="test_venc")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert "cyp3a4" in res.reply_text.lower()
        assert "venclexta" in res.reply_text.lower()

@pytest.mark.asyncio
async def test_teglutik_lookup_returns_riluzole():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_teg", "test_user", "doctor")
        q = CopilotQuery(query="Teglutik", user_name="test_user", user_role="doctor", session_id="test_teg")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert "riluzole" in res.reply_text.lower()

@pytest.mark.asyncio
async def test_unaccented_venclexta_interaction_returns_monograph():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_unacc_venc", "test_user", "doctor")
        q = CopilotQuery(query="tuong tac thuoc venclexta", user_name="test_user", user_role="doctor", session_id="test_unacc_venc")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert "cyp3a4" in res.reply_text.lower()
        assert "venclexta" in res.reply_text.lower()

@pytest.mark.asyncio
async def test_unaccented_venclexta_contraindication_returns_monograph():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_unacc_contra", "test_user", "doctor")
        q = CopilotQuery(query="chong chi dinh venclexta", user_name="test_user", user_role="doctor", session_id="test_unacc_contra")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert "cyp3a" in res.reply_text.lower()
        assert "chống chỉ định" in res.reply_text.lower()

@pytest.mark.asyncio
async def test_catalog_guide_query_returns_lookup_guide_not_jevax():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_guide", "test_user", "doctor")
        q = CopilotQuery(query="Tra cứu Dược Thư Quốc Gia", user_name="test_user", user_role="doctor", session_id="test_guide")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert res.intent == "MEDICATION_LOOKUP_GUIDE"
        assert "jevax" not in res.reply_text.lower()
        assert "cổng tra cứu" in res.reply_text.lower()

@pytest.mark.asyncio
async def test_two_drugs_interaction_prompt_returns_clarification_not_sohaibu():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_two_ddi", "test_user", "doctor")
        q = CopilotQuery(query="Kiểm tra tương tác hai thuốc", user_name="test_user", user_role="doctor", session_id="test_two_ddi")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert res.intent == "MEDICATION_INTERACTION_CLARIFICATION"
        assert "sohaibu" not in res.reply_text.lower()

@pytest.mark.asyncio
async def test_zithromax_meal_timing_returns_dosage_monograph():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_zithro", "test_user", "doctor")
        q = CopilotQuery(query="Kháng sinh Zithromax uống trước hay sau ăn?", user_name="test_user", user_role="doctor", session_id="test_zithro")
        res = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert res.intent == "MEDICATION_SAFETY_PROFILE"
        assert "zithromax" in res.reply_text.lower()
