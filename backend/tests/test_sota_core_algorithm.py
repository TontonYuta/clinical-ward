"""
Unit tests for SOTA Core Algorithm: Lexical Trie, Intent Feature Matrix, and Multi-Drug DDI Matrix.
"""
import pytest
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
from app.services.chatbot.intent_feature_matrix import (
    score_clinical_intents, rank_clinical_intents, get_primary_clinical_intent
)
from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
from app.services.clinical_ddi_engine.schemas import DdiSeverity

def test_lexical_trie_extracts_single_and_multiple_drugs():
    matcher = get_drug_lexical_matcher()
    # 1. Single drug
    assert "Paracetamol" in matcher.extract_medications("Liều dùng Paracetamol cho trẻ em 15kg")
    assert any("Venclexta" in m for m in matcher.extract_medications("Bác sĩ cho hỏi về thuốc Venclexta uống lúc nào"))
    assert "Zithromax" in matcher.extract_medications("Kháng sinh Zithromax uống trước hay sau ăn?")

    # 2. Multiple drugs
    ddi_meds = matcher.extract_medications("Kiểm tra tương tác giữa Clopidogrel và Omeprazol và Aspirin")
    assert len(ddi_meds) == 3
    assert {m.lower() for m in ddi_meds} == {"clopidogrel", "omeprazol", "aspirin"}

    # 3. Unaccented drug query
    unacc_meds = matcher.extract_medications("tuong tac thuoc venclexta")
    assert any("Venclexta" in m for m in unacc_meds)

    # 4. SĐK extraction
    assert matcher.extract_sdk("Tra cứu SĐK VD-24757-16") == "VD-24757-16"

def test_lexical_trie_fuzzy_candidate_search():
    matcher = get_drug_lexical_matcher()
    cands = matcher.fuzzy_candidate_search("venclext", top_k=3)
    assert any("venclexta" in c.lower() for c in cands)

def test_intent_feature_matrix_scoring_and_ranking():
    # 1. Pediatric dosing
    pedia_intent = get_primary_clinical_intent("Liều dùng Paracetamol cho trẻ em 15kg")
    assert pedia_intent == "pediatric_dosage"

    # 2. Meal timing -> administration_timing
    meal_intent = get_primary_clinical_intent("Kháng sinh Zithromax uống trước hay sau ăn?")
    assert meal_intent == "administration_timing"

    # 3. Contraindications
    contra_intent = get_primary_clinical_intent("Bệnh nhân bị hen phế quản có dùng được Propranolol không?")
    assert contra_intent == "contraindications"

    # 4. Pregnancy warning
    preg_intent = get_primary_clinical_intent("Phụ nữ mang thai 3 tháng đầu có dùng được Paracetamol không?")
    assert preg_intent == "pregnancy_warning"

    # 5. Renal adjustment
    renal_intent = get_primary_clinical_intent("Bệnh nhân suy thận CrCl 25 ml/phút dùng liều thế nào?")
    assert renal_intent == "renal_adjustment"

def test_multi_drug_matrix_evaluates_combinations_deterministically():
    # 2 drugs with known contraindication in QD 5948
    res = format_multi_ddi_response(["Clopidogrel", "Omeprazol"], "Tương tác thuốc này")
    assert res.intent == "MEDICATION_SAFETY_PROFILE"
    assert res.rag_grounded is True
    assert res.confidence == 1.0
    assert res.source_status == "retrieved_evidence"
    assert res.answer_type == "grounded_reference"
    assert len(res.citations) > 0
    assert len(res.evidence) > 0
    assert "chống chỉ định" in res.reply_text.lower()

    # 3 drugs
    res3 = format_multi_ddi_response(["Clopidogrel", "Omeprazol", "Aspirin"], "Tương tác 3 thuốc")
    assert res3.rag_grounded is True
    assert len(res3.citations) > 0
    assert len(res3.evidence) > 0


def test_multi_drug_response_survives_claim_provenance_validation_and_is_vietnamese():
    from app.services.chatbot.copilot_orchestrator import validate_response_evidence_contract

    response = validate_response_evidence_contract(
        format_multi_ddi_response(
            ["Clopidogrel", "Omeprazol", "Aspirin"],
            "Kiểm tra tương tác giữa Clopidogrel và Omeprazol và Aspirin",
        )
    )

    assert response.answer_type != "safe_abstention"
    assert response.rag_grounded is True
    assert response.claims
    assert "Core Clinical Guidance" not in response.reply_text
    assert "Polypharmacy Cross-Matrix" not in response.reply_text
    assert "NSAID + ANTICOAGULANT" not in response.reply_text
    evidence_by_id = {item["evidence_id"]: item for item in response.evidence}
    assert all(
        claim.text in response.reply_text
        and claim.text in evidence_by_id[claim.evidence_ids[0]]["content"]
        for claim in response.claims
    )
    assert "**Aspirin**" in response.reply_text
    assert "Aspirin với Clopidogrel" not in response.reply_text
    assert "Aspirin với Omeprazol" not in response.reply_text
    assert "Cặp Clopidogrel + Omeprazol" in response.reply_text
    assert "Cặp Aspirin + Clopidogrel" not in response.reply_text
    assert "NSAID" not in response.reply_text
    assert "ANTICOAGULANT" not in response.reply_text


def test_multi_drug_matrix_marks_unresolved_medication_as_unverified():
    response = format_multi_ddi_response(
        ["Clopidogrel", "UnknownDrugXYZ"], "Kiểm tra tương tác Clopidogrel và UnknownDrugXYZ"
    )

    assert response.source_status in {"unresolved_drug_entity", "evidence_provenance_missing"}
    assert response.rag_grounded is False
    assert response.abstention_reason
    assert not any(citation.get("document_id") == "qd-5948-byt" for citation in response.citations or [])


def test_unlisted_pair_is_not_claimed_safe():
    response = format_multi_ddi_response(
        ["Clopidogrel", "Aspirin"], "Kiểm tra tương tác Clopidogrel và Aspirin"
    )

    assert "không đồng nghĩa với an toàn" in response.reply_text.casefold()
    assert "được xác định là an toàn" not in response.reply_text.casefold()
