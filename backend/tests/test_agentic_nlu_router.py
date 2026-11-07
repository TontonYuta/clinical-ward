import pytest
from app.services.chatbot.agentic_router import fallback_semantic_classification, ClinicalIntent

def test_dispense_intent_detection():
    cases = [
        "Cho 1 lọ morphin",
        "bệnh nhân Nguyễn Văn An cần 2 ống Fentanyl cấp cứu phòng mổ 1",
        "lấy gấp 1 ống adrenalin tiêm bắp cho bệnh nhân phản vệ buồng 1",
        "tiêm tĩnh mạch 1 ống diazepam cho bệnh nhân co giật",
        "xuất 1 chai lipid 20% cấp cứu ngộ độc thuốc tê",
        "cần 10 cái bơm tiêm 5ml và 2 bộ dây truyền",
        "kê 2 lọ ceftriaxone 1g cho bệnh nhân Trần Thị Mai buồng cấp cứu 2",
        "bn 8820 đau quá tiêm 2 morphin",
        "cho 1 adre",
    ]
    for q in cases:
        res = fallback_semantic_classification(q)
        assert res.intent == ClinicalIntent.DISPENSE_MEDICATION, f"Failed for query: {q}, got {res.intent}"

def test_equipment_incident_detection():
    cases = [
        "máy thở PB840 phòng mổ 2 bị xì khí nứt bẫy nước",
        "máy sốc tim zoll r series báo lỗi không nạp năng lượng",
        "bơm tiêm điện b.braun báo lỗi kẹt pít-tông",
        "monitor philips mp50 buồng 3 bị mất tín hiệu ecg",
        "hỏng máy khí máu abl90 khoa cấp cứu",
        "máy thở bennett bị hỏng",
    ]
    for q in cases:
        res = fallback_semantic_classification(q)
        assert res.intent == ClinicalIntent.REPORT_EQUIPMENT_INCIDENT, f"Failed for query: {q}, got {res.intent}"

def test_fefo_detection():
    cases = [
        "thuốc nào cận hạn dưới 60 ngày",
        "kiểm tra date thuốc trong kho",
        "cho tôi xem danh sách fefo ưu tiên xuất",
        "cho tôi xem thuốc cận hạn",
    ]
    for q in cases:
        res = fallback_semantic_classification(q)
        assert res.intent == ClinicalIntent.FEFO_INVENTORY_CHECK, f"Failed for query: {q}, got {res.intent}"

def test_shift_handover_detection():
    cases = [
        "đối soát ca trực đêm qua",
        "giao ban ca trực sáng 07:00 AM",
        "kiểm tra nợ vỏ morphin",
        "tổng hợp nợ ca trực",
    ]
    for q in cases:
        res = fallback_semantic_classification(q)
        assert res.intent == ClinicalIntent.SHIFT_HANDOVER_AUDIT, f"Failed for query: {q}, got {res.intent}"

def test_coldchain_detection():
    q = "nhiệt độ tủ lạnh bảo quản vắc xin hiện tại thế nào"
    res = fallback_semantic_classification(q)
    assert res.intent == ClinicalIntent.COLDCHAIN_CHECK

def test_restock_detection():
    cases = [
        "mặt hàng nào sắp hết",
        "thuốc nào chạm ngưỡng min cần bù",
        "lập phiếu dự trù bù tồn kho",
        "dự trù cơ số mẫu 01",
    ]
    for q in cases:
        res = fallback_semantic_classification(q)
        assert res.intent == ClinicalIntent.RESTOCK_PROPOSAL, f"Failed for query: {q}, got {res.intent}"
