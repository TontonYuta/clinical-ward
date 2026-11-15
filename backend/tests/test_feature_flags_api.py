import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_feature_flags_returns_stable_tab_metadata_and_defaults():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/admin/feature-flags")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload["version"], int)
    keys = {flag["key"] for flag in payload["flags"]}
    assert {"overview", "cpoe", "bhyt_audit", "fefo", "documents"} <= keys
    overview = next(flag for flag in payload["flags"] if flag["key"] == "overview")
    assert overview["enabled"] is True


@pytest.mark.asyncio
async def test_feature_flags_update_rejects_stale_version_and_preserves_overview():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        current = (await client.get("/api/v1/admin/feature-flags")).json()
        stale = await client.put("/api/v1/admin/feature-flags", json={"version": max(0, current["version"] - 1), "flags": []})
        assert stale.status_code == 409

        update = await client.put("/api/v1/admin/feature-flags", json={
            "version": current["version"],
            "flags": [{"key": flag["key"], "enabled": flag["key"] != "bhyt_audit"} for flag in current["flags"]],
        })
        assert update.status_code == 200
        saved = update.json()
        assert saved["version"] == current["version"] + 1
        assert next(flag for flag in saved["flags"] if flag["key"] == "overview")["enabled"] is True
        assert next(flag for flag in saved["flags"] if flag["key"] == "bhyt_audit")["enabled"] is False
