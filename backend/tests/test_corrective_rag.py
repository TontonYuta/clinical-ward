"""
Unit & Integration Tests for Corrective RAG (CRAG) & Tripartite Decision Engine (ICLR 2024 / MedAbstain)
"""
import pytest
from types import SimpleNamespace
import difflib
from app.database import AsyncSessionLocal
from app.services.copilot_drug_lookup import lookup_drug_authoritative
from app.services.chatbot.corrective_rag import (
    evaluate_crag_tripartite, find_crag_candidates, is_exact_drug_match,
    _candidate_similarity,
)


def test_candidate_score_uses_measured_similarity_without_floor():
    assert _candidate_similarity("xytz", "paracetamol") == pytest.approx(
        difflib.SequenceMatcher(None, "xytz", "paracetamol").ratio()
    )
    assert _candidate_similarity("xytz", "paracetamol") < 0.68


def test_exact_match_checks_all_resolved_drugs_and_rejects_partial_tokens():
    first = SimpleNamespace(brand_name="Aspirin", active_ingredient="Acetylsalicylic acid", national_code="A1")
    second = SimpleNamespace(brand_name="Paracetamol 500mg", active_ingredient="Paracetamol", national_code="P1")
    assert any(is_exact_drug_match("Paracetamol", drug) for drug in [first, second])
    assert not is_exact_drug_match("para", second)


@pytest.mark.asyncio
async def test_crag_decides_when_exact_drug_is_not_first_result():
    first = SimpleNamespace(brand_name="Aspirin", active_ingredient="Acetylsalicylic acid", national_code="A1")
    second = SimpleNamespace(brand_name="Paracetamol 500mg", active_ingredient="Paracetamol", national_code="P1")
    async with AsyncSessionLocal() as db:
        response = await evaluate_crag_tripartite(
            "Paracetamol", "Paracetamol", [first, second], db,
            session_id="crag_exact_after_first", user_name="clinician", user_role="doctor",
        )
    assert response is None

@pytest.mark.asyncio
async def test_crag_candidate_search_typo_venclex():
    async with AsyncSessionLocal() as db:
        candidates = await find_crag_candidates("venclex", db, top_k=4)
        assert len(candidates) >= 1
        brand_names = [c["brand_name"].lower() for c in candidates]
        assert any("venclexta" in b for b in brand_names)
        assert candidates[0]["score"] >= 0.70

@pytest.mark.asyncio
async def test_crag_candidate_search_typo_efferal():
    async with AsyncSessionLocal() as db:
        candidates = await find_crag_candidates("efferal", db, top_k=4)
        assert len(candidates) >= 1
        brand_names = [c["brand_name"].lower() for c in candidates]
        assert any("efferalgan" in b for b in brand_names)

@pytest.mark.asyncio
async def test_crag_tripartite_branch2_ask_venclex():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("venclex", db, session_id="test_crag_ask", user_role="doctor", user_name="BS. Hùng")
        assert resp.intent == "CLINICAL_TYPO_SUGGESTION"
        assert resp.answer_type == "corrective_clarification"
        assert resp.confidence >= 0.50
        assert "venclexta" in resp.reply_text.lower()
        assert any("venclexta" in chip.lower() for chip in (resp.suggested_chips or []))

@pytest.mark.asyncio
async def test_crag_tripartite_branch2_ask_efferal():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("efferal", db, session_id="test_crag_efferal", user_role="doctor", user_name="BS. Hùng")
        assert resp.intent == "CLINICAL_TYPO_SUGGESTION"
        assert resp.answer_type == "corrective_clarification"
        assert "efferalgan" in resp.reply_text.lower()
        assert any("efferalgan" in chip.lower() for chip in (resp.suggested_chips or []))

@pytest.mark.asyncio
async def test_unmatched_gibberish_is_safely_abstained_by_lookup():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("xytz987654321random", db, session_id="test_crag_defer", user_role="doctor", user_name="BS. Hùng")
        assert resp.intent == "CLINICAL_SAFE_ABSTENTION"
        assert resp.answer_type == "safe_abstention"
        assert resp.confidence == 0.0
        assert "chưa có căn cứ" in resp.reply_text.lower()


@pytest.mark.asyncio
async def test_crag_tripartite_branch3_defers_gibberish():
    async with AsyncSessionLocal() as db:
        resp = await evaluate_crag_tripartite(
            "xytz987654321random", "xytz987654321random", [], db,
            session_id="test_crag_defer", user_role="doctor", user_name="BS. Hùng",
        )
    assert resp.intent == "CLINICAL_SAFE_ABSTENTION"
    assert resp.answer_type == "safe_abstention"
    assert resp.confidence == 0.0

@pytest.mark.asyncio
async def test_crag_tripartite_branch1_decide_exact_paracetamol():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("Paracetamol", db, session_id="test_crag_decide", user_role="doctor", user_name="BS. Hùng")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.confidence >= 0.85
        assert "paracetamol" in resp.reply_text.lower()

@pytest.mark.asyncio
async def test_crag_end_to_end_router_single_word_typo():
    from types import SimpleNamespace
    from app.schemas.copilot import CopilotQuery
    from app.services.session_context import get_or_create_session
    from app.services.chatbot.copilot_orchestrator import handle_copilot_chat

    session = get_or_create_session("test_router_crag", "BS. Hùng", "doctor")
    mock_request = SimpleNamespace(headers={}, state=SimpleNamespace(authenticated_user=None))

    payload = CopilotQuery(
        query="venclex",
        session_id="test_router_crag",
        user_role="doctor",
        user_name="BS. Hùng"
    )

    async with AsyncSessionLocal() as db:
        resp = await handle_copilot_chat(payload, mock_request, db, session=session, history="")
        assert resp.intent == "CLINICAL_TYPO_SUGGESTION"
        assert resp.answer_type == "corrective_clarification"
        assert "venclexta" in resp.reply_text.lower()

