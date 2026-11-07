"""
Unit Tests for Role Persona & FDA CDSS Disclaimer Engine (Technique 10).
FDA CDSS Guidance 2022.
"""
import pytest
from app.services.chatbot.persona_disclaimer import (
    get_role_salutation,
    get_fda_cdss_disclaimer,
    wrap_dual_zone_reasoning_disclaimer
)

def test_role_salutations():
    """Kiểm tra xưng hô chuẩn xác theo vai trò chuyên môn y tế."""
    assert get_role_salutation("doctor", "BS. Nam") == "Kính gửi Bác sĩ,"
    assert get_role_salutation("nurse", "ĐD. Lan") == "Chào Điều dưỡng,"
    assert get_role_salutation("pharmacist", "DS. Hùng") == "Kính gửi Dược sĩ lâm sàng,"
    assert get_role_salutation(None, None) == "Chào Quý đồng nghiệp y tế,"

def test_fda_cdss_disclaimer_content():
    """Kiểm tra nội dung khuyến cáo pháp lý y khoa."""
    disclaimer = get_fda_cdss_disclaimer()
    assert "FDA CDSS 2022" in disclaimer
    assert "BỘ Y TẾ" in disclaimer
    assert "trách nhiệm độc lập" in disclaimer

def test_wrap_reasoning_disclaimer_prevents_duplication():
    """Kiểm tra bao đóng Vùng 2 với Disclaimer và chống lặp thẻ."""
    reasoning = "Suy luận dược lý: Nhóm ARB không làm tích tụ Bradykinin nên không gây ho khan."
    wrapped = wrap_dual_zone_reasoning_disclaimer(reasoning)
    assert reasoning in wrapped
    assert "FDA CDSS 2022" in wrapped

    # Khi bọc lại lần 2 không được duplicate
    wrapped_twice = wrap_dual_zone_reasoning_disclaimer(wrapped)
    assert wrapped_twice.count("FDA CDSS 2022") == 1
