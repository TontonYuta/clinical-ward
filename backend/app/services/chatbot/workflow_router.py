"""Domain-neutral request preparation and managed intent decision helpers."""
from __future__ import annotations

from typing import Any

from app.services.chatbot.workflow_models import ClinicalRequestContext, RouteDecision
from app.services.chatbot.workflow_policy import WorkflowPolicy


def prepare_request(
    original_query: str,
    *,
    user_role: str,
    nlu_result: Any,
    session: Any = None,
    history_reference: str | None = None,
    normalized_query: str | None = None,
    rewritten_query: str | None = None,
) -> ClinicalRequestContext:
    """Capture request identity and unambiguous entity context without reclassifying."""
    explicit_entity = getattr(nlu_result, "primary_drug", None) if nlu_result is not None else None
    deictic = bool(getattr(nlu_result, "is_deictic_referent", False)) if nlu_result is not None else False
    session_entity = getattr(session, "active_medication_name", None) if session is not None else None
    required_entities = [explicit_entity] if explicit_entity else ([session_entity] if deictic and session_entity else [])
    patient_ref = getattr(session, "active_patient_id", None) if session is not None else None
    if not isinstance(patient_ref, str):
        patient_ref = None
    return ClinicalRequestContext(
        original_query=original_query,
        normalized_query=normalized_query if normalized_query is not None else original_query.strip(),
        rewritten_query=rewritten_query,
        history_reference=history_reference,
        user_role=user_role,
        patient_context_reference=patient_ref,
        required_entities=required_entities,
    )


def decide_route(
    context: ClinicalRequestContext, nlu_result: Any, policy: WorkflowPolicy,
    *, fallback_intent: str | None = None,
) -> RouteDecision:
    """Resolve exactly one managed route for a validated NLU intent."""
    intent = str(getattr(nlu_result, "intent", "") or "").strip()
    reason_code = "managed_nlu_intent"
    if nlu_result is not None:
        signals = {
            "prescription_block": bool(getattr(nlu_result, "is_prescription_block", False)),
            "multiple_subqueries": len(getattr(nlu_result, "sub_queries", []) or []) >= 2,
        }
        for rule in policy.decision_precedence:
            if signals.get(rule.signal, False):
                intent = rule.intent
                reason_code = f"managed_precedence:{rule.signal}"
                break
    if not intent and fallback_intent:
        intent = fallback_intent
        reason_code = "managed_nlu_unavailable_fallback" if nlu_result is None else "managed_ambiguous_intent_fallback"
    elif not intent:
        raise ValueError("no managed route: NLU intent is absent")
    route = policy.routes.get(intent)
    if route is None:
        raise ValueError(f"no managed route for NLU intent: {intent}")
    return RouteDecision(
        intent=intent,
        executor_key=route.executor_key,
        reason_code=reason_code,
        required_entities=context.required_entities,
        evidence_required=route.evidence_required,
    )
