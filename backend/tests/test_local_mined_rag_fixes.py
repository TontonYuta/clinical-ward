import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.session_context import clear_session

@pytest.mark.asyncio
async def test_general_medicine_help_greeting():
    """Câu hỏi mở đầu hỏi thông tin thuốc phải chào đón hướng dẫn, không từ chối tiếp nhận."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/copilot/chat", json={
            "query": "Tôi muốn hỏi về thông tin các loại thuốc, bạn giúp tôi được không",
            "user_name": "ĐD. Lê Thị Thu",
            "user_role": "nurse",
            "session_id": "test_greeting_help_sess"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "GENERAL_CLINICAL_ASSISTANCE"
        assert "Trợ lý Dược lâm sàng" in data["reply_text"]
        assert "TỪ CHỐI TIẾP NHẬN" not in data["reply_text"]

@pytest.mark.asyncio
async def test_ddi_continuation_flexible_counts():
    """Người dùng xin 5 cặp nữa phải trả về chính xác 5 cặp tiếp theo."""
    sid = "test_ddi_5_pairs_sess"
    clear_session("đd. lê thị thu:" + sid)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r1 = await client.post("/api/v1/copilot/chat", json={
            "query": "lấy ví dụ cho tôi 3 cặp tương tác thuốc chống chỉ định",
            "user_name": "ĐD. Lê Thị Thu",
            "user_role": "nurse",
            "session_id": sid
        })
        assert r1.status_code == 200
        assert "3 cặp tương tác thuốc chống chỉ định điển hình" in r1.json()["reply_text"]

        r2 = await client.post("/api/v1/copilot/chat", json={
            "query": "lấy ví dụ 5 cặp nữa",
            "user_name": "ĐD. Lê Thị Thu",
            "user_role": "nurse",
            "session_id": sid
        })
        assert r2.status_code == 200
        d2 = r2.json()
        assert "5 cặp tương tác thuốc chống chỉ định tiếp theo" in d2["reply_text"]
        # Phải có cặp 4, 5, 6, 7, 8
        assert "4. " in d2["reply_text"]
        assert "8. " in d2["reply_text"]

@pytest.mark.asyncio
async def test_tt20_narcotics_does_not_leak_previous_drug():
    """Tra cứu Thông tư 20 quản lý thuốc gây nghiện không được dính thuốc Paracetamol của câu hỏi trước."""
    sid = "test_tt20_isolation_sess"
    clear_session("bs. trần văn hùng:" + sid)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Bước 1: Tra cứu Paracetamol
        r1 = await client.post("/api/v1/copilot/chat", json={
            "query": "Thông tin thuốc Paracetamol 500mg",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor",
            "session_id": sid
        })
        assert r1.status_code == 200
        assert "Paracetamol" in r1.json()["reply_text"]

        # Bước 2: Hỏi quy chế Thông tư 20 -> PHẢI là TT 20, KHÔNG ĐƯỢC gán thành 'Paracetamol'
        r2 = await client.post("/api/v1/copilot/chat", json={
            "query": "Quy chế thuốc gây nghiện TT 20",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor",
            "session_id": sid
        })
        assert r2.status_code == 200
        d2 = r2.json()
        assert "Thông tư 20/2017/TT-BYT" in d2["reply_text"]
        assert "Paracetamol" not in d2["reply_text"]

@pytest.mark.asyncio
async def test_open_pharmacopoeia_portal_clears_active_med():
    """Khi gõ 'Tra cứu Dược Thư 2015', hệ thống mở cổng tra cứu Dược thư và xóa thuốc cũ."""
    sid = "test_portal_clear_sess"
    clear_session("bs. trần văn hùng:" + sid)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Bước 1: Hỏi Paracetamol
        r1 = await client.post("/api/v1/copilot/chat", json={
            "query": "Thông tin thuốc Paracetamol 500mg",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor",
            "session_id": sid
        })
        assert r1.status_code == 200

        # Bước 2: Gõ Tra cứu Dược Thư 2015 -> Mở cổng tra cứu, không dump Paracetamol
        r2 = await client.post("/api/v1/copilot/chat", json={
            "query": "Tra cứu Dược Thư 2015",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor",
            "session_id": sid
        })
        assert r2.status_code == 200
        d2 = r2.json()
        assert "CỔNG TRA CỨU DƯỢC THƯ QUỐC GIA VIỆT NAM" in d2["reply_text"]
        assert "Paracetamol" not in d2["reply_text"]
