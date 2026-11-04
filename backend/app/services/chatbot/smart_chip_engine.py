"""
Smart Contextual Chip Generator for Clinical Dialogue.
Synthesizes high-IQ next-step suggestions based on clinical intent, medications, and risk.
"""
from typing import List, Optional

def generate_smart_clinical_chips(
    query: str,
    drug_name: Optional[str] = None,
    intent: Optional[str] = None,
    category: Optional[str] = None,
    active_ingredient: Optional[str] = None
) -> List[str]:
    q_lower = query.lower()
    
    # 1. Pregnancy / Lactation
    if any(w in q_lower for w in ["thai", "bà bầu", "mang thai", "cho con bú", "sữa mẹ"]):
        if drug_name:
            return [
                f"Liều {drug_name} an toàn trong thai kỳ",
                f"Thuốc thay thế an toàn cho {drug_name}",
                "Cảnh báo dị tật thai nhi theo DĐVN V"
            ]
        return [
            "Kháng sinh an toàn cho phụ nữ có thai",
            "Thuốc hạ huyết áp ưu tiên cho thai phụ",
            "Các thuốc chống chỉ định tuyệt đối thai kỳ"
        ]
    
    # 2. Renal / Hepatic Adjustment
    if any(w in q_lower for w in ["suy thận", "egfr", "crcl", "thận", "lọc máu", "suy gan"]):
        target = drug_name or active_ingredient or "thuốc"
        return [
            f"Chỉnh liều {target} theo độ thanh thải eGFR",
            f"Nguy cơ tích lũy độc tính của {target}",
            "Xét nghiệm Creatinin và men gan cần theo dõi"
        ]
    
    # 3. Drug Interactions (DDI)
    if any(w in q_lower for w in ["tương tác", "kết hợp", "phối hợp", "uống cùng", "dùng cùng", "kỵ"]):
        if drug_name:
            return [
                f"Cơ chế tương tác của {drug_name}",
                f"Thuốc thay thế tránh tương tác với {drug_name}",
                "Mức độ tương tác theo QĐ 5948/QĐ-BYT"
            ]
        return [
            "Tương tác giữa Clopidogrel và Omeprazol",
            "Tương tác Warfarin và Aspirin / NSAIDs",
            "Tra cứu danh mục tương tác chống chỉ định QĐ 5948"
        ]
    
    # 4. Pediatrics / Dosing
    if any(w in q_lower for w in ["trẻ em", "trẻ nhỏ", "sơ sinh", "bé", "cân nặng", "mg/kg"]):
        target = drug_name or "thuốc"
        return [
            f"Cách tính liều {target} theo mg/kg cho trẻ",
            f"Khoảng cách giữa các lần dùng {target}",
            f"Dấu hiệu quá liều {target} ở trẻ em"
        ]
    
    # 5. Timing / Meals
    if any(w in q_lower for w in ["trước ăn", "sau ăn", "lúc đói", "lúc no", "thời điểm", "sáng hay tối"]):
        target = drug_name or "thuốc"
        return [
            f"Tác dụng phụ dạ dày của {target}",
            f"Tương tác giữa {target} và thức ăn",
            f"Liều dùng chuẩn của {target}"
        ]
    
    # 6. Toxicity / Adverse Effects / Antidotes
    if any(w in q_lower for w in ["tác dụng phụ", "độc tính", "ngộ độc", "quá liều", "giải độc", "adr"]):
        target = drug_name or "thuốc"
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
    
    # 10. Specific Drug Targeted Chips
    if drug_name:
        clean = drug_name.split("(")[0].strip()
        return [
            f"Chỉ định và liều dùng của {clean}",
            f"Chống chỉ định và thận trọng {clean}",
            f"Tương tác đáng chú ý của {clean}"
        ]
    
    # Default smart chips
    return [
        "Tra cứu chỉ định & liều dùng DĐVN V",
        "Kiểm tra tương tác thuốc theo QĐ 5948",
        "Phác đồ cấp cứu & an toàn dược lâm sàng"
    ]
