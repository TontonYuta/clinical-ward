import pytest
from app.routers import availability as avail_router


@pytest.mark.asyncio
async def test_check_web_search_available_and_not_configured(monkeypatch):
    avail_router.invalidate_availability_cache()

    async def _fake_key(provider: str = "gemini"):
        return "serper_live_valid_key_12345" if provider == "serper" else None

    monkeypatch.setattr(avail_router, "_active_provider_key_async", _fake_key)
    assert await avail_router._check_web_search() == "available"

    avail_router.invalidate_availability_cache()

    async def _fake_missing(provider: str = "gemini"):
        return None

    monkeypatch.setattr(avail_router, "_active_provider_key_async", _fake_missing)
    monkeypatch.setattr(avail_router.settings, "SERPER_API_KEY", None, raising=False)
    assert await avail_router._check_web_search() == "not_configured"
