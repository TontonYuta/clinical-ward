"""
Test suite kiểm thử các ca lỗi phát hiện từ Production Log (Chu kỳ 4 - 00:04 04/11/2026).
Khắc phục:
1. Bù nước điện giải Oresol không nhầm sang phác đồ Adrenalin phản vệ.
2. Góp ý bố cục hiển thị và vị trí nút bấm (FEEDBACK_UI_ADJUSTMENT).
3. Phàn nàn thông tin sai/nhầm lẫn (CONVERSATIONAL_CORRECTION) và xóa context drift thuốc.
4. "vẫn sai mục đích rồi" không bị từ chối Safe Abstention.
5. "tôi cần cho trẻ em" trả về hướng dẫn an toàn dược nhi khoa chuẩn Bộ Y tế & WHO.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_oresol_hydration_guidance_not_anaphylaxis():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "Bù nước điện giải Oresol",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CLINICAL_AI_CONSULTATION"
        assert "BÙ NƯỚC & ĐIỆN GIẢI BẰNG DUNG DỊCH ORESOL" in data["reply_text"]
        assert "WHO" in data["reply_text"]
        assert "Adrenalin" not in data["reply_text"]
        assert "tiêm bắp" not in data["reply_text"]

@pytest.mark.asyncio
async def test_ui_layout_feedback_handling():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": 'trong câu trả lời trên thì tài liệu gốc nằm ở trên cùng, nhưng bạn lại để "👉 Bấm nút bên dưới để mở toàn bộ Hồ sơ Dược Thư & Chuyên luận đối chứng gốc." ở dưới cuối, cần điều chỉnh lại',
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "FEEDBACK_UI_ADJUSTMENT"
        assert "TIẾP NHẬN GÓP Ý VỀ BỐ CỤC & HIỂN THỊ THÔNG TIN" in data["reply_text"]
        assert "Nistrong-BFS" not in data["reply_text"]

@pytest.mark.asyncio
async def test_complaint_and_drift_correction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "vẫn còn nhầm lẫn tự đưa ra thông tin thuốc, cần cải thiện tiếp",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CONVERSATIONAL_CORRECTION"
        assert "xin lỗi" in data["reply_text"].lower()
        assert "Nistrong-BFS" not in data["reply_text"]

@pytest.mark.asyncio
async def test_wrong_purpose_conversational_correction():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "vẫn sai mục đích rồi",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CONVERSATIONAL_CORRECTION"
        assert "xin lỗi" in data["reply_text"].lower()

@pytest.mark.asyncio
async def test_pediatric_guidance_unanchored():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "tôi cần cho trẻ em",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CLINICAL_PEDIATRIC_GUIDANCE"
        assert "AN TOÀN DƯỢC NHI KHOA" in data["reply_text"]
        assert "Paracetamol" in data["reply_text"]
        assert "Aspirin" in data["reply_text"]
        assert "cân nặng" in data["reply_text"].lower()
