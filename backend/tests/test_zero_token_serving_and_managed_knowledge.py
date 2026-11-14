import pytest
import time
from starlette.requests import Request
from app.database import AsyncSessionLocal
from app.schemas.copilot import CopilotQuery
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.clinical_prescription_auditor import TIMING_GUIDELINES
from app.services.chatbot.gemini_nlu_router import try_deterministic_fast_path
from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
from app.services.session_context import get_or_create_session


def test_drug_registry_loaded_from_managed_json():
    assert isinstance(DRUG_REGISTRY, dict)
    assert len(DRUG_REGISTRY) >= 50
    assert "paracetamol" in DRUG_REGISTRY
    assert "morphin" in DRUG_REGISTRY
    assert "calci" in DRUG_REGISTRY
    assert "plavix" in DRUG_REGISTRY["clopidogrel"]["aliases"]


def test_timing_guidelines_loaded_from_managed_json():
    assert isinstance(TIMING_GUIDELINES, dict)
    assert len(TIMING_GUIDELINES) >= 10
    assert "nsaid" in TIMING_GUIDELINES
    assert "ppi" in TIMING_GUIDELINES
    assert "statin" in TIMING_GUIDELINES
    assert "ibuprofen" in TIMING_GUIDELINES["nsaid"]["keywords"]


def test_try_deterministic_fast_path_latency_and_accuracy():
    # Warmup Trie and SQLite index
    _ = try_deterministic_fast_path("warmup")

    test_queries = [
        ("Paracetamol", "MEDICATION_LOOKUP", "Paracetamol"),
        ("Tra cứu thuốc Calci clorid", "MEDICATION_LOOKUP", "Calci clorid"),
        ("Liều dùng Diazepam", "MEDICATION_LOOKUP", "Diazepam"),
        ("Chỉ định của Morphin", "MEDICATION_LOOKUP", "Morphin"),
        ("VD-10405-10", "MEDICATION_LOOKUP", "VD-10405-10"),
        ("xin chào", "GREETING_WELLBEING", None),
        ("bạn là ai", "OUT_OF_SCOPE", None),
        ("Tra cứu Dược Thư 2015", "MEDICATION_LOOKUP_GUIDE", None),
    ]

    for q, expected_intent, expected_drug in test_queries:
        t0 = time.perf_counter()
        res = try_deterministic_fast_path(q)
        dt = (time.perf_counter() - t0) * 1000
        assert res is not None, f"Fast path failed to match: {q}"
        assert res.intent == expected_intent, f"Wrong intent for {q}: {res.intent}"
        if expected_drug:
            assert res.primary_drug == expected_drug, f"Wrong drug for {q}: {res.primary_drug}"
        assert dt < 50.0, f"Latency exceeded 50ms: {dt:.2f}ms"


@pytest.mark.asyncio
async def test_zero_token_direct_serving_end_to_end():
    async with AsyncSessionLocal() as db:
        req = Request({"type": "http"})
        session = get_or_create_session("zero-tok-test", "BS. Hung", "doctor")
        query = "Tra cứu thuốc Calci clorid"
        payload = CopilotQuery(query=query, user_name="BS. Hung", user_role="doctor", session_id="zero-tok-test")
        
        t0 = time.perf_counter()
        resp = await handle_copilot_chat(payload, req, db, session=session, history="")
        dt = (time.perf_counter() - t0) * 1000

        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert "Calci Clorid" in resp.reply_text or "CALCI CLORID" in resp.reply_text
        assert resp.prompt_tokens == 0
        assert resp.completion_tokens == 0
        assert dt < 500.0, f"Direct serving took too long: {dt:.2f}ms"
