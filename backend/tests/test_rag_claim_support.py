from app.schemas.copilot import AnswerClaim
from app.services.rag.self_rag_verifier import verify_answer_claims


def _claim(text, evidence_ids=("doc:one",), claim_type="source_fact"):
    return AnswerClaim(
        claim_id="claim-1", text=text, claim_type=claim_type,
        evidence_ids=list(evidence_ids), support_status="insufficient_evidence",
    )


def _evidence(evidence_id, content, version="sha256:one"):
    return {
        "evidence_id": evidence_id, "evidence_type": "document_chunk",
        "source_id": "source-1", "source_version": version,
        "content": content,
    }


def test_verifies_claim_only_when_exact_claim_is_present_in_versioned_evidence():
    claim = _claim("The record states fact A.")
    result = verify_answer_claims([claim], [_evidence("doc:one", "The record states fact A.")])

    assert result["claims"][0].support_status == "supported"
    assert result["all_supported"] is True


def test_rejects_claim_with_unknown_evidence_reference():
    result = verify_answer_claims([_claim("Fact A", ("doc:unknown",))], [_evidence("doc:one", "Fact A")])

    assert result["claims"][0].support_status == "unsupported"
    assert result["all_supported"] is False


def test_partial_or_lexically_similar_claim_is_not_counted_as_supported():
    claim = _claim("The record states fact A and fact B.")
    result = verify_answer_claims([claim], [_evidence("doc:one", "The record states fact A.")])

    assert result["claims"][0].support_status != "supported"
    assert result["all_supported"] is False


def test_rejects_claim_with_quantity_or_unit_not_present_in_evidence():
    claim = _claim("The dose is 500 mg.")
    result = verify_answer_claims([claim], [_evidence("doc:one", "The dose is 500 mcg.")])

    assert result["claims"][0].support_status == "unsupported"


def test_patient_specific_inference_requires_semantic_review_and_is_not_auto_verified():
    claim = _claim("The patient is likely to benefit.", claim_type="evidence_inference")
    result = verify_answer_claims([claim], [_evidence("doc:one", "The record states fact A.")])

    assert result["claims"][0].support_status == "insufficient_evidence"
    assert result["all_supported"] is False


def test_missing_source_version_cannot_verify_a_claim():
    claim = _claim("The record states fact A.")
    result = verify_answer_claims([claim], [_evidence("doc:one", "The record states fact A.", version=None)])

    assert result["claims"][0].support_status == "insufficient_evidence"
    assert result["all_supported"] is False


def test_legacy_support_evaluator_does_not_treat_word_overlap_as_proof():
    from app.services.rag.self_rag_verifier import _evaluate_claim_support

    status, _ = _evaluate_claim_support(
        "Paracetamol dose is safe at 500 mg daily.",
        "Paracetamol dose is unsafe at 500 mg daily.",
        "paracetamol dose is unsafe at 500 mg daily",
    )

    assert status != "FULLY_SUPPORTED"
