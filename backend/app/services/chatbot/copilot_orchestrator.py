"""
Orchestration pipeline for Clinical Copilot Chat (<=200 LOC).
Clean Single-Pass Executor Registry + Parallel Speculative RAG Prefetch.
"""
import asyncio
import sys
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.clinical_nlu import ClinicalNluExtraction
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.security.guardrails import validate_input_guardrail, validate_output_guardrail
from app.services.chatbot.conversational_handler import (
    handle_greeting_and_acknowledgment,
    handle_out_of_scope_or_pricing,
)
from app.services.chatbot.copilot_response_postprocessor import post_process_copilot_response
from app.services.chatbot.evidence_contract_validator import (
    _has_verified_source_version,
    validate_response_evidence_contract,
)
from app.services.chatbot.executors import (
    WorkflowExecutionContext,
    dispatch_managed_workflow,
    run_fallback_clinical_pipeline,
)
from app.services.chatbot.executors.context import (
    get_workflow_policy as _get_workflow_policy,
    normalize_conversational_query,
    portal_catalog_counts as _portal_catalog_counts,
    portal_guidance_text as _portal_guidance_text,
    portal_guidance_text_with_counts as _portal_guidance_text_with_counts,
    requested_fields_from_managed_schema as _requested_fields_from_managed_schema,
    resolve_copilot_identity,
)
from app.services.chatbot.field_routing import handle_field_or_drug_inquiry, handle_interaction_clarification
from app.services.chatbot.hospital_business_dispatcher import dispatch_clinical_subflows, dispatch_operational_business
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
from app.services.chatbot.multiturn_handler import resolve_active_drug_and_terms
from app.services.chatbot.pure_rag_handler import is_qualified_clinical_rag_query
from app.services.chatbot.sandwich_pipeline import execute_clinical_sandwich_pipeline
from app.services.chatbot.session_routing import FIELD_ONLY_TERMS, check_renal_adjustment_request
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_lookup import lookup_drug_authoritative


async def _handle_copilot_chat_core(
    payload: CopilotQuery,
    request: Request,
    db: AsyncSession,
    *,
    session,
    history: str,
    pre_validated_query: str | None = None,
) -> CopilotResponse:
    user_name, user_role, session_id = resolve_copilot_identity(payload, request, session=session)
    if pre_validated_query is not None:
        query = pre_validated_query
    else:
        guard_res = validate_input_guardrail(
            payload.query, user_role=user_role, history=history,
            session_risk_score=getattr(session, "security_risk_score", 0.0),
            blocked_turn_count=getattr(session, "blocked_turn_count", 0),
        )
        if not guard_res.is_safe:
            return CopilotResponse(
                intent="SECURITY_GUARDRAIL_BLOCKED", reply_text=guard_res.safe_response,
                legal_basis="OWASP LLM01:2025, TT 20/2017 & An toàn An ninh Y tế",
                suggested_chips=["Tra cứu Dược Thư Quốc Gia", "Quy chế thuốc gây nghiện TT 20", "Hướng dẫn sử dụng hệ thống"],
            )
        query = guard_res.sanitized_query
    lower_query = query.lower()

    if payload.image_base64:
        from app.services.chatbot.multimodal_vision_handler import handle_multimodal_vision_turn
        vision_resp = await handle_multimodal_vision_turn(payload, user_role=user_role)
        if vision_resp is not None:
            return vision_resp

    if len(lower_query.split()) <= 6:
        fast_greeting = handle_greeting_and_acknowledgment(lower_query, user_name, user_role)
        if fast_greeting is not None:
            session.set_active_medication(name="", ingredient="", sdk="")
            return fast_greeting.model_copy(update={"session_id": session_id})

    from app.services.chatbot.semantic_navigation_router import route_semantic_navigation
    nav_response = await route_semantic_navigation(query, lower_query=lower_query, user_role=user_role)
    if nav_response is not None:
        if session is not None and hasattr(session, "append_conversation_turn"):
            session.append_conversation_turn(payload.query, nav_response.reply_text)
        return nav_response.model_copy(update={"session_id": session_id})

    if payload.enable_web_search:
        from app.services.chatbot.grounded_web_search_handler import handle_grounded_web_search_turn
        web_search_resp = await handle_grounded_web_search_turn(payload, user_role=user_role, session=session, history=history)
        if web_search_resp is not None:
            if session is not None and hasattr(session, "append_conversation_turn"):
                session.append_conversation_turn(payload.query, web_search_resp.reply_text)
            return web_search_resp.model_copy(update={"session_id": session_id})

    from app.services.chatbot.clinical_text_sanitizer import sanitize_clinical_input
    query = sanitize_clinical_input(query).clean_query
    lower_query = query.lower()

    early_boundary = handle_out_of_scope_or_pricing(lower_query)
    if early_boundary is not None:
        return early_boundary.model_copy(update={"session_id": session_id})

    # Speculative Parallel Prefetch: warm Hybrid RAG concurrently while Gemini NLU runs
    from app.services.chatbot.gemini_nlu_router import _has_explicit_context_reference, parse_clinical_nlu
    from app.services.rag.rag_pipeline import prefetch_clinical_rag_evidence

    prefetch_task = (
        asyncio.create_task(prefetch_clinical_rag_evidence(query))
        if is_qualified_clinical_rag_query(lower_query, session)
        else None
    )
    try:
        nlu_res = await parse_clinical_nlu(query, history=history, active_med=session.active_medication_name)
    finally:
        if prefetch_task is not None and not prefetch_task.done():
            prefetch_task.cancel()
        elif prefetch_task is not None:
            try:
                prefetch_task.result()
            except Exception:
                pass

    from app.services.chatbot.workflow_router import decide_route, prepare_request
    policy_state = request.scope.get("app") if hasattr(request, "scope") and isinstance(getattr(request, "scope", None), dict) else None
    workflow_policy = _get_workflow_policy(policy_state)

    if not nlu_res:
        fallback_intent = "CLINICAL_CASE_CLARIFICATION"
        workflow_context = prepare_request(payload.query, normalized_query=query, user_role=user_role, nlu_result=ClinicalNluExtraction(intent=fallback_intent), session=session)
        workflow_decision = decide_route(workflow_context, None, workflow_policy, fallback_intent=fallback_intent).model_copy(update={"reason_code": "managed_nlu_unavailable_fallback"})
        if policy_state is not None:
            request.state.workflow_context = workflow_context
            request.state.workflow_route = workflow_decision
        return CopilotResponse(
            intent=fallback_intent, answer_type="clarification", source_status="nlu_unavailable",
            reply_text="Chưa xác định được chủ đề từ bộ phân loại hiện tại. Vui lòng nêu rõ tên thuốc, hoạt chất, văn bản hoặc nghiệp vụ cần tra cứu.",
            confidence=1.0, abstention_reason="Bộ phân loại ý định tạm thời không khả dụng", session_id=session_id,
        )

    request.state.clinical_nlu_result = nlu_res
    from app.services.chatbot.answer_operation import requires_reference_note
    inference_required = requires_reference_note(nlu_res)
    workflow_context = prepare_request(payload.query, normalized_query=query, user_role=user_role, nlu_result=nlu_res, session=session)

    is_field_inquiry = bool(session.active_medication_name and any(term in lower_query for term in FIELD_ONLY_TERMS))
    query_has_med = bool(get_drug_lexical_matcher().extract_medications(query) or resolve_registered_medications(query) or find_matched_med(lower_query))
    has_session_ref = bool(
        session.active_medication_name and _has_explicit_context_reference(query)
        and (is_field_inquiry or getattr(nlu_res, "conversation_mode", "independent") == "contextual_followup"
             or getattr(nlu_res, "is_deictic_referent", False) or getattr(nlu_res, "intent", "") == "MEDICATION_INTERACTION_CLARIFICATION")
    )
    if (
        session.active_medication_name and not query_has_med and not has_session_ref
        and getattr(nlu_res, "intent", "") in {"MEDICATION_LOOKUP", "MEDICATION_INTERACTION_CHECK", "PATIENT_CASE_REASONING", "PATIENT_MEDICATION_COUNSELING"}
    ):
        session.set_active_medication(name="", ingredient="", sdk="")
        is_clinical_topic_shift = is_qualified_clinical_rag_query(lower_query, None) or lower_query.startswith("thuốc ")
        if not is_clinical_topic_shift:
            from app.services.chatbot.conversational_steering import handle_gentle_chitchat_steering
            return handle_gentle_chitchat_steering(
                query, out_of_scope_type="GENERAL_CHITCHAT", user_name=user_name, user_role=user_role, session_id=session_id
            ).model_copy(update={"source_status": "unanchored_turn"})

    if getattr(nlu_res, "conversation_mode", "independent") == "independent" and not getattr(nlu_res, "is_deictic_referent", False) and not is_field_inquiry:
        workflow_context = workflow_context.model_copy(update={"required_entities": []})
    nlu_intent = str(getattr(nlu_res, "intent", "") or "").strip()
    workflow_decision = decide_route(
        workflow_context, nlu_res, workflow_policy,
        fallback_intent="AMBIGUOUS_INTENT" if nlu_intent not in workflow_policy.routes else None,
    )
    if policy_state is not None:
        request.state.workflow_context = workflow_context
        request.state.workflow_route = workflow_decision

    exec_ctx = WorkflowExecutionContext(
        payload=payload, request=request, db=db, session=session, history=history,
        user_name=user_name, user_role=user_role, session_id=session_id,
        query=query, lower_query=lower_query, nlu_res=nlu_res,
        workflow_context=workflow_context, workflow_decision=workflow_decision,
        inference_required=inference_required, is_field_inquiry=is_field_inquiry,
        policy_state=policy_state, core_handler_fn=_handle_copilot_chat_core,
        orch_module=sys.modules[__name__],
    )
    managed_resp = await dispatch_managed_workflow(exec_ctx)
    return managed_resp if managed_resp is not None else await run_fallback_clinical_pipeline(exec_ctx)


async def handle_copilot_chat(
    payload: CopilotQuery, request: Request, db: AsyncSession,
    *, session, history: str, pre_validated_query: str | None = None,
) -> CopilotResponse:
    """Entrypoint chính của Copilot: Xử lý chat và tự động chuẩn hóa 100% nguồn đối chứng (citations)."""
    resp = await _handle_copilot_chat_core(
        payload, request, db, session=session, history=history, pre_validated_query=pre_validated_query
    )
    return post_process_copilot_response(resp, request, payload, validator_fn=validate_response_evidence_contract)
