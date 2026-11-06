"""
Test suite cho tính năng Dặn dò bác sĩ & Gửi email nhắc uống thuốc qua Google Apps Script Webhook (<=200 LOC)
"""

import pytest
from unittest.mock import patch
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_send_prescription_advice_email_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "id": "ADV-2026-0001",
            "prescriptionId": "RX-2026-8801",
            "patientId": "TEST-PATIENT-1",
            "patientName": "Nguyễn Văn An",
            "patientEmail": "nguyenvanan.patient@example.com",
            "patientPhone": "0912345678",
            "diagnosis": "Viêm họng cấp & Sốt nhiễm khuẩn",
            "doctorName": "BS.CKII Trần Văn Hùng",
            "doctorHospital": "Bệnh Viện Đa Khoa Lâm Sàng",
            "startDate": "2026-10-27",
            "endDate": "2026-11-03",
            "generalDoctorAdvice": "Uống thuốc sau ăn 15 phút, kiêng uống rượu bia và nước đá. Uống tối thiểu 2 lít nước/ngày.",
            "medications": [
                {
                    "id": "med-1",
                    "medicationName": "Paracetamol 500mg",
                    "activeIngredient": "Paracetamol",
                    "dosage": "500mg",
                    "route": "Đường uống",
                    "durationDays": 5,
                    "specialInstructions": "Không dùng quá 4g/ngày. Dừng khi hết sốt.",
                    "timeSlots": [
                        {
                            "id": "morning",
                            "label": "Sáng",
                            "time": "07:00",
                            "dosageText": "1 viên",
                            "mealRelation": "Sau khi ăn 15 phút"
                        },
                        {
                            "id": "evening",
                            "label": "Tối",
                            "time": "19:00",
                            "dosageText": "1 viên",
                            "mealRelation": "Sau khi ăn 15 phút"
                        }
                    ]
                },
                {
                    "id": "med-2",
                    "medicationName": "Augmentin 1g",
                    "activeIngredient": "Amoxicillin + Acid clavulanic",
                    "dosage": "1g",
                    "route": "Đường uống",
                    "durationDays": 7,
                    "specialInstructions": "Uống đúng giờ để duy trì nồng độ kháng sinh.",
                    "timeSlots": [
                        {
                            "id": "morning",
                            "label": "Sáng",
                            "time": "08:00",
                            "dosageText": "1 viên",
                            "mealRelation": "Đầu bữa ăn"
                        },
                        {
                            "id": "evening",
                            "label": "Tối",
                            "time": "20:00",
                            "dosageText": "1 viên",
                            "mealRelation": "Đầu bữa ăn"
                        }
                    ]
                }
            ],
            "gasWebhookUrl": "https://example.test/google-apps-script"
        }

        class MockResponse:
            status_code = 200

            def json(self): return {"success": True}

        class MockClient:
            async def __aenter__(self): return self
            async def __aexit__(self, *args): return False
            async def post(self, *args, **kwargs): return MockResponse()

        with patch("app.routers.prescription_advice.httpx.AsyncClient", return_value=MockClient()):
            response = await ac.post("/api/v1/prescription-advice/send-email", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["email_sent_to"] == "nguyenvanan.patient@example.com"
        assert "thành công" in data["message"] or "mô phỏng" in data["message"] or "Google Apps Script" in data["message"]
        assert data["provider"] in ("backend_relay", "google_apps_script")


@pytest.mark.asyncio
async def test_send_prescription_advice_invalid_email():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "id": "ADV-2026-0002",
            "patientId": "TEST-PATIENT-2",
            "patientName": "Trần Thị Mai",
            "patientEmail": "invalid-email-address",
            "doctorName": "BS. Hùng",
            "medications": []
        }
        response = await ac.post("/api/v1/prescription-advice/send-email", json=payload)
        assert response.status_code == 400

@pytest.mark.asyncio
async def test_list_and_save_prescription_advices():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/prescription-advice")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(a["patientName"] == "Võ Minh Trí" for a in data)

@pytest.mark.asyncio
async def test_patients_crud_and_clinical_profiles():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/patients")
        assert res.status_code == 200
        patients = res.json()
        assert len(patients) >= 5
        tri = next(p for p in patients if p["id"] == "BN-8820")
        assert "Penicillin" in tri["allergies"]
        assert tri["egfr"] > 0

        detail = await ac.get("/api/v1/patients/BN-8820")
        assert detail.status_code == 200
        assert detail.json()["fullName"] == "Võ Minh Trí"

@pytest.mark.asyncio
async def test_copilot_clinical_scenarios():
    import uuid
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Kịch bản 1: Thẩm định dị ứng bệnh nhân Trí
        isolated_session = f"scenario-regression-{uuid.uuid4().hex}"
        q1 = {"query": "Kiểm tra an toàn dị ứng đơn thuốc cho bệnh nhân Võ Minh Trí", "user_name": "Scenario QA", "user_role": "doctor", "session_id": isolated_session}
        r1 = await ac.post("/api/v1/copilot/chat", json=q1)
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["intent"] == "CLINICAL_ALLERGY_CDSS"
        assert "Penicillin" in d1["reply_text"]
        assert d1["card"] is not None

        # Kịch bản 2: Hiệu chỉnh liều suy thận bệnh nhân Lan
        q2 = {"query": "Chỉnh liều suy thận cho bệnh nhân Đặng Thị Lan", "user_name": "Scenario QA", "user_role": "doctor", "session_id": isolated_session}
        r2 = await ac.post("/api/v1/copilot/chat", json=q2)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["intent"] == "CLINICAL_CASE_CLARIFICATION"
        assert d2["answer_type"] == "clarification"
        assert "Đặng Thị Lan" not in d2["reply_text"]
