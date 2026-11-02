from app.services.chatbot.evaluation import evaluate_response_components


def test_grounded_clarification_is_not_failed_for_missing_keyword_match():
    result = evaluate_response_components(
        response={"intent": "MEDICATION_LOOKUP_CLARIFICATION", "answer_type": "clarification",
                  "reply_text": "Vui lòng nêu hoạt chất hoặc tên thuốc cần tra cứu.", "citations": []},
        expected_entities=["lithium"], expected_citations=True,
    )
    assert result["safe_behavior"] is True
    assert result["entity_correct"] is False
    assert result["overall_pass"] is True


def test_irrelevant_citation_does_not_count_as_evidence_support():
    result = evaluate_response_components(
        response={"intent": "MEDICATION_SAFETY_PROFILE", "answer_type": "grounded_reference",
                  "reply_text": "Paracetamol: dose guidance",
                  "citations": [{"source": "Unrelated document", "excerpt": "Ceftriaxone monograph"}]},
        expected_entities=["paracetamol"], expected_citations=True,
    )
    assert result["citation_present"] is True
    assert result["citation_relevant"] is False
    assert result["evidence_supported"] is False
    assert result["overall_pass"] is False


def test_supported_alias_counts_as_entity_resolution():
    result = evaluate_response_components(
        response={"intent": "MEDICATION_SAFETY_PROFILE", "answer_type": "grounded_reference",
                  "reply_text": "Coumadin monitoring",
                  "citations": [{"source": "Warfarin monograph", "excerpt": "INR monitoring"}]},
        expected_entities=["warfarin"], entity_aliases={"warfarin": ["coumadin", "marevan"]},
        expected_citations=True,
    )
    assert result["entity_correct"] is True
    assert result["citation_relevant"] is True


def test_critical_cross_drug_leak_fails_even_if_expected_entity_is_present():
    result = evaluate_response_components(
        response={"intent": "MEDICATION_SAFETY_PROFILE", "answer_type": "grounded_reference",
                  "reply_text": "Warfarin; unrelated Ceftriaxone dose",
                  "citations": [{"source": "Warfarin monograph", "excerpt": "INR"}]},
        expected_entities=["warfarin"], forbidden_entities=["ceftriaxon"],
    )
    assert result["critical_entity_leak"] is True
    assert result["overall_pass"] is False


def test_stale_entity_is_a_critical_leak_when_subject_was_switched():
    result = evaluate_response_components(
        response={"answer_type": "grounded_reference",
                  "reply_text": "Cefotaxim renal adjustment; Ceftriaxon was discussed earlier",
                  "citations": [{"source": "Cefotaxim monograph", "excerpt": "Cefotaxim"}]},
        expected_entities=["cefotaxim"], forbidden_entities=["ceftriaxon"],
    )
    assert result["critical_entity_leak"] is True
    assert result["overall_pass"] is False
