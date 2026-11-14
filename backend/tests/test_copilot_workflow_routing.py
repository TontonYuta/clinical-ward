from types import SimpleNamespace

import pytest

from app.services.chatbot.workflow_models import ClinicalRequestContext
from app.services.chatbot.workflow_router import decide_route, prepare_request
from app.services.chatbot.workflow_policy import load_workflow_policy
from app.services.chatbot.workflow_policy import RoutePrecedence
from app.config import settings


def test_prepare_request_preserves_original_and_uses_explicit_current_entity():
    session = SimpleNamespace(active_medication_name="Coversyl", active_patient_id="patient-1")
    nlu = SimpleNamespace(primary_drug="Paracetamol", is_deictic_referent=False)
    context = prepare_request("  Thông tin thuốc Paracetamol?  ", user_role="doctor", nlu_result=nlu,
                              session=session, history_reference="history-1")
    assert context.original_query == "  Thông tin thuốc Paracetamol?  "
    assert context.normalized_query == "Thông tin thuốc Paracetamol?"
    assert context.patient_context_reference == "patient-1"
    assert context.required_entities == ["Paracetamol"]


def test_prepare_request_resolves_deictic_entity_from_session_only_when_nlu_marks_it():
    session = SimpleNamespace(active_medication_name="Coversyl", active_patient_id=None)
    nlu = SimpleNamespace(primary_drug=None, is_deictic_referent=True)
    context = prepare_request("Thuốc đó?", user_role="doctor", nlu_result=nlu, session=session)
    assert context.required_entities == ["Coversyl"]


def test_decide_route_consumes_managed_intent_mapping():
    policy = load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                              "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
    )
    decision = decide_route(
        ClinicalRequestContext(original_query="x", normalized_query="x", user_role="doctor",
                               required_entities=["Paracetamol"]),
        SimpleNamespace(intent="MEDICATION_LOOKUP"), policy,
    )
    assert decision.intent == "MEDICATION_LOOKUP"
    assert decision.executor_key == "drug_lookup"
    assert decision.required_entities == ["Paracetamol"]
    assert decision.evidence_required is True


def test_managed_route_precedence_can_select_configured_route():
    policy = load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                              "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
    )
    context = ClinicalRequestContext(original_query="x", normalized_query="x", user_role="doctor")

    managed_policy = policy.model_copy(update={
        "decision_precedence": [RoutePrecedence(signal="multiple_subqueries", intent="MEDICATION_LOOKUP")]
    })
    multi = decide_route(context, SimpleNamespace(intent="CAPABILITY_OPENING", sub_queries=["a", "b"]), managed_policy)

    assert (multi.intent, multi.executor_key, multi.reason_code) == (
        "MEDICATION_LOOKUP", "drug_lookup", "managed_precedence:multiple_subqueries"
    )


def test_ambiguous_or_unrecognized_intent_fails_closed():
    policy = load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                              "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
    )
    with pytest.raises(ValueError, match="no managed route"):
        decide_route(
            ClinicalRequestContext(original_query="x", normalized_query="x", user_role="doctor"),
            SimpleNamespace(intent="UNKNOWN"), policy,
        )


def test_nlu_outage_uses_explicit_managed_fallback_route():
    policy = load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                              "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
    )
    decision = decide_route(
        ClinicalRequestContext(original_query="x", normalized_query="x", user_role="doctor"),
        None, policy, fallback_intent="CLINICAL_CASE_CLARIFICATION",
    )
    assert decision.intent == "CLINICAL_CASE_CLARIFICATION"
    assert decision.executor_key == "clarification"
    assert decision.evidence_required is False
    assert decision.reason_code == "managed_nlu_unavailable_fallback"


def test_ambiguous_nlu_uses_managed_clarification_route():
    policy = load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                              "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
    )
    decision = decide_route(
        ClinicalRequestContext(original_query="x", normalized_query="x", user_role="doctor"),
        SimpleNamespace(intent=""), policy, fallback_intent="AMBIGUOUS_INTENT",
    )
    assert decision.intent == "AMBIGUOUS_INTENT"
    assert decision.executor_key == "clarification"
    assert decision.reason_code == "managed_ambiguous_intent_fallback"


@pytest.mark.asyncio
async def test_orchestrator_ambiguous_nlu_does_not_continue_into_clinical_branching(monkeypatch):
    ambiguous = SimpleNamespace(intent="", primary_drug=None, sub_queries=[], is_prescription_block=False)
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu",
                        __import__("unittest.mock").mock.AsyncMock(return_value=ambiguous))
    from app.services.chatbot import copilot_orchestrator
    from app.schemas.copilot import CopilotQuery
    from fastapi import Request
    request = Request({"type": "http", "method": "POST", "path": "/chat", "headers": [],
                       "query_string": b"", "server": ("test", 80), "client": ("test", 1),
                       "scheme": "http"})
    request.state.authenticated_user = SimpleNamespace(username="tester", role="doctor")
    request.scope["app"] = SimpleNamespace(state=SimpleNamespace(workflow_policy=load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                              "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
    )))
    import pytest
    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="ambiguous"), request, None,
        session=SimpleNamespace(active_medication_name=None), history="",
    )
    assert response.intent == "CLINICAL_CASE_CLARIFICATION"
    assert response.answer_type == "clarification"
    assert request.state.workflow_route.reason_code == "managed_ambiguous_intent_fallback"


def test_intent_policy_has_executor_and_evidence_metadata_for_every_nlu_intent():
    from app.schemas.clinical_nlu import ClinicalNluExtraction
    policy = load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                              "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
    )
    live_intents = set(ClinicalNluExtraction.model_fields["intent"].annotation.__args__)
    assert live_intents.issubset(policy.routes)
    assert all(policy.routes[intent].executor_key and isinstance(policy.routes[intent].evidence_required, bool)
               for intent in live_intents)

@pytest.mark.asyncio
async def test_managed_drug_lookup_route_dispatches_to_database_lookup(monkeypatch):
    from unittest.mock import AsyncMock
    from fastapi import Request
    from app.schemas.copilot import CopilotQuery, CopilotResponse
    from app.services.chatbot import copilot_orchestrator
    from app.schemas.clinical_nlu import ClinicalNluExtraction

    nlu = ClinicalNluExtraction(
        intent="MEDICATION_LOOKUP", primary_drug="Paracetamol",
        requested_fields=["indications", "adult_dosage"],
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    lookup = AsyncMock(return_value=CopilotResponse(intent="MEDICATION_SAFETY_PROFILE", reply_text="profile"))
    monkeypatch.setattr(copilot_orchestrator, "lookup_drug_authoritative", lookup)
    request = Request({"type": "http", "method": "POST", "path": "/chat", "headers": [],
                       "query_string": b"", "server": ("test", 80), "client": ("test", 1), "scheme": "http"})
    request.scope["app"] = SimpleNamespace(state=SimpleNamespace(workflow_policy=load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi", "clinical_reasoning",
                              "sandwich", "specialty", "clarification", "multi_intent"},
    )))
    session = SimpleNamespace(active_medication_name=None)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Thông tin về Paracetamol"), request, None, session=session, history=""
    )

    assert response.answer_type == "safe_abstention"
    assert response.rag_grounded is False
    assert response.reply_text != "profile"
    lookup.assert_awaited_once()
    assert lookup.await_args.args[0] == "Thông tin về Paracetamol"
    assert lookup.await_args.kwargs["requested_fields"] == ["indications", "adult_dosage"]
    assert request.state.workflow_route.executor_key == "drug_lookup"

@pytest.mark.asyncio
async def test_managed_drug_lookup_route_uses_session_entity_for_contextual_followup(monkeypatch):
    from unittest.mock import AsyncMock
    from fastapi import Request
    from app.schemas.copilot import CopilotQuery, CopilotResponse
    from app.schemas.clinical_nlu import ClinicalNluExtraction
    from app.services.chatbot import copilot_orchestrator

    nlu = ClinicalNluExtraction(
        intent="MEDICATION_LOOKUP", primary_drug=None,
        conversation_mode="contextual_followup", is_deictic_referent=False,
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    lookup = AsyncMock(return_value=CopilotResponse(intent="MEDICATION_SAFETY_PROFILE", reply_text="profile"))
    monkeypatch.setattr(copilot_orchestrator, "lookup_drug_authoritative", lookup)
    request = Request({"type": "http", "method": "POST", "path": "/chat", "headers": [],
                       "query_string": b"", "server": ("test", 80), "client": ("test", 1), "scheme": "http"})
    request.scope["app"] = SimpleNamespace(state=SimpleNamespace(workflow_policy=load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi", "clinical_reasoning",
                              "sandwich", "specialty", "clarification", "multi_intent"},
    )))
    session = SimpleNamespace(active_medication_name="Paracetamol")

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="liều dùng thuốc đó"), request, None, session=session, history=""
    )

    assert response.answer_type == "safe_abstention"
    assert response.rag_grounded is False
    assert response.reply_text != "profile"
    assert lookup.await_args.args[0] == "liều dùng thuốc đó của thuốc Paracetamol"
