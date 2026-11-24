"""
Unit and Integration Tests for Admin Monitoring Serper Separation,
Budget Gate, Component Latencies, and Escalation Ratio.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from app.security.auth import issue_token
from app.services.admin_key_vault import (
    get_all_masked_keys, add_api_key, rotate_to_next_key,
    ping_test_serper_key, ping_test_key
)
from app.services.admin_monitoring_service import (
    check_search_budget_gate, get_budget_status, load_budget_config, save_budget_config
)
from app.services.telemetry_store import (
    record_search_query_usage, get_daily_search_query_usage, get_avg_search_latency
)
from app.schemas.admin_monitoring_schema import BudgetCapConfig


def _admin_headers():
    return {"Authorization": f"Bearer {issue_token('test-director', 'director', settings.SECRET_KEY, session_id='sandbox_session')}"}


@pytest.mark.asyncio
async def test_serper_system_key_listed_in_vault():
    """Kiểm tra Khóa Serper Mặc định (sys-env-serper-primary) hiển thị minh bạch trong danh sách API Key."""
    keys = get_all_masked_keys()
    serper_keys = [k for k in keys if k.get("provider") == "serper"]
    assert len(serper_keys) >= 1
    sys_serper = next((k for k in serper_keys if k.get("key_id") == "sys-env-serper-primary"), None)
    assert sys_serper is not None
    assert sys_serper["is_system_env"] is True
    assert "Serper" in sys_serper["name"]
    assert "Queries" in sys_serper["quota_status"]


@pytest.mark.asyncio
async def test_serper_ping_test_routing():
    """Kiểm tra API kiểm tra kết nối /admin/keys/test định tuyến đúng Serper khi provider='serper'."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Ping test với sys-env-serper-primary
        res = await client.post(
            "/api/v1/admin/keys/test",
            json={"key_id": "sys-env-serper-primary", "provider": "serper"},
            headers=_admin_headers()
        )
        assert res.status_code == 200
        data = res.json()
        assert "latency_ms" in data
        assert data["latency_ms"] >= 0
        assert "available_models" in data
        assert "google-serper-search" in data["available_models"]


@pytest.mark.asyncio
async def test_search_budget_cap_gate_and_status():
    """Kiểm tra Cổng ngân sách tìm kiếm Web hàng ngày (Search Budget Gate)."""
    orig_cfg = load_budget_config()
    try:
        # Cấu hình trần 100 queries/ngày
        cfg = BudgetCapConfig(
            daily_token_limit=500000,
            monthly_token_limit=10000000,
            daily_search_query_limit=100,
            monthly_search_query_limit=2500,
        )
        save_budget_config(cfg)

        status = await get_budget_status()
        assert status.daily_search_query_limit == 100
        assert status.today_search_queries_used >= 0
        assert status.search_budget_gate_open is True
        assert status.search_throttling_status in ("normal", "warning", "quota_exhausted")

        # Kiểm tra check_search_budget_gate
        allowed, reason = check_search_budget_gate()
        assert allowed is True
    finally:
        save_budget_config(orig_cfg)


@pytest.mark.asyncio
async def test_search_ledger_recording_and_latency():
    """Kiểm tra lưu trữ và tính độ trễ trung bình của các truy vấn Serper vào Sổ cái Search."""
    record_search_query_usage("serper", "hỏi liều lecanemab", credits=1, cost_vnd=25.5, latency_ms=450.0, status="success")
    queries_today, cost_today = get_daily_search_query_usage()
    assert queries_today >= 1
    assert cost_today >= 25.5

    avg_lat = get_avg_search_latency()
    assert avg_lat > 0.0


@pytest.mark.asyncio
async def test_telemetry_overview_has_separated_serper_metrics():
    """Kiểm tra /admin/monitoring/overview trả về đầy đủ các trường phân tích Serper và Tỷ lệ Leo thang Nguồn."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/admin/monitoring/overview", headers=_admin_headers())
        assert res.status_code == 200
        data = res.json()

        # Kiểm tra các trường mới
        assert "web_search_queries_today" in data
        assert "internal_pharmacopoeia_ratio_pct" in data
        assert "web_fallback_ratio_pct" in data
        assert "avg_serper_latency_ms" in data
        assert "avg_llm_latency_ms" in data
        assert "top_unindexed_fallback_queries" in data

        # Tổng tỷ lệ nội bộ + fallback phải xấp xỉ 100% hoặc cả hai đều có giá trị hợp lệ
        assert 0.0 <= data["internal_pharmacopoeia_ratio_pct"] <= 100.0
        assert 0.0 <= data["web_fallback_ratio_pct"] <= 100.0
        assert isinstance(data["top_unindexed_fallback_queries"], list)


@pytest.mark.asyncio
async def test_cannot_delete_system_serper_key():
    """Khóa hệ thống sys-env-serper-primary được bảo vệ tuyệt đối, không cho xóa từ client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.delete("/api/v1/admin/keys/sys-env-serper-primary", headers=_admin_headers())
        assert res.status_code == 400
        assert "Không thể xóa Khóa Hệ Thống Mặc Định" in res.json()["detail"]
