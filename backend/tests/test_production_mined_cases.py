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
    ("Thông tin chi tiết đầy đủ", "MEDICATION_LOOKUP_CLARIFICATION", ["chưa xác định được thuốc"]),
    ("Tóm tắt thông tin thuốc đó", "MEDICATION_LOOKUP_CLARIFICATION", ["chưa xác định được thuốc"]),
    ("Tôi muốn hỏi số lượng Tamiflu hiện tại", "MEDICATION_SAFETY_PROFILE", ["tồn kho: tamiflu"]),
    ("Pracetamol tốt hay eferagan codein tốt", "MEDICATION_SAFETY_PROFILE", ["paracetamol", "efferalgan codein", "thang giảm đau", "who"]),
    ("đau bụng, đi ngoài, mất nước là biểu hiện của gì", "CLINICAL_AI_CONSULTATION", ["đau bụng", "tiêu hóa", "bù nước & điện giải"]),
    ("Tôi muốn bạn trả lời đúng trọng tâm và gọn gàng hơn", "CONVERSATIONAL_FEEDBACK", ["tiếp thu góp ý", "đúng trọng tâm"]),
    ("Bạn trả lời bị cứng nhắc quá", "CONVERSATIONAL_FEEDBACK", ["tiếp thu góp ý", "linh hoạt hơn"]),
    ("lại trả lời sai thông tin rồi", "CONVERSATIONAL_CORRECTION", ["tiếp thu", "câu hỏi cụ thể"]),
    ("bạn không xử lý được à", "BOT_CAPABILITY_CLARIFICATION", ["tra cứu thuốc", "54.885"]),
    ("triệu chứng đau bụng, buồn nôn, sốt cao là biểu hiện của gì", "CLINICAL_AI_CONSULTATION", ["đau bụng", "ngoại khoa"]),
    ("trả lời chung chung quá, tôi ko hài lòng với đáp án bạn đưa ra", "CONVERSATIONAL_FEEDBACK", ["tiếp thu", "không trả lời chung chung"]),
    ("Ông là ai", "BUSINESS_OVERVIEW", ["bản đồ 10 đại nghiệp vụ"]),
    ("Tôi muốn kê đơn thuốc cho bệnh nhân mới, mở form kê đơn cho tôi", "CPOE_CLARIFICATION", ["mở biểu mẫu kê đơn cpoe"]),
    ("kể cho tôi một câu chuyện cười đi", "CLINICAL_SAFE_ABSTENTION", ["từ chối tiếp nhận", "ngoài phạm vi chuyên môn"]),
    ("hôm nay ăn gì ngon", "CLINICAL_SAFE_ABSTENTION", ["từ chối tiếp nhận", "ngoài phạm vi chuyên môn"]),
    ("bạn có người yêu chưa", "CLINICAL_SAFE_ABSTENTION", ["từ chối tiếp nhận", "ngoài phạm vi chuyên môn"]),
    ("nói chuyện linh tinh một chút đi", "CLINICAL_SAFE_ABSTENTION", ["từ chối tiếp nhận", "ngoài phạm vi chuyên môn"]),
    ("bạn có biết kết quả sổ xố hôm nay không", "CLINICAL_SAFE_ABSTENTION", ["từ chối tiếp nhận", "ngoài phạm vi chuyên môn"]),
    ("Kiểm tra Warfarin + Aspirin", "MEDICATION_SAFETY_PROFILE", ["warfarin", "aspirin", "xuất huyết", "qđ 5948"]),
]

@pytest.mark.asyncio
@pytest.mark.parametrize("query,expected_intent,expected_snippets", MINED_PRODUCTION_CASES)
async def test_mined_production_query(query, expected_intent, expected_snippets):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/copilot/chat", json={
            "query": query, "user_name": "Mined_QA", "user_role": "doctor", "session_id": f"mined_test_session_{abs(hash(query))}"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == expected_intent
        for snippet in expected_snippets:
            assert snippet.lower() in data["reply_text"].lower()

@pytest.mark.asyncio
async def test_mined_multiturn_deictic_context():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        sess = "mined_multiturn_sess"
        await client.post("/api/v1/copilot/chat", json={
            "query": "Teglutik", "user_name": "Mined_QA", "user_role": "doctor", "session_id": sess
        })
        r_detail = await client.post("/api/v1/copilot/chat", json={
            "query": "Thông tin chi tiết đầy đủ", "user_name": "Mined_QA", "user_role": "doctor", "session_id": sess
        })
        d_detail = r_detail.json()
        assert d_detail["answer_type"] == "medication_profile"
        assert "riluzole" in d_detail["reply_text"].lower()

        r_summary = await client.post("/api/v1/copilot/chat", json={
            "query": "Tóm tắt thông tin thuốc đó", "user_name": "Mined_QA", "user_role": "doctor", "session_id": sess
        })
        d_summary = r_summary.json()
        assert d_summary["answer_type"] == "medication_summary"
        assert "840110202926" in d_summary["reply_text"]

@pytest.mark.asyncio
async def test_mined_multiturn_ddi_deictic():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        sess = "mined_ddi_deictic_sess"
        r1 = await client.post("/api/v1/copilot/chat", json={
            "query": "Kiểm tra Warfarin + Aspirin", "user_name": "BS. Trần Văn Hùng", "user_role": "doctor", "session_id": sess
        })
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert "xuất huyết" in d1["reply_text"].lower()

        r2 = await client.post("/api/v1/copilot/chat", json={
            "query": "Tương tác của 2 thuốc kia cơ mà", "user_name": "BS. Trần Văn Hùng", "user_role": "doctor", "session_id": sess
        })
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert "warfarin" in d2["reply_text"].lower()
        assert "aspirin" in d2["reply_text"].lower()
        assert "xuất huyết" in d2["reply_text"].lower()
