"""
Unit & Integration Tests for Multimodal Prescription Vision & Clinical DDI / BHYT Synthesis.
"""
import pytest
from app.services.chatbot.prescription_vision_analyser import (
    extract_prescription_items_from_vision,
    analyse_vision_prescription,
)


def test_extract_prescription_items_from_structured_json():
    vision_mock = {
        "is_clinical": True,
        "category": "PRESCRIPTION",
        "extracted_prescription": {
            "patient_name": "NGUYỄN VĂN AN",
            "patient_age": 58,
            "insurance_card_number": "GD4790000000001",
            "primary_icd10": "I20",
            "primary_diagnosis": "Cơn đau thắt ngực ổn định",
            "hospital_rank": "HANG_1",
            "items": [
                {
                    "drug_name": "Clopidogrel 75mg",
                    "active_ingredient": "Clopidogrel",
                    "dosage": "75mg",
                    "quantity": 30.0,
                    "unit": "Viên",
                    "instructions": "Uống 1 viên vào buổi sáng"
                },
                {
                    "drug_name": "Omeprazol 20mg",
                    "active_ingredient": "Omeprazol",
                    "dosage": "20mg",
                    "quantity": 30.0,
                    "unit": "Viên",
                    "instructions": "Uống 1 viên trước ăn sáng"
                }
            ]
        }
    }

    meta, items = extract_prescription_items_from_vision(vision_mock)
    assert meta["patient_name"] == "NGUYỄN VĂN AN"
    assert meta["primary_icd10"] == "I20"
    assert len(items) == 2
    assert items[0]["drug_name"] == "Clopidogrel 75mg"
    assert items[1]["drug_name"] == "Omeprazol 20mg"


def test_extract_prescription_items_from_text_fallback():
    vision_mock = {
        "is_clinical": True,
        "category": "PRESCRIPTION",
        "extracted_sections": [
            {
                "title": "Chẩn đoán & Thuốc",
                "items": [
                    "Bệnh nhân: Trần Thị B, Chẩn đoán: Tăng huyết áp",
                    "1. Amlodipin 5mg x 30 viên (Uống sáng 1 viên)",
                    "2. Losartan 50mg x 30 viên (Uống sáng 1 viên)",
                    "3. Atorvastatin 20mg x 30 viên (Uống tối 1 viên)"
                ]
            }
        ]
    }

    meta, items = extract_prescription_items_from_vision(vision_mock)
    assert len(items) >= 3
    drug_names = [it["drug_name"] for it in items]
    assert any("Amlodipin" in d for d in drug_names)
    assert any("Losartan" in d for d in drug_names)
    assert any("Atorvastatin" in d for d in drug_names)


def test_analyse_vision_prescription_with_ddi_and_bhyt_violations():
    vision_mock = {
        "is_clinical": True,
        "category": "PRESCRIPTION",
        "extracted_prescription": {
            "patient_name": "TRẦN VĂN MINH",
            "patient_age": 62,
            "insurance_card_number": "HT2790000000002",
            "primary_icd10": "I10",
            "primary_diagnosis": "Tăng huyết áp vô căn",
            "hospital_rank": "HANG_2",
            "items": [
                {
                    "drug_name": "Clopidogrel 75mg",
                    "active_ingredient": "Clopidogrel",
                    "dosage": "75mg",
                    "quantity": 30.0,
                    "unit_price": 12000.0,
                    "instructions": "Uống 1 viên/ngày"
                },
                {
                    "drug_name": "Omeprazol 20mg",
                    "active_ingredient": "Omeprazol",
                    "dosage": "20mg",
                    "quantity": 30.0,
                    "unit_price": 8000.0,
                    "instructions": "Uống 1 viên/ngày"
                }
            ]
        }
    }

    analysis = analyse_vision_prescription(vision_mock, user_role="doctor")

    # 1. Verification of synthesized markdown
    reply_text = analysis["reply_text"]
    assert "KẾT QUẢ PHÂN TÍCH ĐƠN THUỐC" in reply_text
    assert "TRẦN VĂN MINH" in reply_text
    assert "CHỐNG CHỈ ĐỊNH PHỐI HỢP" in reply_text
    assert "CLOPIDOGREL + OMEPRAZOL" in reply_text
    assert "CYP2C19" in reply_text

    # 2. Verification of BHYT section (Rà soát danh mục BHYT TT 20/2022)
    assert "Rà soát danh mục thuốc BHYT chi trả" in reply_text
    assert "Thông tư 20/2022/TT-BYT" in reply_text
    assert "Trong danh mục BHYT" in reply_text

    # 3. Verification of No Unnecessary Emojis/Icons
    for icon in ["📑", "💊", "⚠️", "⛔", "🚨", "✅", "🛡️", "💵", "💡"]:
        assert icon not in reply_text

    # 4. Verification of CDSS Alert
    cdss = analysis["cdss_alert"]
    assert cdss is not None
    assert cdss.level == "critical"
    assert "Chống chỉ định" in cdss.title or "CHỐNG CHỈ ĐỊNH" in cdss.title

    # 5. Verification of Action Card
    card = analysis["card"]
    assert card is not None
    assert card.target_tab == "cpoe"
    assert card.primary_action_type == "OPEN_CPOE"
    assert len(card.data["items"]) == 2

    # 6. Verification of Grounding & Citations
    assert analysis["rag_grounded"] is True
    assert len(analysis["citations"]) >= 2
    assert any("Dược Thư" in str(c) for c in analysis["citations"])
    assert any("20/2022" in str(c) for c in analysis["citations"])


def test_analyse_vision_prescription_safe():
    vision_mock = {
        "is_clinical": True,
        "category": "PRESCRIPTION",
        "extracted_prescription": {
            "patient_name": "LÊ VĂN HÒA",
            "patient_age": 35,
            "primary_icd10": "J00",
            "primary_diagnosis": "Viêm mũi họng cấp",
            "hospital_rank": "HANG_1",
            "items": [
                {
                    "drug_name": "Paracetamol 500mg",
                    "dosage": "500mg",
                    "quantity": 10.0,
                    "instructions": "Uống khi sốt"
                }
            ]
        }
    }

    analysis = analyse_vision_prescription(vision_mock, user_role="doctor")
    reply_text = analysis["reply_text"]
    assert "Không phát hiện tương tác thuốc bất lợi nghiêm trọng" in reply_text
    assert analysis["rag_grounded"] is True


def test_prescription_without_price_does_not_guess_price():
    """Verify that when a prescription has no unit prices, the system does not guess or display prices."""
    vision_mock = {
        "is_clinical": True,
        "category": "PRESCRIPTION",
        "extracted_prescription": {
            "patient_name": "NGUYỄN VĂN AN",
            "patient_age": 45,
            "primary_icd10": "I10",
            "items": [
                {
                    "drug_name": "Amlodipin 5mg",
                    "dosage": "5mg",
                    "quantity": 30.0,
                    # No unit_price specified
                    "instructions": "Uống 1 viên vào buổi sáng"
                }
            ]
        }
    }

    analysis = analyse_vision_prescription(vision_mock, user_role="doctor")
    reply_text = analysis["reply_text"]

    # Must NOT have guessed unit price or VNĐ in text
    assert "VNĐ" not in reply_text
    assert "15,000" not in reply_text
    assert "xuất toán" not in reply_text

    # Action card should not have artificial at_risk_cost_vnd
    card = analysis["card"]
    assert card.data.get("at_risk_cost_vnd", 0) == 0
    assert card.data.get("bhyt_covered_count") == 1
    assert card.data.get("bhyt_uncovered_count") == 0

    # No unnecessary emojis
    for icon in ["📑", "💊", "⚠️", "⛔", "🚨", "✅", "🛡️", "💵", "💡"]:
        assert icon not in reply_text
