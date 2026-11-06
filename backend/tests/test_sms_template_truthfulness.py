import pytest
from fastapi import HTTPException
from app.routers.sms import CLINICAL_SMS_TEMPLATES, send_patient_sms
from app.schemas.sms import SendSmsRequest


def test_sms_templates_do_not_invent_clinical_or_publication_facts():
    text = " ".join(template.template + template.title + template.description for template in CLINICAL_SMS_TEMPLATES)
    for claim in ["BV LAM SANG", "1900-1234", "da ky", "donthuocquocgia", "07:30", "20:00", "1 vien", "30 ngay", "da hoan tat"]:
        assert claim not in text
    prescription = next(template for template in CLINICAL_SMS_TEMPLATES if template.category == "cpoe_prescription")
    assert "{orderStatus}" in prescription.template


@pytest.mark.asyncio
async def test_esms_requires_explicit_registered_brand_before_contacting_provider(monkeypatch):
    monkeypatch.setenv("ESMS_API_KEY", "configured-key")
    monkeypatch.setenv("ESMS_SECRET_KEY", "configured-secret")
    monkeypatch.setenv("ESMS_SANDBOX", "0")
    monkeypatch.delenv("ESMS_BRANDNAME", raising=False)
    from app.routers import sms
    class NoProvider:
        def __init__(self, **kwargs):
            pytest.fail("Unconfigured brand must not contact a provider")
    monkeypatch.setattr(sms.httpx, "AsyncClient", NoProvider)
    payload = SendSmsRequest(recipientPhone="0909888777", patientId="BN-SOURCE", patientName="Source person", content="Source message", provider="esms")
    with pytest.raises(HTTPException) as error:
        await send_patient_sms(payload, db=None)
    assert error.value.status_code == 503
