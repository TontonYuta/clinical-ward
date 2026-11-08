import uuid
import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.models.sms import SmsDeliveryLog
from app.models.patient import PrescriptionAdviceRecord
from app.database import AsyncSessionLocal

@pytest.mark.asyncio
async def test_auto_dispatch_on_cpoe_sign():
    order_id = f"RX-2026-AUTO-{uuid.uuid4().hex[:6].upper()}"
    order_payload = {
        "id": order_id,
        "prescriptionType": "outpatient",
        "patientId": "BN-TEST-01",
        "patientName": "Nguyễn Văn Test",
        "patientCccd": "001200000001",
        "patientPhone": "0987654321",
        "patientEmail": "patient.test@gmail.com",
        "department": "Khoa Khám Bệnh",
        "diagnosisIcd10": "J00",
        "diagnosisText": "Viêm mũi họng cấp",
        "doctorName": "BS.CKII Trần Văn Hùng",
        "status": "signed",
        "digitalSignature": "TEST-SIG-AUTO-DISPATCH",
        "items": [
            {
                "id": "item-1",
                "medicationName": "Paracetamol 500mg",
                "activeIngredient": "Paracetamol",
                "dosage": "1 viên/lần",
                "quantity": 10,
                "unit": "viên",
                "route": "Đường uống",
                "frequency": "2 lần/ngày",
                "durationDays": 5,
                "instructions": "Uống sau ăn no 30 phút"
            }
        ]
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/cpoe", json=order_payload)
        assert res.status_code == 201
        data = res.json()
        assert data["id"] == order_id
        assert data["status"] == "signed"

    # Đợi background task hoàn tất
    await asyncio.sleep(0.5)

    async with AsyncSessionLocal() as session:
        # 1. Kiểm tra SMS Delivery Log được tự động tạo
        res_sms = await session.execute(
            select(SmsDeliveryLog).where(SmsDeliveryLog.reference_id == order_id)
        )
        sms_log = res_sms.scalar_one_or_none()
        assert sms_log is not None
        assert sms_log.patient_name == "Nguyễn Văn Test"
        assert "0987654321" in sms_log.recipient_phone
        assert order_id in sms_log.content

        # 2. Kiểm tra Prescription Advice Record được tự động tạo
        res_adv = await session.execute(
            select(PrescriptionAdviceRecord).where(PrescriptionAdviceRecord.prescription_id == order_id)
        )
        adv_rec = res_adv.scalar_one_or_none()
        assert adv_rec is not None
        assert adv_rec.patient_email == "patient.test@gmail.com"

@pytest.mark.asyncio
async def test_sign_draft_cpoe_order():
    draft_id = f"RX-2026-DRAFT-{uuid.uuid4().hex[:6].upper()}"
    draft_payload = {
        "id": draft_id,
        "prescriptionType": "outpatient",
        "patientId": "BN-TEST-02",
        "patientName": "Lê Thị Test",
        "patientCccd": "001200000002",
        "patientPhone": "0912345678",
        "patientEmail": "lethi.test@gmail.com",
        "department": "Khoa Khám Bệnh",
        "diagnosisIcd10": "K29",
        "diagnosisText": "Viêm dạ dày",
        "doctorName": "BS. Nguyễn Văn An",
        "status": "draft",
        "items": [
            {
                "id": "item-2",
                "medicationName": "Omeprazol 20mg",
                "activeIngredient": "Omeprazol",
                "dosage": "1 viên/lần",
                "quantity": 14,
                "unit": "viên",
                "route": "Đường uống",
                "frequency": "1 lần/ngày trước ăn sáng",
                "durationDays": 14,
                "instructions": "Uống trước bữa ăn sáng 30 phút"
            }
        ]
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Tạo bản nháp
        res_create = await client.post("/api/v1/cpoe", json=draft_payload)
        assert res_create.status_code == 201
        assert res_create.json()["status"] == "draft"

        # Ký số bản nháp
        res_sign = await client.post(f"/api/v1/cpoe/{draft_id}/sign")
        assert res_sign.status_code == 200
        d_sign = res_sign.json()
        assert d_sign["status"] == "signed"
        assert d_sign["digitalSignature"] is not None

    # Đợi background task hoàn tất
    await asyncio.sleep(0.5)

    async with AsyncSessionLocal() as session:
        res_sms = await session.execute(
            select(SmsDeliveryLog).where(SmsDeliveryLog.reference_id == draft_id)
        )
        sms_log = res_sms.scalar_one_or_none()
        assert sms_log is not None
        assert sms_log.patient_name == "Lê Thị Test"
        assert draft_id in sms_log.content

