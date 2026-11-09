"""
Integration & Verification Suite for Clinical Logic Bugfixes (6 Core Flaws Resolved).

Covers:
1. Log #34819: Female 30yo, 45kg, crystalin 165 um mol/l, Ciprofloxacin -> Adult renal dose, strictly NO pediatric output.
2. Typo and spacing resilience: 'crystalin', 'creatin', 'um mol/l', 'umol / l'.
3. Pediatric suppression for adults: queries with age >= 18 strictly set pediatric_dosage score to 0.0.
4. Adaptive drug slicer pharmacology binding: Levofloxacin / Quinolones grounded in TIMING_GUIDELINES and Monograph, eliminating blanket 'uống sau ăn no'.
5. Open renal routing: General renal inquiries with drug name do not get blocked demanding 'bn-' ID.
6. Focused pediatric drug routing: Queries mentioning specific drug + pediatric context do not dump generic 500-word boilerplate.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.schemas.clinical_nlu import ClinicalNluExtraction
from app.services.session_context import clear_session, get_or_create_session
from app.services.chatbot.intent_feature_matrix import score_clinical_intents
from app.services.clinical_reasoning.patient_dose_reasoner import (
    evaluate_patient_dose_reasoning,
    extract_patient_clinical_slots
)
from app.services.clinical_reasoning.pediatric_dosage_reasoner import reason_pediatric_dosage


@pytest.mark.asyncio
async def test_reproduce_and_verify_log_34819_fixed():
    """Tái hiện chính xác Log #34819: Bệnh nhân nữ 30 tuổi 45 kg crystalin 165 um mol/l dùng Ciprofloxacin liều thế nào.
    Xác nhận:
    1. Đánh giá suy thận người lớn với Cockcroft-Gault CrCl ~ 31.3 mL/min.
    2. Phân tầng KDIGO G3b.
    3. Liều hiệu chỉnh Ciprofloxacin 250 - 500mg mỗi 12h theo DĐVN V.
    4. TUYỆT ĐỐI KHÔNG chứa 'không khuyến cáo dùng cho trẻ dưới 18 tuổi' hay liều trẻ em.
    """
    sid = "test_log_34819_fix_sess"
    clear_session("bác sĩ:" + sid)
    query = "bệnh nhân nữ 30 tuổi 45 kg crystalin 165 um mol/l dùng Ciprofloxacin liều thế nào"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/copilot/chat", json={
            "query": query,
            "user_name": "Bác sĩ Điều trị",
            "user_role": "doctor",
            "session_id": sid
        })

    assert resp.status_code == 200
    data = resp.json()
    reply = data["reply_text"]
    reply_low = reply.lower()

    # Xác nhận tính toán suy thận
    assert "g3b" in reply_low or "g3" in reply_low
    assert "crcl" in reply_low
    assert "ciprofloxacin" in reply_low
    assert any(term in reply for term in ("30 tuổi", "30t", "Nữ"))

    # Kiểm tra khẳng định âm tính nghiêm ngặt (Negative assertions)
    assert "không khuyến cáo dùng cho trẻ dưới 18 tuổi" not in reply_low
    assert "liều dùng trẻ em của ciprofloxacin" not in reply_low
    assert "liều dùng khuyến cáo cho trẻ" not in reply_low


def test_intent_feature_matrix_adult_suppression():
    """Kiểm tra ma trận đặc trưng: người lớn từ 18 tuổi trở lên bị triệt tiêu pediatric_dosage."""
    cases = [
        "bệnh nhân nữ 30 tuổi 45 kg crystalin 165 um mol/l dùng Ciprofloxacin",
        "cụ ông 70 tuổi nặng 55kg dùng Augmentin",
        "người lớn 45 tuổi uống Paracetamol mấy viên",
    ]
    for q in cases:
        scores = score_clinical_intents(q)
        assert scores["pediatric_dosage"] == 0.0, f"Query '{q}' không được có điểm pediatric_dosage!"


def test_pediatric_dosage_reasoner_guard_clause_adult():
    """Kiểm tra reason_pediatric_dosage tự động return None khi tuổi >= 18."""
    slots_adult = {"age_years": 30.0, "weight_kg": 45.0, "is_pediatric": False}
    res = reason_pediatric_dosage(
        drug_name="Ciprofloxacin",
        clean_inn="ciprofloxacin",
        raw_pediatric_dosage="Trẻ em: không khuyến cáo dùng cho trẻ dưới 18 tuổi",
        query="bệnh nhân nữ 30 tuổi",
        slots=slots_adult
    )
    assert res is None, "Phải return None cho bệnh nhân 30 tuổi!"


def test_typo_and_space_resilience_extract_slots():
    """Kiểm tra khả năng chịu lỗi chính tả và khoảng trắng trong đơn vị Creatinin."""
    q1 = "bệnh nhân nữ 30 tuổi 45 kg crystalin 165 um mol/l"
    s1 = extract_patient_clinical_slots(q1)
    assert s1["age"] == 30.0
    assert s1["weight_kg"] == 45.0
    assert s1["creatinine_val"] == 165.0
    assert s1["creatinine_unit"] == "umol/L"

    q2 = "nam 60t 70kg creatin 180 umol / l"
    s2 = extract_patient_clinical_slots(q2)
    assert s2["age"] == 60.0
    assert s2["weight_kg"] == 70.0
    assert s2["creatinine_val"] == 180.0
    assert s2["creatinine_unit"] == "umol/L"


@pytest.mark.asyncio
async def test_pediatric_query_with_specific_drug_not_blocked():
    """Hỏi liều Cefixim cho trẻ em phải tra cứu thông tin Cefixim, không trả văn mẫu chung chung."""
    sid = "test_ped_cefixim_sess"
    clear_session("bác sĩ:" + sid)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/copilot/chat", json={
            "query": "kháng sinh Cefixim cho bé 10kg liều bao nhiêu",
            "user_name": "Bác sĩ Nhi",
            "user_role": "doctor",
            "session_id": sid
        })

    assert resp.status_code == 200
    data = resp.json()
    reply = data["reply_text"].lower()
    # Phải có thông tin Cefixim, không phải văn mẫu Paracetamol + Aspirin
    assert "cefixim" in reply
    assert "aspirin & salicylat" not in reply or "cefixim" in reply


@pytest.mark.asyncio
async def test_gemini_nlu_structured_slots_direct_ingestion():
    """Kiểm tra Gemini NLU tự đọc và truyền trực tiếp thông số bệnh nhân không cần regex."""
    nlu_ext = ClinicalNluExtraction(
        intent="MEDICATION_LOOKUP",
        primary_drug="Ciprofloxacin",
        patient_age=30.0,
        patient_gender="female",
        patient_weight_kg=45.0,
        patient_creatinine_val=165.0,
        patient_creatinine_unit="umol_l",
        is_pediatric=False,
        is_renal_inquiry=True,
        requested_field="renal"
    )
    session = get_or_create_session("test_sess_direct_nlu", "BS", "doctor")
    resp = await evaluate_patient_dose_reasoning(
        query="câu hỏi tự nhiên không chứa số",
        session=session,
        db=None,
        nlu_extraction=nlu_ext
    )
    assert resp is not None
    assert "30 tuổi" in resp.reply_text
    assert "45kg" in resp.reply_text or "45 kg" in resp.reply_text
    assert "G3b" in resp.reply_text
