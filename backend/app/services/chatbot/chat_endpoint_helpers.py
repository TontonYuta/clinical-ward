"""
Shared Endpoint Helpers for `/copilot/chat` and `/copilot/chat/stream`.
Ensures 100% behavioral parity between sync and streaming endpoints (cache eligibility,
regulatory session reset, stale-cache recompute, Goal Alignment persistence, and stage timing).
"""
from __future__ import annotations

import time
from typing import Any, Callable, Dict, Optional

from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.security.prompt_isolator import check_goal_alignment

_GREETING_TOKENS = (
    "xin chào", "chào", "hello", "hi", "hey", "cảm ơn", "cam on", "thanks", "ok", "oke"
)

_CONTEXT_OR_PATIENT_TOKENS = (
    "này", "đó", "kia", "nó", "vừa rồi", "thuốc này", "thuốc đó", "thuốc có", "thuốc kia",
    "hai thuốc", "2 thuốc", "tuổi", "kg", "creatinin", "crcl", "egfr", "bệnh nhân",
    "người bệnh", "suy thận", "chỉnh liều",
)

_REGULATORY_TOKENS = (
    "thông tư", "tt 26", "tt 20", "tt 51", "tt 36", "tt 22", "tt 52",
    "nghị định", "luật dược", "quy chế", "quản lý", "chuỗi lạnh", "fefo",
    "kê đơn", "đơn thuốc", "bảo hiểm", "bhyt",
)


class StageTimer:
    """Lightweight per-request stage latency tracker (ms) for workflow observability."""

    def __init__(self) -> None:
        now = time.monotonic()
        self._start = now
        self._last = now
        self.timings: Dict[str, float] = {}

    def mark(self, stage: str) -> float:
        now = time.monotonic()
        elapsed_ms = round((now - self._last) * 1000.0, 1)
        self.timings[stage] = round(self.timings.get(stage, 0.0) + elapsed_ms, 1)
        self._last = now
        return elapsed_ms

    def total_ms(self) -> float:
        return round((time.monotonic() - self._start) * 1000.0, 1)


def is_regulatory_query(lower_q: str) -> bool:
    return any(w in lower_q for w in _REGULATORY_TOKENS)


def is_short_greeting(lower_q: str) -> bool:
    stripped = (lower_q or "").strip()
    return len(stripped.split()) <= 4 and any(
        stripped == g or stripped.startswith(g + " ") for g in _GREETING_TOKENS
    )


def is_context_or_patient_dependent(lower_q: str, session: Any) -> bool:
    if any(w in lower_q for w in _CONTEXT_OR_PATIENT_TOKENS):
        return True
    active_med = getattr(session, "active_medication_name", None)
    if active_med and active_med.casefold() not in lower_q:
        return True
    return False


def can_use_clinical_cache(payload: CopilotQuery, lower_q: str, session: Any) -> bool:
    if getattr(payload, "bypass_cache", False):
        return False
    if payload.image_base64 or payload.enable_web_search:
        return False
    if is_short_greeting(lower_q):
        return False
    if any(w in lower_q for w in _CONTEXT_OR_PATIENT_TOKENS):
        return False
    active_med = getattr(session, "active_medication_name", None)
    if active_med:
        has_explicit_drug = bool(active_med.casefold() in lower_q)
        if not has_explicit_drug:
            try:
                from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
                has_explicit_drug = bool(get_drug_lexical_matcher().extract_medications(payload.query))
            except Exception:
                has_explicit_drug = False
        if not has_explicit_drug:
            return False
    return True


def can_use_verified_qa(payload: CopilotQuery, lower_q: str, session: Any) -> bool:
    """Unified eligibility gate for Verified Q&A Knowledge Graph lookup across /chat & /chat/stream."""
    if getattr(payload, "bypass_cache", False):
        return False
    if payload.image_base64 or payload.enable_web_search:
        return False
    if is_short_greeting(lower_q):
        return False
    if any(w in lower_q for w in _CONTEXT_OR_PATIENT_TOKENS):
        return False
    return True


def sync_session_from_vqa_node(session: Any, verified_node: Optional[dict], is_reg: bool) -> Optional[str]:
    """Keep `session.active_medication_name` synchronized when a turn is served by a VQA node."""
    if not verified_node or is_reg or session is None or not hasattr(session, "set_active_medication"):
        return None
    entities = verified_node.get("entities") or []
    if not entities:
        return None
    try:
        from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
        matcher = get_drug_lexical_matcher()
        for ent in entities:
            if not isinstance(ent, str) or len(ent.strip()) < 3:
                continue
            if matcher.extract_medications(ent):
                session.set_active_medication(name=ent.strip())
                return ent.strip()
    except Exception:
        pass
    return None


def resolve_default_telemetry_model(
    response: CopilotResponse,
    *,
    cached_resp: bool,
    last_exec: Optional[dict],
) -> tuple[str, str]:
    """Consistent default (model_name, provider) resolution shared by /chat & /chat/stream."""
    exec_data = last_exec or {}
    if cached_resp:
        return "clinical-cache-engine", "local-cache"
    if response.intent in ("MEDICATION_INTERACTION_BLOCKED", "CLINICAL_CONTRAINDICATION_BLOCKED"):
        return "safety-ddi-matrix", "clinical-safety"
    if response.intent in ("SECURITY_GUARDRAIL_BLOCKED", "OFFTOPIC_DECLINED"):
        return "clinical-guardrail-v2", "system-guardrail"
    if exec_data.get("model_call_count", 0) > 0 and getattr(response, "model_name", None) and response.model_name not in ("gemini-2.5-flash", None):
        return str(response.model_name), str(getattr(response, "provider", "gemini") or "gemini")
    if (exec_data.get("model_call_count", 0) > 0 or exec_data.get("call_count", 0) > 0) and exec_data.get("model"):
        return str(exec_data["model"]), str(exec_data.get("provider", "gemini") or "gemini")
    return "local-rag-engine", "local"


def apply_regulatory_session_reset(session: Any, lower_q: str) -> bool:
    is_reg = is_regulatory_query(lower_q)
    if is_reg and session is not None and hasattr(session, "set_active_medication"):
        session.set_active_medication(name="", ingredient="", sdk="")
    return is_reg


def lookup_validated_clinical_cache(
    clinical_cache: Any,
    *,
    query: str,
    user_role: str,
    session: Any,
    is_reg: bool,
    validate_fn: Callable[[CopilotResponse], CopilotResponse],
    standardize_fn: Callable[[CopilotResponse, str], CopilotResponse],
) -> Optional[CopilotResponse]:
    cached_resp = clinical_cache.get(query, user_role=user_role)
    if not cached_resp:
        return None
    validated = validate_fn(cached_resp.model_copy(deep=True))
    if validated.answer_type == "safe_abstention" or (
        cached_resp.intent == "MEDICATION_SAFETY_PROFILE"
        and not getattr(cached_resp, "clinical_summary", None)
    ):
        return None
    validated.session_id = session.session_id
    validated = standardize_fn(validated, query)
    session.append_conversation_turn(query, validated.reply_text)
    if validated.active_medication_name and not is_reg:
        session.set_active_medication(name=validated.active_medication_name)
    elif getattr(session, "active_medication_name", None) and not is_reg:
        validated.active_medication_name = session.active_medication_name
    return validated


def persist_aligned_cache_and_vqa(
    *,
    payload: CopilotQuery,
    response: CopilotResponse,
    user_role: str,
    lower_q: str,
    session: Any,
    pre_guard: Any,
    clinical_cache: Any,
    vqa_service: Any,
) -> bool:
    """
    Apply Goal Alignment Check + Crescendo risk bookkeeping, then persist clean independent
    clinical responses into LRU cache & Verified Q&A graph. Returns `is_aligned`.
    """
    is_context_dep = is_context_or_patient_dependent(lower_q, session)
    is_security_blocked = (
        response.intent == "SECURITY_GUARDRAIL_BLOCKED"
        or "Output Rail Blocked" in (response.reply_text or "")
    )
    is_aligned, _ = check_goal_alignment(
        payload.query,
        response.reply_text or "",
        intent=response.intent or "",
    )
    soft_delta = float(getattr(pre_guard, "soft_risk_delta", 0.0) or 0.0)
    if soft_delta > 0 and hasattr(session, "record_security_signal"):
        session.record_security_signal(soft_delta, "soft_escalation_probe", blocked=False)
    elif not is_security_blocked and is_aligned and hasattr(session, "decay_security_risk"):
        session.decay_security_risk()

    eligible_for_persistence = (
        not is_security_blocked
        and is_aligned
        and soft_delta == 0.0
        and not is_context_dep
        and not payload.enable_web_search
    )
    if eligible_for_persistence and response.answer_type not in ("clarification", "safe_abstention"):
        clinical_cache.set(payload.query, user_role, response)

    if eligible_for_persistence and response.intent != "GROUNDED_WEB_SEARCH":
        vqa_service.auto_register_candidate(
            payload.query,
            response,
            source="copilot_rag",
        )
    return is_aligned
