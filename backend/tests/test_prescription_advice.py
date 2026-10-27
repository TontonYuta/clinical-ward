"""
Test suite cho tính năng Dặn dò bác sĩ & Gửi email nhắc uống thuốc qua Google Apps Script Webhook (<=200 LOC)
"""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_send_prescription_advice_email_success():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "id": "ADV-2026-0001",
            "prescriptionId": "RX-2026-8801",
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
            "gasWebhookUrl": ""
        }

        response = await ac.post("/api/v1/prescription-advice/send-email", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["email_sent_to"] == "nguyenvanan.patient@example.com"
        assert "mô phỏng" in data["message"] or "Google Apps Script" in data["message"]


@pytest.mark.asyncio
async def test_send_prescription_advice_invalid_email():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "id": "ADV-2026-0002",
            "patientName": "Trần Thị Mai",
            "patientEmail": "invalid-email-address",
            "doctorName": "BS. Hùng",
            "medications": []
        }
        response = await ac.post("/api/v1/prescription-advice/send-email", json=payload)
        assert response.status_code == 400
