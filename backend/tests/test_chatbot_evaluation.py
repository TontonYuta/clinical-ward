from app.services.rag.evaluate_chatbot import evaluate_chatbot_sync


def test_chatbot_evaluation_dataset_has_cases_for_required_risk_classes():
    report = evaluate_chatbot_sync()
    categories = {case["category"] for case in report["cases"]}
    assert {"greeting", "ambiguous_interaction", "missing_entity", "missing_case_context", "out_of_scope", "security"} <= categories
    assert report["case_count"] >= 10
    assert report["candidate_unreviewed_count"] == report["case_count"]


def test_chatbot_evaluation_fails_regression_instead_of_reporting_metrics_only():
    report = evaluate_chatbot_sync()
    failures = [case for case in report["cases"] if not case["passed"]]
    assert not failures, failures


def test_out_of_scope_question_is_not_answered_from_incidentally_retrieved_chunks():
    report = evaluate_chatbot_sync()
    case = next(item for item in report["cases"] if item["id"] == "out_of_scope_weather")
    assert case["actual_intent"] == "CLINICAL_SAFE_ABSTENTION"
    assert case["actual_grounded"] is False
    assert case["citation_count"] == 0


def test_interaction_question_without_two_medicines_asks_for_clarification():
    report = evaluate_chatbot_sync()
    case = next(item for item in report["cases"] if item["id"] == "ddi_no_drugs")
    assert case["actual_intent"] == "MEDICATION_INTERACTION_CLARIFICATION"
    assert case["actual_answer_type"] == "clarification"


def test_clinical_indication_question_is_not_sent_to_unrelated_patient_scenario():
    report = evaluate_chatbot_sync()
    case = next(item for item in report["cases"] if item["id"] == "specific_field_indication_paraphrase")
    assert case["actual_intent"] == "MEDICATION_SAFETY_PROFILE"
    assert case["actual_answer_type"] == "medication_field"


def test_multiple_requested_drug_fields_are_not_misrouted_to_adr_reporting():
    report = evaluate_chatbot_sync()
    case = next(item for item in report["cases"] if item["id"] == "drug_multiple_fields")
    assert case["actual_intent"] == "MEDICATION_SAFETY_PROFILE"
    assert case["actual_answer_type"] == "medication_fields"

def test_chatbot_evaluation_includes_bounded_context_and_source_provenance_contracts():
    report = evaluate_chatbot_sync()
    categories = {case["category"] for case in report["cases"]}
    assert {"multi_turn_context", "citation_provenance"} <= categories
    assert report["case_count"] >= 14
