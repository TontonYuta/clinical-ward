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
    ("lại ảo giác rồi", "CONVERSATIONAL_CORRECTION", ["dạ xin lỗi bác sĩ", "tiếp thu"]),
    ("bị ảo giác à", "CONVERSATIONAL_CORRECTION", ["dạ xin lỗi bác sĩ"]),
    ("bạn kém quá", "CONVERSATIONAL_CORRECTION", ["dạ xin lỗi bác sĩ", "tiếp thu phản ánh"]),
    ("bạn có thể giúp tôi học toán được không", "CLINICAL_SAFE_ABSTENTION", ["từ chối tiếp nhận", "ngoài phạm vi"]),
    ("Biểu hiện buồn nôn, sốt cao thì nên sử dụng thuốc nào", "CLINICAL_AI_CONSULTATION", ["buồn nôn", "sốt cao", "paracetamol", "oresol"]),
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

@pytest.mark.asyncio
async def test_mined_doctor_hung_session_cases():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        sess = "doctor_hung_sess_1793696158581"
        r1 = await client.post("/api/v1/copilot/chat", json={
            "query": "Warfarin Sodium Tablets USP 1mg", "user_name": "BS. Trần Văn Hùng", "user_role": "doctor", "session_id": sess
        })
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert "890110007625" in d1["reply_text"]

        r2 = await client.post("/api/v1/copilot/chat", json={
            "query": "\\đây là tóm tắt mà, tôi cần thông tin đầy đủ nhất", "user_name": "BS. Trần Văn Hùng", "user_role": "doctor", "session_id": sess
        })
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["intent"] == "MEDICATION_SAFETY_PROFILE"
        assert d2["answer_type"] == "medication_profile"
        assert "Warfarin" in d2["reply_text"]
        assert "Lokelma" not in d2["reply_text"]

        r3 = await client.post("/api/v1/copilot/chat", json={
            "query": "lại ảo giác rồi", "user_name": "BS. Trần Văn Hùng", "user_role": "doctor", "session_id": sess
        })
        assert r3.status_code == 200
        d3 = r3.json()
        assert d3["intent"] == "CONVERSATIONAL_CORRECTION"
        assert "dạ xin lỗi bác sĩ" in d3["reply_text"].lower()
        assert "adrenalin" not in d3["reply_text"].lower()

@pytest.mark.asyncio
async def test_fsm_device_isolation_multi_session():
    """Kiểm thử tính cô lập context 100% giữa các máy/thiết bị khác nhau (Device Context Isolation)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Máy A: Bác sĩ Khoa Cấp cứu tra cứu Warfarin
        sess_a = "device_a_emergency_ward_sess"
        r_a1 = await client.post("/api/v1/copilot/chat", json={
            "query": "Warfarin Sodium Tablets USP 1mg", "user_name": "BS. Cấp Cứu", "user_role": "doctor", "session_id": sess_a
        })
        assert r_a1.status_code == 200
        assert "Warfarin" in r_a1.json()["reply_text"]

        # Máy B: Bác sĩ Khoa Nội thần kinh tra cứu Teglutik
        sess_b = "device_b_neurology_ward_sess"
        r_b1 = await client.post("/api/v1/copilot/chat", json={
            "query": "Teglutik", "user_name": "BS. Thần Kinh", "user_role": "doctor", "session_id": sess_b
        })
        assert r_b1.status_code == 200
        assert "Teglutik" in r_b1.json()["reply_text"]

        # Máy A hỏi tiếp: "đây là tóm tắt mà, tôi cần thông tin đầy đủ nhất" -> PHẢI LÀ WARFARIN, không được dính Teglutik
        r_a2 = await client.post("/api/v1/copilot/chat", json={
            "query": "đây là tóm tắt mà, tôi cần thông tin đầy đủ nhất", "user_name": "BS. Cấp Cứu", "user_role": "doctor", "session_id": sess_a
        })
        assert r_a2.status_code == 200
        d_a2 = r_a2.json()
        assert "Warfarin" in d_a2["reply_text"]
        assert "Teglutik" not in d_a2["reply_text"]

        # Máy B hỏi tiếp: "thông tin chi tiết đầy đủ của thuốc đó" -> PHẢI LÀ TEGLUTIK, không được dính Warfarin
        r_b2 = await client.post("/api/v1/copilot/chat", json={
            "query": "thông tin chi tiết đầy đủ", "user_name": "BS. Thần Kinh", "user_role": "doctor", "session_id": sess_b
        })
        assert r_b2.status_code == 200
        d_b2 = r_b2.json()
        assert "Teglutik" in d_b2["reply_text"] or "riluzole" in d_b2["reply_text"].lower()
        assert "Warfarin" not in d_b2["reply_text"]

@pytest.mark.asyncio
async def test_clinical_rag_gatekeeper_blocks_unqualified_queries():
    """Kiểm thử Cổng RAG Gatekeeper: Chặn đứng truy vấn mơ hồ/phi lâm sàng, cấm tuyệt đối trả về Adrenalin."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Ca 1: Câu hỏi mơ hồ không có thực thể y tế
        r1 = await client.post("/api/v1/copilot/chat", json={
            "query": "cái này dùng thế nào nhỉ cho tôi biết thêm", "user_name": "BS. Test", "user_role": "doctor"
        })
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["intent"] == "CLINICAL_SAFE_ABSTENTION"
        assert "adrenalin" not in d1["reply_text"].lower()
        assert "từ chối" in d1["reply_text"].lower()

        # Ca 2: Câu hỏi phác đồ chuyên môn hợp lệ -> ĐƯỢC PHÉP QUA CỔNG
        r2 = await client.post("/api/v1/copilot/chat", json={
            "query": "Phác đồ cấp cứu sốc phản vệ theo Thông tư 51", "user_name": "BS. Test", "user_role": "doctor"
        })
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["intent"] in ("CLINICAL_AI_CONSULTATION", "CLINICAL_ANAPHYLAXIS_EMERGENCY")
        assert "51/2017" in d2["reply_text"]

@pytest.mark.asyncio
async def test_nurse_sepsis_and_role_address():
    """Kiểm thử ca lâm sàng thực tế: Điều dưỡng hỏi về nhiễm khuẩn huyết và xưng hô chuẩn theo vai trò."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Ca 1: Điều dưỡng hỏi về nhiễm khuẩn huyết nặng -> Phải được tư vấn chỉ định lâm sàng (không bị chặn nhầm)
        r1 = await client.post("/api/v1/copilot/chat", json={
            "query": "nhiễm khuẩn huyết nặng là gì?", "user_name": "ĐD. Lê Thị Thu", "user_role": "nurse"
        })
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["intent"] == "CLINICAL_AI_CONSULTATION"
        assert d1["answer_type"] in ("grounded_reference", "clinical_guideline")

        # Ca 2: Từ chối câu hỏi ngoài lề nhưng xưng hô 'Điều dưỡng' thay vì 'Bác sĩ'
        r2 = await client.post("/api/v1/copilot/chat", json={
            "query": "chơi trò chơi điện tử gì hay", "user_name": "ĐD. Lê Thị Thu", "user_role": "nurse"
        })
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["intent"] == "CLINICAL_SAFE_ABSTENTION"
        assert "Điều dưỡng" in d2["reply_text"]
        assert "Bác sĩ" not in d2["reply_text"]
