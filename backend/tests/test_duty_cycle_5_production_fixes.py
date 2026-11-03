"""
Test suite kiểm thử các ca lỗi phát hiện từ Production Log (Chu kỳ 5 - 02:00 04/11/2026).
Khắc phục:
1. "Thuốc hạ huyết áp cho người suy thận" không bị trích nhầm sang Morphin, Ceftriaxon hay Adrenalin; trả về hướng dẫn KDIGO & VNHA chuẩn y khoa.
2. "Thuốc điều trị tăng huyết áp ở phụ nữ có thai" không bị khớp nhầm sang Huyết thanh kháng uốn ván (SAT); trả về hướng dẫn an toàn thai kỳ (Methyldopa, Labetalol) và cảnh báo chống chỉ định tuyệt đối nhóm ACEi/ARB.
3. Rào chắn từ chối truy xuất lệch mục tiêu (Off-target evidence rejection) trong Pure RAG.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_hypertension_in_ckd_guidance_not_morphine_or_ceftriaxone():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "Thuốc hạ huyết áp cho người suy thận",
            "user_name": "BS. Thận Học",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CLINICAL_AI_CONSULTATION"
        assert "TĂNG HUYẾT ÁP Ở NGƯỜI SUY THẬN" in data["reply_text"]
        assert "KDIGO" in data["reply_text"] or "VNHA" in data["reply_text"]
        assert "Amlodipin" in data["reply_text"] or "ACEi" in data["reply_text"]
        # Phải loại bỏ hoàn toàn các thực thể sai mục tiêu
        assert "Morphin" not in data["reply_text"]
        assert "Ceftriaxon" not in data["reply_text"]
        assert "Phác Đồ Cấp Cứu Phản Vệ" not in (data.get("legal_basis") or "")

@pytest.mark.asyncio
async def test_hypertension_in_pregnancy_guidance_not_tetanus_serum():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "Thuốc điều trị tăng huyết áp ở phụ nữ có thai",
            "user_name": "BS. Sản Khoa",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CLINICAL_AI_CONSULTATION"
        assert "TĂNG HUYẾT ÁP Ở PHỤ NỮ CÓ THAI" in data["reply_text"]
        assert "Methyldopa" in data["reply_text"]
        assert "Labetalol" in data["reply_text"]
        assert "CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI" in data["reply_text"]
        # Tuyệt đối không được nhầm sang huyết thanh kháng uốn ván SAT
        assert "kháng độc tố uốn ván" not in data["reply_text"].lower()
        assert "SAT" not in data["reply_text"]

@pytest.mark.asyncio
async def test_general_hypertension_choice_guidance():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "Thuốc hạ huyết áp lựa chọn nào theo phác đồ",
            "user_name": "BS. Nội Tim Mạch",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CLINICAL_AI_CONSULTATION"
        assert "HỘI TIM MẠCH" in data["reply_text"].upper() or "VNHA" in data["reply_text"].upper()
