"""
Smart Contextual Chip Generator for Clinical Dialogue.
Synthesizes high-IQ next-step suggestions based on clinical intent, medications, and risk.
"""
from typing import List, Optional

def _resolve_clean_drug_label(
    query: str,
    drug_name: Optional[str] = None,
    active_ingredient: Optional[str] = None,
) -> Optional[str]:
    """Prefer the canonical INN/active ingredient when the user queried by INN
    rather than exposing a random DAV brand name (e.g. 'Ibuprofeno Azevedos')."""
    q_lower = (query or "").lower()
    raw_name = (drug_name or "").split("(")[0].strip()
    raw_inn = (active_ingredient or "").split("(")[0].split(";")[0].split("+")[0].strip()

    if raw_inn:
        # Format INN nicely if all-lowercase
        inn_display = raw_inn[:1].upper() + raw_inn[1:] if raw_inn.islower() else raw_inn
        if not raw_name:
            return inn_display
        # If user typed the INN (or didn't type the brand name), prefer the clean INN
        if raw_inn.lower() in q_lower and raw_name.lower() not in q_lower:
            return inn_display
        # If brand name is noisy/foreign DAV label containing the INN root, use clean INN
        if len(raw_name.split()) >= 2 and raw_inn.lower()[:6] in raw_name.lower() and raw_name.lower() not in q_lower:
            return inn_display
    return raw_name or (raw_inn if raw_inn else None)


def generate_smart_clinical_chips(
    query: str,
    drug_name: Optional[str] = None,
    intent: Optional[str] = None,
    category: Optional[str] = None,
    active_ingredient: Optional[str] = None
) -> List[str]:
    q_lower = query.lower()
    clean_drug = _resolve_clean_drug_label(query, drug_name, active_ingredient)
    
    # 1. Pregnancy / Lactation
    if any(w in q_lower for w in ["thai", "bà bầu", "mang thai", "cho con bú", "sữa mẹ"]):
        if clean_drug:
            return [
                f"Liều {clean_drug} an toàn trong thai kỳ",
                f"Thuốc thay thế an toàn cho {clean_drug}",
                "Cảnh báo dị tật thai nhi theo DĐVN V"
            ]
        return [
            "Kháng sinh an toàn cho phụ nữ có thai",
            "Thuốc hạ huyết áp ưu tiên cho thai phụ",
            "Các thuốc chống chỉ định tuyệt đối thai kỳ"
        ]
    
    # 2. Renal / Hepatic Adjustment
    if any(w in q_lower for w in ["suy thận", "egfr", "crcl", "thận", "lọc máu", "suy gan"]):
        target = clean_drug or "thuốc"
        return [
            f"Chỉnh liều {target} theo độ thanh thải eGFR",
            f"Nguy cơ tích lũy độc tính của {target}",
            "Xét nghiệm Creatinin và men gan cần theo dõi"
        ]
    
    # 3. Drug Interactions (DDI)
    if any(w in q_lower for w in ["tương tác", "kết hợp", "phối hợp", "uống cùng", "dùng cùng", "kỵ"]):
        if clean_drug:
            return [
                f"Cơ chế tương tác của {clean_drug}",
                f"Thuốc thay thế tránh tương tác với {clean_drug}",
                "Mức độ tương tác theo QĐ 5948/QĐ-BYT"
            ]
        return [
            "Tương tác giữa Clopidogrel và Omeprazol",
            "Tương tác Warfarin và Aspirin / NSAIDs",
            "Tra cứu danh mục tương tác chống chỉ định QĐ 5948"
        ]
    
    # 4. Pediatrics / Dosing
    if any(w in q_lower for w in ["trẻ em", "trẻ nhỏ", "sơ sinh", "bé", "cân nặng", "mg/kg"]):
        target = clean_drug or "thuốc"
        return [
            f"Cách tính liều {target} theo mg/kg cho trẻ",
            f"Khoảng cách giữa các lần dùng {target}",
            f"Dấu hiệu quá liều {target} ở trẻ em"
        ]
    
    # 5. Timing / Meals
    if any(w in q_lower for w in ["trước ăn", "sau ăn", "lúc đói", "lúc no", "thời điểm", "sáng hay tối"]):
        target = clean_drug or "thuốc"
        return [
            f"Tác dụng phụ dạ dày của {target}",
            f"Tương tác giữa {target} và thức ăn",
            f"Liều dùng chuẩn của {target}"
        ]
    
    # 6. Toxicity / Adverse Effects / Antidotes
    if any(w in q_lower for w in ["tác dụng phụ", "độc tính", "ngộ độc", "quá liều", "giải độc", "adr"]):
        target = clean_drug or "thuốc"
        return [
            f"Thuốc giải độc đặc hiệu cho {target}",
            f"Dấu hiệu cảnh báo nguy kịch của {target}",
            f"Quy trình xử trí cấp cứu quá liều {target}"
        ]
    
    # 7. Emergency / Anaphylaxis / TT 51
    if any(w in q_lower for w in ["phản vệ", "sốc", "adrenalin", "cấp cứu", "thông tư 51"]):
        return [
            "Phác đồ tiêm bắp Adrenalin theo TT 51/2017",
            "Liều Adrenalin cấp cứu phản vệ trẻ em",
            "Phân độ phản vệ từ độ I đến độ IV"
        ]
    
    # 8. Narcotics / Controlled Drugs TT 20
    if any(w in q_lower for w in ["gây nghiện", "morphin", "fentanyl", "hướng thần", "hủy vỏ", "thông tư 20"]):
        return [
            "Quy chế bảo quản tủ thuốc gây nghiện TT 20",
            "Biên bản hủy vỏ ống Morphin sau tiêm",
            "Kê đơn thuốc gây nghiện tối đa 30 ngày"
        ]
    
    # 9. Inventory / FEFO / TT 36
    if any(w in q_lower for w in ["fefo", "tồn kho", "cận hạn", "kho dược", "thông tư 36", "xuất kho"]):
        return [
            "Quét danh mục thuốc cận hạn dưới 60 ngày",
            "Quy trình xuất kho ưu tiên FEFO chuẩn GSP",
            "Biệt trữ và xử lý thuốc hết hạn dùng"
        ]
    
    # 10. Specific Drug Targeted Chips (avoid repeating basic facets when user asked full detail)
    if clean_drug:
        is_comprehensive = any(
            w in q_lower
            for w in ["chi tiết", "chi tiet", "toàn văn", "toan van", "đầy đủ", "day du", "toàn bộ", "chuyên luận"]
        )
        if is_comprehensive:
            return [
                f"Chỉnh liều {clean_drug} ở bệnh nhân suy thận / suy gan",
                f"{clean_drug} có dùng được cho phụ nữ có thai không?",
                f"Tương tác thuốc nghiêm trọng cần tránh của {clean_drug}",
            ]
        return [
            f"Chỉ định và liều dùng của {clean_drug}",
            f"Chống chỉ định và thận trọng {clean_drug}",
            f"Tương tác đáng chú ý của {clean_drug}"
        ]
    
    # Default smart chips
    return [
        "Tra cứu chỉ định & liều dùng DĐVN V",
        "Kiểm tra tương tác thuốc theo QĐ 5948",
        "Phác đồ cấp cứu & an toàn dược lâm sàng"
    ]
