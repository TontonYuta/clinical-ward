"""
Unit Tests for Dual-Zone Consistency Verifier & Response Coordinator (Techniques 11 & 12).
Self-RAG (ICLR 2024) & Dual-Zone Clinical Architecture.
"""
import pytest
from app.services.rag.cross_zone_verifier import CrossZoneVerifier
from app.services.chatbot.dual_zone_orchestrator import DualZoneOrchestrator, DualZonePackage

def test_cross_zone_consistent_reasoning():
    """Khi Vùng 1 và Vùng 2 đồng thuận, hệ thống xác thực an toàn."""
    z1 = "Paracetamol chống chỉ định ở bệnh nhân suy gan nặng."
    z2 = "Đối với bệnh nhân suy gan nặng, khuyến nghị thay thế bằng giảm đau không qua gan hoặc liệu pháp vật lý."
    res = CrossZoneVerifier.verify_consistency(z1, z2)
    assert res.is_consistent is True
    assert len(res.conflict_items) == 0

def test_cross_zone_conflict_detection_and_safety_gate():
    """Khi Vùng 1 cấm nhưng Vùng 2 lại khuyên dùng -> Bắt buộc kích hoạt cờ xung đột."""
    z1 = "Tuyệt đối chống chỉ định phối hợp Simvastatin và Clarithromycin do nguy cơ tiêu cơ vân tử vong."
    z2 = "Bác sĩ có thể dùng phối hợp Simvastatin và Clarithromycin nếu theo dõi kỹ." # Xung đột nặng
    res = CrossZoneVerifier.verify_consistency(z1, z2)
    assert res.is_consistent is False
    assert len(res.conflict_items) >= 1
    assert "CẢNH BÁO XUNG ĐỘT SUY LUẬN AI" in res.sanitized_zone_2

def test_dual_zone_orchestrator_packaging():
    """Kiểm tra điều phối đóng gói 2 phân vùng tri thức và gắn nhãn Disclaimer."""
    z1 = "Coversyl 5mg: Uống 1 lần/ngày vào buổi sáng trước bữa ăn."
    z2 = "Cơ chế: Perindopril ức chế ACE làm giãn mạch và giảm áp lực cầu thận."
    package = DualZoneOrchestrator.coordinate_response(
        zone_1_fact=z1,
        zone_2_reasoning=z2,
        user_role="doctor",
        user_name="BS. Tuấn"
    )
    assert isinstance(package, DualZonePackage)
    assert "Kính gửi Bác sĩ," in package.full_markdown_text
    assert "CĂN CỨ DƯỢC THƯ & CSDL QUỐC GIA" in package.full_markdown_text
    assert "SUY LUẬN LÂM SÀNG THAM KHẢO" in package.full_markdown_text
    assert "FDA CDSS 2022" in package.zone_2_content
    assert package.is_cross_verified is True
