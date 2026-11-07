"""
Unit & Boundary Tests for Semantic Boundary & Safe Abstention Gate (Technique 3).
Reference: Self-RAG (Asai et al., 2024 / ICLR 2024) & FDA CDSS 2022 Safe Abstention.
"""
import pytest
from app.services.chatbot.semantic_boundary import (
    evaluate_semantic_boundary,
    generate_safe_abstention_copilot_response,
    BoundaryAssessment
)

def test_clinical_queries_accepted_within_boundary():
    """Các câu hỏi lâm sàng phải được chấp thuận trong Semantic Boundary."""
    clinical_queries = [
        "Liều dùng Paracetamol cho người lớn",
        "Coversyl có kỵ với Amlodipin không",
        "Tồn kho thuốc Morphin còn bao nhiêu",
        "Bệnh nhân suy thận độ 3 có dùng được thuốc này không",
        "Phác đồ cấp cứu sốc phản vệ Adrenalin",
        "Nhiệt độ bảo quản tủ lạnh vắc xin"
    ]
    for q in clinical_queries:
        assessment = evaluate_semantic_boundary(q)
        assert isinstance(assessment, BoundaryAssessment)
        assert assessment.is_out_of_domain is False, f"Clinical query was rejected: {q}"
        assert assessment.category == "clinical"

def test_out_of_domain_queries_rejected_safely():
    """Các câu hỏi giải trí / ngoài lề phải bị kích hoạt OOD Safe Abstention."""
    frivolous_queries = [
        "Kể cho tôi một câu chuyện cười đi",
        "Hôm nay ăn gì ngon",
        "Bạn có người yêu chưa",
        "Nói chuyện linh tinh một chút đi",
        "Bạn có biết kết quả sổ xố hôm nay không",
        "Bạn có thể giúp tôi học toán được không",
        "Dự báo thời tiết Hà Nội hôm nay thế nào",
        "Giá vàng hôm nay tăng hay giảm",
        "Làm một bài thơ tình tặng bạn gái"
    ]
    for q in frivolous_queries:
        assessment = evaluate_semantic_boundary(q)
        assert assessment.is_out_of_domain is True, f"Frivolous query was not rejected: {q}"
        assert assessment.confidence >= 0.90

def test_safe_abstention_copilot_response_payload():
    """Thông điệp từ chối phải chuẩn mực theo FDA CDSS 2022."""
    resp = generate_safe_abstention_copilot_response()
    assert resp.intent == "CLINICAL_SAFE_ABSTENTION"
    assert resp.answer_type == "safe_abstention"
    assert resp.source_status == "out_of_scope"
    assert "TỪ CHỐI TIẾP NHẬN: CÂU HỎI NGOÀI PHẠM VI CHUYÊN MÔN" in resp.reply_text
    assert len(resp.suggested_chips) > 0
