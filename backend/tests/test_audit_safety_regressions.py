"""Isolated safety regressions; no application startup, DB or provider calls."""
import asyncio
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.services.clinical_prescription_auditor import ClinicalPrescriptionAuditor
from app.services.advice_notifier import dispatch_sms_notification, dispatch_email_notification


def order(*items, **extra):
    return dict(facilityName="Test", patientName="Test Patient", patientAge=40,
                doctorName="Test Doctor", doctorCertificate="test", patientCccd="test",
                items=list(items), **extra)


def med(name, **extra):
    return dict(medicationName=name, activeIngredient=name, **extra)


def test_contraindicated_ddi_rejects_prescription():
    result = ClinicalPrescriptionAuditor().audit_prescription(order(med("simvastatin"), med("clarithromycin")))
    assert result.overall_status == "REJECTED"
    assert result.clinical_checks[0].severity == "contraindicated"


def test_synergy_is_not_reported_as_dangerous_interaction():
    result = ClinicalPrescriptionAuditor().audit_prescription(order(med("morphin"), med("paracetamol")))
    assert not any(c.category == "interaction" and not c.passed for c in result.clinical_checks)


def test_polypharmacy_and_patient_context_reach_audit():
    result = ClinicalPrescriptionAuditor().audit_prescription(
        order(med("losartan"), med("furosemide"), med("ibuprofen")), {"egfr": 25})
    assert result.overall_status == "REJECTED"
    assert any("TRIPLE WHAMMY" in c.title for c in result.clinical_checks)


@pytest.mark.parametrize("dosage,frequency,age", [
    ("2 viên", "Ngày 5 lần", 40),
    ("1 viên", "khi cần", 40),
    ("1 viên", "Ngày 2 lần", 3),
])
def test_uncertain_or_excessive_dose_never_gets_safe_pass(dosage, frequency, age):
    draft = order(med("Paracetamol 500mg", dosage=dosage, frequency=frequency))
    draft["patientAge"] = age
    draft["patientWeight"] = 12
    draft["guardianName"] = "Test Guardian"
    result = ClinicalPrescriptionAuditor().audit_prescription(draft)
    checks = [c for c in result.clinical_checks if c.category == "dosage_safety"]
    assert checks and not any(c.passed for c in checks)
    assert result.overall_status != "PASSED"


def test_combined_paracetamol_daily_dose_is_not_checked_per_line():
    result = ClinicalPrescriptionAuditor().audit_prescription(order(
        med("Paracetamol 500mg", dosage="2 viên", frequency="Ngày 3 lần"),
        med("Paracetamol 500mg", dosage="2 viên", frequency="Ngày 2 lần")))
    assert result.overall_status == "REJECTED"


def test_zero_renal_function_is_not_missing_context():
    result = ClinicalPrescriptionAuditor().audit_prescription(order(med("metformin")), {"egfr": 0})
    assert result.overall_status == "REJECTED"


@pytest.mark.parametrize("reported_signature", [{"status": "signed"}, {"digitalSignature": "x"}, {}])
def test_caller_signature_state_is_not_signature_verification(reported_signature):
    result = ClinicalPrescriptionAuditor().audit_prescription(order(med("test"), **reported_signature))
    assert result.doctor_signature_verified is False
    assert not any("Đã ký số ✓" in check.message for check in result.legal_checks)


def test_webhook_application_rejection_is_not_email_success():
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def post(self, *args, **kwargs):
            return SimpleNamespace(status_code=200, json=lambda: {"success": False, "error": "Failed"})

    payload = SimpleNamespace(gas_webhook_url="https://example.invalid/script", model_dump=lambda **kwargs: {})
    channels = []
    with pytest.raises(HTTPException) as error:
        asyncio.run(dispatch_email_notification(payload, channels, httpx_cls=Client))
    assert error.value.status_code == 502
    assert channels == []


@pytest.mark.parametrize("provider_body", [{}, None, {"success": True}])
def test_webhook_requires_positive_application_receipt(provider_body):
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def post(self, *args, **kwargs):
            return SimpleNamespace(status_code=200, json=lambda: provider_body)

    payload = SimpleNamespace(gas_webhook_url="https://example.invalid/script", model_dump=lambda **kwargs: {})
    channels = []
    if provider_body == {"success": True}:
        asyncio.run(dispatch_email_notification(payload, channels, httpx_cls=Client))
        assert channels == ["google_apps_script"]
    else:
        with pytest.raises(HTTPException) as error:
            asyncio.run(dispatch_email_notification(payload, channels, httpx_cls=Client))
        assert error.value.status_code == 502
        assert channels == []


class FakeDb:
    def __init__(self):
        self.records = []

    def add(self, record):
        self.records.append(record)


def sms_payload():
    return SimpleNamespace(patient_phone="0912345678", patient_name="Test Patient",
                           patient_id="test", prescription_id="test-rx", id="test-advice")


def test_unconfigured_sms_cannot_report_delivery():
    channels = []
    with patch.dict("os.environ", {}, clear=True), pytest.raises(HTTPException) as error:
        asyncio.run(dispatch_sms_notification(sms_payload(), FakeDb(), channels))
    assert error.value.status_code == 503
    assert channels == []


def test_rejected_sms_cannot_report_success():
    class Client:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def post(self, *args, **kwargs):
            return SimpleNamespace(status_code=400, text="Rejected")

    channels = []
    env = {"TWILIO_ACCOUNT_SID": "test", "TWILIO_AUTH_TOKEN": "test", "TWILIO_FROM_NUMBER": "+10000000000"}
    with patch.dict("os.environ", env, clear=True), patch("app.services.advice_notifier.httpx.AsyncClient", return_value=Client()), pytest.raises(HTTPException) as error:
        asyncio.run(dispatch_sms_notification(sms_payload(), FakeDb(), channels))
    assert error.value.status_code == 502
    assert channels == []


def test_esms_sandbox_cannot_report_real_delivery():
    with patch.dict("os.environ", {"ESMS_API_KEY": "test", "ESMS_SECRET_KEY": "test"}, clear=True), patch("app.services.advice_notifier.httpx.AsyncClient", side_effect=RuntimeError("Network disabled")), pytest.raises(HTTPException) as error:
        asyncio.run(dispatch_sms_notification(sms_payload(), FakeDb(), []))
    assert error.value.status_code == 503


def test_accepted_sms_is_not_marked_delivered():
    class Client:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def post(self, *args, **kwargs):
            return SimpleNamespace(status_code=201, json=lambda: {"sid": "SM-test", "status": "queued"})

    db, channels = FakeDb(), []
    env = {"TWILIO_ACCOUNT_SID": "test", "TWILIO_AUTH_TOKEN": "test", "TWILIO_FROM_NUMBER": "+10000000000"}
    with patch.dict("os.environ", env, clear=True), patch("app.services.advice_notifier.httpx.AsyncClient", return_value=Client()):
        asyncio.run(dispatch_sms_notification(sms_payload(), db, channels))
    assert db.records[0].status != "delivered"
    assert channels
