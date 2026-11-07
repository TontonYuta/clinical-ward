"""
Unit Tests for PaperQA2 Claim Attribution Engine (Technique 6).
Paper: Language agents achieve superhuman synthesis of scientific knowledge (Nature 2024 / arXiv:2409.13740)
"""
import pytest
from app.services.rag.claim_attributor import (
    verify_and_purge_unsupported_claims,
    ClaimCitation,
    PaperQASynthesisResult
)

def test_grounded_claims_are_verified_and_cited():
    """Các câu khẳng định có căn cứ từ CSDL phải được bảo toàn và cấp Citation."""
    evidence = (
        "Paracetamol là thuốc giảm đau, hạ sốt bậc 1 theo thang WHO. "
        "Liều thông thường cho người lớn là 500mg đến 1000mg mỗi lần, cách 4 đến 6 giờ. "
        "Chống chỉ định ở người suy gan nặng."
    )
    llm_output = (
        "Paracetamol được dùng giảm đau hạ sốt cho người lớn với liều 500mg - 1000mg mỗi lần. [DĐVN V, Trang 102]\n"
        "Thuốc chống chỉ định với người suy gan nặng."
    )
    cleaned, citations = verify_and_purge_unsupported_claims(llm_output, evidence)
    assert len(citations) >= 1
    assert "Paracetamol" in cleaned
    assert "suy gan nặng" in cleaned

def test_unsupported_hallucinations_are_purged():
    """Các câu khẳng định chứa từ khóa độc tính/nguy kịch bịa đặt không có trong evidence phải bị loại bỏ."""
    evidence = (
        "Coversyl (Perindopril) điều trị tăng huyết áp và suy tim sung huyết."
    )
    llm_output = (
        "Coversyl điều trị tăng huyết áp và suy tim sung huyết.\n"
        "Thuốc này gây hoại tử da cấp tính và tử vong ngay sau khi uống."  # Bịa đặt nặng
    )
    cleaned, citations = verify_and_purge_unsupported_claims(llm_output, evidence)
    assert "tăng huyết áp" in cleaned
    assert "hoại tử da" not in cleaned
    assert "tử vong" not in cleaned
