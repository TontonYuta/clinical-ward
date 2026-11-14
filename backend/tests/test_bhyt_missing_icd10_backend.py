from app.routers.bhyt import parse_vietnamese_prescription_text
from app.schemas.bhyt import BhytPrescriptionPayload, BhytPrescriptionItemPayload
from app.services.bhyt_service import BhytAuditService
from fastapi.testclient import TestClient
from app.main import app


def test_ocr_parser_does_not_invent_i10_when_source_has_no_icd10():
    parsed = parse_vietnamese_prescription_text("Đơn thuốc\nParacetamol 500mg uống")
    assert parsed["primary_icd10"] == ""
    assert parsed["primary_diagnosis"] == ""


def test_missing_icd10_is_review_not_icd10_rejection():
    payload = BhytPrescriptionPayload(
        prescription_id="RX-MISSING-ICD", patient_name="", patient_age=0, insurance_card_number="",
        hospital_rank="HANG_I", treatment_type="NGOAI_TRU", primary_icd10="", primary_diagnosis="",
        items=[BhytPrescriptionItemPayload(id="p", drug_name="Glucosamin", active_ingredient="Glucosamin", dosage="500mg", quantity=1, unit_price=1000, days_supply=1)]
    )
    report = BhytAuditService().audit_prescription(payload)
    assert report.status == "NEEDS_REVIEW"
    assert report.reject_count == 0
    assert report.at_risk_cost_vnd == 0
    assert not any(v.category == "ICD10_UNSUPPORTED" for v in report.violations)


def test_api_preserves_empty_icd10_and_returns_needs_review():
    client = TestClient(app)
    response = client.post("/api/v1/bhyt/audit", json={
        "prescription_id": "RX-API-MISSING-ICD", "patient_name": "", "patient_age": 0,
        "insurance_card_number": "", "hospital_rank": "HANG_I", "treatment_type": "NGOAI_TRU",
        "primary_icd10": "", "primary_diagnosis": "", "items": [{"id": "p", "drug_name": "Glucosamin", "active_ingredient": "Glucosamin", "quantity": 1, "unit_price": 1000, "days_supply": 1}]
    })
    assert response.status_code == 200
    body = response.json()
    assert body["primary_icd10"] == ""
    assert body["status"] == "NEEDS_REVIEW"
    assert body["reject_count"] == 0
