"""
Adaptive Clinical Query Classifier & Context Budgeting (NAACL 2024 Adaptive-RAG).
Phân tầng độ phức tạp câu hỏi lâm sàng để cấp phát ngân sách retrieval (top_k, max_chars).
"""
import re
from dataclasses import dataclass
from typing import Optional, List
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications

@dataclass(frozen=True)
class QueryBudgetConfig:
    complexity_level: int       # 1: Đơn thuộc tính/Chuyên khảo; 2: Đa thực thể/Tương tác/Phức tạp
    top_k: int                  # Số chunks tối đa cần trích xuất
    max_context_chars: int      # Ngân sách ký tự tối đa đưa vào LLM Prompt
    include_graph: bool         # Có cần nhồi toàn bộ đồ thị tri thức DDI hay không
    reason: str                 # Lý do phân loại ngân sách

COMPLEX_CLINICAL_KEYWORDS = (
    "tương tác", "tuong tac", "uống cùng", "uong cung", "phối hợp", "phoi hop",
    "kết hợp", "ket hop", "uống chung", "uong chung", "dùng chung", "dung chung",
    "đổi sang", "doi sang", "chuyển sang", "chuyen sang", "thay thế", "thay the",
    "thay bằng", "suy thận", "suy than", "suy gan", "egfr", "creatinin", "creatinine",
    "phản vệ", "phan ve", "cấp cứu", "cap cuu", "ngộ độc", "ngo doc", "quá liều", "qua lieu",
    "xử trí", "xu tri", "mang thai", "thai kỳ", "thai ky", "cho con bú", "cho con bu",
    "trẻ em", "tre em", "sơ sinh", "so sinh", "người cao tuổi", "đa bệnh"
)

SINGLE_ATTRIBUTE_CUES = (
    "liều tối đa", "lieu toi da", "liều dùng", "lieu dung", "liều lượng", "lieu luong",
    "chỉ định", "chi dinh", "chống chỉ định", "chong chi dinh",
    "tác dụng phụ", "tac dung phu", "tác dụng không mong muốn", "adr",
    "cơ chế", "co che", "thời gian bán thải", "dược động học",
    "cách dùng", "cach dung", "uống lúc nào", "dạng bào chế", "hạn dùng"
)

def classify_query_complexity(query: str, resolved_drugs: Optional[List[str]] = None) -> QueryBudgetConfig:
    """
    Phân loại độ phức tạp câu hỏi lâm sàng theo chuẩn Adaptive-RAG (NAACL 2024).
    Tự động cấp phát ngân sách retrieval (top_k, max_chars):
    - Đơn thuộc tính: top_k=1-2 để tiết kiệm token.
    - Đa ý / Đa thuộc tính / Đa thực thể / Tương tác: top_k=3-5, max_chars=3500-4500 để trả lời trọn vẹn.
    """
    clean_q = (query or "").lower().strip()
    if not clean_q:
        return QueryBudgetConfig(1, 1, 1000, False, "empty_query")

    drugs = resolved_drugs if resolved_drugs is not None else resolve_registered_medications(clean_q)
    num_drugs = len(drugs)

    # Đếm số lượng thuộc tính lâm sàng được hỏi trong câu (liều, chỉ định, adr, quá liều...)
    matched_attrs = [cue for cue in SINGLE_ATTRIBUTE_CUES if cue in clean_q]
    has_multi_intent_connectors = any(conn in clean_q for conn in (
        " và ", " kèm ", " đồng thời ", " cùng với ", " ngoài ra ", " còn ", "những ý", "các ý"
    ))
    is_multi_attribute = len(matched_attrs) >= 2 or (len(matched_attrs) >= 1 and has_multi_intent_connectors)

    # 1. Phát hiện câu hỏi đa ý / phức tạp (Đa thuốc, Đa thuộc tính, Tương tác, Suy tạng, Đổi thuốc, Quá liều)
    has_complex_keyword = any(k in clean_q for k in COMPLEX_CLINICAL_KEYWORDS)
    if num_drugs >= 2 or has_complex_keyword or is_multi_attribute:
        target_k = min(5, max(3, len(matched_attrs) + 1 if is_multi_attribute else 3))
        return QueryBudgetConfig(
            complexity_level=2,
            top_k=target_k,
            max_context_chars=4000,
            include_graph=True,
            reason="complex_multi_entity_or_multi_attribute"
        )

    # 2. Câu hỏi đơn thuộc tính (Tra cứu liều, chỉ định, tác dụng phụ của 1 thuốc)
    has_single_attr = len(matched_attrs) == 1
    if num_drugs == 1 and has_single_attr:
        return QueryBudgetConfig(
            complexity_level=1,
            top_k=1,
            max_context_chars=1400,
            include_graph=False,
            reason="single_drug_specific_attribute"
        )

    # 3. Câu hỏi tra cứu thuốc đơn lẻ thông thường
    if num_drugs == 1:
        return QueryBudgetConfig(
            complexity_level=1,
            top_k=1,
            max_context_chars=1600,
            include_graph=False,
            reason="single_drug_general_lookup"
        )

    # 4. Fallback mặc định cho các câu hỏi tổng quát
    return QueryBudgetConfig(
        complexity_level=1,
        top_k=2,
        max_context_chars=2000,
        include_graph=False,
        reason="default_general_clinical_query"
    )
