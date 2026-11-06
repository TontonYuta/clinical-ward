"""
Unit Tests cho Bộ Thẩm Định Đơn Thuốc Lâm Sàng 5 Trụ Cột (AI Clinical Prescription Auditor)
"""
import pytest
from app.services.clinical_prescription_auditor import ClinicalPrescriptionAuditor

@pytest.fixture
def auditor():
    return ClinicalPrescriptionAuditor()

def test_legal_format_check_child_under_6_missing_weight(auditor):
    # Đơn thuốc trẻ em < 6 tuổi nhưng thiếu cân nặng -> Bắt buộc cảnh báo lỗi thể thức
    order_data = {
        "id": "RX-PED-01",
        "prescriptionType": "outpatient",
        "facilityName": "Bệnh viện Đa khoa Lâm sàng",
        "patientName": "Nguyễn Minh Khang",
        "patientAge": 3,  # 3 tuổi (< 6 tuổi)
        "patientWeight": None,  # THIẾU CÂN NẶNG
        "diagnosisIcd10": "J02.9",
        "diagnosisText": "Viêm họng cấp",
        "doctorName": "BS. Trần Văn Hùng",
        "doctorCertificate": "012345/BYT-CCHN",
        "daysPrescribed": 5,
        "items": [
            {"medicationName": "Amoxicillin 250mg", "activeIngredient": "Amoxicillin", "quantity": 10, "unit": "Gói"}
        ]
    }
    result = auditor.audit_prescription(order_data)
    weight_check = next((c for c in result.legal_checks if "Cân nặng trẻ em" in c.rule_name), None)
    assert weight_check is not None
    assert weight_check.passed is False
    assert weight_check.severity == "error"
    assert result.overall_status == "REJECTED"

def test_legal_format_check_child_under_6_valid(auditor):
    order_data = {
        "id": "RX-PED-02",
        "prescriptionType": "outpatient",
        "facilityName": "Bệnh viện Đa khoa Lâm sàng",
        "patientName": "Nguyễn Minh Khang",
        "patientAge": 3,
        "patientWeight": 14.5,
        "guardianName": "Nguyễn Văn Tuấn (Bố)",
        "patientCccd": "001202001234",
        "diagnosisIcd10": "J02.9",
        "diagnosisText": "Viêm họng cấp",
        "doctorName": "BS. Trần Văn Hùng",
        "doctorCertificate": "012345/BYT-CCHN",
        "digitalSignature": "SHA256:abcd1234signature",
        "daysPrescribed": 5,
        "items": [
            {"medicationName": "Amoxicillin 250mg", "activeIngredient": "Amoxicillin", "quantity": 10, "unit": "Gói"}
        ]
    }
    result = auditor.audit_prescription(order_data)
    weight_check = next((c for c in result.legal_checks if "Cân nặng trẻ em" in c.rule_name), None)
    assert weight_check is not None
    assert weight_check.passed is True
    # Caller-provided signature text is not a trusted verification result.
    assert result.doctor_signature_verified is False
    assert result.safety_score >= 80

def test_dosage_safety_paracetamol_overdose(auditor):
    # Explicit dose reaches the existing adult ceiling (4000mg/day).
    order_data = {
        "id": "RX-DOSE-01",
        "prescriptionType": "outpatient",
        "facilityName": "Bệnh viện Đa khoa Lâm sàng",
        "patientName": "Lê Văn Hùng",
        "patientAge": 45,
        "diagnosisIcd10": "R50.9",
        "diagnosisText": "Sốt chưa rõ nguyên nhân",
        "doctorName": "BS. Trần Văn Hùng",
        "doctorCertificate": "012345/BYT-CCHN",
        "daysPrescribed": 3,
        "items": [
            {
                "medicationName": "Paracetamol 1000mg",
                "activeIngredient": "Paracetamol",
                "dosage": "1 viên",
                "frequency": "Uống 4 lần/ngày",
                "quantity": 12,
                "unit": "Viên"
            }
        ]
    }
    result = auditor.audit_prescription(order_data)
    dose_check = next((c for c in result.clinical_checks if "LIỀU TỐI ĐA" in c.title), None)
    assert dose_check is not None
    assert dose_check.passed is False
    assert dose_check.severity == "contraindicated"
    assert result.overall_status == "REJECTED"

def test_dosage_safety_metformin_renal_contraindication(auditor):
    # Bệnh nhân suy thận nặng eGFR = 22 mL/min dùng Metformin -> Chống chỉ định
    order_data = {
        "id": "RX-RENAL-01",
        "prescriptionType": "outpatient",
        "facilityName": "Bệnh viện Đa khoa Lâm sàng",
        "patientName": "Trần Thị Lan",
        "patientAge": 72,
        "diagnosisIcd10": "E11.9",
        "diagnosisText": "Đái tháo đường típ 2",
        "doctorName": "BS. Trần Văn Hùng",
        "doctorCertificate": "012345/BYT-CCHN",
        "daysPrescribed": 30,
        "items": [
            {
                "medicationName": "Metformin 850mg",
                "activeIngredient": "Metformin",
                "frequency": "Uống 2 lần/ngày sau ăn",
                "quantity": 60,
                "unit": "Viên"
            }
        ]
    }
    patient_data = {"egfr": 22.0, "age": 72}
    result = auditor.audit_prescription(order_data, patient_data)
    renal_check = next((c for c in result.clinical_checks if "Metformin ở bệnh nhân suy thận nặng" in c.title), None)
    assert renal_check is not None
    assert renal_check.passed is False
    assert renal_check.severity == "contraindicated"
    assert any("NGỪNG Metformin" in r for r in result.recommendations)

def test_dosage_safety_metformin_order_level_egfr(auditor):
    # eGFR đặt trực tiếp trong order_data (CPOE payload)
    order_data = {
        "id": "RX-RENAL-02",
        "prescriptionType": "inpatient",
        "facilityName": "Bệnh viện Đa khoa Lâm sàng",
        "patientName": "Trần Thị Lan",
        "patientAge": 72,
        "patientEgfr": 25.0,
        "doctorName": "BS. Trần Văn Hùng",
        "doctorCertificate": "012345/BYT-CCHN",
        "status": "signed",
        "items": [
            {
                "medicationName": "Glucophage 850mg",
                "activeIngredient": "Metformin",
                "dosage": "850mg x 2",
                "quantity": 20
            }
        ]
    }
    result = auditor.audit_prescription(order_data)
    renal_check = next((c for c in result.clinical_checks if "Metformin ở bệnh nhân suy thận nặng" in c.title), None)
    assert renal_check is not None
    assert renal_check.passed is False
    assert renal_check.severity == "contraindicated"
    assert result.overall_status == "REJECTED"

def test_timing_and_administration_guidance(auditor):
    # Kê Ibuprofen và Esomeprazol và Glucophage XR -> Phải có hướng dẫn thời điểm & dạng bào chế
    order_data = {
        "id": "RX-TIMING-01",
        "prescriptionType": "outpatient",
        "facilityName": "Bệnh viện Đa khoa Lâm sàng",
        "patientName": "Vũ Đình Tuấn",
        "patientAge": 50,
        "diagnosisIcd10": "M17.0",
        "diagnosisText": "Thoái hóa khớp gối",
        "doctorName": "BS. Trần Văn Hùng",
        "doctorCertificate": "012345/BYT-CCHN",
        "daysPrescribed": 7,
        "items": [
            {
                "medicationName": "Ibuprofen 400mg",
                "activeIngredient": "Ibuprofen",
                "quantity": 14,
                "unit": "Viên"
            },
            {
                "medicationName": "Esomeprazol 40mg",
                "activeIngredient": "Esomeprazol",
                "quantity": 7,
                "unit": "Viên"
            },
            {
                "medicationName": "Glucophage XR 750mg",
                "activeIngredient": "Metformin",
                "quantity": 14,
                "unit": "Viên"
            }
        ]
    }
    result = auditor.audit_prescription(order_data)
    timing_checks = [c for c in result.clinical_checks if c.category == "timing_administration"]
    assert len(timing_checks) >= 3

    # Check NSAID timing
    nsaid_timing = next((c for c in timing_checks if "Ibuprofen" in c.item_name), None)
    assert nsaid_timing is not None
    assert "sau bữa ăn no" in nsaid_timing.detail

    # Check PPI timing
    ppi_timing = next((c for c in timing_checks if "Esomeprazol" in c.item_name), None)
    assert ppi_timing is not None
    assert "trước bữa ăn sáng 30 - 60 phút" in ppi_timing.detail

    # Check XR formulation warning
    xr_warning = next((c for c in timing_checks if "phóng thích kéo dài" in c.title), None)
    assert xr_warning is not None
    assert "KHÔNG ĐƯỢC bẻ đôi, nghiền nát" in xr_warning.detail

@pytest.mark.asyncio
async def test_copilot_drug_administration_timing_zithromax():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/copilot/chat", json={
            "query": "Kháng sinh Zithromax uống trước hay sau ăn?",
            "user_name": "BS. Hùng",
            "user_role": "doctor"
        })
        assert res.status_code == 200
        d = res.json()
        assert d["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert "Thời điểm" in d["reply_text"]
        assert "trước hoặc sau" in d["reply_text"] or "lúc đói" in d["reply_text"]
        assert "Zithromax" in d["reply_text"]

