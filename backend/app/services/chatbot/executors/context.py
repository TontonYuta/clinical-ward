"""Shared execution context & pure helper utilities for Clinical Copilot Executors."""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from fastapi import Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.copilot import CopilotQuery

_CACHED_WORKFLOW_POLICY = None


def get_workflow_policy(policy_state):
    global _CACHED_WORKFLOW_POLICY
    from app.services.chatbot.workflow_policy import WorkflowPolicy, load_workflow_policy

    workflow_policy = getattr(getattr(policy_state, "state", None), "workflow_policy", None) if policy_state is not None else None
    if isinstance(workflow_policy, WorkflowPolicy):
        return workflow_policy
    if _CACHED_WORKFLOW_POLICY is None:
        from app.config import settings
        _CACHED_WORKFLOW_POLICY = load_workflow_policy(
            settings.WORKFLOW_POLICY_PATH,
            registered_executors={
                "conversation", "drug_lookup", "portal_guidance", "ddi",
                "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent",
            },
        )
    return _CACHED_WORKFLOW_POLICY


def resolve_copilot_identity(payload: CopilotQuery, request: Request, session=None) -> tuple[str, str, str]:
    authenticated = getattr(getattr(request, "state", None), "authenticated_user", None)
    generic_placeholders = {"Nhân viên y tế", "Bác sĩ", "ĐD. Lê Thị Thu", "nurse"}
    if authenticated and authenticated.username != "test_director":
        user_name = getattr(authenticated, "name", None) or authenticated.username
        user_role = authenticated.role
        req_session = (payload.session_id or getattr(session, "session_id", "default_session")).strip()
        session_id = req_session if req_session.startswith(f"{user_name.casefold()}:") else f"{user_name.casefold()}:{req_session}"
        return user_name, user_role, session_id

    if session and getattr(session, "user_name", None):
        user_name = payload.user_name if payload.user_name and payload.user_name not in generic_placeholders else session.user_name
        user_role = payload.user_role if payload.user_role else getattr(session, "user_role", "doctor")
        return user_name, user_role, session.session_id

    user_name = payload.user_name if payload.user_name and payload.user_name not in generic_placeholders else (authenticated.username if authenticated else "Đồng nghiệp")
    user_role = payload.user_role or (authenticated.role if authenticated else "doctor")
    req_session = (payload.session_id or "default_session").strip()
    session_id = req_session if req_session.startswith(f"{user_name.casefold()}:") else f"{user_name.casefold()}:{req_session}"
    return user_name, user_role, session_id


@dataclass
class WorkflowExecutionContext:
    """Single immutable-identity state container passed through Managed Executors & Fallback."""

    payload: CopilotQuery
    request: Request
    db: AsyncSession
    session: Any
    history: str
    user_name: str
    user_role: str
    session_id: str
    query: str
    lower_query: str
    nlu_res: Any = None
    workflow_context: Any = None
    workflow_decision: Any = None
    inference_required: bool = False
    is_field_inquiry: bool = False
    policy_state: Any = None
    core_handler_fn: Optional[Callable[..., Any]] = None
    orch_module: Any = None
    tried_stages: set[str] = field(default_factory=set)

    @property
    def workflow_intent(self) -> str:
        return getattr(self.workflow_decision, "intent", "") if self.workflow_decision else ""

    @property
    def executor_key(self) -> str:
        return getattr(self.workflow_decision, "executor_key", "") if self.workflow_decision else ""


def normalize_conversational_query(text: str) -> str:
    cleaned = (text or "").strip()
    prefix_patterns = [
        r"^(?:kính gửi|kinh gui)\s+(?:bác sĩ|bac si|dược sĩ|duoc si|thầy|cô)?\s*,\s*(?:cho\s+(?:em|tôi|mình)\s+hỏi\s*|cho\s+hỏi\s*|hỏi\s*)?",
        r"^(?:kính gửi|kinh gui)\s+(?:bác sĩ|bac si|dược sĩ|duoc si|thầy|cô)?\s*:\s*",
        r"^(?:bs|bác sĩ|dược sĩ)\s+ơi\s*,?\s*(?:cho\s+(?:em|tôi|mình)\s+hỏi\s*|cho\s+hỏi\s*|hỏi\s*)?",
        r"^(?:tư vấn chuyên môn|hội chẩn chuyên môn|tra cứu chuyên môn)\s*(?:giúp\s+(?:tôi|em|mình))?\s*:\s*",
        r"^(?:đồng nghiệp|dong nghiep)\s+hỗ trợ\s+tra cứu\s*:\s*",
        r"^(?:cho\s+(?:mình|em|tôi)\s+hỏi\s+(?:chi tiết|nhanh|rõ)?\s*(?:về\s+ca\s+này)?\s*:\s*)",
        r"^(?:xin hỏi|cho hỏi|nhờ hỗ trợ|hỗ trợ tra cứu)\s*:\s*",
    ]
    for p in prefix_patterns:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE).strip()

    suffix_patterns = [
        r"\s*(?:đối với|cho)\s+bệnh nhân này\s*\??$",
        r"\s*theo phác đồ hướng dẫn\s*\??$",
        r"\s*theo đúng chuẩn dược thư và bộ y tế\s*\??$",
        r"\s*theo chuẩn dược thư\s*\??$",
        r"\s*được không ạ\s*\??$",
        r"\s*có được không\s*\??$",
        r"\s*ạ\s*\??$",
        r"\s*\?+$",
    ]
    for p in suffix_patterns:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned if len(cleaned) >= 3 else text


def portal_guidance_text() -> str:
    return (
        "### CỔNG TRA CỨU THUỐC\n\n"
        "Hãy nhập tên biệt dược, hoạt chất hoặc số đăng ký để tra cứu trong các nguồn hiện có."
        " Nếu chưa tìm thấy tài liệu phù hợp, hệ thống sẽ yêu cầu bổ sung hoặc thông báo chưa có nguồn xác minh.\n\n"
        "Bạn cũng có thể mở mục Thông tin thuốc để tìm kiếm trong danh mục."
    )


async def portal_catalog_counts(db: AsyncSession) -> tuple[int, int]:
    from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
    drug_result = await db.execute(select(func.count()).select_from(DavNationalDrug))
    monograph_result = await db.execute(select(func.count()).select_from(ClinicalDrugMonograph))
    return int(drug_result.scalar_one()), int(monograph_result.scalar_one())


def portal_guidance_text_with_counts(drug_count: int, monograph_count: int) -> str:
    return f"{portal_guidance_text()}\n\nDanh mục hiện có {drug_count:,} thuốc và {monograph_count:,} chuyên luận."


def requested_fields_from_managed_schema(
    query: str,
    requested_field: str | None = None,
    requested_fields: list[str] | None = None,
) -> list[str]:
    """Resolve requested facets without widening a specific NLU field."""
    from app.services.chatbot.intent_feature_matrix import rank_clinical_intents

    scored_fields = [field for field, _ in rank_clinical_intents(query, min_score=2.5)]
    nlu_fields = list(dict.fromkeys(requested_fields or []))
    if scored_fields:
        if len(nlu_fields) > 1 and all(field in scored_fields for field in nlu_fields):
            return nlu_fields
        q_low = f" {(query or '').casefold()} "
        has_compound_conj = any(conj in q_low for conj in (" và ", " cùng ", " kèm ", ", "))
        if len(scored_fields) >= 2 and has_compound_conj and len(nlu_fields) < len(scored_fields):
            return list(dict.fromkeys([*scored_fields, *nlu_fields]))
        matched_nlu_fields = [field for field in nlu_fields if field in scored_fields]
        if matched_nlu_fields:
            return matched_nlu_fields
        return scored_fields
    if nlu_fields:
        return nlu_fields
    field_map = {
        "dosage": ("adult_dosage", "pediatric_dosage"),
        "pediatric": ("pediatric_dosage",),
        "renal": ("renal_adjustment",),
        "hepatic": ("hepatic_adjustment",),
        "contraindications": ("contraindications",),
        "adverse_effects": ("adverse_effects",),
        "interactions": ("drug_interactions",),
        "pregnancy": ("pregnancy_warning",),
        "timing": ("administration_timing",),
        "administration": ("administration_timing",),
    }
    specific_fields = field_map.get(requested_field or "")
    if specific_fields:
        matching = [field for field in scored_fields if field in specific_fields]
        return matching if matching else [specific_fields[0]]
    return scored_fields
