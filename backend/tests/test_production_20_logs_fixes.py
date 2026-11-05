"""
Unit & Integration Tests for 20 Real Production Logs Fixes (<=140 LOC).
Verifies:
1. Elimination of cross-drug hallucinations (Primolut N -> not Biotin, Venclexta -> not Naloxone).
2. Elimination of false safe abstentions on DAV drugs (Teglutik, Venclexta).
3. Clinical guidance on disease and drug class queries (Diabetes, Stroke, Antihistamines kiêng gì).
4. Inventory inquiry handling for drug classes (nhóm thuốc kháng histamin còn bao nhiêu).
5. Clinical comparison between Noradrenalin and Dopamin in cardiogenic shock.
"""
import pytest
from types import SimpleNamespace
from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery
from app.services.session_context import get_or_create_session
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat

class DummyRequest:
    headers = {}
    client = None
    state = SimpleNamespace()

@pytest.mark.asyncio
async def test_teglutik_authoritative_lookup():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_teglutik_test", "Bác sĩ", "doctor")
        payload = CopilotQuery(query="Teglutik")
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Teglutik" in resp.reply_text or "Riluzole" in resp.reply_text
        assert "840110202926" in resp.reply_text
        assert "TỪ CHỐI ĐƯA CHỈ ĐỊNH" not in resp.reply_text

@pytest.mark.asyncio
async def test_venclexta_contraindication_and_interaction():
    async with AsyncSessionLocal() as db:
        # 1. Chống chỉ định Venclexta
        session1 = get_or_create_session("sess_venc_contra", "Bác sĩ", "doctor")
        payload1 = CopilotQuery(query="chong chi dinh venclexta")
        resp1 = await handle_copilot_chat(payload1, DummyRequest(), db, session=session1, history="")
        assert resp1.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Venetoclax" in resp1.reply_text
        assert "TỪ CHỐI ĐƯA CHỈ ĐỊNH" not in resp1.reply_text

        # 2. Tương tác thuốc Venclexta (không ra Naloxon)
        session2 = get_or_create_session("sess_venc_inter", "Bác sĩ", "doctor")
        payload2 = CopilotQuery(query="Tôi muốn hỏi về tương tác thuốc của Venclexta")
        resp2 = await handle_copilot_chat(payload2, DummyRequest(), db, session=session2, history="")
        assert resp2.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Venetoclax" in resp2.reply_text
        assert "NALOXON" not in resp2.reply_text
        assert "Naloxone" not in resp2.reply_text

@pytest.mark.asyncio
async def test_primolut_interaction_no_biotin():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_primolut_test", "Bác sĩ", "doctor")
        payload = CopilotQuery(query="Tôi cần thông tin về tương tác thuốc của Primolut N")
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Norethisteron" in resp.reply_text or "Primolut" in resp.reply_text
        assert "BIOTIN" not in resp.reply_text
        assert "Biotin" not in resp.reply_text

@pytest.mark.asyncio
async def test_diabetes_lifestyle_guidance_no_clortalidon():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_diabetes_test", "Bác sĩ", "doctor")
        payload = CopilotQuery(query="tiểu đường thì chú ý những gì")
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert "đái tháo đường" in resp.reply_text.lower() or "tiểu đường" in resp.reply_text.lower()
        assert "hạ đường huyết" in resp.reply_text.lower() or "hba1c" in resp.reply_text.lower()
        assert "CLORTALIDON" not in resp.reply_text
        assert "Chlortalidone" not in resp.reply_text

@pytest.mark.asyncio
async def test_stroke_emergency_guidance():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_stroke_test", "Bác sĩ", "doctor")
        payload = CopilotQuery(query="nếu bị tai biến thì uống thuốc và sinh hoạt thế nào")
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert "đột quỵ" in resp.reply_text.lower() or "tai biến" in resp.reply_text.lower()
        assert "an cung" in resp.reply_text.lower() or "115" in resp.reply_text.lower()
        assert "TỪ CHỐI TIẾP NHẬN" not in resp.reply_text

@pytest.mark.asyncio
async def test_antihistamine_dietary_restrictions_no_kenmag():
    async with AsyncSessionLocal() as db:
        # Dị ứng có dấu
        session1 = get_or_create_session("sess_antihist_1", "Bác sĩ", "doctor")
        payload1 = CopilotQuery(query="nhóm thuốc chống dị ứng kiêng gì")
        resp1 = await handle_copilot_chat(payload1, DummyRequest(), db, session=session1, history="")
        assert "kháng histamin" in resp1.reply_text.lower() or "chống dị ứng" in resp1.reply_text.lower()
        assert "rượu" in resp1.reply_text.lower() or "cồn" in resp1.reply_text.lower()
        assert "Kenmag" not in resp1.reply_text

        # Dị ứng không dấu (di ung)
        session2 = get_or_create_session("sess_antihist_2", "Bác sĩ", "doctor")
        payload2 = CopilotQuery(query="nhóm thuốc chống di ứng kiêng gì")
        resp2 = await handle_copilot_chat(payload2, DummyRequest(), db, session=session2, history="")
        assert "kháng histamin" in resp2.reply_text.lower() or "chống dị ứng" in resp2.reply_text.lower()
        assert "thực thể dược phẩm `Di`" not in resp2.reply_text

@pytest.mark.asyncio
async def test_antihistamine_inventory_query():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_hist_inv", "Bác sĩ", "doctor")
        payload = CopilotQuery(query="nhóm thuốc kháng histamin còn bao nhiêu")
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert resp.intent == "CLINICAL_INVENTORY_LOOKUP"
        assert "TỒN KHO" in resp.reply_text or "tồn kho" in resp.reply_text.lower()
        assert "GỢI Ý ĐỐI SOÁT CHÍNH TẢ" not in resp.reply_text

@pytest.mark.asyncio
async def test_cardiogenic_shock_noradrenalin_vs_dopamin():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_shock_compare", "Bác sĩ", "doctor")
        payload = CopilotQuery(query="Nếu bệnh nhân sốc tim thì dùng Noradrenalin hay Dopamin?")
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert "noradrenalin" in resp.reply_text.lower()
        assert "dopamin" in resp.reply_text.lower()
        assert "loạn nhịp" in resp.reply_text.lower() or "tử vong" in resp.reply_text.lower()
