# backend/tests/test_cdss_alerting_sentinel.py
"""
Test Suite for Automated CDSS High-Alert Sentinel & 1-Click Substitution Engine.
Verifies QĐ 5948/QĐ-BYT hard/soft stop alerts, 1-click substitutions, and zero false alarms
on single drugs or safe combinations.
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
async def test_critical_contraindication_cdss_alert():
    """
    Nitroglycerin + Sildenafil is a critical level 1 contraindication under QĐ 5948.
    Must generate a critical CDSS alert.
    """
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_cdss_nitro_sildenafil", "BS. Hùng", "doctor")
        payload = CopilotQuery(
            query="Tương tác giữa Nitroglycerin và Sildenafil",
            user_role="doctor",
            user_name="BS. Hùng",
            session_id="test_cdss_nitro_sildenafil"
        )
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert resp is not None
        assert resp.cdss_alert is not None, "CDSS Alert must be automatically triggered for Contraindicated DDI"
        assert resp.cdss_alert.level == "critical"
        assert "CHỐNG CHỈ ĐỊNH" in resp.cdss_alert.title
        assert any(term in resp.cdss_alert.message.lower() for term in ("hạ huyết áp", "tử vong", "sildenafil", "nitroglycerin"))
        assert any(ref in (resp.cdss_alert.regulatoryReference or "") for ref in ("5948", "QĐ 5948", "Quyết định 5948"))

@pytest.mark.asyncio
async def test_ddi_with_one_click_substitution():
    """
    Clopidogrel + Omeprazole interacts via CYP2C19 inhibition.
    Must trigger CDSS alert with 1-click substitute to Pantoprazol 40mg.
    """
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_cdss_clop_ome", "BS. Mai", "doctor")
        payload = CopilotQuery(
            query="Tương tác giữa Clopidogrel và Omeprazol",
            user_role="doctor",
            user_name="BS. Mai",
            session_id="test_cdss_clop_ome"
        )
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert resp is not None
        assert resp.cdss_alert is not None, "CDSS Alert must trigger for Clopidogrel + Omeprazole"
        assert resp.cdss_alert.substituteDrug == "Pantoprazol 40mg"
        assert any(term in resp.cdss_alert.message.lower() for term in ("omeprazol", "clopidogrel", "kháng kết tập", "cyp2c19", "giảm hoạt tính"))

@pytest.mark.asyncio
async def test_multihop_clinical_case_cdss_alert():
    """
    Multihop Case: Metformin + ClCr 24 mL/min is contraindicated.
    Spironolactone + Enalapril has severe hyperkalemia risk.
    Must trigger a critical CDSS alert with substitute recommendation.
    """
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_cdss_multihop", "BS. Tuấn", "doctor")
        payload = CopilotQuery(
            query="Bệnh nhân nam 68 tuổi, đái tháo đường typ 2, suy tim sung huyết và suy thận mạn với ClCr 24 mL/phút. Bác sĩ kê đơn: Metformin 1000mg, Enalapril 10mg, Spironolactone 25mg. Phác đồ này có an toàn không?",
            user_role="doctor",
            user_name="BS. Tuấn",
            session_id="test_cdss_multihop"
        )
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert resp is not None
        assert resp.cdss_alert is not None, "CDSS Alert must be present in multihop contraindicated case"
        assert resp.cdss_alert.level == "critical"
        assert resp.cdss_alert.substituteDrug is not None
        assert resp.cdss_alert.substituteDrug in ("Linagliptin 5mg", "Hiệu chỉnh giảm 50% liều", "Pantoprazol 40mg")

@pytest.mark.asyncio
async def test_single_drug_no_false_cdss_alert():
    """
    Single drug queries (Paracetamol, Amlodipin) must NEVER trigger CDSS DDI alerts.
    Zero false alarms guarantee clean SOTA RAG UI.
    """
    async with AsyncSessionLocal() as db:
        # 1. Paracetamol
        session_para = get_or_create_session("test_cdss_single_para", "BS. Lan", "doctor")
        payload_para = CopilotQuery(
            query="Paracetamol 500mg",
            user_role="doctor",
            user_name="BS. Lan",
            session_id="test_cdss_single_para"
        )
        resp_para = await handle_copilot_chat(payload_para, DummyRequest(), db, session=session_para, history="")
        assert resp_para is not None
        assert resp_para.cdss_alert is None, "Single drug query Paracetamol must NOT have CDSS alert"

        # 2. Amlodipin
        session_amlo = get_or_create_session("test_cdss_single_amlo", "BS. Lan", "doctor")
        payload_amlo = CopilotQuery(
            query="Thuốc Amlodipin 5mg",
            user_role="doctor",
            user_name="BS. Lan",
            session_id="test_cdss_single_amlo"
        )
        resp_amlo = await handle_copilot_chat(payload_amlo, DummyRequest(), db, session=session_amlo, history="")
        assert resp_amlo is not None
        assert resp_amlo.cdss_alert is None, "Single drug query Amlodipin must NOT have CDSS alert"

@pytest.mark.asyncio
async def test_safe_drug_combination_no_cdss_alert():
    """
    Safe combination (Aspirin + Paracetamol) without major QĐ 5948 contraindication
    must not trigger false critical CDSS alert.
    """
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_cdss_safe_pair", "BS. An", "doctor")
        payload = CopilotQuery(
            query="Tương tác giữa Aspirin và Paracetamol",
            user_role="doctor",
            user_name="BS. An",
            session_id="test_cdss_safe_pair"
        )
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert resp is not None
        assert resp.cdss_alert is None, "Safe combination must not have CDSS alert"

@pytest.mark.asyncio
async def test_out_of_scope_no_cdss_alert():
    """
    Out of scope / non-medical queries must not have CDSS alert.
    """
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("test_cdss_out_of_scope", "BS. An", "doctor")
        payload = CopilotQuery(
            query="Thời tiết hôm nay thế nào?",
            user_role="doctor",
            user_name="BS. An",
            session_id="test_cdss_out_of_scope"
        )
        resp = await handle_copilot_chat(payload, DummyRequest(), db, session=session, history="")
        assert resp is not None
        assert resp.cdss_alert is None, "Out-of-scope query must NOT have CDSS alert"
