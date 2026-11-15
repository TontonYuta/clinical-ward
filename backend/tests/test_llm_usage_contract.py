import asyncio

from app.services.llm_provider import (
    get_last_llm_execution,
    record_llm_execution,
    reset_llm_execution,
    set_last_llm_execution,
)
from app.services.telemetry_store import record_llm_token_usage


def test_usage_contract_marks_missing_provider_usage_as_estimated():
    reset_llm_execution()
    set_last_llm_execution({
        "model": "test-model",
        "provider": "test-provider",
        "prompt_tokens": 4,
        "completion_tokens": 2,
        "total_tokens": 6,
    })

    usage = get_last_llm_execution()

    assert usage["usage_source"] == "estimated"
    assert usage["actual_usage"] is False


def test_usage_contract_marks_provider_usage_as_actual():
    reset_llm_execution()
    set_last_llm_execution({
        "model": "test-model",
        "provider": "test-provider",
        "prompt_tokens": 4,
        "completion_tokens": 2,
        "total_tokens": 6,
        "usage_source": "provider",
        "actual_usage": True,
    })

    usage = get_last_llm_execution()

    assert usage["usage_source"] == "provider"
    assert usage["actual_usage"] is True


def test_no_provider_usage_is_not_reported_as_actual_by_default():
    reset_llm_execution()

    usage = get_last_llm_execution()

    assert usage["usage_source"] == "none"
    assert usage["actual_usage"] is False


def test_request_usage_resets_between_requests_and_marks_no_model_call():
    record_llm_execution("prior", "provider", 8, 2, usage_source="provider")

    reset_llm_execution()

    usage = get_last_llm_execution()
    assert usage["call_count"] == 0
    assert usage["prompt_tokens"] == 0
    assert usage["completion_tokens"] == 0
    assert usage["usage_source"] == "none"


def test_request_usage_accumulates_multiple_calls_without_losing_provenance():
    reset_llm_execution()
    record_llm_execution("first", "gemini", 10, 4, usage_source="provider")
    record_llm_execution("second", "gemini", 3, 2, usage_source="estimated")

    usage = get_last_llm_execution()

    assert usage["call_count"] == 2
    assert usage["prompt_tokens"] == 13
    assert usage["completion_tokens"] == 6
    assert usage["total_tokens"] == 19
    assert usage["usage_source"] == "mixed"
    assert usage["actual_usage"] is False


def test_cached_model_response_is_a_cache_hit_without_token_usage():
    reset_llm_execution()
    record_llm_execution("test-model", "gemini", cache_hit=True)

    usage = get_last_llm_execution()

    assert usage["call_count"] == 0
    assert usage["cache_hits"] == 1
    assert usage["prompt_tokens"] == usage["completion_tokens"] == 0
    assert usage["usage_source"] == "none"


def test_estimated_usage_is_not_recorded_as_billable_cost():
    cost = record_llm_token_usage(1000, 500, usage_source="estimated")
    assert cost == 0.0


def test_telemetry_ledger_path_can_target_persistent_runtime_storage():
    from app.services.telemetry_store import resolve_telemetry_db_path

    configured = resolve_telemetry_db_path({"TELEMETRY_DB_PATH": "/var/data/telemetry.db"})
    assert configured == "/var/data/telemetry.db"

    defaulted = resolve_telemetry_db_path({})
    assert defaulted.endswith("/data/telemetry_ledger.db")


def test_execution_count_distinguishes_provider_call_from_actual_usage():
    reset_llm_execution()
    record_llm_execution("gemini-auto", "gemini", 12, 0, usage_source="estimated")
    usage = get_last_llm_execution()
    assert usage["model_call_count"] == 1
    assert usage["provider_call_count"] == 0
    assert usage["actual_usage"] is False


def test_concurrent_child_tasks_do_not_lose_request_usage():
    async def child(model, prompt, completion):
        await asyncio.sleep(0)
        record_llm_execution(model, "gemini", prompt, completion, usage_source="provider")

    async def run():
        reset_llm_execution()
        await asyncio.gather(child("one", 11, 3), child("two", 7, 5))
        return get_last_llm_execution()

    usage = asyncio.run(run())

    assert usage["call_count"] == 2
    assert usage["prompt_tokens"] == 18
    assert usage["completion_tokens"] == 8
    assert usage["total_tokens"] == 26


def test_llm_cache_hit_is_served_before_closed_budget_gate(monkeypatch):
    import time
    import app.services.llm_provider as provider

    reset_llm_execution()
    monkeypatch.setattr(provider.settings, "LLM_PROVIDER", "gemini")
    monkeypatch.setattr(provider, "_LLM_CACHE", {})
    prompt = "cached prompt"
    system = "cached system"
    model = "gemini-auto"
    cache_hash = provider._compute_prompt_hash("gemini", model, prompt, system)
    provider._LLM_CACHE[cache_hash] = ("cached answer", time.time())
    monkeypatch.setattr(
        "app.services.admin_monitoring_service.check_token_budget_gate",
        lambda: (False, "budget exhausted"),
    )

    import asyncio
    result = asyncio.run(provider.query_clinical_llm(
        prompt, system_instruction=system, api_key="unused"
    ))

    assert result == "cached answer"
    usage = get_last_llm_execution()
    assert usage["cache_hits"] == 1
    assert usage["model_call_count"] == 0
    assert usage["total_tokens"] == 0
