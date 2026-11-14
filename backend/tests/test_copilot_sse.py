import json
import re
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.routers import copilot


def _events(frames):
    return [json.loads(line[6:]) for frame in frames for line in frame.splitlines() if line.startswith("data: ")]


@pytest.mark.asyncio
async def test_stream_emits_validated_response_as_tokens_then_single_done(monkeypatch):
    response = CopilotResponse(intent="GREETING_WELLBEING", reply_text="A validated answer.")
    session = SimpleNamespace(
        active_medication_name=None, session_id="s1", append_conversation_turn=lambda *args: None,
        set_active_medication=lambda **kwargs: None, render_recent_history=lambda: "",
    )
    monkeypatch.setattr(copilot, "resolve_copilot_identity", lambda *args: ("doctor", "doctor", "s1"))
    monkeypatch.setattr(copilot, "get_or_create_session", lambda *args: session)
    monkeypatch.setattr("app.services.cache.clinical_cache.get_clinical_cache", lambda: SimpleNamespace(get=lambda *a, **k: response.model_copy(deep=True), set=lambda *a, **k: None))
    monkeypatch.setattr(copilot, "handle_copilot_chat", AsyncMock(return_value=response))

    endpoint_response = await copilot.chat_with_copilot_stream(
        CopilotQuery(query="hello"), SimpleNamespace(), SimpleNamespace(add=lambda *_: None, commit=AsyncMock())
    )
    frames = [frame async for frame in endpoint_response.body_iterator]
    events = _events(frames)

    assert [event["type"] for event in events][-1] == "done"
    assert sum(event["type"] == "done" for event in events) == 1
    assert "".join(event["content"] for event in events if event["type"] == "token") == "A validated answer."
    assert events[-1]["response"]["reply_text"] == "A validated answer."
    assert not re.search(r"sleep(0.003)", __import__("inspect").getsource(copilot.chat_with_copilot_stream))


@pytest.mark.asyncio
async def test_stream_emits_error_without_done_when_orchestrator_fails(monkeypatch):
    session = SimpleNamespace(
        active_medication_name=None, session_id="s1", append_conversation_turn=lambda *args: None,
        set_active_medication=lambda **kwargs: None, render_recent_history=lambda: "",
    )
    monkeypatch.setattr(copilot, "resolve_copilot_identity", lambda *args: ("doctor", "doctor", "s1"))
    monkeypatch.setattr(copilot, "get_or_create_session", lambda *args: session)
    monkeypatch.setattr("app.services.cache.clinical_cache.get_clinical_cache", lambda: SimpleNamespace(get=lambda *a, **k: None, set=lambda *a, **k: None))
    monkeypatch.setattr(copilot, "handle_copilot_chat", AsyncMock(side_effect=RuntimeError("private traceback detail")))

    endpoint_response = await copilot.chat_with_copilot_stream(
        CopilotQuery(query="clinical question"), SimpleNamespace(), SimpleNamespace(add=lambda *_: None, commit=AsyncMock())
    )
    frames = [frame async for frame in endpoint_response.body_iterator]
    events = _events(frames)

    assert [event["type"] for event in events] == ["error"]
    assert "private traceback detail" not in json.dumps(events)

@pytest.mark.asyncio
async def test_stream_persists_image_usage_metadata(monkeypatch):
    response = CopilotResponse(
        intent="MULTIMODAL_CLINICAL_VISION", reply_text="OCR", has_image=True, image_tokens=258,
        answer_type="image_extraction", source_status="image_extracted_unverified",
    )
    session = SimpleNamespace(
        active_medication_name=None, session_id="s1", append_conversation_turn=lambda *args: None,
        set_active_medication=lambda **kwargs: None, render_recent_history=lambda: "",
    )
    monkeypatch.setattr(copilot, "resolve_copilot_identity", lambda *args: ("doctor", "doctor", "s1"))
    monkeypatch.setattr(copilot, "get_or_create_session", lambda *args: session)
    monkeypatch.setattr("app.services.cache.clinical_cache.get_clinical_cache", lambda: SimpleNamespace(get=lambda *a, **k: None, set=lambda *a, **k: None))
    monkeypatch.setattr(copilot, "handle_copilot_chat", AsyncMock(return_value=response))
    entries = []
    db = SimpleNamespace(add=entries.append, commit=AsyncMock())

    endpoint_response = await copilot.chat_with_copilot_stream(
        CopilotQuery(query="Đọc ảnh", image_base64="data:image/png;base64,abc", image_mime_type="image/png"),
        SimpleNamespace(), db
    )
    [frame async for frame in endpoint_response.body_iterator]

    assert len(entries) == 1
    assert entries[0].has_image is True
    assert entries[0].image_tokens == 258
