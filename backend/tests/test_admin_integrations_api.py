"""
Unit & Integration Tests for Admin External Integrations API (eSMS & Google Apps Script).
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_esms_status_and_ping():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Fetch eSMS status
        res = await client.get("/api/v1/admin/integrations/esms/status")
        assert res.status_code == 200
        data = res.json()
        assert "configured" in data
        assert "brandname" in data
        assert "total_sms" in data
        assert "recent_logs" in data
        assert isinstance(data["recent_logs"], list)

        # 2. Ping eSMS endpoint
        res_ping = await client.post("/api/v1/admin/integrations/esms/ping")
        assert res_ping.status_code == 200
        d_ping = res_ping.json()
        assert "latency_ms" in d_ping
        assert "message" in d_ping

@pytest.mark.asyncio
async def test_esms_config_update():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/admin/integrations/esms/config", json={
            "brandname": "BV_LAMSANG",
            "is_sandbox": True
        })
        assert res.status_code == 200
        data = res.json()
        assert data["brandname"] == "BV_LAMSANG"
        assert data["is_sandbox"] is True

@pytest.mark.asyncio
async def test_gas_status_and_config():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Fetch GAS status
        res = await client.get("/api/v1/admin/integrations/gas/status")
        assert res.status_code == 200
        data = res.json()
        assert "configured" in data
        assert "total_advices" in data
        assert "recent_logs" in data

        # 2. Update GAS Webhook config
        res_cfg = await client.post("/api/v1/admin/integrations/gas/config", json={
            "webhook_url": "https://script.google.com/macros/s/AKfycbz_test_monitor_mock/exec"
        })
        assert res_cfg.status_code == 200
        d_cfg = res_cfg.json()
        assert d_cfg["configured"] is True
        assert "script.google.com" in d_cfg["webhook_url_masked"]
