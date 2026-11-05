"""
Integration Tests for End-to-End Multi-Turn Adaptive Clinical Conversations.
Simulates real doctor interactions from production logs:
Turn 1: "Paracetamol" (Overview)
Turn 2: "Uống sáng hay tối?" (Followup Facet: Timing)
Turn 3: "thuốc có kỵ rượu không" (Followup Facet: Alcohol)
Turn 4: "Còn liều tối đa?" (Followup Facet: Max Dose)
Turn 5: "Bệnh nhân suy thận có dùng được không?" (Followup Facet: Renal Adjustment)
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
async def test_production_multiturn_adaptive_flow():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("sess_prod_multiturn", "Bác sĩ", "doctor")
        
        # Turn 1: Hỏi bình thường (Overview)
        resp1 = await handle_copilot_chat(CopilotQuery(query="Paracetamol"), DummyRequest(), db, session=session, history="")
        assert resp1.intent == "MEDICATION_SAFETY_PROFILE"
        assert len(resp1.reply_text) < 500, f"Turn 1 should be concise BLUF: {len(resp1.reply_text)}"
        assert "Bác sĩ" in resp1.reply_text
        assert "Paracetamol" in resp1.reply_text
        assert len(resp1.suggested_chips) == 4
        assert session.active_medication_name == "Paracetamol"

        # Turn 2: Hỏi sâu thời điểm uống
        resp2 = await handle_copilot_chat(CopilotQuery(query="Uống sáng hay tối?"), DummyRequest(), db, session=session, history="")
        assert resp2.intent == "MEDICATION_SAFETY_PROFILE"
        assert len(resp2.reply_text) < 600
        assert "sáng hay tối đều được" in resp2.reply_text.lower()
        assert "sau bữa ăn" in resp2.reply_text.lower() or "dạ dày" in resp2.reply_text.lower()

        # Turn 3: Hỏi sâu tương tác rượu
        resp3 = await handle_copilot_chat(CopilotQuery(query="thuốc có kỵ rượu không"), DummyRequest(), db, session=session, history="")
        assert resp3.intent == "MEDICATION_SAFETY_PROFILE"
        assert len(resp3.reply_text) < 900
        assert "rượu" in resp3.reply_text.lower()
        assert "napqi" in resp3.reply_text.lower() or "cyp2e1" in resp3.reply_text.lower() or "gan" in resp3.reply_text.lower()

        # Turn 4: Hỏi sâu liều tối đa
        resp4 = await handle_copilot_chat(CopilotQuery(query="Còn liều tối đa?"), DummyRequest(), db, session=session, history="")
        assert resp4.intent == "MEDICATION_SAFETY_PROFILE"
        assert len(resp4.reply_text) < 900
        assert "4.000 mg" in resp4.reply_text or "4g" in resp4.reply_text or "4 g" in resp4.reply_text

        # Turn 5: Hỏi sâu suy thận
        resp5 = await handle_copilot_chat(CopilotQuery(query="Thuốc này suy thận dùng được không?"), DummyRequest(), db, session=session, history="")
        assert resp5.intent == "MEDICATION_SAFETY_PROFILE"
        assert len(resp5.reply_text) < 900
        assert "thận" in resp5.reply_text.lower()
        assert "giãn khoảng cách" in resp5.reply_text.lower() or "clcr" in resp5.reply_text.lower()
