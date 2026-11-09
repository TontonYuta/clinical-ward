"""
Unit & Integration Tests for Direction A: Multi-Hop Clinical Agent & Chain-of-Thought Diagnostic Pathway.
Based on:
- 'IRCoT: Interleaving Retrieval with Chain-of-Thought Reasoning for Multi-Step QA' (Trivedi et al., ACL 2023, 1.2k ⭐)
- 'Med-PaLM 2 / AMIE: Towards Clinician-Level Multi-turn Consultation' (Google Research, Nature 2023).

Verifies 4-hop clinical reasoning on complex polypharmacy cases, organ contraindication audits,
QĐ 5948 drug interaction analysis, safe therapeutic alternatives, and Self-RAG reflective verification.
"""
import pytest
from app.services.rag.multihop_clinical_agent import (
    is_multihop_clinical_case,
    _extract_clcr_or_egfr,
    _partition_current_and_proposed_meds,
    execute_multihop_clinical_evaluation
)
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from app.schemas.copilot import CopilotQuery
from unittest.mock import MagicMock, AsyncMock

def test_is_multihop_clinical_case_detection():
    case_poly = (
        "Bệnh nhân suy thận ClCr 25 ml/phút, suy tim NYHA III, đái tháo đường typ 2, gout. "
        "Đang dùng Coversyl 4mg, Metformin 500mg, Spironolacton 25mg. "
        "Định kê thêm Meloxicam 7.5mg và Colchicin 1mg"
    )
    assert is_multihop_clinical_case(case_poly, case_poly.lower()) is True

    case_elderly = (
        "Cụ ông 72 tuổi suy thận mạn ClCr < 30 đang uống Coversyl, Spironolacton và Metformin, "
        "rà soát đơn thuốc có an toàn không?"
    )
    assert is_multihop_clinical_case(case_elderly, case_elderly.lower()) is True

    # Simple monotherapy lookups should not trigger multihop
    simple_lookup = "Paracetamol 500mg uống thế nào"
    assert is_multihop_clinical_case(simple_lookup, simple_lookup.lower()) is False

    # Simple 2-drug pair inquiry without organ impairment or clinical case context
    simple_pair = "Paracetamol và Ibuprofen có tương tác không"
    assert is_multihop_clinical_case(simple_pair, simple_pair.lower()) is False

def test_clcr_extraction_and_partitioning():
    case_text = (
        "Bệnh nhân suy thận ClCr 25 ml/phút, suy tim NYHA III, đái tháo đường typ 2, gout. "
        "Đang dùng Coversyl 4mg, Metformin 500mg, Spironolacton 25mg. "
        "Định kê thêm Meloxicam 7.5mg và Colchicin 1mg"
    )

    clcr = _extract_clcr_or_egfr(case_text)
    assert clcr == 25.0

    curr, prop = _partition_current_and_proposed_meds(case_text)
    assert "perindopril" in curr or "coversyl" in curr
    assert "metformin" in curr
    assert "spironolacton" in curr
    assert "meloxicam" in prop
    assert "colchicin" in prop

@pytest.mark.asyncio
async def test_multihop_clinical_evaluation_execution():
    case_query = (
        "Bệnh nhân suy thận ClCr 25 ml/phút, suy tim NYHA III, đái tháo đường typ 2, gout. "
        "Đang dùng Coversyl 4mg, Metformin 500mg, Spironolacton 25mg. "
        "Định kê thêm Meloxicam 7.5mg và Colchicin 1mg"
    )

    res = await execute_multihop_clinical_evaluation(case_query, user_role="doctor")

    # Hop 1: Baseline Regimen vs Organ Function Audit
    assert "CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI — Metformin" in res.answer
    assert "Nhiễm toan Lactic" in res.answer
    assert "BẮT BUỘC HIỆU CHỈNH LIỀU — Perindopril (Coversyl)" in res.answer
    assert "2 mg mỗi 2 ngày" in res.answer

    # Hop 2: Regimen-Internal Drug Interactions (QĐ 5948)
    assert "TĂNG KALI MÁU" in res.answer
    assert "QĐ 5948" in res.answer

    # Hop 3: Proposed Additions Safety & Efficacy Assessment
    assert "BÁO ĐỘNG ĐỎ / TỪ CHỐI KÊ ĐƠN — Meloxicam" in res.answer
    assert "co thắt tiểu động mạch đến" in res.answer
    assert "HIỆU CHỈNH LIỀU THẬN TRỌNG — Colchicin" in res.answer
    assert "0.5 mg" in res.answer

    # Hop 4: Integrated Therapeutic Action Plan Synthesis
    assert "Linagliptin 5 mg/ngày" in res.answer
    assert "Prednisolon 20 - 30 mg/ngày" in res.answer
    assert "Điện giải đồ (Kali máu K+)" in res.answer

    # Citations Verification
    assert len(res.citations) >= 4
    citation_sections = [c.section for c in res.citations]
    assert any("PERINDOPRIL" in s for s in citation_sections)
    assert any("METFORMIN" in s for s in citation_sections)
    assert any("MELOXICAM" in s for s in citation_sections)
    assert any("Spironolacton" in s for s in citation_sections)

    # Self-RAG Reflective Verification Layer (ICLR 2024)
    assert res.critique_verdict == "PASS"
    assert res.factuality_score >= 0.85
    assert res.hallucination_rate <= 0.15

@pytest.mark.asyncio
async def test_multihop_integration_with_copilot_chat():
    payload = CopilotQuery(
        query=(
            "Bệnh nhân suy thận ClCr 25 ml/phút, suy tim NYHA III, đái tháo đường typ 2, gout. "
            "Đang dùng Coversyl 4mg, Metformin 500mg, Spironolacton 25mg. "
            "Định kê thêm Meloxicam 7.5mg và Colchicin 1mg"
        ),
        user_role="doctor",
        user_name="BS. Hùng"
    )
    request_mock = MagicMock()
    request_mock.headers = {}
    request_mock.state.authenticated_user = None
    session_mock = MagicMock()
    session_mock.session_id = "test_multihop_session"
    session_mock.user_name = "BS. Hùng"
    session_mock.user_role = "doctor"
    session_mock.active_medication_name = None
    session_mock.last_active_medication_name = None
    db_mock = AsyncMock()
    mock_exec = MagicMock()
    mock_exec.scalar_one_or_none.return_value = None
    db_mock.execute.return_value = mock_exec

    response = await handle_copilot_chat(
        payload=payload,
        request=request_mock,
        db=db_mock,
        session=session_mock,
        history=""
    )

    assert response.intent == "CLINICAL_AI_CONSULTATION"
    assert response.answer_type == "multihop_case_consultation"
    assert response.critique_verdict == "PASS"
    assert response.factuality_score >= 0.85
    assert response.rag_grounded is True
    assert len(response.citations) >= 4
    assert "HỘI CHẨN DƯỢC LÂM SÀNG" in response.reply_text


@pytest.mark.asyncio
async def test_multihop_dynamic_cockcroft_gault_and_cough_adr():
    """Kiểm tra ca lâm sàng đa bệnh tính toán CrCl động bằng Cockcroft-Gault và bắt được ADR ho khan."""
    case_query = (
        "Bệnh nhân nam 68 tuổi, 55kg, Creatinin máu 180 umol/L, đang dùng Metformin 1000mg và Coversyl 5mg, có ho khan"
    )

    res = await execute_multihop_clinical_evaluation(case_query, user_role="doctor")

    # 1. Cockcroft-Gault CrCl động: (140-68)*55 / (0.814*180) = 27.0 mL/phút (< 30)
    assert "CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI — Metformin" in res.answer
    assert "Nhiễm toan Lactic" in res.answer or "acid lactic" in res.answer.lower()

    # 2. Phát hiện tác dụng phụ ho khan do ACEI (Perindopril/Coversyl)
    assert "ADR HO KHAN" in res.answer or "ho khan" in res.answer.lower()
    assert "bradykinin" in res.answer.lower() or "chất P" in res.answer

    # 3. Phác đồ thay thế an toàn
    assert "Linagliptin 5 mg/ngày" in res.answer
    assert "Losartan" in res.answer or "Telmisartan" in res.answer or "Amlodipine" in res.answer

    # 4. Bảo chứng và Critique Pass
    assert res.critique_verdict == "PASS"
    assert res.factuality_score >= 0.85


@pytest.mark.asyncio
async def test_multihop_role_adaptation_nurse_and_pharmacist():
    """Kiểm tra khả năng thích ứng văn phong lâm sàng theo vai trò Điều dưỡng và Dược sĩ."""
    case_query = (
        "Bệnh nhân nam 68 tuổi, 55kg, Creatinin máu 180 umol/L, đang dùng Metformin 1000mg và Coversyl 5mg, có ho khan"
    )

    # Vai trò Điều dưỡng (Nurse)
    res_nurse = await execute_multihop_clinical_evaluation(case_query, user_role="nurse")
    assert "ĐIỀU DƯỠNG" in res_nurse.answer or "Nursing" in res_nurse.answer
    assert "CẢNH BÁO NGUY HIỂM" in res_nurse.answer or "Red Flags" in res_nurse.answer

    # Vai trò Dược sĩ (Pharmacist)
    res_pharm = await execute_multihop_clinical_evaluation(case_query, user_role="pharmacist")
    assert "DƯỢC ĐỘNG HỌC" in res_pharm.answer or "PK/PD" in res_pharm.answer
    assert "THANH THẢI" in res_pharm.answer or "ClCr" in res_pharm.answer
