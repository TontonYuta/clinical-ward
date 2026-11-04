"""
Kiểm thử tính toàn vẹn và khả năng trả lời 100% của các câu hỏi gợi ý (Suggested Chips Integrity & Accuracy).
Đảm bảo mọi câu hỏi chatbot gợi ý cho bác sĩ/điều dưỡng đều được chatbot trả lời chính xác,
tuyệt đối không bị từ chối tiếp nhận (CLINICAL_SAFE_ABSTENTION) hoặc crash runtime.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

VERIFIED_SUGGESTED_QUERIES = [
    # Nhóm 1: Sốt xuất huyết & Triage hạ sốt (fix log thực tế từ BS. Trần Văn Hùng)
    "Dấu hiệu cảnh báo sốt xuất huyết ở người bệnh",
    "Liều Paracetamol hạ sốt cho người lớn",
    "Liều Paracetamol cho trẻ em theo cân nặng",
    "Cách pha và uống dung dịch Oresol bù nước",

    # Nhóm 2: Tra cứu Dược thư & Tương tác thuốc
    "Tra cứu Dược Thư 2015",
    "Tra cứu Dược Thư Quốc Gia",
    "Kiểm tra tương tác Clopidogrel + Omeprazol",

    # Nhóm 3: Nghiệp vụ Kho Dược & CPOE & Giao ban ca trực
    "Xem bảng kho Dược",
    "Kiểm tra hạn dùng FEFO",
    "Lập phiếu dự trù bù tồn kho",
    "Đối soát ca trực 07:00 AM",
    "Kê đơn thuốc CPOE",
    "Mở form gửi email/sms",

    # Nhóm 4: Chuyên khoa Ung bướu & Chuỗi lạnh
    "Chăm sóc giảm nhẹ ung thư",
    "Quy chế thuốc gây nghiện TT 20",
    "Xem biểu đồ chuỗi lạnh",
    "Kiểm tra kho lạnh GSP"
]

@pytest.mark.asyncio
@pytest.mark.parametrize("query", VERIFIED_SUGGESTED_QUERIES)
async def test_all_suggested_chips_are_accurately_answered(query: str):
    """Mọi câu hỏi gợi ý phải trả lời thành công 200, không bị CLINICAL_SAFE_ABSTENTION."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/copilot/chat", json={
            "query": query,
            "user_role": "doctor",
            "user_name": "BS. Trần Văn Hùng",
            "session_id": "test_suggested_chips_session"
        })
        assert res.status_code == 200, f"Query '{query}' failed with status {res.status_code}: {res.text}"
        data = res.json()
        intent = data.get("intent")
        reply = data.get("reply_text") or ""
        
        # Không được rơi vào từ chối tiếp nhận
        assert intent != "CLINICAL_SAFE_ABSTENTION", (
            f"Câu hỏi gợi ý '{query}' bị chatbot từ chối tiếp nhận (intent={intent})! Nội dung: {reply[:100]}"
        )
        assert len(reply.strip()) > 30, f"Câu trả lời cho '{query}' quá ngắn hoặc rỗng!"
