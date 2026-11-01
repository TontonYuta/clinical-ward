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
