"""
Unit Tests for Adaptive Clinical Query Schema & Depth Analyzer (Part 1).
Verifies:
1. Overview identification for broad drug queries (Paracetamol, Ciprofloxacin).
2. Deep facet extraction for targeted questions (timing, max dosage, alcohol, renal).
3. Conversational context inheritance for followup deictic queries without drug names.
4. Correct categorization into OVERVIEW vs. DEEP_FACET vs. INTERACTION.
"""
import pytest
from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic


def test_overview_single_drug_query():
    res = extract_clinical_query_schema_deterministic("Paracetamol")
    assert res.query_depth == "OVERVIEW"
    assert len(res.target_facets) == 0
    assert len(res.medications) >= 1
    assert res.medications[0].canonical_id == "paracetamol"
    assert not res.is_followup_question


def test_overview_information_phrase():
    res = extract_clinical_query_schema_deterministic("Cho tôi thông tin về thuốc Diazepam 5mg")
    assert res.query_depth == "OVERVIEW"
    assert len(res.target_facets) == 0
    assert len(res.medications) >= 1
    assert "diazepam" in res.medications[0].canonical_id


def test_timing_and_administration_followup():
    session_ctx = {"active_medication": "Paracetamol"}
    res = extract_clinical_query_schema_deterministic("Uống sáng hay tối?", session_context=session_ctx)
    assert res.query_depth == "DEEP_FACET"
    assert "timing_and_administration" in res.target_facets
    assert res.is_followup_question is True
    assert len(res.medications) == 1
    assert res.medications[0].surface_form == "Paracetamol"


def test_before_or_after_meal_facet():
    session_ctx = {"active_medication": "Paracetamol"}
    res = extract_clinical_query_schema_deterministic("thuốc này uống trước hay sau ăn", session_context=session_ctx)
    assert res.query_depth == "DEEP_FACET"
    assert "timing_and_administration" in res.target_facets
    assert res.is_followup_question is True
    assert res.references_previous_entity is True


def test_max_dosage_followup():
    session_ctx = {"active_medication": "Paracetamol"}
    res = extract_clinical_query_schema_deterministic("Còn liều tối đa?", session_context=session_ctx)
    assert res.query_depth == "DEEP_FACET"
    assert "max_dosage" in res.target_facets
    assert res.is_followup_question is True


def test_alcohol_interaction_followup():
    session_ctx = {"active_medication": "Paracetamol"}
    res = extract_clinical_query_schema_deterministic("thuốc có kỵ rượu không", session_context=session_ctx)
    assert res.query_depth == "DEEP_FACET"
    assert "alcohol_interaction" in res.target_facets
    assert res.is_followup_question is True
    assert res.medications[0].surface_form == "Paracetamol"


def test_renal_adjustment_facet():
    session_ctx = {"active_medication": "Paracetamol"}
    res = extract_clinical_query_schema_deterministic("Bệnh nhân suy thận có dùng được không?", session_context=session_ctx)
    assert res.query_depth == "DEEP_FACET"
    assert "renal_adjustment" in res.target_facets
    assert res.is_followup_question is True


def test_two_drugs_interaction():
    res = extract_clinical_query_schema_deterministic("Paracetamol uống cùng Ciprofloxacin được không?")
    assert res.query_depth == "INTERACTION"
    assert len(res.medications) == 2
