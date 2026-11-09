"""
Unit and Integration Tests for Admin Monitoring, Key Vault & Token Budget APIs.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_admin_telemetry_overview():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/admin/monitoring/overview")
        assert res.status_code == 200
        data = res.json()
        assert "total_queries" in data
        assert "cache_hit_rate_pct" in data
        assert "tokens_consumed" in data
        assert "tokens_saved" in data
        assert "bhyt_rejection_saved_vnd" in data
        assert "bhyt_logs" in data
        assert isinstance(data["bhyt_logs"], list)
        assert len(data.get("intent_distribution", [])) >= 3
        assert len(data.get("timeline_trend", [])) >= 5

@pytest.mark.asyncio
async def test_admin_key_vault_crud():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Liệt kê keys
        list_res = await client.get("/api/v1/admin/keys")
        assert list_res.status_code == 200
        keys = list_res.json()
        assert isinstance(keys, list)

        # 2. Thêm key mới
        add_res = await client.post("/api/v1/admin/keys", json={
            "name": "Test Hospital Unit Key",
            "api_key": "AIzaSyTestMockKeyForAdminUnitTesting123456",
            "provider": "gemini"
        })
        assert add_res.status_code == 200
        new_key = add_res.json()
        assert new_key["name"] == "Test Hospital Unit Key"
        # Xác nhận khóa đã được che mờ an toàn
        assert "..." in new_key["masked_key"]
        assert "123456" not in new_key["masked_key"] or new_key["masked_key"].endswith("3456")
        test_key_id = new_key["key_id"]

        # 3. Xóa key vừa tạo
        del_res = await client.delete(f"/api/v1/admin/keys/{test_key_id}")
        assert del_res.status_code == 200

@pytest.mark.asyncio
async def test_admin_token_budget_crud():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Lấy thông tin budget
        get_res = await client.get("/api/v1/admin/budget")
        assert get_res.status_code == 200
        b_data = get_res.json()
        assert "config" in b_data
        assert "today_tokens_used" in b_data

        # 2. Cập nhật budget
        update_res = await client.post("/api/v1/admin/budget", json={
            "daily_token_limit": 600000,
            "monthly_token_limit": 15000000,
            "auto_offline_fallback": True,
            "alert_on_threshold_pct": 85
        })
        assert update_res.status_code == 200
        updated = update_res.json()
        assert updated["daily_token_limit"] == 600000
        assert updated["alert_on_threshold_pct"] == 85

@pytest.mark.asyncio
async def test_key_vault_rotation_and_budget_gate():
    from app.services.admin_key_vault import get_active_api_key, rotate_to_next_key, add_api_key, delete_api_key
    from app.services.admin_monitoring_service import check_token_budget_gate, save_budget_config, load_budget_config
    from app.schemas.admin_monitoring_schema import BudgetCapConfig

    # 1. Thêm key phụ
    raw1 = "AIzaSyTestMockKeyPrimary123456789"
    raw2 = "AIzaSyTestMockKeyBackup987654321"
    k1 = add_api_key("Primary Test Key", raw1)
    k2 = add_api_key("Backup Test Key", raw2)

    try:
        # Lấy active key
        active = get_active_api_key(provider="gemini")
        assert active is not None

        # Giả lập xoay vòng key khi dính 429
        next_k = rotate_to_next_key(raw1, "Chạm 429 Rate Limit")
        assert next_k is not None
        assert next_k != raw1

        # 2. Test budget gate
        old_cfg = load_budget_config()
        safe_old_cfg = BudgetCapConfig(
            daily_token_limit=50_000_000,
            monthly_token_limit=500_000_000,
            auto_offline_fallback=old_cfg.auto_offline_fallback,
            alert_on_threshold_pct=old_cfg.alert_on_threshold_pct
        )
        save_budget_config(BudgetCapConfig(
            daily_token_limit=10000,
            monthly_token_limit=100000,
            auto_offline_fallback=True,
            alert_on_threshold_pct=80
        ))
        
        # Kiểm tra budget gate với cấu hình hợp lệ
        allowed, reason = check_token_budget_gate()
        assert isinstance(allowed, bool)
        assert isinstance(reason, str)

        # Reset lại config an toàn
        save_budget_config(safe_old_cfg)
        allowed_after, _ = check_token_budget_gate()
        assert allowed_after is True
    finally:
        delete_api_key(k1["key_id"])
        delete_api_key(k2["key_id"])

@pytest.mark.asyncio
async def test_real_token_ledger_and_auto_heartbeat():
    from app.services.telemetry_store import (
        record_llm_token_usage, get_daily_token_usage,
        get_monthly_token_usage, get_all_time_token_usage
    )

    # 1. Ghi nhận lượt tiêu thụ token thật
    cost1 = record_llm_token_usage(prompt_tokens=150, completion_tokens=350, model="gemini-3.5-flash-lite", provider="gemini")
    assert cost1 > 0

    daily_tok, daily_cost = get_daily_token_usage()
    assert daily_tok >= 500
    assert daily_cost >= cost1

    month_tok, month_cost = get_monthly_token_usage()
    assert month_tok >= daily_tok

    p_all, c_all, t_all, cost_all = get_all_time_token_usage()
    assert t_all >= 500
    assert p_all >= 150
    assert c_all >= 350

    # 2. Test API auto-heartbeat
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/admin/keys/auto-heartbeat")
        assert res.status_code == 200
        keys = res.json()
        assert isinstance(keys, list)

@pytest.mark.asyncio
async def test_per_key_consumption_telemetry():
    from app.services.admin_key_vault import add_api_key, delete_api_key, record_key_consumption, get_all_masked_keys
    raw_test_key = "AIzaSyTestPerKeyConsumption12345678"
    new_k = add_api_key("Key Test Telemetry", raw_test_key)
    key_id = new_k["key_id"]

    try:
        # Ghi nhận consumption bình thường
        record_key_consumption(raw_test_key, tokens=1200, is_error_429=False)
        keys = get_all_masked_keys()
        target = next((k for k in keys if k["key_id"] == key_id), None)
        assert target is not None
        assert target["tokens_used_today"] >= 1200
        assert target["requests_count"] >= 1
        assert target["error_429_count"] == 0
        assert target["last_used_at"] is not None

        # Ghi nhận lỗi 429
        record_key_consumption(raw_test_key, tokens=0, is_error_429=True)
        keys2 = get_all_masked_keys()
        target2 = next((k for k in keys2 if k["key_id"] == key_id), None)
        assert target2 is not None
        assert target2["error_429_count"] >= 1
        assert "429" in target2["quota_status"]
    finally:
        delete_api_key(key_id)

@pytest.mark.asyncio
async def test_admin_bhyt_monitoring_logs():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Ghi nhận log giám định BHYT tùy chỉnh (kèm lỗi)
        log_res = await client.post("/api/v1/bhyt/log", json={
            "prescription_id": "RX-MONITOR-TEST-01",
            "patient_name": "Bệnh Nhân Test Monitor",
            "insurance_card_number": "DN4799988877766",
            "hospital_rank": "HANG_I",
            "treatment_type": "NGOAI_TRU",
            "primary_icd10": "I10",
            "status": "REJECT",
            "total_cost_vnd": 450000.0,
            "at_risk_cost_vnd": 150000.0,
            "violations_count": 1,
            "violations_json": '[{"id":"VIO-01","severity":"REJECT","category":"RANK","title":"Vượt tuyến","detail":"Chi tiết lỗi test"}]'
        })
        assert log_res.status_code == 200
        assert log_res.json()["status"] == "success"

        # 2. Ghi nhận log lỗi ngoại lệ
        err_res = await client.post("/api/v1/bhyt/log", json={
            "prescription_id": "RX-ERR-02",
            "patient_name": "Bệnh Nhân Lỗi OCR",
            "error_detail": "Lỗi phân tích cú pháp đơn thuốc OCR: Thiếu mã hoạt chất"
        })
        assert err_res.status_code == 200
        assert err_res.json()["status"] == "success"

        # 3. Tra cứu danh sách log qua endpoint monitoring chuyên dụng
        mon_res = await client.get("/api/v1/admin/monitoring/bhyt-logs?limit=10")
        assert mon_res.status_code == 200
        logs = mon_res.json()
        assert len(logs) >= 2
        assert any(l["prescription_id"] == "RX-MONITOR-TEST-01" for l in logs)

        # 4. Lọc theo trạng thái REJECT
        reject_res = await client.get("/api/v1/admin/monitoring/bhyt-logs?status=REJECT")
        assert reject_res.status_code == 200
        reject_logs = reject_res.json()
        assert all(l["status"] == "REJECT" for l in reject_logs)

        # 5. Lọc theo tìm kiếm từ khóa
        search_res = await client.get("/api/v1/admin/monitoring/bhyt-logs?q=Test%20Monitor")
        assert search_res.status_code == 200
        search_logs = search_res.json()
        assert len(search_logs) >= 1
        assert "Test Monitor" in search_logs[0]["patient_name"]
