import json

import pytest

from app.services.chatbot.workflow_policy import load_workflow_policy, validate_policy_route_coverage


def write_policy(path, **overrides):
    policy = {
        "schema_version": 1,
        "policy_version": "test-1",
        "provenance": {"source_id": "test-fixture", "source_version": "sha256:test"},
        "routes": [{"intent": "lookup", "executor_key": "drug_lookup", "evidence_required": True}],
        "budgets": {"max_context_chars": 1000, "top_k": 2},
    }
    policy.update(overrides)
    path.write_text(json.dumps(policy), encoding="utf-8")
    return path


def test_loads_versioned_policy_when_executor_is_registered(tmp_path):
    path = write_policy(tmp_path / "policy.json")

    policy = load_workflow_policy(path, registered_executors={"drug_lookup"})

    assert policy.policy_version == "test-1"
    assert policy.routes["lookup"].executor_key == "drug_lookup"
    assert policy.provenance.source_version == "sha256:test"


@pytest.mark.parametrize("routes", [
    [],
    [{"intent": "lookup", "executor_key": "drug_lookup", "evidence_required": True}, {"intent": "lookup", "executor_key": "drug_lookup", "evidence_required": True}],
    [{"intent": "lookup", "executor_key": "missing", "evidence_required": True}],
])
def test_rejects_empty_duplicate_or_unregistered_routes(tmp_path, routes):
    path = write_policy(tmp_path / "policy.json", routes=routes)
    with pytest.raises(ValueError):
        load_workflow_policy(path, registered_executors={"drug_lookup"})


@pytest.mark.parametrize("budgets", [
    {"max_context_chars": 0, "top_k": 2},
    {"max_context_chars": 1000, "top_k": 0},
    {"max_context_chars": 1000, "top_k": 2, "other": 3},
])
def test_rejects_invalid_or_unrecognized_budget_values(tmp_path, budgets):
    path = write_policy(tmp_path / "policy.json", budgets=budgets)
    with pytest.raises(ValueError):
        load_workflow_policy(path, registered_executors={"drug_lookup"})


def test_rejects_missing_file_and_unsupported_schema(tmp_path):
    with pytest.raises(ValueError, match="cannot read"):
        load_workflow_policy(tmp_path / "absent.json", registered_executors={"drug_lookup"})
    path = write_policy(tmp_path / "policy.json", schema_version=9)
    with pytest.raises(ValueError, match="schema_version"):
        load_workflow_policy(path, registered_executors={"drug_lookup"})


def test_rejects_missing_provenance_and_malformed_policy(tmp_path):
    path = write_policy(tmp_path / "policy.json", provenance={"source_id": "", "source_version": ""})
    with pytest.raises(ValueError, match="provenance"):
        load_workflow_policy(path, registered_executors={"drug_lookup"})
    path.write_text("{broken", encoding="utf-8")
    with pytest.raises(ValueError, match="cannot read"):
        load_workflow_policy(path, registered_executors={"drug_lookup"})


def test_policy_file_is_not_loaded_from_implicit_working_directory(monkeypatch, tmp_path):
    from app.config import settings

    monkeypatch.chdir(tmp_path)
    resolved = load_workflow_policy(
        settings.WORKFLOW_POLICY_PATH,
        registered_executors={
            "conversation", "drug_lookup", "portal_guidance", "ddi",
            "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent",
        },
    )
    assert resolved.policy_version == "copilot-workflow-1"


def test_route_coverage_accepts_all_nlu_intents_and_rejects_missing_intents(tmp_path):
    path = write_policy(tmp_path / "policy.json")
    policy = load_workflow_policy(path, registered_executors={"drug_lookup"})

    with pytest.raises(ValueError, match="missing live route intents: greeting"):
        validate_policy_route_coverage(policy, required_intents={"lookup", "greeting"})

    validate_policy_route_coverage(policy, required_intents={"lookup"})
