"""
Comprehensive verification test suite for Step 1: Dynamic Schema-Driven Intent & Entity Extractor.
Tests Pydantic V2 schema, zero-hardcode extraction, and compatibility.
"""
import pytest
from app.schemas.clinical_extraction_schema import (
    ClinicalExtractionAnalysis,
    ExtractedMedication,
    PatientContextSchema,
)
from app.services.chatbot.clinical_schema_extractor import (
    extract_clinical_query_schema_deterministic,
    analysis_to_parsed_turn,
)


def test_schema_model_validation():
    analysis = ClinicalExtractionAnalysis(
        primary_intent="monograph_field_lookup",
        medications=[
            ExtractedMedication(
                canonical_id="paracetamol",
                surface_form="Paracetamol",
                role="primary_medication"
            )
        ],
        requested_fields=["dosage", "contraindications"],
        diseases_or_symptoms=["sốt", "đau đầu"],
        patient_context=PatientContextSchema(
            age_group="adult",
            weight_kg=65.0,
            renal_impairment=False
        ),
        confidence=0.98,
        reasoning="User explicitly asked for dosage and contraindications of Paracetamol."
    )
    assert analysis.primary_intent == "monograph_field_lookup"
    assert len(analysis.medications) == 1
    assert analysis.medications[0].canonical_id == "paracetamol"
    assert "dosage" in analysis.requested_fields
    assert analysis.patient_context.weight_kg == 65.0


def test_extracts_primary_drug_and_fields_without_regex():
    res = extract_clinical_query_schema_deterministic("Thông tin thuốc Metformin, chống chỉ định và liều dùng")
    assert any("metformin" in m.canonical_id for m in res.medications)
    assert "contraindications" in res.requested_fields
    assert "dosage" in res.requested_fields
    assert "indications" not in res.requested_fields  # Anti-bleed rule


def test_extracts_contextual_exposure_procedure():
    res = extract_clinical_query_schema_deterministic("Metformin chụp CT có thuốc cản quang thì sao?")
    med_roles = {m.canonical_id: m.role for m in res.medications}
    assert any("metformin" in k for k in med_roles)
    assert "thuoc_can_quang" in med_roles
    assert med_roles["thuoc_can_quang"] == "contextual_exposure"
    assert res.primary_intent == "clinical_consultation"


def test_extracts_patient_renal_crcl_parameters():
    res = extract_clinical_query_schema_deterministic(
        "Bệnh nhân suy thận có CrCl: 25 ml/phút dùng Cefotaxim thế nào?"
    )
    assert any("cefotaxim" in m.canonical_id for m in res.medications)
    assert res.patient_context is not None
    assert res.patient_context.renal_impairment is True
    assert res.patient_context.crcl_ml_min == 25.0
    assert res.primary_intent == "dosage_adjustment"


def test_extracts_pediatric_context():
    res = extract_clinical_query_schema_deterministic(
        "Trẻ em 5 tuổi bị sốt cao uống Paracetamol liều bao nhiêu?"
    )
    assert any("paracetamol" in m.canonical_id for m in res.medications)
    assert res.patient_context is not None
    assert res.patient_context.age_group == "pediatric"
    assert "dosage" in res.requested_fields


def test_detects_interaction_with_missing_partner():
    res = extract_clinical_query_schema_deterministic("Paracetamol có tương tác không?")
    assert res.primary_intent == "interaction_assessment"
    assert any("paracetamol" in m.canonical_id for m in res.medications)
    assert "missing_interaction_partner" in res.ambiguities


def test_detects_multi_drug_interaction():
    res = extract_clinical_query_schema_deterministic(
        "Có tương tác giữa Clopidogrel và Omeprazole khi uống chung không?"
    )
    assert res.primary_intent == "interaction_assessment"
    med_names = [m.canonical_id for m in res.medications]
    assert any("clopidogrel" in name for name in med_names)
    assert any("omeprazol" in name for name in med_names)
    assert "missing_interaction_partner" not in res.ambiguities


def test_detects_subject_switch_and_session_inheritance():
    res = extract_clinical_query_schema_deterministic(
        "Đổi sang Cefotaxim, hiệu chỉnh suy thận ra sao?",
        session_context={"active_medication": "ceftriaxon"}
    )
    assert res.switches_subject is True
    assert any("cefotaxim" in m.canonical_id for m in res.medications)


def test_handles_unknown_drug_entity_conservatively():
    res = extract_clinical_query_schema_deterministic("Thông tin thuốc BrandX-99999")
    assert len(res.medications) == 0
    assert "unresolved_medication" in res.ambiguities


def test_conversational_query():
    res = extract_clinical_query_schema_deterministic("Xin chào bạn, chúc một ngày làm việc tốt lành")
    assert res.primary_intent == "conversational"
    assert len(res.medications) == 0


def test_analysis_to_parsed_turn_compatibility():
    analysis = extract_clinical_query_schema_deterministic("Thông tin thuốc Metformin, chống chỉ định và liều dùng")
    parsed_turn = analysis_to_parsed_turn(analysis, "Thông tin thuốc Metformin, chống chỉ định và liều dùng")
    assert parsed_turn.medication_entities[0].canonical_id == "metformin"
    assert "contraindications" in parsed_turn.requested_fields
    assert "dosage" in parsed_turn.requested_fields
