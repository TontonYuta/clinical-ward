"""
Property-based randomized tests for BHYT Multimodal Vision OCR and Universal Gateway.
Verifies zero-hardcode behavior, cascading fallback, and hybrid entity resolution across randomized inputs.
"""

import pytest
import random
import string
import base64
import json
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.services.llm_provider import (
    _clean_base64_data,
    query_vision_ocr,
    _call_gemini_vision_ocr,
    _call_openai_compatible_vision_ocr,
)
from app.schemas.bhyt import BhytOcrPrescriptionRequest

client = TestClient(app)

SAMPLE_DRUGS = [
    ("Paracetamol", "500mg", "Uống"),
    ("Diclofenac", "50mg", "Uống"),
    ("Amlodipin", "5mg", "Uống"),
    ("Metformin", "850mg", "Uống"),
    ("Atorvastatin", "20mg", "Uống"),
    ("Pantoprazol", "40mg", "Uống"),
    ("Omeprazol", "20mg", "Uống"),
    ("Amoxicillin", "500mg", "Uống"),
    ("Cefuroxim", "500mg", "Uống"),
    ("Losartan", "50mg", "Uống"),
]

SAMPLE_ICD10S = ["I10", "E11", "M16", "J00", "K21", "I20", "E78"]

def _generate_random_base64(size: int = 100) -> str:
    raw_bytes = "".join(random.choices(string.ascii_letters + string.digits, k=size)).encode()
    return base64.b64encode(raw_bytes).decode()

def test_clean_base64_data_randomized():
    """Kiểm tra hàm tách base64 và MIME type với 20 chuỗi ngẫu nhiên."""
    for _ in range(20):
        raw_b64 = _generate_random_base64(random.randint(60, 200))
        mime = random.choice(["image/jpeg", "image/png", "image/webp"])
        data_url = f"data:{mime};base64,{raw_b64}"

        clean, detected_mime = _clean_base64_data(data_url)
        assert clean == raw_b64
        assert detected_mime == mime

        # Thử không có prefix
        clean_raw, detected_default = _clean_base64_data(raw_b64, default_mime="image/png")
        assert clean_raw == raw_b64
        assert detected_default == "image/png"

@pytest.mark.asyncio
async def test_vision_ocr_universal_gateway_mock_gemini():
    """Kiểm tra Multimodal Vision OCR Gateway khi provider='gemini'."""
    mock_payload = {
        "patient_name": "NGUYỄN VĂN RANDOM",
        "patient_age": random.randint(20, 80),
        "insurance_card_number": "GD479" + "".join(random.choices(string.digits, k=10)),
        "primary_icd10": random.choice(SAMPLE_ICD10S),
        "primary_diagnosis": "Chẩn đoán thử nghiệm",
        "secondary_icd10s": [],
        "items": [
            {
                "drug_name": "Panadol Extra",
                "dosage": "500mg",
                "quantity": 10.0,
                "days_supply": 5,
                "route": "Uống",
                "instructions": "Uống 1 viên x 2 lần/ngày"
            }
        ]
    }

    with patch("app.services.llm_provider._call_gemini_vision_ocr", new_callable=AsyncMock) as mock_gemini:
        mock_payload_copy = dict(mock_payload)
        mock_payload_copy["_model_used"] = "gemini-2.5-flash"
        mock_payload_copy["_provider"] = "gemini"
        mock_gemini.return_value = mock_payload_copy

        res = await query_vision_ocr("dummy_base64_data")
        assert res is not None
        assert res["_provider"] == "gemini"
        assert res["_model_used"] == "gemini-2.5-flash"
        assert res["patient_name"] == "NGUYỄN VĂN RANDOM"

@pytest.mark.asyncio
async def test_vision_ocr_universal_gateway_mock_third_party():
    """Kiểm tra Multimodal Vision OCR Gateway khi cắm nhà cung cấp bên thứ 3 (OpenAI/Qwen-VL)."""
    mock_payload = {
        "patient_name": "TRẦN THỊ TEST",
        "patient_age": 45,
        "insurance_card_number": "HT2790000000000",
        "primary_icd10": "I10",
        "primary_diagnosis": "Tăng huyết áp vô căn",
        "secondary_icd10s": [],
        "items": [
            {
                "drug_name": "Amlor 5mg",
                "dosage": "5mg",
                "quantity": 30.0,
                "days_supply": 30,
                "route": "Uống",
                "instructions": "Uống 1 viên sáng"
            }
        ]
    }

    with patch("app.services.llm_provider.settings.LLM_PROVIDER", "openai_compatible"), \
         patch("app.services.llm_provider._call_openai_compatible_vision_ocr", new_callable=AsyncMock) as mock_openai:
        mock_payload_copy = dict(mock_payload)
        mock_payload_copy["_model_used"] = "gpt-4o-mini"
        mock_payload_copy["_provider"] = "openai_compatible"
        mock_openai.return_value = mock_payload_copy

        res = await query_vision_ocr("dummy_base64_data")
        assert res is not None
        assert res["_provider"] == "openai_compatible"
        assert res["_model_used"] == "gpt-4o-mini"
        assert res["patient_name"] == "TRẦN THỊ TEST"

def test_ocr_prescription_api_randomized_trials():
    """
    Chạy 25 lần test ngẫu nhiên endpoint POST /api/v1/bhyt/ocr-prescription.
    Đảm bảo:
    1. Nhận diện danh sách thuốc đa dạng.
    2. Tự động đối soát với CSDL Dược Quốc Gia (DAV).
    3. Trả về đúng format BhytOcrPrescriptionResponse.
    """
    for iteration in range(25):
        num_items = random.randint(1, 4)
        chosen_drugs = random.sample(SAMPLE_DRUGS, num_items)
        rand_name = f"BỆNH NHÂN RANDOM #{random.randint(100, 999)}"
        rand_card = "GD4" + "".join(random.choices(string.digits, k=12))
        rand_icd = random.choice(SAMPLE_ICD10S)

        mock_ocr = {
            "patient_name": rand_name,
            "patient_age": random.randint(25, 75),
            "insurance_card_number": rand_card,
            "primary_icd10": rand_icd,
            "primary_diagnosis": f"Chẩn đoán cho {rand_icd}",
            "secondary_icd10s": [],
            "_provider": random.choice(["gemini", "openai_compatible"]),
            "_model_used": random.choice(["gemini-2.5-flash", "gemini-3.5-flash-lite", "gpt-4o-mini"]),
            "items": [
                {
                    "drug_name": d[0],
                    "dosage": d[1],
                    "quantity": float(random.randint(7, 30)),
                    "days_supply": random.randint(5, 30),
                    "route": d[2],
                    "instructions": f"Uống {d[0]} ngày 2 lần"
                }
                for d in chosen_drugs
            ]
        }

        with patch("app.routers.bhyt.query_vision_ocr", new_callable=AsyncMock) as mock_q:
            mock_q.return_value = mock_ocr

            dummy_b64 = _generate_random_base64(80)
            res = client.post(
                "/api/v1/bhyt/ocr-prescription",
                json={
                    "image_base64": f"data:image/jpeg;base64,{dummy_b64}",
                    "mime_type": "image/jpeg",
                    "hospital_rank": "HANG_I",
                    "treatment_type": "NGOAI_TRU"
                }
            )

            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["total_items"] == num_items
            assert data["prescription"]["patient_name"] == rand_name
            assert data["prescription"]["insurance_card_number"] == rand_card
            assert len(data["prescription"]["items"]) == num_items

            # Đối soát thực thể tự động
            assert data["resolved_count"] >= 1
            for it in data["prescription"]["items"]:
                assert len(it["drug_name"]) > 0
                assert it["quantity"] > 0

def test_ocr_prescription_offline_fallback():
    """Kiểm tra kịch bản ngoại tuyến hoặc không có ảnh (fallback spatial text)."""
    raw_text = """
    ĐƠN THUỐC ĐIỀU TRỊ NGOẠI TRÚ
    Bệnh nhân: Hoàng Văn Thử Nghiệm
    Chẩn đoán: Viêm khớp dạng thấp
    1. Paracetamol 500mg
    2. Diclofenac 50mg
    """
    res = client.post(
        "/api/v1/bhyt/ocr-prescription",
        json={"raw_text": raw_text}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["provider"] == "offline_extractor"
    assert data["total_items"] >= 2
    assert data["resolved_count"] >= 1
