"""
Unit and Integration Tests for Patient Dose Reasoner (Neuro-Symbolic Dosing).
Kiểm tra suy luận cá thể hóa trên các ca lâm sàng có suy thận, chống chỉ định và ca bình thường.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.session_context import SessionState
from app.models.patient import PatientProfile
from app.services.clinical_reasoning.patient_dose_reasoner import (
    evaluate_patient_dose_reasoning,
    extract_patient_clinical_slots
)


def test_extract_patient_clinical_slots():
    query = "Bệnh nhân nữ 72 tuổi, nặng 42 kg, creatinin máu 165 umol/L hỏi liều Ciprofloxacin"
    slots = extract_patient_clinical_slots(query)
    assert slots["is_female"] is True
    assert slots["age"] == 72.0
    assert slots["weight_kg"] == 42.0
    assert slots["creatinine_val"] == 165.0
    assert slots["creatinine_unit"] == "umol/L"


def test_extract_patient_clinical_slots_mg_dl():
    query = "Bác trai 65t 60kg creatinin 1.8 mg/dl"
    slots = extract_patient_clinical_slots(query)
    assert slots["is_female"] is False
    assert slots["age"] == 65.0
    assert slots["weight_kg"] == 60.0
    assert slots["creatinine_val"] == 1.8
    assert slots["creatinine_unit"] == "mg/dL"


@pytest.mark.asyncio
async def test_dose_reasoning_ciprofloxacin_female_severe_ckd():
    session = SessionState(session_id="test_sess_01", user_name="BS. Trần", user_role="doctor")
    query = "Bệnh nhân nữ 72 tuổi, 42 kg, creatinin 165 umol/L dùng Ciprofloxacin liều thế nào?"
    
    resp = await evaluate_patient_dose_reasoning(query=query, session=session, db=None)
    assert resp is not None
    assert resp.intent == "MEDICATION_SAFETY_PROFILE"
    assert "CrCl = 18.1" in resp.reply_text or "18." in resp.reply_text
    assert "G4" in resp.reply_text
    assert "250 mg – 500 mg" in resp.reply_text
    assert "18 – 24 giờ" in resp.reply_text
    assert resp.citations is not None
    assert len(resp.citations) == 1
    assert resp.citations[0]["page"] in (394, 412)
    assert "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" in resp.citations[0]["url"]


@pytest.mark.asyncio
async def test_dose_reasoning_metformin_contraindicated_severe_ckd():
    session = SessionState(session_id="test_sess_02", user_name="BS. Trần", user_role="doctor")
    query = "Bệnh nhân nữ 75 tuổi, 40 kg, creatinin 200 umol/L dùng Metformin được không?"
    
    resp = await evaluate_patient_dose_reasoning(query=query, session=session, db=None)
    assert resp is not None
    assert "CHỐNG CHỈ ĐỊNH" in resp.reply_text
    assert "acid lactic" in resp.reply_text.lower()
    assert "Ngừng thuốc" in resp.reply_text or "không khởi đầu" in resp.reply_text
    assert resp.citations[0]["page"] in (955, 964)


@pytest.mark.asyncio
async def test_dose_reasoning_enoxaparin_severe_ckd():
    session = SessionState(session_id="test_sess_03", user_name="BS. Trần", user_role="doctor")
    query = "Bệnh nhân nữ 68 tuổi, 45 kg, creatinin 180 umol/L dùng Lovenox (Enoxaparin) liều bao nhiêu?"
    
    resp = await evaluate_patient_dose_reasoning(query=query, session=session, db=None)
    assert resp is not None
    assert "Enoxaparin" in resp.reply_text or "Lovenox" in resp.reply_text
    assert "Mỗi 24 giờ duy nhất" in resp.reply_text or "24 giờ" in resp.reply_text
    assert resp.citations[0]["page"] in (586, 535)


@pytest.mark.asyncio
async def test_dose_reasoning_active_patient_db():
    session = SessionState(session_id="test_sess_04", user_name="BS. Trần", user_role="doctor")
    session.set_active_patient("BN-8820", "Lê Thị Mai")
    
    # Mock PatientProfile in DB
    mock_patient = PatientProfile(
        id="BN-8820",
        full_name="Lê Thị Mai",
        age=74,
        gender="Nữ",
        weight_kg=43.0,
        creatinine=165.0,
        email="test@hospital.vn"
    )
    
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_patient
    mock_db.execute.return_value = mock_result
    
    query = "Thuốc Ciprofloxacin này dùng cho bệnh nhân liều thế nào?"
    resp = await evaluate_patient_dose_reasoning(query=query, session=session, db=mock_db)
    
    assert resp is not None
    assert "Lê Thị Mai" in resp.reply_text
    assert "G4" in resp.reply_text
    assert "18 – 24 giờ" in resp.reply_text


@pytest.mark.asyncio
async def test_no_patient_params_returns_none():
    session = SessionState(session_id="test_sess_05", user_name="BS. Trần", user_role="doctor")
    # Câu hỏi chung không kèm thông số bệnh nhân và không có active patient
    query = "Ciprofloxacin liều người lớn thông thường bao nhiêu?"
    resp = await evaluate_patient_dose_reasoning(query=query, session=session, db=None)
    assert resp is None


@pytest.mark.asyncio
async def test_log_34819_ciprofloxacin_female_30yo_crystalin_typo():
    """Tái hiện chính xác Log #34819: Bệnh nhân nữ 30 tuổi gõ nhầm crystalin 165 um mol/l.
    Phải tính ra suy thận người lớn (G3b), TUYỆT ĐỐI KHÔNG được trả lời liều trẻ em dưới 18 tuổi!
    """
    from app.schemas.clinical_nlu import ClinicalNluExtraction
    from app.services.chatbot.intent_feature_matrix import score_clinical_intents
    from app.services.clinical_reasoning.pediatric_dosage_reasoner import reason_pediatric_dosage

    session = SessionState(session_id="test_sess_log_34819", user_name="Bác sĩ", user_role="doctor")
    query = "bệnh nhân nữ 30 tuổi 45 kg crystalin 165 um mol/l dùng Ciprofloxacin liều thế nào"

    # 1. Kiểm tra ma trận ý định: Cấm điểm pediatric_dosage
    scores = score_clinical_intents(query)
    assert scores["pediatric_dosage"] == 0.0, "Bệnh nhân 30 tuổi không được có điểm pediatric_dosage!"
    assert scores["renal_adjustment"] >= 2.5, "Phải nhận diện được chỉ dấu suy thận khi có creatinin!"

    # 2. Kiểm tra reason_pediatric_dosage: Chặn cứng tuổi >= 18
    slots_30yo = extract_patient_clinical_slots(query)
    assert slots_30yo["age"] == 30.0
    assert slots_30yo["weight_kg"] == 45.0
    assert slots_30yo["creatinine_val"] == 165.0
    assert slots_30yo["is_female"] is True
    ped_res = reason_pediatric_dosage(
        drug_name="Ciprofloxacin",
        clean_inn="ciprofloxacin",
        raw_pediatric_dosage="Không khuyến cáo dùng cho trẻ dưới 18 tuổi",
        query=query,
        slots={"age_years": 30.0, "weight_kg": 45.0, "is_pediatric": False}
    )
    assert ped_res is None, "pediatric_dosage_reasoner phải trả về None cho bệnh nhân 30 tuổi!"

    # 3. Kiểm tra evaluate_patient_dose_reasoning với NLU extraction
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

    resp = await evaluate_patient_dose_reasoning(
        query=query,
        session=session,
        db=None,
        nlu_extraction=nlu_ext
    )

    assert resp is not None
    assert "30 tuổi" in resp.reply_text
    assert "45kg" in resp.reply_text or "45 kg" in resp.reply_text
    assert "G3b" in resp.reply_text
    assert "CrCl = 31." in resp.reply_text
    assert "250 mg – 500 mg" in resp.reply_text
    # Kiểm tra khẳng định âm tính nghiêm ngặt: Tuyệt đối không xuất hiện văn mẫu trẻ em
    assert "dưới 18 tuổi" not in resp.reply_text.lower()
    assert "liều dùng trẻ em" not in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_extract_patient_clinical_slots_with_gemini_nlu():
    """Kiểm tra Gemini NLU tự đọc và truyền trực tiếp thông số bệnh nhân không cần regex."""
    from app.schemas.clinical_nlu import ClinicalNluExtraction
    nlu_ext = ClinicalNluExtraction(
        intent="MEDICATION_LOOKUP",
        primary_drug="Metformin",
        patient_age=65.0,
        patient_gender="male",
        patient_weight_kg=58.0,
        patient_creatinine_val=195.0,
        patient_creatinine_unit="umol_l",
        is_pediatric=False,
        is_renal_inquiry=True
    )
    slots = extract_patient_clinical_slots("câu hỏi không có số", nlu_extraction=nlu_ext)
    assert slots["age"] == 65.0
    assert slots["weight_kg"] == 58.0
    assert slots["is_female"] is False
    assert slots["creatinine_val"] == 195.0
    assert slots["creatinine_unit"] == "umol/L"
