import pytest
import time

from app.routers import availability


@pytest.mark.asyncio
async def test_provider_status_is_rechecked_after_key_vault_change(monkeypatch):
    calls = 0

    class FakeResponse:
        status_code = 200

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            nonlocal calls
            calls += 1
            return FakeResponse()

    async def fingerprint():
        return "new"

    async def active_key(_provider="gemini"):
        return "valid-looking-gemini-key"

    monkeypatch.setattr(availability.settings, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(availability.settings, "GEMINI_API_KEY", None)
    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(availability, "_provider_state", {
        "value": "not_configured", "checked_at": time.monotonic(), "checked_at_wall": time.time(), "fingerprint": "old",
    })
    monkeypatch.setattr(availability, "_provider_fingerprint", fingerprint, raising=False)
    monkeypatch.setattr(availability, "_active_provider_key_async", active_key, raising=False)
    assert await availability._check_provider() == "available"
    assert calls == 1


@pytest.mark.asyncio
async def test_provider_status_reads_identity_vault_without_sync_bridge(monkeypatch):
    calls = 0

    class FakeResponse:
        status_code = 200

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, *_args, **_kwargs):
            nonlocal calls
            calls += 1
            return FakeResponse()

    async def active_key(provider):
        assert provider == "gemini"
        return "configured-provider-key"

    monkeypatch.setattr(availability.settings, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(availability.settings, "GEMINI_API_KEY", None)
    monkeypatch.setattr(availability, "_active_provider_key", lambda *_args: (_ for _ in ()).throw(
        AssertionError("sync vault bridge was called from the async availability workflow")
    ))
    monkeypatch.setattr(availability, "_active_provider_key_async", active_key, raising=False)
    monkeypatch.setattr("httpx.AsyncClient", FakeClient)
    monkeypatch.setattr(availability, "_provider_state", {
        "value": "unknown", "checked_at": 0.0, "checked_at_wall": 0.0, "fingerprint": None,
    })

    assert await availability._check_provider() == "available"
    assert calls == 1
