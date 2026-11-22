"""
Test suite verifying dynamic, contextual role-based identity and personalized greetings for Copilot.
Validates removal of hardcoded "Nhân viên y tế" and ensures role-tailored quick chips.
"""
import pytest
from app.services.chatbot.conversational_handler import (
    get_role_display_label,
    get_user_salutation,
    get_role_based_chips,
    handle_greeting_and_acknowledgment,
    attach_correction_empathy,
)


def test_get_role_display_label_all_roles():
    assert get_role_display_label(user_role="doctor") == "Bác sĩ"
    assert get_role_display_label(user_role="physician") == "Bác sĩ"
    assert get_role_display_label(user_name="BS. Hùng", user_role="doctor") == "Bác sĩ"

    assert get_role_display_label(user_role="pharmacist") == "Dược sĩ"
    assert get_role_display_label(user_name="DS. Mai", user_role="pharmacist") == "Dược sĩ"

    assert get_role_display_label(user_role="nurse") == "Điều dưỡng"
    assert get_role_display_label(user_name="ĐD. Thu", user_role="nurse") == "Điều dưỡng"

    assert get_role_display_label(user_role="director") == "Ban Giám đốc"
    assert get_role_display_label(user_role="admin") == "Ban Giám đốc"


def test_get_user_salutation_formatting():
    # Generic IDs should NOT produce "Bác sĩ bac_si_test"
    assert get_user_salutation(user_name="bac_si_test", user_role="doctor") == "Bác sĩ"
    assert get_user_salutation(user_name="duoc_si_test", user_role="pharmacist") == "Dược sĩ"
    assert get_user_salutation(user_name="dieu_duong_test", user_role="nurse") == "Điều dưỡng"
    assert get_user_salutation(user_name="director", user_role="director") == "Ban Giám đốc"
    assert get_user_salutation(user_name="Nhân viên y tế", user_role="nurse") == "Điều dưỡng"

    # Human names should retain the personalized name cleanly
    assert get_user_salutation(user_name="BS. Nguyễn Văn A", user_role="doctor") == "Bác sĩ Nguyễn Văn A"
    assert get_user_salutation(user_name="DS. Trần Thị Mai", user_role="pharmacist") == "Dược sĩ Trần Thị Mai"
    assert get_user_salutation(user_name="ĐD. Lê Thị Thu", user_role="nurse") == "Điều dưỡng Lê Thị Thu"


def test_get_role_based_chips():
    doc_chips = get_role_based_chips("doctor")
    assert any("Coversyl" in c or "Paracetamol" in c for c in doc_chips)

    pharm_chips = get_role_based_chips("pharmacist")
    assert any("FEFO" in c or "BHYT" in c for c in pharm_chips)

    nurse_chips = get_role_based_chips("nurse")
    assert any("đường dùng" in c or "sốc phản vệ" in c for c in nurse_chips)

    director_chips = get_role_based_chips("director")
    assert any("Báo cáo" in c or "Dược thư" in c for c in director_chips)


def test_greeting_and_acknowledgment_roles():
    # Doctor greeting
    res_doc = handle_greeting_and_acknowledgment("chào bot", "bac_si_test", "doctor")
    assert res_doc is not None
    assert "Bác sĩ" in res_doc.reply_text
    assert "Nhân viên y tế" not in res_doc.reply_text

    # Pharmacist greeting
    res_pharm = handle_greeting_and_acknowledgment("xin chào", "duoc_si_test", "pharmacist")
    assert res_pharm is not None
    assert "Dược sĩ" in res_pharm.reply_text
    assert "Bác sĩ" not in res_pharm.reply_text
    assert "Nhân viên y tế" not in res_pharm.reply_text
    assert any("FEFO" in c or "BHYT" in c for c in res_pharm.suggested_chips)

    # Nurse greeting
    res_nurse = handle_greeting_and_acknowledgment("alo em", "dieu_duong_test", "nurse")
    assert res_nurse is not None
    assert "Điều dưỡng" in res_nurse.reply_text
    assert "Bác sĩ" not in res_nurse.reply_text
    assert "Nhân viên y tế" not in res_nurse.reply_text

    # Director greeting
    res_dir = handle_greeting_and_acknowledgment("chào", "test_director", "director")
    assert res_dir is not None
    assert "Ban Giám đốc" in res_dir.reply_text
    assert "Bác sĩ" not in res_dir.reply_text

    # Thanks
    res_thanks = handle_greeting_and_acknowledgment("cảm ơn bạn", "duoc_si_test", "pharmacist")
    assert res_thanks is not None
    assert "dược sĩ" in res_thanks.reply_text.lower()
    assert "bác sĩ" not in res_thanks.reply_text.lower()


def test_attach_correction_empathy_dynamic_role():
    doc_reply = attach_correction_empathy("Liều tối đa là 4g.", "sai rồi", "bac_si_test", "doctor")
    assert "Dạ xin lỗi bác sĩ" in doc_reply

    pharm_reply = attach_correction_empathy("Liều tối đa là 4g.", "sai rồi", "duoc_si_test", "pharmacist")
    assert "Dạ xin lỗi dược sĩ" in pharm_reply
    assert "bác sĩ" not in pharm_reply
