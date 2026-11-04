"""
Test suite kiểm thử các ca lỗi phát hiện từ Production Log (Chu kỳ 6 - Đợt 19 - 15:39 04/11/2026).
Khắc phục:
1. Câu hỏi "à triệu chứng buồn nôn sốt cao thì nên uống thuốc gì" từ bác sĩ/điều dưỡng:
   - Phải trả về phác đồ xử trí sốt chuẩn y khoa CLINICAL_FEVER_TRIAGE_PROTOCOL thay vì clarification rỗng.
   - Hướng dẫn thuốc hạ sốt đầu tay Paracetamol, lưu ý dạng viên đặt trực tràng khi nôn ói nhiều không uống được.
   - Cảnh báo chống chỉ định NSAID khi chưa loại trừ Sốt xuất huyết Dengue.
   - Bổ sung chips gợi ý lâm sàng chuẩn xác.
2. Câu hỏi cá nhân "Tôi bị sốt, tôi nên uống thuốc nào?":
   - Tiếp tục giữ an toàn rào chắn CLINICAL_CASE_CLARIFICATION nhưng cung cấp chips gợi ý rõ ràng thay vì bế tắc.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_fever_with_nausea_symptom_inquiry_protocol():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "à triệu chứng buồn nôn sốt cao thì nên uống thuốc gì",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CLINICAL_FEVER_TRIAGE_PROTOCOL"
        assert "Paracetamol" in data["reply_text"]
        assert "Buồn nôn" in data["reply_text"] or "buồn nôn" in data["reply_text"]
        assert "đặt hậu môn" in data["reply_text"] or "đặt trực tràng" in data["reply_text"]
        assert "Ibuprofen" in data["reply_text"]
        assert "Sốt xuất huyết" in data["reply_text"]
        assert len(data.get("suggested_chips") or []) >= 2

@pytest.mark.asyncio
async def test_personal_fever_inquiry_has_helpful_chips():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/api/v1/copilot/chat", json={
            "query": "Tôi bị sốt, tôi nên uống thuốc nào?",
            "user_name": "Người dùng",
            "user_role": "nurse"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "CLINICAL_CASE_CLARIFICATION"
        assert len(data.get("suggested_chips") or []) >= 2
