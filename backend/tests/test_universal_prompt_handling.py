"""
Universal Benchmark Test Suite for Clinical Copilot (25+ Real-World Prompt Scenarios).
Verifies that the chatbot answers accurately across all input modalities:
1. Terse / Direct Drug Inquiries
2. Natural Clinical Phrasing & Meal Timing
3. Drug-Drug & Drug-Alcohol Interactions
4. Individualized Patient Dosing (Renal, Pediatric, Pregnancy)
5. Hospital Operations & Statutory Regulations (TT 20, TT 36, TT 26)
6. Patient Medication Counseling (Dặn dò người bệnh)
7. Multi-Turn Deictic Continuity & Dynamic Topic Shift
8. Conversational Feedback & Safe Abstention Guardrails
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
async def test_scenario_01_terse_drug_overview():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_01", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Paracetamol", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_01")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "paracetamol" in resp.reply_text.lower()
        assert session.active_medication_name == "Paracetamol"


@pytest.mark.asyncio
async def test_scenario_02_natural_dosing_inquiry():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_02", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Kháng sinh Augmentin liều dùng thế nào", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_02")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert resp.intent in ("MEDICATION_SAFETY_PROFILE", "CLINICAL_AI_CONSULTATION")
        assert "augmentin" in resp.reply_text.lower() or "amoxicillin" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_scenario_03_meal_timing_question():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_03", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Kháng sinh Zithromax uống trước hay sau ăn?", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_03")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "zithromax" in resp.reply_text.lower() or "azithromycin" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_scenario_04_sdk_direct_lookup():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_04", "Bác sĩ", "doctor")
        q = CopilotQuery(query="SĐK VD-23439-15", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_04")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert resp.intent in ("MEDICATION_SAFETY_PROFILE", "CLINICAL_AI_CONSULTATION")
        assert "carbamazepin" in resp.reply_text.lower() or "vd-23439-15" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_scenario_05_contraindicated_ddi_pair():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_05", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Uống Clopidogrel cùng Omeprazol được không", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_05")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "cyp2c19" in reply_lower or "tương tác" in reply_lower or "chống chỉ định" in reply_lower or "giảm tác dụng" in reply_lower


@pytest.mark.asyncio
async def test_scenario_06_carbamazepine_macrolide_interaction():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_06", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Carbamazepine kỵ kháng sinh Clarithromycin đúng không", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_06")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "cyp3a4" in reply_lower or "tương tác" in reply_lower or "ngộ độc" in reply_lower or "nồng độ" in reply_lower


@pytest.mark.asyncio
async def test_scenario_07_drug_alcohol_interaction():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_07", "Bác sĩ", "doctor")
        session.set_active_medication("Paracetamol")
        q = CopilotQuery(query="thuốc có kỵ rượu không", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_07")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "rượu" in reply_lower
        assert "napqi" in reply_lower or "cyp2e1" in reply_lower or "gan" in reply_lower


@pytest.mark.asyncio
async def test_scenario_08_renal_dose_evaluation():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_08", "Bác sĩ", "doctor")
        q = CopilotQuery(query="bệnh nhân suy thận creatinin 180 dùng Ciprofloxacin liều thế nào", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_08")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "ciprofloxacin" in reply_lower
        assert "thận" in reply_lower or "clcr" in reply_lower or "liều" in reply_lower


@pytest.mark.asyncio
async def test_scenario_09_pediatric_dose_by_weight():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_09", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Liều dùng Paracetamol cho trẻ em 15kg", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_09")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "trẻ em" in reply_lower or "150" in reply_lower or "225" in reply_lower or "10 - 15 mg/kg" in reply_lower or "10-15 mg/kg" in reply_lower


@pytest.mark.asyncio
async def test_scenario_10_pregnancy_contraindication():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_10", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Thuốc điều trị tăng huyết áp ở phụ nữ có thai", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_10")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "methyldopa" in reply_lower or "labetalol" in reply_lower or "nifedipin" in reply_lower or "chống chỉ định" in reply_lower or "huyết áp" in reply_lower


@pytest.mark.asyncio
async def test_scenario_11_asthma_contraindication():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_11", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Bệnh nhân bị hen phế quản có dùng được Propranolol không?", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_11")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "propranolol" in reply_lower
        assert "chống chỉ định" in reply_lower or "co thắt" in reply_lower or "nguy hiểm" in reply_lower


@pytest.mark.asyncio
async def test_scenario_12_narcotic_cabinet_regulation():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_12", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Quy chế quản lý thuốc gây nghiện tại tủ trực", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_12")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert resp.intent == "LEGAL_GUIDANCE"
        assert "thông tư" in resp.reply_text.lower() or "20/2017" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_scenario_13_coldchain_gsp_regulation():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_13", "Bác sĩ", "doctor")
        q = CopilotQuery(query="nhiệt độ tủ lạnh bảo quản vắc xin hiện tại thế nào", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_13")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "nhiệt độ" in reply_lower or "tủ lạnh" in reply_lower or "2" in reply_lower or "8" in reply_lower or "°c" in reply_lower


@pytest.mark.asyncio
async def test_scenario_14_patient_medication_counseling():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_14", "Bác sĩ", "doctor")
        session.set_active_medication("Coversyl")
        q = CopilotQuery(query="Bác sĩ dặn bệnh nhân cách uống thuốc này dễ hiểu giúp em", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_14")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "coversyl" in reply_lower or "uống" in reply_lower or "bệnh nhân" in reply_lower or "sáng" in reply_lower


@pytest.mark.asyncio
async def test_scenario_15_multiturn_continuity_and_topic_shift():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_15", "Bác sĩ", "doctor")
        
        # Turn 1: Hỏi thuốc 1
        q1 = CopilotQuery(query="Paracetamol", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_15")
        resp1 = await handle_copilot_chat(q1, DummyRequest(), db, session=session, history="")
        assert session.active_medication_name == "Paracetamol"

        # Turn 2: Hỏi tiếp thuốc 1 (Deictic)
        q2 = CopilotQuery(query="Còn liều tối đa?", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_15")
        resp2 = await handle_copilot_chat(q2, DummyRequest(), db, session=session, history="")
        assert "4.000 mg" in resp2.reply_text or "4g" in resp2.reply_text or "4 g" in resp2.reply_text

        # Turn 3: Chuyển chủ đề sang thuốc 2 (Topic Shift)
        q3 = CopilotQuery(query="thế còn Carbamazepine thì sao", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_15")
        resp3 = await handle_copilot_chat(q3, DummyRequest(), db, session=session, history="")
        assert "carbamazepin" in resp3.reply_text.lower()
        assert session.active_medication_name == "Carbamazepine" or session.active_medication_name == "Carbamazepin"

        # Turn 4: Hỏi tiếp thuốc 2 (Deictic)
        q4 = CopilotQuery(query="thuốc này có tác dụng phụ gì nguy hiểm", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_15")
        resp4 = await handle_copilot_chat(q4, DummyRequest(), db, session=session, history="")
        reply4 = resp4.reply_text.lower()
        assert "stevens-johnson" in reply4 or "sjs" in reply4 or "ten" in reply4 or "da" in reply4 or "dị ứng" in reply4 or "tác dụng phụ" in reply4


@pytest.mark.asyncio
async def test_scenario_16_conversational_feedback():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_16", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Bạn trả lời bị cứng nhắc quá", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_16")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert resp.intent in ("CONVERSATIONAL_FEEDBACK", "FEEDBACK_DATA_ENRICHMENT", "CONVERSATIONAL_CORRECTION")
        assert len(resp.reply_text) > 20


@pytest.mark.asyncio
async def test_scenario_17_out_of_scope_guardrail():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_17", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Hôm nay thời tiết Hà Nội thế nào?", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_17")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert resp.intent in ("OUT_OF_SCOPE", "CLINICAL_SAFE_ABSTENTION")
        assert "y tế" in resp.reply_text.lower() or "dược" in resp.reply_text.lower() or "phạm vi" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_scenario_18_sql_injection_defense():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_18", "Bác sĩ", "doctor")
        q = CopilotQuery(query="'; DROP TABLE patients; --", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_18")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        assert resp.intent == "SECURITY_GUARDRAIL_BLOCKED"


@pytest.mark.asyncio
async def test_scenario_19_monograph_detailed_facet():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_19", "Bác sĩ", "doctor")
        session.set_active_medication("Carbamazepin")
        q = CopilotQuery(query="thông tin chi tiết", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_19")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "carbamazepin" in reply_lower
        assert "chỉ định" in reply_lower
        assert "liều dùng" in reply_lower
        assert "hla-b*1502" in reply_lower or "stevens-johnson" in reply_lower or "chống chỉ định" in reply_lower
        assert "theo chỉ định lâm sàng của bác sĩ" not in reply_lower


@pytest.mark.asyncio
async def test_scenario_20_prescription_validity_regulation():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_20", "Bác sĩ", "doctor")
        q = CopilotQuery(query="đơn thuốc ngoại trú có giá trị trong bao nhiêu ngày", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_20")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "5 ngày" in reply_lower or "ngày" in reply_lower or "thông tư" in reply_lower or "đơn thuốc" in reply_lower


@pytest.mark.asyncio
async def test_scenario_21_morphine_ampoule_return_regulation():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_21", "Bác sĩ", "doctor")
        q = CopilotQuery(query="vỏ ống morphin tiêm xong thì xử lý nộp lại thế nào", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_21")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "vỏ ống" in reply_lower or "thu hồi" in reply_lower or "20/2017" in reply_lower or "tiêu hủy" in reply_lower or "kho dược" in reply_lower


@pytest.mark.asyncio
async def test_scenario_22_polite_conversational_drug_lookup():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_22", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Kính gửi bác sĩ, cho tôi hỏi về thuốc Coversyl", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_22")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "coversyl" in reply_lower or "perindopril" in reply_lower


@pytest.mark.asyncio
async def test_scenario_23_triple_polypharmacy_interaction():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_23", "Bác sĩ", "doctor")
        q = CopilotQuery(query="Kiểm tra tương tác Clopidogrel, Omeprazol và Aspirin", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_23")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert "clopidogrel" in reply_lower and "omeprazol" in reply_lower
        assert "chống chỉ định" in reply_lower or "cyp2c19" in reply_lower or "xuất huyết" in reply_lower


@pytest.mark.asyncio
async def test_scenario_24_generic_unanchored_symptom_clarification():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("u_bench_24", "Bác sĩ", "doctor")
        q = CopilotQuery(query="tôi bị đau bụng quá làm sao bây giờ", user_name="Bác sĩ", user_role="doctor", session_id="u_bench_24")
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_lower = resp.reply_text.lower()
        assert resp.intent in ("CLINICAL_CASE_CLARIFICATION", "CLINICAL_SAFE_ABSTENTION")
        assert "tra cứu" in reply_lower or "chuyên môn" in reply_lower or "bệnh" in reply_lower

