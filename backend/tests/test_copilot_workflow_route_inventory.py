from app.services.rag.types import RagResult
from app.services.chatbot.multi_intent_handler import handle_multi_intent_chat
from app.services.chatbot import copilot_orchestrator
from app.schemas.copilot import CopilotQuery, CopilotResponse
from types import SimpleNamespace
import pytest
from app.services.chatbot.copilot_orchestrator import validate_response_evidence_contract
from app.services.session_context import get_or_create_session
from app.config import settings
from app.services.chatbot.workflow_policy import load_workflow_policy
from app.security.guardrails import GuardrailResult
from fastapi import Request
from unittest.mock import AsyncMock


def test_rag_result_starts_unverified_until_pipeline_validates_evidence():
    result = RagResult(query="dose?", answer="")

    assert result.rag_grounded is False
    assert result.confidence_score == 0.0
    assert result.critique_verdict == "NOT_RUN"
    assert result.to_response_dict()["rag_grounded"] is False


def test_portal_guidance_formats_live_catalog_counts():
    guidance = copilot_orchestrator._portal_guidance_text_with_counts(12, 34)

    assert "12 thuốc" in guidance
    assert "34 chuyên luận" in guidance
    assert "771" not in guidance


def test_unmatched_fallback_contains_no_inline_regulatory_or_drug_examples():
    import inspect
    source = inspect.getsource(copilot_orchestrator._handle_copilot_chat_core)

    assert "Clopidogrel + Omeprazol" not in source
    assert "TT 26, phác đồ phản vệ TT 51" not in source


@pytest.mark.asyncio
async def test_multi_intent_response_cannot_claim_grounding_without_linked_sources():
    async def core(payload, *_args, **_kwargs):
        return CopilotResponse(intent="CLINICAL", reply_text="fact", answer_type="grounded_reference", rag_grounded=True, citations=[{"chunk_id": "c1"}], evidence=[])

    session = SimpleNamespace(active_medication_name=None)
    response = await handle_multi_intent_chat(
        ["question one", "question two"], CopilotQuery(query="combined"), None, None,
        session=session, core_handler_fn=core,
    )

    assert response.rag_grounded is False
    assert response.confidence == 0.0
    assert response.abstention_reason


def test_factual_response_without_provenance_abstains_even_when_grounding_flag_is_false():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="unsupported dosage claim",
        answer_type="medication_profile", rag_grounded=False, confidence=0.8,
        citations=[{"source": "a title only"}], evidence=[],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False
    assert validated.confidence == 0.0
    assert "unsupported dosage claim" not in validated.reply_text


def test_versioned_medication_record_evidence_can_link_without_chunk_citation_id():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="source-backed medication profile",
        answer_type="medication_profile", rag_grounded=True, confidence=0.9,
        citations=[{"document_id": "dtqg-v2-2015", "source": "Dược thư Quốc gia", "chunk_id": "monograph:paracetamol"}],
        evidence=[{"evidence_type": "document_chunk", "chunk_id": "monograph:paracetamol",
                   "source_id": "data/knowledge_base/dtqg_monographs_extracted.json",
                   "source_version": "sha256:source-digest", "content": "Supported excerpt"}],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.rag_grounded is False
    assert validated.answer_type == "safe_abstention"


def test_source_resolver_prefers_direct_active_ingredient_over_brand_token_collision():
    from app.services.rag.source_resolver import find_monograph_for_query
    records = {
        "paracetamol": {"inn": "Paracetamol", "id": "paracetamol-record"},
        "yspporo suppository": {"inn": "Paracetamol", "id": "brand-record"},
    }
    token_map = {"paracetamol": records["yspporo suppository"]}

    result = find_monograph_for_query("YSPPoro suppository 125 mg Paracetamol", records, token_map)

    assert result["id"] == "paracetamol-record"


def test_factual_response_with_evidence_but_failed_validation_replaces_draft_text():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="unvalidated clinical draft",
        answer_type="medication_profile", rag_grounded=False, confidence=0.8,
        citations=[{"chunk_id": "chunk-a"}],
        evidence=[{"evidence_type": "document_chunk", "chunk_id": "chunk-a",
                   "source_id": "source-a", "source_version": "sha256:abc",
                   "content": "source excerpt"}],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.confidence == 0.0
    assert "unvalidated clinical draft" not in validated.reply_text


def test_factual_response_labeled_safe_abstention_removes_unverified_draft():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="unverified medical draft",
        answer_type="safe_abstention", rag_grounded=False, confidence=0.0,
        source_status="evidence_provenance_missing", citations=[{"chunk_id": "unlinked"}],
        claims=[{"claim_id": "unverified", "text": "unverified medical draft", "claim_type": "source_fact",
                 "evidence_ids": ["missing"], "support_status": "insufficient_evidence"}],
        evidence_claim_map={"missing": ["unverified"]},
    )
    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.citations == []
    assert validated.rag_grounded is False
    assert validated.claims == []
    assert validated.evidence_claim_map == {}


def test_factual_refusal_text_cannot_be_marked_grounded_by_attached_monograph_evidence():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="Không thể xác minh nguồn hiện hành cho nội dung chuyên khoa này; vui lòng đối chiếu tài liệu đã được phê duyệt.",
        answer_type="medication_profile", rag_grounded=True, confidence=0.0,
        citations=[{"chunk_id": "monograph:generic:profile"}],
        evidence=[{"evidence_type": "document_chunk", "chunk_id": "monograph:generic:profile",
                   "source_id": "source", "source_version": "sha256:source", "content": "monograph facts"}],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False
    assert validated.confidence == 0.0
    assert validated.citations == []
    assert validated.evidence == []


def test_operational_response_is_not_reclassified_as_unverified_clinical_fact():
    response = CopilotResponse(
        intent="CHECK_INVENTORY", reply_text="Stock is 12",
        answer_type="operational_result", rag_grounded=False,
    )

    validated = validate_response_evidence_contract(response)

    assert validated.reply_text == "Stock is 12"
    assert validated.answer_type == "operational_result"


def test_document_evidence_requires_matching_citation_chunk():
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="claim",
        answer_type="grounded_reference", rag_grounded=True,
        citations=[{"chunk_id": "chunk-a"}],
        evidence=[{"evidence_type": "document_chunk", "chunk_id": "chunk-b",
                   "source_id": "source", "source_version": "v1", "content": "text"}],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.confidence == 0.0


def test_unversioned_curated_graph_is_not_accepted_as_source_provenance():
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="claim",
        answer_type="grounded_reference", rag_grounded=True,
        evidence=[{"evidence_type": "knowledge_graph", "source_id": "curated-graph",
                   "source_version": "unversioned", "content": "relation"}],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.confidence == 0.0


def test_valid_retrieved_document_evidence_keeps_grounded_response():
    evidence = {
        "evidence_type": "document_chunk", "evidence_id": "document:chunk-a", "chunk_id": "chunk-a",
        "source_id": "guideline", "source_version": "sha256:version",
        "content": "Retrieved source excerpt",
    }
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="Retrieved source excerpt supports this.",
        answer_type="grounded_reference", rag_grounded=True, confidence=0.82,
        citations=[{"chunk_id": "chunk-a"}], evidence=[evidence],
        claims=[{"claim_id": "claim-a", "text": "Retrieved source excerpt",
                 "claim_type": "source_fact", "evidence_ids": ["document:chunk-a"],
                 "support_status": "supported"}],
        evidence_claim_map={"document:chunk-a": ["claim-a"]},
    )

    validated = validate_response_evidence_contract(response)

    assert validated.rag_grounded is True
    assert validated.reply_text == "Retrieved source excerpt supports this."


def test_common_gate_rejects_citation_only_response_without_verified_claims():
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="claim",
        answer_type="grounded_reference", rag_grounded=True, confidence=0.9,
        citations=[{"chunk_id": "chunk-a"}],
        evidence=[{"evidence_type": "document_chunk", "evidence_id": "document:chunk-a",
                   "chunk_id": "chunk-a", "source_id": "source", "source_version": "sha256:v1",
                   "content": "claim"}],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False
    assert validated.confidence == 0.0


def test_common_gate_rejects_inference_claim_without_semantic_verifier():
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="**Chỉ mang tính tham khảo.** Inference",
        answer_type="grounded_reference", rag_grounded=True, confidence=0.9,
        citations=[{"chunk_id": "chunk-a"}],
        evidence=[{"evidence_type": "document_chunk", "evidence_id": "document:chunk-a",
                   "chunk_id": "chunk-a", "source_id": "source", "source_version": "sha256:v1",
                   "content": "Premise"}],
        claims=[{"claim_id": "claim-i", "text": "Inference", "claim_type": "evidence_inference",
                 "evidence_ids": ["document:chunk-a"], "support_status": "supported"}],
        evidence_claim_map={"document:chunk-a": ["claim-i"]},
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False


def test_common_gate_requires_claim_to_citation_mapping():
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="Source fact.",
        answer_type="grounded_reference", rag_grounded=True, confidence=0.9,
        citations=[{"chunk_id": "chunk-a"}],
        evidence=[{"evidence_type": "document_chunk", "evidence_id": "document:chunk-a",
                   "chunk_id": "chunk-a", "source_id": "source", "source_version": "sha256:v1",
                   "content": "Source fact."}],
        claims=[{"claim_id": "claim-a", "text": "Source fact.", "claim_type": "source_fact",
                 "evidence_ids": ["document:chunk-a"], "support_status": "supported"}],
        evidence_claim_map={},
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False


def test_common_gate_requires_claim_evidence_to_have_a_returned_citation():
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="Source fact.",
        answer_type="grounded_reference", rag_grounded=True, confidence=0.9,
        citations=[{"chunk_id": "different-chunk"}],
        evidence=[{"evidence_type": "document_chunk", "evidence_id": "document:chunk-a",
                   "chunk_id": "chunk-a", "source_id": "source", "source_version": "sha256:v1",
                   "content": "Source fact."}],
        claims=[{"claim_id": "claim-a", "text": "Source fact.", "claim_type": "source_fact",
                 "evidence_ids": ["document:chunk-a"], "support_status": "supported"}],
        evidence_claim_map={"document:chunk-a": ["claim-a"]},
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False


@pytest.mark.parametrize("intent", [
    "CLINICAL_ALLERGY_CDSS", "CLINICAL_DDI_INTERACTION_LOOKUP", "CLINICAL_PEDIATRIC_GUIDANCE",
])
def test_clinical_fact_intents_cannot_bypass_the_claim_gate(intent):
    response = CopilotResponse(
        intent=intent, reply_text="Unsupported clinical assertion",
        answer_type="grounded_reference", rag_grounded=True, confidence=0.9,
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False


@pytest.mark.parametrize("intent,answer_type", [
    ("GENERAL_CLINICAL_ASSISTANCE", "grounded_reference"),
    ("CLINICAL_AI_CONSULTATION", "guideline"),
    ("CLINICAL_AI_CONSULTATION", "cdss_alert"),
])
def test_unverified_clinical_guidance_and_alert_types_cannot_bypass_claim_gate(intent, answer_type):
    response = CopilotResponse(
        intent=intent, reply_text="Unsupported clinical assertion",
        answer_type=answer_type, rag_grounded=True, confidence=0.9,
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False


def _request_with_authenticated_user():
    request = Request({"type": "http", "method": "POST", "path": "/chat",
                      "headers": [], "query_string": b"", "server": ("test", 80),
                      "client": ("test", 1), "scheme": "http"})
    request.state.authenticated_user = SimpleNamespace(username="tester", role="doctor")
    request.scope["app"] = SimpleNamespace(state=SimpleNamespace(workflow_policy=load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                              "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
    )))
    return request


def _session():
    def _set_comparison_drugs(_drugs):
        return None

    return SimpleNamespace(
        session_id="tester:session", active_medication_name=None,
        set_active_medication=lambda **_kwargs: None, set_comparison_drugs=_set_comparison_drugs,
    )


def _real_session():
    return get_or_create_session("workflow-route-test-session", "tester", "doctor")


@pytest.mark.asyncio
async def test_image_route_precedes_nlu_and_returns_multimodal_executor_result(monkeypatch):
    from app.services import llm_provider

    vision = AsyncMock(return_value={"is_clinical": False, "category": "NON_CLINICAL",
                                     "reply_markdown": "out of scope"})
    nlu = AsyncMock(side_effect=AssertionError("text NLU must not run for image route"))
    monkeypatch.setattr(llm_provider, "query_clinical_multimodal_chat", vision)
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", nlu)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="analyze attachment", image_base64="encoded"),
        _request_with_authenticated_user(), None, session=_session(), history="",
    )

    assert response.intent == "MULTIMODAL_CLINICAL_VISION"
    assert response.answer_type == "safe_abstention"
    vision.assert_awaited_once()
    nlu.assert_not_awaited()


@pytest.mark.asyncio
async def test_prescription_block_route_precedes_multi_intent_decomposition(monkeypatch):
    nlu = SimpleNamespace(is_prescription_block=True, prescription_lines=["raw row"],
                          sub_queries=["part one", "part two"])
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu",
                        AsyncMock(return_value=nlu))
    handler = AsyncMock(return_value=CopilotResponse(intent="PRESCRIPTION_AUDIT", reply_text="abstain"))
    monkeypatch.setattr("app.services.chatbot.prescription_block_handler.handle_prescription_block_audit", handler)
    multi = AsyncMock(side_effect=AssertionError("prescription route has precedence"))
    monkeypatch.setattr("app.services.chatbot.multi_intent_handler.handle_multi_intent_chat", multi)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="raw prescription"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response.intent == "PRESCRIPTION_AUDIT"
    handler.assert_awaited_once()
    multi.assert_not_awaited()


@pytest.mark.asyncio
async def test_input_guardrail_terminates_before_image_or_nlu(monkeypatch):
    blocked = GuardrailResult(
        is_safe=False, violation_type="prompt_injection", threat_description="blocked",
        sanitized_query="unsafe", safe_response="blocked safely",
    )
    monkeypatch.setattr(copilot_orchestrator, "validate_input_guardrail", lambda *_args, **_kwargs: blocked)
    vision = AsyncMock(side_effect=AssertionError("guardrail must run before vision"))
    monkeypatch.setattr("app.services.llm_provider.query_clinical_multimodal_chat", vision)
    nlu = AsyncMock(side_effect=AssertionError("guardrail must run before NLU"))
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", nlu)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="unsafe input", image_base64="image"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response.intent == "SECURITY_GUARDRAIL_BLOCKED"
    assert response.reply_text == "blocked safely"
    vision.assert_not_awaited()
    nlu.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("intent", "expected"),
    [
        ("CAPABILITY_OPENING", "CAPABILITY_OPENING"),
        ("CONVERSATIONAL_FEEDBACK", "CONVERSATIONAL_FEEDBACK"),
        ("GREETING_WELLBEING", "GREETING_WELLBEING"),
    ],
)
async def test_nlu_conversational_intents_take_their_early_route(monkeypatch, intent, expected):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False, intent=intent,
        out_of_scope_type=None, primary_drug=None,
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu",
                        AsyncMock(return_value=nlu))
    routed = CopilotResponse(intent=expected, reply_text="conversation")
    if intent == "CAPABILITY_OPENING":
        monkeypatch.setattr("app.services.chatbot.conversational_steering.handle_capability_opening",
                            lambda **_kwargs: routed)
    else:
        monkeypatch.setattr(copilot_orchestrator, "handle_greeting_and_acknowledgment",
                            lambda *_args: routed)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="plain conversational input"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response.intent == expected


@pytest.mark.asyncio
async def test_multi_intent_route_precedes_topic_rewrite(monkeypatch):
    nlu = SimpleNamespace(is_prescription_block=False, sub_queries=["one part question", "another question"],
                          is_topic_shift=False)
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu",
                        AsyncMock(return_value=nlu))
    child = CopilotResponse(intent="CLINICAL_SAFE_ABSTENTION", reply_text="clarify")
    handler = AsyncMock(return_value=child)
    monkeypatch.setattr("app.services.chatbot.multi_intent_handler.handle_multi_intent_chat", handler)
    rewrite = AsyncMock(side_effect=AssertionError("multi-intent terminates before rewrite"))
    monkeypatch.setattr("app.services.rag.query_rewriter.rewrite_clinical_query", rewrite)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="two independent questions"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response is child
    handler.assert_awaited_once()
    rewrite.assert_not_awaited()


@pytest.mark.asyncio
async def test_nlu_unavailable_uses_managed_clarification_without_rewrite(monkeypatch):
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu",
                        AsyncMock(return_value=None))
    rewrite = AsyncMock(side_effect=AssertionError("NLU outage uses managed clarification without a second classifier"))
    monkeypatch.setattr("app.services.rag.query_rewriter.rewrite_clinical_query", rewrite)
    monkeypatch.setattr("app.services.clinical_reasoning.patient_dose_reasoner.evaluate_patient_dose_reasoning",
                        AsyncMock(return_value=None))
    monkeypatch.setattr(copilot_orchestrator, "check_renal_adjustment_request", lambda *_args, **_kwargs: None)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Tôi bị sốt và đau đầu"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response.intent == "CLINICAL_CASE_CLARIFICATION"
    assert response.answer_type == "clarification"
    rewrite.assert_not_awaited()


@pytest.mark.asyncio
async def test_nlu_outage_returns_managed_neutral_clarification_without_other_classifier(monkeypatch):
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=None))
    rewrite = AsyncMock(side_effect=AssertionError("managed fallback must not run another intent classifier"))
    monkeypatch.setattr("app.services.rag.query_rewriter.rewrite_clinical_query", rewrite)
    request = _request_with_authenticated_user()

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="arbitrary question"), request, None, session=_session(), history="",
    )

    assert response.intent == "CLINICAL_CASE_CLARIFICATION"
    assert response.answer_type == "clarification"
    assert response.rag_grounded is False
    assert request.state.workflow_route.reason_code == "managed_nlu_unavailable_fallback"
    rewrite.assert_not_awaited()


@pytest.mark.asyncio
async def test_interaction_check_route_precedes_generic_lookup(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False,
        intent="MEDICATION_INTERACTION_CHECK", primary_drug="Warfarin",
        secondary_drug="Aspirin", additional_drugs=[],
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    ddi = CopilotResponse(intent="CLINICAL_SAFE_ABSTENTION", reply_text="need source")
    formatter = lambda *_args, **_kwargs: ddi
    monkeypatch.setattr("app.services.clinical_ddi_engine.multi_drug_matrix.format_multi_ddi_response", formatter)
    monkeypatch.setattr("app.services.chatbot.multi_intent_handler.handle_multi_intent_chat", AsyncMock(side_effect=AssertionError("wrong route")))

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Warfarin và Aspirin"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response is ddi
    assert response is ddi


@pytest.mark.asyncio
async def test_patient_counseling_route_uses_sandwich_executor(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False,
        intent="PATIENT_MEDICATION_COUNSELING", primary_drug="Coversyl",
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    counseling = CopilotResponse(intent="PATIENT_MEDICATION_COUNSELING", reply_text="need evidence")
    sandwich = AsyncMock(return_value=counseling)
    monkeypatch.setattr("app.services.chatbot.sandwich_pipeline.execute_clinical_sandwich_pipeline", sandwich)
    monkeypatch.setattr(copilot_orchestrator, "execute_clinical_sandwich_pipeline", sandwich)
    monkeypatch.setattr("app.services.clinical_reasoning.patient_dose_reasoner.evaluate_patient_dose_reasoning",
                        AsyncMock(return_value=None))
    rewrite = AsyncMock(return_value=SimpleNamespace(rewritten_query="Dặn bệnh nhân cách uống Coversyl"))
    monkeypatch.setattr("app.services.rag.query_rewriter.rewrite_clinical_query", rewrite)
    monkeypatch.setattr(copilot_orchestrator, "check_renal_adjustment_request", lambda *_args, **_kwargs: None)
    monkeypatch.setattr("app.services.chatbot.multiturn_handler.resolve_active_drug_and_terms",
                        AsyncMock(return_value=("Dặn bệnh nhân cách uống Coversyl", "dặn bệnh nhân cách uống coversyl", False, False, False, None)))
    monkeypatch.setattr("app.services.chatbot.fsm_router.route_fsm_context", AsyncMock(return_value=None))

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Dặn bệnh nhân cách uống Coversyl"), _request_with_authenticated_user(), None,
        session=_real_session(), history="",
    )

    assert response is counseling
    sandwich.assert_awaited_once()


@pytest.mark.asyncio
async def test_specialty_protocol_route_attempts_authorized_subflow_before_registry(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False,
        intent="SPECIALTY_CLINICAL_PROTOCOL", primary_drug=None,
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    subflow = CopilotResponse(intent="SPECIALTY_CLINICAL_PROTOCOL", reply_text="need evidence")
    dispatch = AsyncMock(return_value=subflow)
    monkeypatch.setattr(copilot_orchestrator, "dispatch_clinical_subflows", dispatch)
    monkeypatch.setattr("app.services.chatbot.conversational_clinical_engine.find_clinical_specialty_consultation",
                        lambda *_args: {"specialty": "should not override returned subflow"})
    synth = AsyncMock(side_effect=AssertionError("specialty synthesis must not run after returned subflow"))
    monkeypatch.setattr("app.services.chatbot.conversational_clinical_engine.synthesize_specialty_response", synth)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Quy chế thuốc gây nghiện"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response is subflow
    dispatch.assert_awaited_once()
    synth.assert_not_awaited()


@pytest.mark.asyncio
async def test_specialty_registry_is_fallback_after_subflow_returns_none(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False,
        intent="SPECIALTY_CLINICAL_PROTOCOL", primary_drug=None,
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    dispatch = AsyncMock(return_value=None)
    monkeypatch.setattr(copilot_orchestrator, "dispatch_clinical_subflows", dispatch)
    artifact = {"id": "artifact"}
    monkeypatch.setattr("app.services.chatbot.conversational_clinical_engine.find_clinical_specialty_consultation",
                        lambda *_args: artifact)
    expected = CopilotResponse(intent="SPECIALTY_CLINICAL_PROTOCOL", reply_text="source-gated result")
    synth = AsyncMock(return_value=expected)
    monkeypatch.setattr("app.services.chatbot.conversational_clinical_engine.synthesize_specialty_response", synth)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Quy chế thuốc gây nghiện"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response is expected
    dispatch.assert_awaited_once()
    synth.assert_awaited_once()


@pytest.mark.asyncio
async def test_interaction_clarification_route_precedes_generic_nlu_fallthrough(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False,
        intent="MEDICATION_INTERACTION_CLARIFICATION",
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    result = CopilotResponse(intent="MEDICATION_LOOKUP_CLARIFICATION", reply_text="name both medicines")
    clarification = AsyncMock(return_value=result)
    monkeypatch.setattr(copilot_orchestrator, "handle_interaction_clarification", clarification)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Tương tác thuốc thế nào?"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response is result
    clarification.assert_awaited_once()


@pytest.mark.asyncio
async def test_nlu_out_of_scope_uses_steering_executor(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False,
        intent="OUT_OF_SCOPE", out_of_scope_type="MATH_LOGIC",
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    expected = CopilotResponse(intent="OUT_OF_SCOPE", reply_text="outside domain")
    steering = lambda *_args, **_kwargs: expected
    monkeypatch.setattr("app.services.chatbot.conversational_steering.handle_gentle_chitchat_steering", steering)

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="out of domain question"), _request_with_authenticated_user(), None,
        session=_session(), history="",
    )

    assert response is expected


@pytest.mark.asyncio
async def test_patient_dose_reasoner_preempts_generic_lookup_when_it_returns_result(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False,
        intent="PATIENT_CASE_REASONING", primary_drug="Ciprofloxacin",
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    expected = CopilotResponse(intent="CLINICAL_SAFE_ABSTENTION", reply_text="insufficient patient facts")
    reasoner = AsyncMock(return_value=expected)
    monkeypatch.setattr("app.services.clinical_reasoning.patient_dose_reasoner.evaluate_patient_dose_reasoning", reasoner)
    monkeypatch.setattr(copilot_orchestrator, "lookup_drug_authoritative",
                        AsyncMock(side_effect=AssertionError("patient-dose route is terminal when it returns a result")))

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Bệnh nhân 45 tuổi Ciprofloxacin"), _request_with_authenticated_user(), None,
        session=_real_session(), history="",
    )

    assert response is expected
    reasoner.assert_awaited_once()


def test_document_evidence_rejects_empty_or_placeholder_versions():
    for version in (None, "", "unversioned", "unknown"):
        response = CopilotResponse(
            intent="CLINICAL_AI_CONSULTATION", reply_text="claim",
            answer_type="grounded_reference", rag_grounded=True,
            citations=[{"chunk_id": "chunk-a"}],
            evidence=[{"evidence_type": "document_chunk", "chunk_id": "chunk-a",
                       "source_id": "guide", "source_version": version, "content": "excerpt"}],
        )

        validated = validate_response_evidence_contract(response)

        assert validated.answer_type == "safe_abstention"


def test_document_evidence_requires_source_identity_and_content():
    for source_id, content in (("", "excerpt"), ("source", "")):
        response = CopilotResponse(
            intent="CLINICAL_AI_CONSULTATION", reply_text="claim",
            answer_type="grounded_reference", rag_grounded=True,
            citations=[{"chunk_id": "chunk-a"}],
            evidence=[{"evidence_type": "document_chunk", "chunk_id": "chunk-a",
                       "source_id": source_id, "source_version": "v1", "content": content}],
        )

        validated = validate_response_evidence_contract(response)

        assert validated.answer_type == "safe_abstention"




def test_cached_factual_response_is_revalidated_including_claim_evidence_link():
    from app.routers.copilot import validate_cached_chat_response
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="Cached unsupported claim",
        answer_type="grounded_reference", rag_grounded=True,
        citations=[{"chunk_id": "old-chunk"}], evidence=[],
    )

    validated = validate_cached_chat_response(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.confidence == 0.0


def test_cached_response_revalidation_does_not_add_synthetic_source_citation():
    from app.routers.copilot import validate_cached_chat_response
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION", reply_text="Unverified",
        answer_type="safe_abstention", legal_basis="Dược thư Quốc gia", citations=[],
    )

    validated = validate_cached_chat_response(response)

    assert validated.citations == []


@pytest.mark.asyncio
async def test_explicit_current_turn_drug_overrides_session_drug(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=True,
        intent="MEDICATION_LOOKUP", primary_drug="Paracetamol", is_deictic_referent=False,
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    session = _real_session()
    session.set_active_medication("Coversyl")
    rewrite = AsyncMock(return_value=SimpleNamespace(rewritten_query="Thông tin thuốc Paracetamol"))
    monkeypatch.setattr("app.services.rag.query_rewriter.rewrite_clinical_query", rewrite)
    monkeypatch.setattr("app.services.clinical_reasoning.patient_dose_reasoner.evaluate_patient_dose_reasoning",
                        AsyncMock(return_value=None))
    monkeypatch.setattr(copilot_orchestrator, "check_renal_adjustment_request", lambda *_args, **_kwargs: None)
    resolve = AsyncMock(return_value=("Thông tin thuốc Paracetamol", "thông tin thuốc paracetamol", False, True, True, None))
    monkeypatch.setattr(copilot_orchestrator, "resolve_active_drug_and_terms", resolve)
    monkeypatch.setattr("app.services.chatbot.fsm_router.route_fsm_context", AsyncMock(return_value=None))
    lookup = AsyncMock(return_value=CopilotResponse(intent="MEDICATION_SAFETY_PROFILE", reply_text="draft"))
    monkeypatch.setattr(copilot_orchestrator, "lookup_drug_authoritative", lookup)
    monkeypatch.setattr(copilot_orchestrator, "handle_field_or_drug_inquiry", AsyncMock(return_value=None))
    monkeypatch.setattr(copilot_orchestrator, "dispatch_clinical_subflows", AsyncMock(return_value=None))
    monkeypatch.setattr("app.services.chatbot.conversational_clinical_engine.find_clinical_specialty_consultation", lambda *_args: None)
    monkeypatch.setattr("app.services.copilot_gemini_scenarios.detect_and_handle_gemini_clinical_scenario", AsyncMock(return_value=None))
    monkeypatch.setattr("app.services.chatbot.pure_rag_handler.handle_contextual_rag_followup", AsyncMock(return_value=None))
    monkeypatch.setattr(copilot_orchestrator, "dispatch_operational_business", AsyncMock(return_value=None))
    monkeypatch.setattr("app.services.chatbot.pure_rag_handler.handle_deep_rag_consultation", AsyncMock(return_value=None))

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Thông tin thuốc Paracetamol"), _request_with_authenticated_user(), None,
        session=session, history="",
    )

    assert response.intent == "MEDICATION_SAFETY_PROFILE"
    assert session.active_medication_name == "Paracetamol"
    lookup.assert_awaited_once()


@pytest.mark.asyncio
async def test_orchestrator_exposes_single_route_context_and_decision_on_request_state(monkeypatch):
    nlu = SimpleNamespace(
        is_prescription_block=False, sub_queries=[], is_topic_shift=False,
        intent="CAPABILITY_OPENING", primary_drug=None,
    )
    monkeypatch.setattr("app.services.chatbot.gemini_nlu_router.parse_clinical_nlu", AsyncMock(return_value=nlu))
    monkeypatch.setattr("app.services.chatbot.conversational_steering.handle_capability_opening",
                        lambda **_kwargs: CopilotResponse(intent="CAPABILITY_OPENING", reply_text="capability"))
    request = _request_with_authenticated_user()

    response = await copilot_orchestrator._handle_copilot_chat_core(
        CopilotQuery(query="Bạn hỗ trợ tra cứu thuốc được không"), request, None,
        session=_session(), history="",
    )

    assert response.intent == "CAPABILITY_OPENING"
    assert request.state.workflow_context.original_query == "Bạn hỗ trợ tra cứu thuốc được không"
    assert request.state.workflow_context.rewritten_query is None
    assert request.state.workflow_route.intent == "CAPABILITY_OPENING"



def test_medication_profile_evidence_links_database_monograph_to_document_citation():
    from app.services.chatbot.conversational_clinical_engine import _link_medication_profile_evidence

    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="Dose from monograph",
        answer_type="medication_field", rag_grounded=True, confidence=1.0,
        citations=[{"document_id": "dtqg-v2-2015", "section": "Paracetamol", "page": 1118}],
    )
    monograph = SimpleNamespace(
        id="paracetamol", inn="Paracetamol", title="PARACETAMOL (Acetaminophen)",
        source_id="data/knowledge_base/dtqg_monographs_extracted.json",
        source_version="sha256:source", source="Dược thư Quốc gia", adult_dosage="Dose excerpt",
    )

    linked = _link_medication_profile_evidence(response, monograph)
    validated = validate_response_evidence_contract(linked)

    assert validated.rag_grounded is False
    assert validated.answer_type == "safe_abstention"
    assert validated.citations == []
    assert validated.evidence == []


def test_monograph_linking_does_not_promote_an_abstention():
    from app.services.chatbot.conversational_clinical_engine import _link_medication_profile_evidence

    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="Unverified response",
        answer_type="safe_abstention", rag_grounded=False, confidence=0.0,
    )
    monograph = SimpleNamespace(
        id="record", source_id="source", source_version="sha256:source",
        title="Monograph", adult_dosage="Dose",
    )

    linked = _link_medication_profile_evidence(response, monograph)

    assert linked.answer_type == "safe_abstention"
    assert linked.rag_grounded is False
    assert linked.citations == []
    assert linked.evidence == []

@pytest.mark.asyncio
async def test_database_driven_medication_lookup_produces_versioned_citation_and_evidence():
    from app.database import AsyncSessionLocal
    from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic
    from app.services.chatbot.adaptive_drug_slicer import slice_clinical_drug_evidence
    from app.services.chatbot.adaptive_clinical_synthesizer import synthesize_adaptive_clinical_response

    async with AsyncSessionLocal() as db:
        session = _real_session()
        analysis = extract_clinical_query_schema_deterministic(
            "Thông tin Paracetamol", session_context={"active_medication": "Paracetamol"}
        )
        sliced, _, status = await slice_clinical_drug_evidence(analysis, db, session)

    assert status == "ok"
    response = synthesize_adaptive_clinical_response(sliced, session_id=session.session_id)
    response = validate_response_evidence_contract(response)

    assert response.answer_type == "safe_abstention"
    assert response.rag_grounded is False
    assert response.citations == []
    assert response.evidence == []

@pytest.mark.asyncio
async def test_medication_lookup_without_source_provenance_remains_unverified():
    from app.database import AsyncSessionLocal
    from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic
    from app.services.chatbot.adaptive_drug_slicer import slice_clinical_drug_evidence
    from app.services.chatbot.adaptive_clinical_synthesizer import synthesize_adaptive_clinical_response

    async with AsyncSessionLocal() as db:
        session = _real_session()
        analysis = extract_clinical_query_schema_deterministic(
            "Thông tin Paracetamol", session_context={"active_medication": "Paracetamol"}
        )
        sliced, _, status = await slice_clinical_drug_evidence(analysis, db, session)
    assert status == "ok"
    for item in sliced.evidence:
        if item.get("source_id") == sliced.monograph.source_id:
            item["source_version"] = None
    response = synthesize_adaptive_clinical_response(sliced, session_id=session.session_id)
    validated = validate_response_evidence_contract(response)
    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False


def test_legacy_source_document_fallback_does_not_establish_linked_evidence():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="unsupported statement",
        answer_type="medication_profile", rag_grounded=True, confidence=1.0,
        citations=[{"document_id": "dtqg-v2-2015", "page": 12}],
        evidence=[{
            "evidence_type": "document_chunk",
            "source_id": "path/dtqg_monographs_extracted.json",
            "source_version": "sha256:version",
            "chunk_id": "unlinked",
            "content": "unrelated content",
        }],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.rag_grounded is False
    assert validated.answer_type == "safe_abstention"
    assert validated.source_status == "evidence_validation_failed"
