import json

from app.services.ingredient_mapping import load_reviewed_aliases, validate_reviewed_aliases


def test_reviewed_alias_file_requires_explicit_canonical_and_reviewer(tmp_path):
    path = tmp_path / "aliases.json"
    path.write_text(json.dumps([{"alias": "foo", "canonical_inn": "Bar", "source": "DTQG p. 1", "reviewer": "DSLS", "status": "approved"}]), encoding="utf-8")
    assert load_reviewed_aliases(path) == {"foo": "Bar"}


def test_unapproved_alias_is_ignored(tmp_path):
    path = tmp_path / "aliases.json"
    path.write_text(json.dumps([{"alias": "foo", "canonical_inn": "Bar", "source": "", "reviewer": "", "status": "pending"}]), encoding="utf-8")
    assert load_reviewed_aliases(path) == {}


def test_alias_validator_requires_canonical_dtqg_target_and_rejects_conflicts():
    dictionary = {"paracetamol": {"canonical_inn": "Paracetamol"}, "acetaminophen": {"canonical_inn": "Paracetamol"}}
    rows = [
        {"alias": "paracetamol", "canonical_inn": "Other INN", "source": "DTQG p. 1", "reviewer": "DSLS", "reviewed_at": "2026-10-30", "status": "approved"},
        {"alias": "foo", "canonical_inn": "Acetaminophen", "source": "label", "reviewer": "DSLS", "reviewed_at": "2026-10-30", "status": "approved"},
        {"alias": "x", "canonical_inn": "Paracetamol", "source": "", "reviewer": "", "status": "approved"},
    ]
    errors = validate_reviewed_aliases(rows, dictionary)
    assert any("alias collides" in error for error in errors)
    assert any("canonical INN" in error for error in errors)
    assert any("source" in error for error in errors)
