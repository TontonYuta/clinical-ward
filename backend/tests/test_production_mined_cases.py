"""
Automated regression tests synthesized from real production user interactions.
Generated automatically by scripts/auto_improve_from_production_logs.py (<= 60 LOC).
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

MINED_PRODUCTION_CASES = [
    ("Liều dùng Paracetamol cho trẻ em 15kg", "MEDICATION_SAFETY_PROFILE", ["trẻ em"]),
    ("Kháng sinh Zithromax uống trước hay sau ăn?", "MEDICATION_SAFETY_PROFILE", ["zithromax"]),
    ("Bệnh nhân bị hen phế quản có dùng được Propranolol không?", "MEDICATION_SAFETY_PROFILE", ["propranolol"]),
    ("Kiểm tra tương tác giữa Clopidogrel và Omeprazol và Aspirin", "MEDICATION_SAFETY_PROFILE", ["clopidogrel", "omeprazol"]),
    ("chong chi dinh venclexta", "MEDICATION_SAFETY_PROFILE", ["cyp3a"]),
    ("Thông tin đầy đủ của Teglutik", "MEDICATION_SAFETY_PROFILE", ["riluzole", "chỉ định điều trị", "chống chỉ định"]),
    ("Liều dùng của Teglutik", "MEDICATION_SAFETY_PROFILE", ["50mg", "12 giờ"]),
    ("Tác dụng phụ của Teglutik", "MEDICATION_SAFETY_PROFILE", ["tăng enzym gan", "alt/ast"]),
    ("sai rồi, tôi cần tương tác thuốc của paracetamol", "MEDICATION_SAFETY_PROFILE", ["dạ xin lỗi", "paracetamol"]),
    ("sai rồi", "CONVERSATIONAL_CORRECTION", ["dạ xin lỗi bác sĩ"]),
]

@pytest.mark.asyncio
@pytest.mark.parametrize("query,expected_intent,expected_snippets", MINED_PRODUCTION_CASES)
async def test_mined_production_query(query, expected_intent, expected_snippets):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/copilot/chat", json={
            "query": query, "user_name": "Mined_QA", "user_role": "doctor", "session_id": "mined_test_session"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == expected_intent
        for snippet in expected_snippets:
            assert snippet.lower() in data["reply_text"].lower()
