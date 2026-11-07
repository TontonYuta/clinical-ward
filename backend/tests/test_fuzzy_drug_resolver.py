"""
Unit Tests for Fuzzy Levenshtein Drug Resolver (Technique 4).
Kiểm thử nhận diện biệt dược gõ sai chính tả từ CSDL 55.000 thuốc.
"""
import pytest
from app.services.chatbot.fuzzy_drug_resolver import (
    FuzzyDrugResolver,
    compute_levenshtein_similarity
)
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher

def test_levenshtein_similarity_calculation():
    """Kiểm tra độ đo tương đồng khoảng cách Levenshtein chuẩn hóa."""
    sim_exact = compute_levenshtein_similarity("Paracetamol", "Paracetamol")
    assert sim_exact == 1.0

    sim_typo = compute_levenshtein_similarity("Paracetamol", "Paraxetamol")
    assert sim_typo > 0.80

    sim_diff = compute_levenshtein_similarity("Paracetamol", "Aspirin")
    assert sim_diff < 0.40

def test_fuzzy_resolver_recovers_misspelled_drugs():
    """Kiểm tra khả năng tìm kiếm mờ phục hồi thuốc khi gõ sai hoặc không dấu."""
    matcher = get_drug_lexical_matcher()

    # Trường hợp gõ sai hoặc viết thiếu
    cases = [
        ("paraxetamol", "paracetamol"),
        ("coversil", "coversyl"),
        ("amiodaron", "amiodaron"),
        ("clopido", "clopidogrel"),
    ]
    for typo, expected in cases:
        matches = matcher.fuzzy_candidate_search(typo, top_k=3)
        assert len(matches) > 0, f"No fuzzy match found for {typo}"
        assert any(expected in m.lower() for m in matches), f"Expected {expected} in matches for {typo}, got {matches}"

def test_extract_medications_integration():
    """Kiểm tra bóc tách thuốc chuẩn xác từ chuỗi lâm sàng."""
    matcher = get_drug_lexical_matcher()
    text = "Bệnh nhân cần dùng phối hợp Coversyl và Paracetamol 500mg"
    extracted = matcher.extract_medications(text)
    lower_extracted = [x.lower() for x in extracted]
    assert any("coversyl" in x for x in lower_extracted)
    assert any("paracetamol" in x for x in lower_extracted)
