"""
Ma trận trọng số đặc trưng ý định lâm sàng (Clinical Intent Scoring Matrix).
Chấm điểm đa nhãn độc lập, loại bỏ hoàn toàn chuỗi if/else rời rạc (<= 160 LOC).
"""
import re
import unicodedata
from typing import Dict, List, Tuple, Optional

def _unaccent(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower()

INTENT_FEATURE_WEIGHTS: Dict[str, List[Tuple[str, float]]] = {
    "pediatric_dosage": [
        (r"\bliều\s+(?:cho\s+)?(?:trẻ|bé|con|sơ\s+sinh)\b", 3.0),
        (r"\b(?:trẻ\s+em|nhi\s+khoa|trẻ\s+nhỏ|bé|sơ\s+sinh)\b", 2.0),
        (r"\b\d+\s*(?:tháng|tuổi)(?!\s*(?:đầu|giữa|cuối))\b", 1.5),
        (r"\b\d+\s*kg\b", 2.0),
        (r"\bmg/kg\b", 2.5),
    ],
    "administration_timing": [
        (r"\b(?:trước\s+hay\s+sau\s+ăn|trước\s+ăn|sau\s+ăn|uống\s+lúc\s+nào|lúc\s+no|lúc\s+đói|cùng\s+bữa\s+ăn|sau\s+bữa\s+ăn|trước\s+bữa\s+ăn)\b", 3.5),
        (r"\b(?:uống\s+trước|uống\s+sau|uống\s+khi\s+nào|thời\s+điểm\s+uống|thời\s+điểm\s+dùng)\b", 2.5),
    ],
    "adult_dosage": [
        (r"\bliều\s+(?:dùng|lượng|tối\s+đa|uống|người\s+lớn)\b", 2.5),
        (r"\b(?:uống\s+mấy\s+viên|ngày\s+mấy\s+lần|cách\s+dùng|còn\s+liều)\b", 2.0),
        (r"\b(?:uống\s+thế\s+nào|dùng\s+thế\s+nào|uống\s+sao|dùng\s+sao|hướng\s+dẫn\s+sử\s+dụng|cách\s+sử\s+dụng)\b", 2.5),
        (r"\bliều\b", 2.0),
    ],
    "overdose_treatment": [
        (r"\b(?:quá\s+liều|ngộ\s+độc|xử\s+trí\s+quá\s+liều|giải\s+độc|thuốc\s+giải|antidote)\b", 3.5),
        (r"\b(?:uống\s+nhầm|uống\s+nhiều\s+quá|uống\s+quá\s+nhiều)\b", 2.5),
    ],
    "contraindications": [
        (r"\bchống\s+chỉ\s+định\b", 3.0),
        (r"\b(?:cấm\s+dùng|không\s+được\s+dùng|chống\s+dùng)\b", 2.5),
        (r"\b(?:có\s+dùng\s+được\s+không|có\s+uống\s+được\s+không|dùng\s+được\s+không)\b", 2.0),
        (r"\b(?:bị\s+hen|suy\s+gan|suy\s+thận|dị\s+ứng|loét\s+dạ\s+dày)\b", 1.5),
    ],
    "adverse_effects": [
        (r"\btác\s+dụng\s+(?:phụ|không\s+mong\s+muốn|có\s+hại)\b", 3.0),
        (r"\b(?:adr|dị\s+ứng|nổi\s+ban|phát\s+ban|buồn\s+nôn|chóng\s+mặt)\b", 2.0),
    ],
    "drug_interactions": [
        (r"\btương\s+tác(?:\s+thuốc)?\b", 3.0),
        (r"\b(?:tương\s+kỵ|kỵ\s+thuốc|kỵ\s+nhau)\b", 2.5),
        (r"\b(?:uống\s+cùng|dùng\s+cùng|phối\s+hợp|kết\s+hợp\s+với|dùng\s+chung)\b", 2.0),
    ],
    "indications": [
        (r"(?<!chống\s)(?<!chống)chỉ\s+định\b", 3.0),
        (r"\b(?:công\s+dụng|tác\s+dụng\s+chính)\b", 2.5),
        (r"\b(?:dùng\s+để\s+làm\s+gì|dùng\s+cho\s+bệnh\s+gì|chữa\s+bệnh\s+gì|điều\s+trị\s+bệnh\s+gì)\b", 2.5),
        (r"\b(?:điều\s+trị|chữa\s+trị)\b", 1.0),
    ],
    "pregnancy_warning": [
        (r"\b(?:phụ\s+nữ\s+mang\s+thai|phụ\s+nữ\s+có\s+thai|mang\s+thai|thai\s+kỳ|bà\s+bầu)\b", 3.0),
        (r"\b(?:cho\s+con\s+bú|nuôi\s+con\s+bằng\s+sữa\s+mẹ)\b", 3.0),
    ],
    "renal_adjustment": [
        (r"\b(?:chỉnh\s+liều\s+suy\s+thận|suy\s+thận|chỉnh\s+liều\s+thận)\b", 3.0),
        (r"\b(?:crcl|egfr|creatinin|chạy\s+thận|lọc\s+máu)\b", 2.5),
    ],
    "hepatic_adjustment": [
        (r"\b(?:chỉnh\s+liều\s+suy\s+gan|suy\s+gan|chỉnh\s+liều\s+gan|bệnh\s+gan)\b", 3.5),
        (r"\b(?:xơ\s+gan|viêm\s+gan|men\s+gan|tăng\s+men\s+gan|chức\s+năng\s+gan|child-pugh)\b", 2.5),
    ],
    "alcohol_interaction": [
        (r"\b(?:kỵ\s+rượu|uống\s+rượu|uống\s+bia|rượu\s+bia|chất\s+cồn|say\s+rượu|khi\s+say|với\s+rượu|với\s+bia|uống\s+rượu\s+được\s+không|uống\s+bia\s+được\s+không|kỵ\s+cồn)\b", 3.5),
        (r"\b(?:nghiện\s+rượu|uống\s+nhiều\s+rượu|uống\s+rượu\s+nhiều)\b", 3.0),
        (r"\b(?:rượu|bia)\b", 1.5),
        (r"\bcồn\b", 1.5),
    ],
    "food_interaction": [
        (r"\b(?:uống\s+cùng\s+sữa|với\s+sữa|uống\s+sữa|nước\s+cam|nước\s+bưởi|nước\s+ép\s+bưởi|thức\s+ăn|thức\s+ăn\s+giàu\s+canxi|kiêng\s+ăn\s+gì|kỵ\s+thức\s+ăn|uống\s+chung\s+sữa|dùng\s+cùng\s+sữa)\b", 3.5),
        (r"\b(?:sữa|nước\s+cam|nước\s+bưởi)\b", 2.0),
    ],
    "elderly_warning": [
        (r"\b(?:người\s+cao\s+tuổi|người\s+già|người\s+lớn\s+tuổi|trên\s+65\s+tuổi|bệnh\s+nhân\s+già)\b", 3.0),
    ],
    "ingredient": [
        (r"\b(?:thành\s+phần|hoạt\s+chất|chứa\s+chất\s+gì)\b", 3.0),
    ],
    "stock_inquiry": [
        (r"\b(?:tồn\s+kho|còn\s+bao\s+nhiêu|trong\s+kho|vị\s+trí\s+kho|số\s+lượng|so\s+luong|còn\s+lại|con\s+lai|số\s+hộp|số\s+viên|số\s+lọ)\b", 3.0),
        (r"\b(?:hạn\s+dùng|hạn\s+sử\s+dụng|fefo)\b", 2.5),
    ],
}

def score_clinical_intents(query: str) -> Dict[str, float]:
    """Chấm điểm mọi ý định lâm sàng trên câu hỏi (hỗ trợ cả có dấu và không dấu)."""
    q_norm = query.lower()
    q_unacc = _unaccent(query)
    scores: Dict[str, float] = {intent: 0.0 for intent in INTENT_FEATURE_WEIGHTS}

    for intent, patterns in INTENT_FEATURE_WEIGHTS.items():
        for pat, weight in patterns:
            # Ngăn ngừa va chạm unaccent của 'cồn' -> 'con' gây false-positive với 'còn' (còn lại, thế còn)
            if pat == r"\bcồn\b":
                if re.search(r"\bcồn\b", q_norm):
                    scores[intent] += weight
                continue
            pat_unacc = _unaccent(pat)
            if re.search(pat, q_norm) or re.search(pat_unacc, q_unacc):
                scores[intent] += weight

    # Xử lý quy tắc triệt tiêu (Priority Suppression):
    # Nếu có chỉ dấu nhi khoa rõ rệt, hạ điểm adult_dosage nếu adult_dosage chỉ có điểm thấp
    if scores["pediatric_dosage"] >= 2.0 and scores["adult_dosage"] <= 1.5:
        scores["adult_dosage"] = 0.0

    # Nếu có chỉ dấu suy thận rõ rệt, ưu tiên renal_adjustment
    if scores["renal_adjustment"] >= 2.5 and scores["adult_dosage"] <= 1.0:
        scores["adult_dosage"] = 0.5

    # Nếu có chỉ dấu tương tác rượu/thức ăn rõ rệt, triệt tiêu drug_interactions (tránh nhầm đòi 2 thuốc)
    if scores["alcohol_interaction"] >= 2.0:
        scores["drug_interactions"] = 0.0
    if scores["food_interaction"] >= 2.0:
        scores["drug_interactions"] = 0.0

    return scores

def rank_clinical_intents(query: str, min_score: float = 1.0) -> List[Tuple[str, float]]:
    """Trả về danh sách các ý định lâm sàng đạt ngưỡng điểm xếp từ cao xuống thấp."""
    scores = score_clinical_intents(query)
    ranked = [(k, v) for k, v in scores.items() if v >= min_score]
    ranked.sort(key=lambda x: x[1], reverse=True)
    return ranked

def get_primary_clinical_intent(query: str, default: str = "general_profile") -> str:
    """Xác định ý định lâm sàng nổi trội nhất."""
    ranked = rank_clinical_intents(query, min_score=1.0)
    return ranked[0][0] if ranked else default
