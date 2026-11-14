import pytest
from pydantic import ValidationError

from app.schemas.copilot import AnswerClaim, CopilotResponse


def test_source_fact_claim_must_link_to_evidence():
    claim = AnswerClaim(
        claim_id="claim-1",
        text="The source records fact A.",
        claim_type="source_fact",
        evidence_ids=["evidence-a"],
        support_status="supported",
    )

    assert claim.evidence_ids == ["evidence-a"]


def test_evidence_inference_can_link_to_multiple_premises():
    claim = AnswerClaim(
        claim_id="claim-2",
        text="Taken together, the records imply conclusion B.",
        claim_type="evidence_inference",
        evidence_ids=["evidence-a", "evidence-b"],
        support_status="supported",
    )

    assert len(claim.evidence_ids) == 2


def test_unsupported_claim_cannot_be_marked_supported():
    with pytest.raises(ValidationError):
        AnswerClaim(
            claim_id="claim-3",
            text="Unsupported assertion.",
            claim_type="source_fact",
            evidence_ids=[],
            support_status="supported",
        )


def test_copilot_response_serializes_claims_and_support_map():
    response = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION",
        reply_text="The source records fact A.",
        claims=[AnswerClaim(
            claim_id="claim-1", text="The source records fact A.",
            claim_type="source_fact", evidence_ids=["evidence-a"],
            support_status="supported",
        )],
        evidence_claim_map={"evidence-a": ["claim-1"]},
    )

    serialized = response.model_dump()
    assert serialized["claims"][0]["evidence_ids"] == ["evidence-a"]
    assert serialized["evidence_claim_map"] == {"evidence-a": ["claim-1"]}


def test_database_source_claims_are_verbatim_and_bound_to_versioned_evidence():
    from app.services.copilot_drug_formatter import _evidence_claim_contract

    evidence = [{
        "evidence_id": "document:monograph:42:dose",
        "evidence_type": "document_chunk",
        "chunk_id": "monograph:42:dose",
        "source_id": "monograph:42",
        "source_version": "sha256:abc",
        "content": "Database field value",
    }]

    contract = _evidence_claim_contract(evidence)

    assert len(contract["claims"]) == 1
    assert contract["claims"][0].text == evidence[0]["content"]
    assert contract["claims"][0].claim_type == "source_fact"
    assert contract["claims"][0].support_status == "supported"
    assert contract["claims"][0].evidence_ids == [evidence[0]["evidence_id"]]
    assert contract["evidence_claim_map"] == {evidence[0]["evidence_id"]: [contract["claims"][0].claim_id]}


def test_database_source_claims_omit_missing_field_or_provenance():
    from app.services.copilot_drug_formatter import _evidence_claim_contract

    evidence = [
        {"evidence_id": "missing-version", "source_id": "monograph", "content": "value"},
        {"evidence_id": "empty-value", "source_id": "monograph", "source_version": "sha256:abc", "content": "  "},
    ]

    contract = _evidence_claim_contract(evidence)

    assert contract == {"claims": [], "evidence_claim_map": {}}


def test_database_claims_include_only_cited_facts_present_in_rendered_reply():
    from app.services.copilot_drug_formatter import _evidence_claim_contract

    evidence = [
        {"evidence_id": "indications", "evidence_type": "document_chunk", "chunk_id": "c1",
         "source_id": "dtqg", "source_version": "sha256:abc",
         "content": "Chỉ định một. Liều hai."},
        {"evidence_id": "unrequested-dose", "evidence_type": "document_chunk", "chunk_id": "c2",
         "source_id": "dtqg", "source_version": "sha256:abc",
         "content": "Liều không được hỏi."},
    ]

    contract = _evidence_claim_contract(
        evidence,
        reply_text="Chỉ định một.",
        cited_chunk_ids={"c1"},
    )

    assert [claim.text for claim in contract["claims"]] == ["Chỉ định một."]
    assert contract["evidence_claim_map"] == {"indications": [contract["claims"][0].claim_id]}


def test_database_field_keys_are_rendered_as_vietnamese_labels():
    from app.services.copilot_drug_lookup import _attach_database_claims

    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="**Tương tác thuốc:**\nNội dung đã được định dạng bằng tiếng Việt.",
        answer_type="medication_fields", rag_grounded=True,
        evidence=[{
            "evidence_id": "evidence-dose", "source_id": "dtqg",
            "source_version": "sha256:abc", "section": "adult_dosage",
            "content": "Liều dùng theo tài liệu nguồn.",
        }],
    )

    rendered = _attach_database_claims(response).reply_text

    assert rendered == response.reply_text
    assert "adult_dosage" not in rendered
