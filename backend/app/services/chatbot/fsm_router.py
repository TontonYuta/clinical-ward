"""
Explicit Finite State Machine (FSM) Context Router (<=180 LOC).
Điều phối hội thoại đa lượt xác định dựa trên trạng thái FSM (Zero-Hallucination & O(1) routing).
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.session_context import SessionState
from app.services.copilot_drug_lookup import lookup_drug_authoritative
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.copilot_catalog import find_matched_med

EXPAND_PATTERNS = (
    "thông tin đầy đủ", "chi tiết nhất", "đầy đủ nhất", "hồ sơ đầy đủ",
    "toàn bộ thông tin", "chi tiết đầy đủ", "tóm tắt mà", "cho xem đầy đủ",
    "cho tôi xem đầy đủ", "thông tin chi tiết", "chi tiết hơn", "đầy đủ hơn",
    "thong tin day du", "chi tiet nhat", "day du nhat", "ho so day du"
)

SUMMARY_PATTERNS = (
    "tóm tắt thôi", "tóm tắt lại", "tóm tắt thông tin", "chỉ cần tóm tắt",
    "tom tat thoi", "tom tat lai", "tom tat"
)

DDI_INQUIRY_PATTERNS = (
    "kỵ gì", "kỵ thuốc gì", "tương tác với thuốc nào", "tương kỵ với gì",
    "có tương tác gì không", "tránh dùng chung với gì", "tránh phối hợp với"
)

def has_explicit_new_medication(lower_query: str, current_active_drug: Optional[str]) -> bool:
    """Kiểm tra người dùng có đang chủ động đổi sang một thuốc hoàn toàn mới không."""
    for key, entry in DRUG_REGISTRY.items():
        if current_active_drug and key.casefold() in current_active_drug.casefold():
            continue
        for alias in entry.get("aliases", []):
            if len(alias) >= 4 and alias.casefold() in lower_query:
                if current_active_drug and alias.casefold() in current_active_drug.casefold():
                    continue
                return True
    matched = find_matched_med(lower_query)
    matched_name = matched.get("name", "") if isinstance(matched, dict) else (matched or "")
    if matched_name and current_active_drug and matched_name.casefold() not in current_active_drug.casefold():
        return True
    return False

async def route_fsm_context(
    query: str,
    lower_query: str,
    db: AsyncSession,
    *,
    session: SessionState,
    session_id: str,
    user_name: str,
    user_role: str
) -> Optional[CopilotResponse]:
    """
    Xử lý theo FSM State của từng session riêng biệt.
    Nếu đang trong DRUG_FOCUSED và người dùng hỏi tiếp các trường liên quan:
    -> Điều phối trực tiếp O(1) vào thuốc đang active, ngăn chặn 100% rơi vào RAG hoặc nhầm thuốc.
    """
    if session.fsm_state == "DRUG_FOCUSED" and session.active_medication_name:
        if has_explicit_new_medication(lower_query, session.active_medication_name):
            return None

        is_expand = any(p in lower_query for p in EXPAND_PATTERNS)
        if is_expand:
            target_kw = session.active_medication_sdk or session.active_medication_name
            expand_query = f"thông tin đầy đủ của {target_kw}"
            return await lookup_drug_authoritative(
                expand_query, db, session_id=session_id, user_name=user_name, user_role=user_role
            )

        is_summary = any(p in lower_query for p in SUMMARY_PATTERNS)
        if is_summary:
            target_kw = session.active_medication_sdk or session.active_medication_name
            summary_query = f"tóm tắt {target_kw}"
            return await lookup_drug_authoritative(
                summary_query, db, session_id=session_id, user_name=user_name, user_role=user_role
            )

        is_ddi_ask = any(p in lower_query for p in DDI_INQUIRY_PATTERNS)
        if is_ddi_ask:
            target_kw = session.active_medication_ingredient or session.active_medication_name
            ddi_query = f"tương tác của {target_kw}"
            return await lookup_drug_authoritative(
                ddi_query, db, session_id=session_id, user_name=user_name, user_role=user_role
            )

    return None
