"""Unit tests for Enterprise Phase 1: FinOps pricing/spend cap, per-user rate limiting, Pay-as-you-go tiering, and async key vault."""
import json
from types import SimpleNamespace
import pytest
from fastapi import HTTPException

from app.config import settings
from app.schemas.admin_monitoring_schema import BudgetCapConfig
from app.security.chat_rate_limiter import UserChatRateLimiter
from app.services import admin_key_vault
from app.services.gemini_model_discovery import filter_high_quota_chat_models
from app.services.telemetry_store import estimate_model_cost_vnd


def _dummy_req(host: str = "10.0.0.1"):
    return SimpleNamespace(client=SimpleNamespace(host=host))


def test_user_chat_rate_limiter_enforces_burst_and_daily_caps():
    limiter = UserChatRateLimiter(
        window_seconds=60.0,
        standard_per_minute=2,
        privileged_per_minute=4,
        standard_per_day=3,
        privileged_per_day=5,
    )
    req = _dummy_req()

    # Standard user hits 2/min burst limit on 3rd request
    limiter.check_and_consume(req, "nurse_a", "nurse")
    limiter.check_and_consume(req, "nurse_a", "nurse")
    with pytest.raises(HTTPException) as exc:
        limiter.check_and_consume(req, "nurse_a", "nurse")
    assert exc.value.status_code == 429
    assert int(exc.value.headers["Retry-After"]) >= 1

    # Doctor role has higher burst limit (4/min) and daily cap (5/day)
    for _ in range(4):
        limiter.check_and_consume(req, "doc_b", "doctor")
    limiter._minute_buckets.clear()
    limiter.check_and_consume(req, "doc_b", "doctor")
    with pytest.raises(HTTPException) as exc_daily:
        limiter.check_and_consume(req, "doc_b", "doctor")
    assert exc_daily.value.status_code == 429


def test_estimate_model_cost_vnd_scales_by_model_tier(monkeypatch):
    monkeypatch.setenv("USD_TO_VND_RATE", "25500")
    lite_cost = estimate_model_cost_vnd("gemini-3.1-flash-lite", 1_000_000, 0, 1_000_000)
    flash_cost = estimate_model_cost_vnd("gemini-3-flash-preview", 1_000_000, 0, 1_000_000)
    pro_cost = estimate_model_cost_vnd("gemini-2.5-pro", 1_000_000, 0, 1_000_000)
    assert lite_cost < flash_cost < pro_cost


def test_check_token_budget_gate_blocks_when_daily_cost_limit_reached(monkeypatch):
    from app.services import admin_monitoring_service

    monkeypatch.setattr(
        admin_monitoring_service,
        "load_budget_config",
        lambda: BudgetCapConfig(daily_token_limit=500000, daily_cost_limit_vnd=10000.0),
    )
    monkeypatch.setattr("app.services.telemetry_store.get_daily_token_usage", lambda: (1000, 9000.0))
    monkeypatch.setattr("app.services.telemetry_store.get_daily_search_query_usage", lambda: (5, 1500.0))

    allowed, reason = admin_monitoring_service.check_token_budget_gate()
    assert allowed is False
    assert "chi phí ngày" in reason.lower()


def test_payg_model_tiering_prioritizes_flash_for_reasoning_and_lite_for_standard():
    candidates = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3-flash-preview",
    ]
    standard = filter_high_quota_chat_models(candidates, tier="standard", tier_mode="payg")
    reasoning = filter_high_quota_chat_models(candidates, tier="reasoning", tier_mode="payg")
    free_reasoning = filter_high_quota_chat_models(candidates, tier="reasoning", tier_mode="free")

    assert standard[0] == "gemini-3.1-flash-lite"
    assert reasoning[0] == "gemini-3-flash-preview"
    assert free_reasoning[0] == "gemini-3.1-flash-lite"


@pytest.mark.asyncio
async def test_async_key_vault_consumption_and_rotation(monkeypatch, tmp_path):
    vault_file = tmp_path / "vault.json"
    vault_file.write_text(
        json.dumps([
            {
                "key_id": "k1",
                "name": "Primary",
                "raw_key": "AIzaSyTestAsyncKeyOne1111111",
                "provider": "gemini",
                "status": "active",
                "is_active": True,
                "tokens_used_today": 0,
                "requests_count": 0,
                "error_429_count": 0,
            },
            {
                "key_id": "k2",
                "name": "Backup",
                "raw_key": "AIzaSyTestAsyncKeyTwo2222222",
                "provider": "gemini",
                "status": "standby",
                "is_active": False,
                "tokens_used_today": 0,
                "requests_count": 0,
                "error_429_count": 0,
            },
        ]),
        encoding="utf-8",
    )
    monkeypatch.setattr(settings, "IDENTITY_DATABASE_URL", "")
    monkeypatch.setattr(settings, "KEY_ENCRYPTION_KEY", "")
    monkeypatch.setattr(admin_key_vault, "_VAULT_FILE", str(vault_file))
    admin_key_vault._ACTIVE_KEY_CACHE.clear()

    await admin_key_vault.record_key_consumption_async("AIzaSyTestAsyncKeyOne1111111", 150)
    nxt = await admin_key_vault.rotate_to_next_key_async("AIzaSyTestAsyncKeyOne1111111", reason="rate_limited")
    assert nxt == "AIzaSyTestAsyncKeyTwo2222222"

    stored = json.loads(vault_file.read_text(encoding="utf-8"))
    by_id = {item["key_id"]: item for item in stored}
    assert by_id["k1"]["requests_count"] == 1
    assert by_id["k1"]["tokens_used_today"] == 150
    assert by_id["k1"]["is_active"] is False
    assert by_id["k2"]["is_active"] is True
