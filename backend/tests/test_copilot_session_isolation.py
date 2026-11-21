from starlette.requests import Request

from app.schemas.copilot import CopilotQuery
from app.services.session_context import clear_session, get_or_create_session
from app.routers.copilot import resolve_copilot_identity
from app.security.auth import AuthenticatedUser


def _request(user=None):
    scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST", "scheme": "http", "path": "/api/v1/copilot/chat", "raw_path": b"/api/v1/copilot/chat", "query_string": b"", "headers": [], "client": ("test", 1), "server": ("test", 80), "state": {}}
    request = Request(scope)
    if user is not None:
        request.state.authenticated_user = user
    return request


def test_authenticated_identity_overrides_payload_identity():
    payload = CopilotQuery(query="Hi", user_name="Spoofed Name", user_role="director", session_id="shared")
    name, role, session = resolve_copilot_identity(payload, _request(AuthenticatedUser("alice", "nurse")))
    assert (name, role) == ("alice", "nurse")
    assert session.startswith("alice:")


def test_demo_session_namespace_includes_user_and_requested_session():
    payload = CopilotQuery(query="Hi", user_name="alice", user_role="nurse", session_id="shared")
    _, _, session = resolve_copilot_identity(payload, _request())
    assert session == "alice:shared"


def test_same_session_id_does_not_share_context_between_users():
    a = get_or_create_session("alice:shared", "alice", "nurse")
    a.set_active_medication("warfarin")
    b = get_or_create_session("bob:shared", "bob", "nurse")
    assert b.active_medication_name is None
    clear_session("alice:shared")
    clear_session("bob:shared")

def test_gemini_cache_key_is_hashed_and_system_prompt_versioned():
    from app.services.copilot_gemini import _cache_key

    first = _cache_key("question A")
    assert len(first) == 64
    assert "question A" not in first
    assert first != _cache_key("question B")

import pytest

@pytest.mark.asyncio
async def test_scenario_dispatch_skips_patient_and_inventory_reads_for_greeting():
    from app.services.scenarios.registry import dispatch_clinical_scenario

    class Result:
        def scalars(self):
            return self
        def all(self):
            return []

    class Database:
        async def execute(self, statement):
            raise AssertionError("Greeting dispatch should not query clinical tables")

    result = await dispatch_clinical_scenario("Hi", "hi", "alice", "nurse", "alice:scenario", Database())
    assert result is None
    clear_session("alice:scenario")


def test_conversation_history_is_bounded_ordered_and_truncated():
    session = get_or_create_session("history-bounds", "alice", "nurse")
    session.append_conversation_turn("q1", "a1")
    session.append_conversation_turn("q2", "a2")
    rendered = session.render_recent_history(max_turns=1, max_chars=100)
    assert "q2" in rendered and "a2" in rendered
    assert "q1" not in rendered

    session.append_conversation_turn("u" * 2500, "a" * 2500)
    latest = session.render_recent_history(max_turns=8, max_chars=5000)
    assert len(latest) <= 5000
    assert "…" in latest
    clear_session("alice:history-bounds")

def test_conversation_history_evicts_oldest_until_character_budget():
    session = get_or_create_session("history-eviction", "alice", "nurse")
    for i in range(5):
        session.append_conversation_turn(f"question-{i}-" + "x" * 35, f"answer-{i}-" + "y" * 35)
    rendered = session.render_recent_history(max_turns=8, max_chars=180)
    assert len(rendered) <= 180
    assert "question-4" in rendered
    assert "question-0" not in rendered
    clear_session("alice:history-eviction")


import pytest
from app.database import get_db
from app.models.copilot_log import CopilotChatLog
from app.routers.copilot import get_user_chat_sessions, delete_user_chat_session


@pytest.mark.asyncio
async def test_get_user_chat_sessions_isolated_by_username():
    async for db in get_db():
        # Tạo bản ghi log thử nghiệm cho 2 người dùng khác nhau
        log_lan = CopilotChatLog(
            id="test-log-lan-1",
            session_id="bac_si_lan:sess_lan_1",
            user_name="bac_si_lan",
            user_role="doctor",
            query="Bệnh nhân An cần Morphin",
            reply_text="Đã kiểm tra liều Morphin",
            is_useful=True
        )
        log_hung = CopilotChatLog(
            id="test-log-hung-1",
            session_id="dieu_duong_hung:sess_hung_1",
            user_name="dieu_duong_hung",
            user_role="nurse",
            query="Bàn giao ca trực sáng",
            reply_text="Đã bàn giao nợ vỏ",
            is_useful=True
        )
        db.add(log_lan)
        db.add(log_hung)
        await db.commit()

        try:
            # 1. Bác sĩ Lan truy vấn danh sách phiên
            req_lan = _request(AuthenticatedUser("bac_si_lan", "doctor"))
            sessions_lan = await get_user_chat_sessions(req_lan, limit=10, db=db)
            assert any(s.id == "sess_lan_1" for s in sessions_lan), "Bác sĩ Lan phải thấy phiên của mình"
            assert not any(s.id == "sess_hung_1" for s in sessions_lan), "Bác sĩ Lan TUYỆT ĐỐI KHÔNG được thấy phiên của Điều dưỡng Hùng"

            # 2. Điều dưỡng Hùng truy vấn danh sách phiên
            req_hung = _request(AuthenticatedUser("dieu_duong_hung", "nurse"))
            sessions_hung = await get_user_chat_sessions(req_hung, limit=10, db=db)
            assert any(s.id == "sess_hung_1" for s in sessions_hung), "Điều dưỡng Hùng phải thấy phiên của mình"
            assert not any(s.id == "sess_lan_1" for s in sessions_hung), "Điều dưỡng Hùng TUYỆT ĐỐI KHÔNG được thấy phiên của Bác sĩ Lan"

            # 3. Bác sĩ Lan xóa phiên sess_lan_1
            del_res = await delete_user_chat_session("sess_lan_1", req_lan, db=db)
            assert del_res["status"] == "ok"

            # Xác nhận phiên của Lan đã xóa, nhưng phiên của Hùng vẫn còn nguyên vẹn 100%
            recheck_lan = await get_user_chat_sessions(req_lan, limit=10, db=db)
            assert not any(s.id == "sess_lan_1" for s in recheck_lan)
            recheck_hung = await get_user_chat_sessions(req_hung, limit=10, db=db)
            assert any(s.id == "sess_hung_1" for s in recheck_hung)
        finally:
            # Dọn dẹp
            await delete_user_chat_session("sess_hung_1", req_hung, db=db)
            await delete_user_chat_session("sess_lan_1", req_lan, db=db)
        break
