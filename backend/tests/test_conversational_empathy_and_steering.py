"""
Bộ kiểm thử Tự Động: Văn phong Tự nhiên, Mở đầu Thiện chí & Điều hướng Thông minh (MedAbstain & PaperQA).
Kiểm tra triệt tiêu 100% phản xạ 'xin lỗi' vô cớ và xử lý câu hỏi toán học/chitchat nhã nhặn.
"""
from types import SimpleNamespace
import pytest
from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery
from app.services.session_context import get_or_create_session
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from app.security.prompt_utility_scorer import compute_prompt_utility


class DummyRequest:
    headers = {"user-agent": "pytest-clinical-runner"}
    client = type("Client", (), {"host": "127.0.0.1"})()
    state = SimpleNamespace()


@pytest.mark.asyncio
async def test_capability_opening_natural_welcome():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("empathy_bench_01", "BS. Trần Văn Hùng", "doctor")
        q = CopilotQuery(
            query="tôi có thể hỏi bạn thông tin về thuốc được không",
            user_name="BS. Trần Văn Hùng",
            user_role="doctor",
            session_id="empathy_bench_01"
        )
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_low = resp.reply_text.lower()
        
        # Kiểm tra ý định chuẩn
        assert resp.intent == "CAPABILITY_OPENING"
        # Tuyệt đối không dùng từ 'xin lỗi' hoặc 'chưa xác định được'
        assert "xin lỗi" not in reply_low
        assert "chưa xác định được" not in reply_low
        # Phải thể hiện sự nồng nhiệt sẵn sàng
        assert "sẵn sàng" in reply_low or "được chứ" in reply_low
        assert "bác sĩ" in reply_low
        assert len(resp.suggested_chips) >= 2


@pytest.mark.asyncio
async def test_capability_opening_with_assistance_ask():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("empathy_bench_02", "BS. Trần Văn Hùng", "doctor")
        q = CopilotQuery(
            query="tôi muốn hỏi thông tin về thuốc, bạn hỗ trợ tôi được không",
            user_name="BS. Trần Văn Hùng",
            user_role="doctor",
            session_id="empathy_bench_02"
        )
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_low = resp.reply_text.lower()
        
        assert resp.intent == "CAPABILITY_OPENING"
        assert "xin lỗi" not in reply_low
        assert "dược lâm sàng" in reply_low or "dược thư" in reply_low
        assert "chưa xác định được thực thể" not in reply_low


@pytest.mark.asyncio
async def test_simple_math_gentle_steering():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("empathy_bench_03", "BS. Trần Văn Hùng", "doctor")
        q = CopilotQuery(
            query="1+1 = 2 đúng không",
            user_name="BS. Trần Văn Hùng",
            user_role="doctor",
            session_id="empathy_bench_03"
        )
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_low = resp.reply_text.lower()
        
        # Khẳng định phép tính đúng
        assert "đúng rồi" in reply_low or "1 + 1 = 2" in reply_low or "1+1" in reply_low
        # Điều hướng nhã nhặn về Dược lâm sàng
        assert "dược lâm sàng" in reply_low or "y tế" in reply_low
        # Không dùng bức tường từ chối khô khan
        assert "từ chối tiếp nhận: câu hỏi ngoài phạm vi chuyên môn" not in reply_low
        assert "chưa xác định rõ thực thể lâm sàng" not in reply_low


@pytest.mark.asyncio
async def test_tutoring_chitchat_gentle_steering():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("empathy_bench_04", "BS. Trần Văn Hùng", "doctor")
        q = CopilotQuery(
            query="bạn có thể dạy tôi học toán được không",
            user_name="BS. Trần Văn Hùng",
            user_role="doctor",
            session_id="empathy_bench_04"
        )
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_low = resp.reply_text.lower()
        
        assert resp.intent == "OUT_OF_SCOPE"
        assert "không thể hỗ trợ dạy học" in reply_low or "dược lâm sàng" in reply_low
        # Không dùng bức tường từ chối thô bạo
        assert "từ chối tiếp nhận: câu hỏi ngoài phạm vi chuyên môn" not in reply_low


@pytest.mark.asyncio
async def test_unanchored_lookup_clarification_no_apology():
    async with AsyncSessionLocal() as db:
        session = get_or_create_session("empathy_bench_05", "BS. Trần Văn Hùng", "doctor")
        q = CopilotQuery(
            query="thông tin chi tiết",
            user_name="BS. Trần Văn Hùng",
            user_role="doctor",
            session_id="empathy_bench_05"
        )
        resp = await handle_copilot_chat(q, DummyRequest(), db, session=session, history="")
        reply_low = resp.reply_text.lower()
        
        assert resp.intent == "MEDICATION_LOOKUP_CLARIFICATION"
        assert "xin lỗi" not in reply_low
        assert "vui lòng gửi tên thuốc" in reply_low or "sđk" in reply_low


def test_prompt_utility_scoring_categories():
    # Câu mở đầu thiện chí
    u1 = compute_prompt_utility(
        raw_query="tôi có thể hỏi bạn thông tin về thuốc được không",
        reply_text="Dạ được chứ ạ! Em luôn sẵn sàng...",
        intent="CAPABILITY_OPENING"
    )
    assert u1.category == "conversational_engagement"
    assert u1.utility_score >= 0.70
    assert u1.is_useful is True

    # Câu toán học điều hướng
    u2 = compute_prompt_utility(
        raw_query="1+1 = 2 đúng không",
        reply_text="Dạ đúng rồi ạ, 1 + 1 = 2...",
        intent="OUT_OF_SCOPE"
    )
    assert u2.category == "steered_chitchat"
    assert u2.utility_score >= 0.50

    # Chuỗi spam vô nghĩa
    u3 = compute_prompt_utility(
        raw_query="asdfghjklqwerty12345",
        reply_text="",
        intent="CLINICAL_SAFE_ABSTENTION"
    )
    assert u3.category == "noise_garbage"
    assert u3.utility_score <= 0.35
