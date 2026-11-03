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
    assert "Venclexta" in matcher.extract_medications("Bác sĩ cho hỏi về thuốc Venclexta uống lúc nào")
    assert "Zithromax" in matcher.extract_medications("Kháng sinh Zithromax uống trước hay sau ăn?")

    # 2. Multiple drugs
    ddi_meds = matcher.extract_medications("Kiểm tra tương tác giữa Clopidogrel và Omeprazol và Aspirin")
    assert len(ddi_meds) == 3
    assert {m.lower() for m in ddi_meds} == {"clopidogrel", "omeprazol", "aspirin"}

    # 3. Unaccented drug query
    unacc_meds = matcher.extract_medications("tuong tac thuoc venclexta")
    assert "Venclexta" in unacc_meds

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

    # 2. Meal timing -> adult dosage
    meal_intent = get_primary_clinical_intent("Kháng sinh Zithromax uống trước hay sau ăn?")
    assert meal_intent == "adult_dosage"

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
    assert "Quyết định 5948/QĐ-BYT" in res.legal_basis
    assert "CLOPIDOGREL + OMEPRAZOL" in res.reply_text
    assert "CHỐNG CHỈ ĐỊNH" in res.reply_text
    assert res.card is not None

    # 3 drugs
    res3 = format_multi_ddi_response(["Clopidogrel", "Omeprazol", "Aspirin"], "Tương tác 3 thuốc")
    assert "CLOPIDOGREL + OMEPRAZOL" in res3.reply_text
    assert "Clopidogrel" in res3.reply_text and "Omeprazol" in res3.reply_text and "Aspirin" in res3.reply_text
