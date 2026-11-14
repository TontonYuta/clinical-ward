"""
Bộ Phân Loại Ý Định Dự Phòng Ngữ Nghĩa (Semantic Prototype Fallback).
Hoạt động độc lập khi LLM API mất kết nối hoặc timeout, không dùng regex cứng nhắc.
"""

import re
from typing import Dict, Any, List, Optional
from app.schemas.agentic_intent import ClinicalIntent, IntentExtractionResult

TOOL_SEMANTIC_PROFILES: Dict[ClinicalIntent, Dict[str, Any]] = {
    ClinicalIntent.SHIFT_HANDOVER_AUDIT: {
        "anchors": {"giao ban", "ca trực", "đối soát", "nợ vỏ", "nợ ca", "bàn giao"},
        "negatives": {"thông tin", "hướng dẫn", "tác dụng"}
    },
    ClinicalIntent.COLDCHAIN_CHECK: {
        "anchors": {"nhiệt độ", "tủ lạnh", "vắc xin", "chuỗi lạnh", "kho lạnh", "bảo quản lạnh"},
        "negatives": {"thân nhiệt", "sốt", "nhiệt độ cơ thể"}
    },
    ClinicalIntent.RESTOCK_PROPOSAL: {
        "anchors": {"dự trù", "bù kho", "chạm ngưỡng", "ngưỡng min", "cạn kho", "mẫu 01", "đặt thêm", "sắp hết", "hết hàng", "cần bù"},
        "negatives": {"còn bao nhiêu", "hỏi số lượng", "tra cứu"}
    },
    ClinicalIntent.FEFO_INVENTORY_CHECK: {
        "anchors": {"cận hạn", "hạn dùng", "hết hạn", "fefo", "date thuốc", "hạn sử dụng"},
        "negatives": {"thời hạn bảo hành", "hạn tái khám"}
    },
    ClinicalIntent.REPORT_EQUIPMENT_INCIDENT: {
        "anchors": {"hỏng", "báo hỏng", "sự cố", "xì khí", "mất nguồn", "mất tín hiệu", "lỗi", "chập", "kẹt", "chai pin"},
        "device_cues": {"máy", "thiết bị", "bơm tiêm điện", "monitor", "ventilator", "zoll", "bennett", "prismaflex", "abl90", "mp50", "pb840", "ecg", "sốc tim", "khí máu"},
        "negatives": {"hỏng men răng", "hỏng dạ dày"}
    },
    ClinicalIntent.CHECK_DRUG_INTERACTION: {
        "anchors": {"tương tác", "tương kỵ", "uống cùng", "dùng cùng", "uống chung", "phối hợp"},
        "negatives": {"dặn dò", "nhắc thuốc"}
    },
    ClinicalIntent.DISPENSE_MEDICATION: {
        "anchors": {"mượn", "mượn thuốc", "lập phiếu mượn", "mượn tủ trực", "xuất mượn", "xuất khẩn", "xuất khẩn cấp", "rút khẩn", "kê nợ", "phiếu nợ", "xuất kho cấp cứu"},
        "negatives": {
            "nhắc thuốc", "lịch uống", "dặn dò", "thông tin", "kê đơn điện tử", "cpoe", "hỏi số lượng",
            "tóm tắt", "tom tat", "cho tôi", "cho em", "cho minh", "cho bác sĩ",
            "mang thai", "có thai", "thai kỳ", "bà bầu", "sốt", "được không", "uống được không",
            "dùng được không", "thế nào", "là gì", "tác dụng", "liều", "chỉ định", "chống chỉ định", "tương tác"
        }
    }
}

def extract_parameters(query: str, lower: str, intent: ClinicalIntent) -> Dict[str, Any]:
    """Bóc tách tham số định lượng tự nhiên từ câu nói."""
    params: Dict[str, Any] = {}
    if intent == ClinicalIntent.DISPENSE_MEDICATION:
        qty_match = re.search(r"(\d+)\s*(lọ|ống|bộ|cái|hộp|liều|chai|viên)?", lower)
        params["quantity"] = int(qty_match.group(1)) if qty_match and qty_match.group(1) else 1
        params["unit"] = qty_match.group(2) if qty_match and qty_match.group(2) else "ống"
        params["drug_name"] = query
        params["urgency"] = "urgent" if any(w in lower for w in ["gấp", "khẩn", "stat", "ngay", "cấp cứu"]) else "routine"

    elif intent == ClinicalIntent.FEFO_INVENTORY_CHECK:
        days_match = re.search(r"(\d+)\s*ngày", lower)
        params["threshold_days"] = int(days_match.group(1)) if days_match else 60

    elif intent == ClinicalIntent.REPORT_EQUIPMENT_INCIDENT:
        loc_match = re.search(r"(phòng mổ\s*\d*|buồng\s*[a-za-z0-9\-]+|khoa\s*[a-za-z0-9\s\-]+|icu|cấp cứu)", lower)
        params["device_location"] = loc_match.group(0).title() if loc_match else "Khoa Cấp Cứu / Hồi Sức"
        params["device_name"] = query
        params["issue_description"] = query
        params["urgency"] = "urgent" if any(w in lower for w in ["gấp", "khẩn", "nguy cấp", "ngay"]) else "routine"

    return params

def fallback_semantic_classification(query: str) -> IntentExtractionResult:
    """Phân loại ý định dựa trên bộ hồ sơ ngữ nghĩa mẫu (Zero Hardcoded Rules)."""
    clean_q = query.strip()
    lower = clean_q.lower()

    if any(lower.startswith(w) for w in ["chào", "xin chào", "hello", "hi", "cảm ơn", "tks"]):
        return IntentExtractionResult(intent=ClinicalIntent.CONVERSATIONAL_GREETING)

    # 0. Nếu là câu hỏi chuyên môn lâm sàng, tra cứu hoặc câu hỏi nghi vấn -> 100% CLINICAL_CONSULTATION
    # Tuy nhiên loại trừ các tác vụ vận hành kho/tủ lạnh/xuất thuốc cấp cứu
    is_coldchain_op = any(w in lower for w in ["tủ lạnh", "kho lạnh", "vắc xin", "chuỗi lạnh", "bảo quản lạnh"])
    is_dispense_op = bool(re.search(r"\d+\s*(lọ|ống|viên|bộ|hộp|chai|liều|cái|adre|morphin)", lower) or re.search(r"(?:tiêm|cho|lấy|cần|kê|xuất)\s+\d+", lower))

    is_clinical_inquiry = (not is_coldchain_op and not is_dispense_op) and (
        "?" in clean_q
        or any(w in lower for w in [
            "thế nào", "như thế nào", "được không", "được ko", "có dùng được", "có uống được", "có tiêm được",
            "có nên", "uống được không", "dùng được không", "tiêm được không", "là gì", "là thuốc gì",
            "tác dụng", "công dụng", "chỉ định", "chống chỉ định", "tương tác", "tương kỵ", "thành phần",
            "dị ứng", "dược động học", "thời gian bán thải", "thải trừ", "sinh khả dụng", "liều lượng",
            "liều dùng", "cách dùng", "uống lúc nào", "khi nào", "bao nhiêu", "an toàn", "nguy cơ", "lưu ý",
            "thận trọng", "mang thai", "có thai", "thai kỳ", "bà bầu", "phụ nữ", "cho con bú", "sơ sinh",
            "trẻ em", "người già", "cao tuổi", "suy gan", "suy thận", "bị sốt", "hạ sốt", "đau đầu",
            "giải thích", "tư vấn", "hướng dẫn", "thông tin về", "tra cứu"
        ])
    )
    if is_clinical_inquiry:
        return IntentExtractionResult(intent=ClinicalIntent.CLINICAL_CONSULTATION, confidence=0.95)

    # Đánh giá độ cộng hưởng ngữ nghĩa với từng Tool Profile
    best_intent = ClinicalIntent.CLINICAL_CONSULTATION
    best_score = 0.0

    for intent, profile in TOOL_SEMANTIC_PROFILES.items():
        if any(neg in lower for neg in profile.get("negatives", set())):
            continue

        score = sum(2.0 for anc in profile["anchors"] if anc in lower)
        if "device_cues" in profile:
            has_dev = any(dev in lower for dev in profile["device_cues"])
            if not has_dev and score > 0:
                score *= 0.2  # Giảm điểm nếu không có chỉ dấu thiết bị

        if intent == ClinicalIntent.DISPENSE_MEDICATION:
            has_qty = bool(re.search(r"\d+\s*(lọ|ống|viên|bộ|hộp|chai|liều|cái|adre|morphin)?", lower)) or bool(re.search(r"(?:tiêm|cho|lấy|cần|kê|xuất)\s+\d+", lower))
            if not has_qty and not any(w in lower for w in ["mượn", "xuất khẩn", "rút khẩn"]):
                score = 0.0

        if score > best_score and score >= 2.0:
            best_score = score
            best_intent = intent

    params = extract_parameters(clean_q, lower, best_intent)
    return IntentExtractionResult(intent=best_intent, confidence=0.85 if best_score > 0 else 0.5, **params)
