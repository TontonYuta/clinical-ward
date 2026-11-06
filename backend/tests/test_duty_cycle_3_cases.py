"""
Test suite kiểm thử các ca lỗi phát hiện từ Production Log (Chu kỳ 3 - 23:06 03/11/2026).
Đảm bảo 100% các tình huống thực tế của bác sĩ/điều dưỡng được xử lý chuẩn mực.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_two_drug_paracetamol_ibuprofen_interaction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "Paracetamol và Ibuprofen thì sao",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert any(t in data["reply_text"] for t in ("QĐ 5948/QĐ-BYT", "Quyết định 5948/QĐ-BYT", "5948"))
        assert "Paracetamol" in data["reply_text"]
        assert "Ibuprofen" in data["reply_text"]

@pytest.mark.asyncio
async def test_feedback_data_enrichment_suggestion():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "thiếu tương tác thuốc giữa các cặp nhé, cần bổ sung cho đầy đủ",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "FEEDBACK_DATA_ENRICHMENT"
        assert "633 cặp tương tác chống chỉ định" in data["reply_text"]

@pytest.mark.asyncio
async def test_complaint_and_dissatisfaction_correction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "trả lời vẫn còn sai, lệch hướng, không liên quan đến câu hỏi",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CONVERSATIONAL_CORRECTION"
        assert "xin lỗi" in data["reply_text"].lower()

@pytest.mark.asyncio
async def test_gerd_reflux_management():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "tôi bị trào ngược dạ dày",
            "user_name": "ĐD. Lê Thị Thu",
            "user_role": "nurse"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "TRÀO NGƯỢC DẠ DÀY THỰC QUẢN (GERD)" in data["reply_text"]
        assert "Esomeprazole" in data["reply_text"]
