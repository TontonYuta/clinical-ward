import pytest
from pydantic import ValidationError

from app.services.chatbot.workflow_models import (
    ClinicalRequestContext,
    EvidenceRecord,
    EvidenceStatus,
    ExecutorResult,
    RouteDecision,
    ValidationStatus,
)


def test_factual_executor_result_cannot_be_verified_without_evidence():
    with pytest.raises(ValidationError):
        ExecutorResult(
            outcome_type="clinical_factual",
            evidence_status=EvidenceStatus.VERIFIED,
            validation_status=ValidationStatus.PASSED,
            response={"reply_text": "claim"},
        )


def test_verified_factual_result_requires_versioned_evidence_and_source_identity():
    evidence = EvidenceRecord(
        evidence_id="evidence-1",
        source_id="source-1",
        source_version="sha256:abc",
        content="source excerpt",
        chunk_id="chunk-1",
    )
    result = ExecutorResult(
        outcome_type="clinical_factual",
        evidence_status=EvidenceStatus.VERIFIED,
        validation_status=ValidationStatus.PASSED,
        response={"reply_text": "supported claim"},
        evidence=[evidence],
    )
    assert result.evidence[0].source_version == "sha256:abc"


def test_verified_factual_result_rejects_blank_evidence_version():
    for version in (" ​", "unversioned", "unknown"):
        evidence = EvidenceRecord(
            evidence_id="evidence-1", source_id="source-1",
            source_version=version, content="excerpt", chunk_id="chunk-1",
        )
        with pytest.raises(ValidationError):
            ExecutorResult(
                outcome_type="clinical_factual",
                evidence_status=EvidenceStatus.VERIFIED,
                validation_status=ValidationStatus.PASSED,
                response={"reply_text": "claim"}, evidence=[evidence],
            )


def test_operational_and_conversational_results_can_declare_evidence_not_applicable():
    for outcome in ("operational", "conversational"):
        result = ExecutorResult(
            outcome_type=outcome,
            evidence_status=EvidenceStatus.NOT_APPLICABLE,
            validation_status=ValidationStatus.NOT_REQUIRED,
            response={"reply_text": "ok"},
        )
        assert result.evidence == []


def test_request_context_preserves_original_and_rewritten_query_separately():
    context = ClinicalRequestContext(
        original_query="Thuốc này dùng sao?",
        normalized_query="thuốc này dùng sao",
        rewritten_query="Cách dùng thuốc X",
        history_reference="session:abc",
        user_role="doctor",
        patient_context_reference="patient:123",
    )
    assert context.original_query != context.rewritten_query
    assert context.normalized_query == "thuốc này dùng sao"


def test_route_decision_retains_executor_reason_and_required_entities():
    route = RouteDecision(
        intent="MEDICATION_LOOKUP",
        executor_key="medication_lookup",
        reason_code="structured_intent",
        required_entities=["medication"],
        evidence_required=True,
    )
    assert route.executor_key == "medication_lookup"
    assert route.required_entities == ["medication"]


def test_executor_result_can_be_converted_to_existing_api_response_without_contract_loss():
    from app.schemas.copilot import CopilotResponse

    result = ExecutorResult(
        outcome_type="clinical_factual",
        evidence_status=EvidenceStatus.VERIFIED,
        validation_status=ValidationStatus.PASSED,
        response={
            "intent": "CLINICAL_AI_CONSULTATION",
            "reply_text": "supported",
            "answer_type": "grounded_reference",
            "rag_grounded": True,
        },
        evidence=[EvidenceRecord(
            evidence_id="e1", source_id="s1", source_version="sha256:v1",
            content="excerpt", chunk_id="c1",
        )],
    )
    response = CopilotResponse(**result.response, evidence=[item.model_dump() for item in result.evidence])
    assert response.rag_grounded is True
    assert response.evidence[0]["source_id"] == "s1"
