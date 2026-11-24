"""
Kiểm thử tự động cho Semantic Web Intent Router qua Vector Embedding.
Xác minh khả năng phân luồng thông minh (Zero Hardcoding):
- Các câu hỏi Chào hỏi / Năng lực (kể cả biến thể tự nhiên, tiếng lóng) được bypass Web Search (< 150ms).
- Các câu hỏi lâm sàng thật sự (sốt, trĩ, cúm) không bị bypass nhầm và tiếp tục đi vào Web Search.
"""

import pytest
from app.schemas.copilot import CopilotQuery
from app.services.chatbot.semantic_web_intent_router import check_semantic_web_bypass
from app.services.chatbot.grounded_web_search_handler import handle_grounded_web_search_turn


@pytest.mark.asyncio
async def test_capability_intent_bypasses_web_search():
    """Kiểm tra các câu hỏi năng lực (đa dạng cách diễn đạt) được bypass chính xác qua Embedding."""
    queries = [
        "bạn có thể làm được gì",
        "mày giúp được gì tao",
        "chức năng chính của bot"
    ]
    for q in queries:
        resp = await check_semantic_web_bypass(q, user_name="BS. Test", user_role="doctor")
        assert resp is not None, f"Expected bypass for '{q}' but got None"
        assert resp.intent == "CAPABILITY_OPENING"
        assert "Dược Thư" in resp.reply_text
        assert len(resp.suggested_chips) >= 3


@pytest.mark.asyncio
async def test_greeting_intent_bypasses_web_search():
    """Kiểm tra câu chào hỏi thông thường được bypass về GREETING_WELCOME."""
    resp = await check_semantic_web_bypass("xin chào bạn", user_name="BS. Test", user_role="doctor")
    assert resp is not None
    assert resp.intent == "GREETING_WELCOME"


@pytest.mark.asyncio
async def test_clinical_queries_do_not_bypass_web_search():
    """Kiểm tra các câu hỏi chuyên môn y tế TUYỆT ĐỐI KHÔNG BỊ BYPASS NHẦM."""
    clinical_queries = [
        "người bị sốt cao 39 độ thì nên xử lý như thế nào",
        "thuốc cho người bị trĩ",
        "khuyến cáo tiêm phòng cúm mùa 2026",
        "Paracetamol liều tối đa một ngày là bao nhiêu"
    ]
    for q in clinical_queries:
        resp = await check_semantic_web_bypass(q, user_name="BS. Test", user_role="doctor")
        assert resp is None, f"Clinical query '{q}' should NOT be bypassed, but got {resp}"


@pytest.mark.asyncio
async def test_handle_grounded_web_search_turn_integrates_semantic_bypass():
    """Kiểm tra tích hợp trực tiếp trong handle_grounded_web_search_turn."""
    payload = CopilotQuery(
        query="bạn có thể làm được gì",
        enable_web_search=True
    )
    resp = await handle_grounded_web_search_turn(payload, user_role="director")
    assert resp is not None
    assert resp.intent == "CAPABILITY_OPENING"
    assert resp.source_status == "internal_knowledge"


@pytest.mark.asyncio
async def test_out_of_scope_intent_bypasses_web_search():
    """Kiểm tra câu hỏi phi lâm sàng / toán học được nhận diện và từ chối an toàn bằng Vector Embedding."""
    queries = [
        "1+1 = ?",
        "1 + 1 bằng mấy",
        "thời tiết ngày mai có mưa không",
        "kể một câu chuyện cười đi",
        "về văn học thì sao",
        "kết quả bóng đá hôm nay"
    ]
    for q in queries:
        resp = await check_semantic_web_bypass(q, user_name="BS. Test", user_role="doctor")
        assert resp is not None, f"Expected out-of-scope bypass for '{q}' but got None"
        assert resp.intent == "CLINICAL_SAFE_ABSTENTION"
        assert resp.answer_type == "safe_abstention"
        assert resp.source_status == "out_of_scope"
        assert "Trợ lý Trí tuệ Nhân tạo Dược Lâm Sàng" in resp.reply_text
