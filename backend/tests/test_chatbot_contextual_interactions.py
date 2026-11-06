"""Regressions for keeping both operands in follow-up interaction questions."""
import asyncio
from types import SimpleNamespace

import pytest

from app.services.chatbot import multiturn_handler
from app.services.session_context import SessionState


class Rows:
    def scalar_one_or_none(self):
        return None


class EmptyDb:
    async def execute(self, statement):
        return Rows()


@pytest.fixture(autouse=True)
def isolate_single_drug_lookup(monkeypatch):
    async def lookup(query, db, **kwargs):
        return SimpleNamespace(intent="SINGLE-DRUG-LOOKUP")
    monkeypatch.setattr(multiturn_handler, "lookup_drug_authoritative", lookup)
    monkeypatch.setattr("app.services.chatbot.fsm_router.lookup_drug_authoritative", lookup)


def resolve(query, session):
    return asyncio.run(multiturn_handler.resolve_active_drug_and_terms(
        query, query.lower(), EmptyDb(), session=session, session_id=session.session_id,
        user_name="test", user_role="doctor", is_renal=False, is_deep_complex=False,
    ))


@pytest.mark.parametrize("query", [
    "Thuốc này có tương tác với ibuprofen không?",
    "Thuốc đó dùng cùng ibuprofen được không?",
    "Thuoc nay co tuong tac voi ibuprofen khong?",
])
def test_followup_keeps_active_drug_and_explicit_second_drug(monkeypatch, query):
    from app.services.clinical_ddi_engine import multi_drug_matrix
    captured = []
    def format_pair(drugs, query, session_id=None):
        captured.extend(drugs)
        return SimpleNamespace(intent="PAIR-CHECK")
    monkeypatch.setattr(multi_drug_matrix, "format_multi_ddi_response", format_pair)
    session = SessionState("test:pair", "test", "doctor")
    session.set_active_medication("Concor 5mg", "Bisoprolol fumarate", sdk="test-sdk")
    result = resolve(query, session)
    assert set(name.casefold() for name in captured) == {"concor 5mg", "ibuprofen"}
    assert result[-1].intent == "PAIR-CHECK"
    assert session.active_medication_name == "Concor 5mg"


def test_deictic_pair_without_anchor_asks_for_missing_drug():
    response = resolve("Thuốc này có tương tác với ibuprofen không?", SessionState("missing", "test", "doctor"))[-1]
    assert response is not None
    assert response.intent == "MEDICATION_INTERACTION_CLARIFICATION"
    assert response.source_status == "missing_interaction_medications"


def test_reference_keeps_active_drug_with_multiple_explicit_comedications(monkeypatch):
    from app.services.clinical_ddi_engine import multi_drug_matrix
    captured = []
    def format_pair(drugs, query, session_id=None):
        captured.extend(drugs)
        return SimpleNamespace(intent="PAIR-CHECK")
    monkeypatch.setattr(multi_drug_matrix, "format_multi_ddi_response", format_pair)
    session = SessionState("multi", "test", "doctor")
    session.set_active_medication("Warfarin", "warfarin")
    resolve("Thuốc này có tương tác với Aspirin và Ibuprofen không?", session)
    assert set(name.casefold() for name in captured) == {"warfarin", "aspirin", "ibuprofen"}


@pytest.mark.parametrize("query", ["Thuốc này có tương tác với thuốc nào?", "Thuốc này có tương tác gì không?"])
def test_general_partner_list_question_remains_single_drug_lookup(query):
    session = SessionState("list", "test", "doctor")
    session.set_active_medication("Warfarin", "warfarin")
    response = resolve(query, session)[-1]
    if response is None:
        from app.services.chatbot.fsm_router import route_fsm_context
        response = asyncio.run(route_fsm_context(query, query.lower(), EmptyDb(), session=session,
                               session_id=session.session_id, user_name="test", user_role="doctor"))
    assert response.intent == "SINGLE-DRUG-LOOKUP"
    assert session.active_medication_name == "Warfarin"


def test_fed_state_no_does_not_mean_pronoun_no():
    from app.services.chatbot.field_routing import handle_contextual_interaction
    session = SessionState("food", "test", "doctor")
    session.set_active_medication("Warfarin", "warfarin")
    response = asyncio.run(handle_contextual_interaction(
        "Ibuprofen uống lúc no có tương tác với thức ăn không?", session=session,
        session_id=session.session_id, user_name="test", user_role="doctor"))
    assert response is None
    assert session.active_medication_name == "Warfarin"


def test_complex_renal_case_defers_to_existing_case_pipeline():
    from app.services.chatbot.field_routing import handle_contextual_interaction
    session = SessionState("renal", "test", "doctor")
    response = asyncio.run(handle_contextual_interaction(
        "Bệnh nhân suy thận eGFR 20 đang dùng Metformin và Aspirin, kiểm tra tương tác và hiệu chỉnh liều.",
        session=session, session_id=session.session_id, user_name="test", user_role="doctor"))
    assert response is None


def test_orchestrator_keeps_existing_complex_case_evaluation(monkeypatch):
    from app.schemas.copilot import CopilotQuery
    from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
    async def rewrite(query, **kwargs):
        return SimpleNamespace(rewritten_query=query)
    async def evaluate(query, **kwargs):
        return SimpleNamespace(answer="CASE-PIPELINE", citations=[], cdss_alert=None,
                               legal_basis="test fixture", confidence_score=0, rag_grounded=False,
                               critique_verdict="FAIL", factuality_score=0)
    monkeypatch.setattr("app.services.rag.query_rewriter.rewrite_clinical_query", rewrite)
    monkeypatch.setattr("app.services.rag.multihop_clinical_agent.execute_multihop_clinical_evaluation", evaluate)
    session = SessionState("test:renal-pipeline", "test", "doctor")
    request = SimpleNamespace(state=SimpleNamespace(authenticated_user=None))
    response = asyncio.run(handle_copilot_chat(CopilotQuery(
        query="Bệnh nhân suy thận eGFR 20 đang dùng Metformin và Aspirin, kiểm tra tương tác và hiệu chỉnh liều.",
        user_name="test", user_role="doctor"), request, EmptyDb(), session=session, history=""))
    assert response.intent == "CLINICAL_AI_CONSULTATION"
    assert response.reply_text == "CASE-PIPELINE"


def test_two_explicit_drugs_override_previous_subject(monkeypatch):
    from app.services.clinical_ddi_engine import multi_drug_matrix
    captured = []
    def format_pair(drugs, query, session_id=None):
        captured.extend(drugs)
        return SimpleNamespace(intent="PAIR-CHECK")
    monkeypatch.setattr(multi_drug_matrix, "format_multi_ddi_response", format_pair)
    session = SessionState("two", "test", "doctor")
    session.set_active_medication("Concor 5mg", "Bisoprolol fumarate")
    resolve("Tương tác Warfarin và Aspirin", session)
    assert set(name.casefold() for name in captured) == {"warfarin", "aspirin"}
    assert session.active_medication_name is None
    assert set(name.casefold() for name in session.comparison_drugs) == {"warfarin", "aspirin"}


def test_explicit_new_single_drug_still_switches_subject(monkeypatch):
    async def lookup(query, db, **kwargs):
        return SimpleNamespace(intent="NEW-DRUG")
    monkeypatch.setattr(multiturn_handler, "lookup_drug_authoritative", lookup)
    session = SessionState("switch", "test", "doctor")
    session.set_active_medication("Concor 5mg", "Bisoprolol fumarate")
    assert resolve("Chống chỉ định Ibuprofen", session)[-1].intent == "NEW-DRUG"
    assert session.active_medication_name == "Ibuprofen"


def test_unmatched_pair_is_not_reported_as_confirmed_safe():
    from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
    response = format_multi_ddi_response(["Concor 5mg", "Ibuprofen"], "Tương tác Concor và Ibuprofen")
    assert "Concor" in response.reply_text
    assert "Ibuprofen" in response.reply_text
    assert response.source_status == "no_matching_interaction_evidence"
    assert response.answer_type == "safe_abstention"
    assert response.confidence == 0
    assert "không xác nhận" in response.reply_text.lower()


def test_known_pair_still_returns_existing_warning():
    from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
    response = format_multi_ddi_response(["Warfarin", "Aspirin"], "Tương tác Warfarin và Aspirin")
    assert response.cdss_alert is not None
    assert response.source_status == "retrieved_evidence"


def test_original_reference_is_resolved_before_any_llm_query_rewrite(monkeypatch):
    from app.schemas.copilot import CopilotQuery
    from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
    async def unexpected_rewrite(*args, **kwargs):
        raise AssertionError("Pair operands must be resolved without a model rewrite")
    monkeypatch.setattr("app.services.rag.query_rewriter.rewrite_clinical_query", unexpected_rewrite)
    session = SessionState("test:original", "test", "doctor")
    session.set_active_medication("Concor 5mg", "Bisoprolol fumarate")
    request = SimpleNamespace(state=SimpleNamespace(authenticated_user=None))
    response = asyncio.run(handle_copilot_chat(
        CopilotQuery(query="Thuốc này có tương tác với Ibuprofen không?", user_name="test", user_role="doctor"),
        request, EmptyDb(), session=session, history="Thông tin thuốc Concor 5mg",
    ))
    assert "Concor" in response.reply_text and "Ibuprofen" in response.reply_text
    assert response.source_status == "no_matching_interaction_evidence"
