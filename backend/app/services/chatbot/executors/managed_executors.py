"""
Single-Pass Managed Workflow Executor Registry (Anthropic Effective Agents / LangGraph Pattern).
Each managed `executor_key` from `workflow_policy.json` maps cleanly to one dedicated executor.
"""
from __future__ import annotations

import re
from typing import Awaitable, Callable, Optional

from app.schemas.copilot import CopilotResponse
from app.services.chatbot.executors.context import (
    WorkflowExecutionContext,
    normalize_conversational_query,
    portal_catalog_counts,
    portal_guidance_text_with_counts,
    requested_fields_from_managed_schema,
)
from app.services.chatbot.field_routing import handle_interaction_clarification
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
from app.services.chatbot.pure_rag_handler import handle_deep_rag_consultation
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_lookup import lookup_drug_authoritative

ExecutorFn = Callable[[WorkflowExecutionContext], Awaitable[Optional[CopilotResponse]]]


def _get_hook(ctx: WorkflowExecutionContext, name: str, default):
    if ctx.orch_module is not None and hasattr(ctx.orch_module, name):
        return getattr(ctx.orch_module, name)
    return default


def _effective_rag_history(ctx: WorkflowExecutionContext) -> str:
    """Only pass conversation history to RAG when the turn is genuinely a contextual follow-up."""
    nlu = ctx.nlu_res
    mode = getattr(nlu, "conversation_mode", "independent") if nlu is not None else "independent"
    deictic = bool(getattr(nlu, "is_deictic_referent", False)) if nlu is not None else False
    has_ref = any(r in ctx.lower_query for r in ("thuốc này", "thuốc đó", "thuốc kia", "vừa rồi")) or bool(re.search(r"\bnó\b", ctx.lower_query))
    if mode == "contextual_followup" or deictic or has_ref:
        return ctx.history
    return ""


async def execute_multi_intent(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    from app.services.chatbot.multi_intent_handler import handle_multi_intent_chat
    return await handle_multi_intent_chat(
        ctx.nlu_res.sub_queries,
        ctx.payload,
        ctx.request,
        ctx.db,
        session=ctx.session,
        history=ctx.history,
        core_handler_fn=ctx.core_handler_fn,
    )


async def execute_drug_lookup(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    nlu_res = ctx.nlu_res
    has_contextual_entity = (
        getattr(nlu_res, "conversation_mode", "independent") == "contextual_followup"
        or getattr(nlu_res, "is_deictic_referent", False)
        or ctx.is_field_inquiry
    )
    from app.services.chatbot.gemini_nlu_router import _has_explicit_context_reference
    has_explicit_context_reference = _has_explicit_context_reference(ctx.query)
    current_medication_supported = bool(
        (has_explicit_context_reference and has_contextual_entity)
        or get_drug_lexical_matcher().extract_medications(ctx.query)
        or resolve_registered_medications(ctx.query)
        or find_matched_med(ctx.lower_query)
    )
    query_mode = getattr(nlu_res, "query_mode", "clinical_qa")
    from app.services.chatbot.session_routing import CLINICAL_NON_DRUG_TERMS
    from app.services.chatbot.pure_rag_handler import is_qualified_clinical_rag_query

    primary_drug_norm = re.sub(
        r"^(?:(?:các|những|nhóm|loại)\s+)?thuốc\s+",
        "",
        (nlu_res.primary_drug or "").strip().lower(),
    ).strip()
    primary_is_therapeutic_class = bool(
        nlu_res.primary_drug
        and not current_medication_supported
        and (
            primary_drug_norm in CLINICAL_NON_DRUG_TERMS
            or any(
                kw in primary_drug_norm
                for kw in ("hạ sốt", "giảm đau", "kháng sinh", "chống viêm", "kháng virus", "huyết áp", "tiểu đường", "dạ dày", "chống đông", "giãn phế quản", "kháng histamin")
            )
        )
    )
    if primary_is_therapeutic_class and is_qualified_clinical_rag_query(ctx.lower_query, None):
        ctx.tried_stages.add("deep_rag")
        rag_class_res = await handle_deep_rag_consultation(
            ctx.query, ctx.lower_query, ctx.user_role, _effective_rag_history(ctx), ctx.session_id, ctx.user_name,
            is_deep_pharmacology=True, inference_required=ctx.inference_required,
        )
        if rag_class_res is not None:
            return rag_class_res

    if nlu_res.primary_drug and not current_medication_supported and not has_contextual_entity:
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Chưa xác định được thuốc cần tra cứu. Vui lòng nêu tên thuốc, hoạt chất hoặc số đăng ký.",
            answer_type="clarification",
            source_status="unsupported_medication_entity",
            confidence=1.0,
            session_id=ctx.session_id,
        )
    if not current_medication_supported or (not nlu_res.primary_drug and not has_contextual_entity):
        from app.services.chatbot.pure_rag_handler import is_qualified_clinical_rag_query
        is_clinical_class_or_qa = (
            (not nlu_res.primary_drug and query_mode == "clinical_qa" and len(ctx.query.split()) >= 5)
            or (not nlu_res.primary_drug and is_qualified_clinical_rag_query(ctx.lower_query, None))
        )
        if is_clinical_class_or_qa:
            ctx.tried_stages.add("deep_rag")
            rag_clinical_res = await handle_deep_rag_consultation(
                ctx.query, ctx.lower_query, ctx.user_role, _effective_rag_history(ctx), ctx.session_id, ctx.user_name,
                is_deep_pharmacology=True, inference_required=ctx.inference_required,
            )
            if rag_clinical_res is not None:
                return rag_clinical_res
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Chưa xác định được thuốc cần tra cứu. Vui lòng nêu tên thuốc, hoạt chất hoặc số đăng ký.",
            answer_type="clarification",
            source_status="missing_medication_entity",
            confidence=1.0,
            session_id=ctx.session_id,
        )

    if nlu_res.primary_drug and getattr(nlu_res, "is_topic_shift", False):
        ctx.session.set_active_medication(name=nlu_res.primary_drug)
    elif nlu_res.primary_drug and getattr(nlu_res, "is_deictic_referent", False):
        ctx.session.set_active_medication(name=nlu_res.primary_drug)

    medication_query = ctx.query
    if (has_contextual_entity or ctx.is_field_inquiry) and not nlu_res.primary_drug and ctx.session.active_medication_name:
        medication_query = f"{ctx.query} của thuốc {ctx.session.active_medication_name}"

    lookup_fn = _get_hook(ctx, "lookup_drug_authoritative", lookup_drug_authoritative)
    lookup_response = await lookup_fn(
        medication_query,
        ctx.db,
        session_id=ctx.session_id,
        user_name=ctx.user_name,
        user_role=ctx.user_role,
        requested_fields=(
            requested_fields_from_managed_schema(
                ctx.query,
                getattr(nlu_res, "requested_field", None),
                getattr(nlu_res, "requested_fields", None),
            ) or None
        ),
        query_mode=query_mode,
    )
    from app.services.copilot_drug_lookup import _attach_database_claims
    return _attach_database_claims(lookup_response)


async def execute_clinical_reasoning(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    is_advice_or_schedule = any(
        w in ctx.lower_query
        for w in ("dặn dò", "nhắc uống thuốc", "nhắc thuốc", "lịch uống", "lên lịch nhắc", "thông báo uống")
    )
    if not is_advice_or_schedule:
        ctx.tried_stages.add("patient_dose_reasoning")
        from app.services.clinical_reasoning.patient_dose_reasoner import evaluate_patient_dose_reasoning
        patient_dose_res = await evaluate_patient_dose_reasoning(
            query=ctx.query,
            session=ctx.session,
            db=ctx.db,
            user_name=ctx.user_name,
            user_role=ctx.user_role,
            nlu_extraction=ctx.nlu_res,
        )
        if patient_dose_res is not None:
            return patient_dose_res

    ctx.tried_stages.add("deep_rag")
    return await handle_deep_rag_consultation(
        ctx.query, ctx.lower_query, ctx.user_role, _effective_rag_history(ctx), ctx.session_id, ctx.user_name,
        is_deep_pharmacology=False, inference_required=ctx.inference_required,
    )


async def execute_ddi(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    nlu_res = ctx.nlu_res
    clarify_fn = _get_hook(ctx, "handle_interaction_clarification", handle_interaction_clarification)
    if getattr(nlu_res, "secondary_entity_type", None) and nlu_res.secondary_entity_type != "drug":
        ctx.tried_stages.add("deep_rag")
        ddi_ev = await handle_deep_rag_consultation(
            ctx.query, ctx.lower_query, ctx.user_role, _effective_rag_history(ctx), ctx.session_id, ctx.user_name,
            is_deep_pharmacology=True, inference_required=ctx.inference_required,
        )
        if ddi_ev is not None:
            return ddi_ev

    if ctx.workflow_intent == "MEDICATION_INTERACTION_CLARIFICATION" and not any(
        c in ctx.lower_query for c in (" và ", " cùng ", " với ", "+")
    ):
        from app.services.chatbot.session_routing import check_interaction_examples_request
        ddi_ex = check_interaction_examples_request(ctx.lower_query, ctx.session_id)
        if ddi_ex:
            return ddi_ex
        clarification_res = await clarify_fn(
            ctx.query, ctx.lower_query, ctx.session_id, ctx.user_name, ctx.user_role, session=ctx.session
        )
        if clarification_res:
            return clarification_res

    if nlu_res.primary_drug and nlu_res.secondary_drug:
        has_interaction_kw = any(
            w in ctx.lower_query
            for w in ("tương tác", "tương kỵ", "kỵ nhau", "kỵ thuốc", "uống cùng", "dùng cùng", "uống chung", "phối hợp")
        )
        has_profile_kw = any(
            w in ctx.lower_query for w in ("chỉ định", "chống chỉ định", "liều dùng", "công dụng", "tác dụng phụ")
        )
        if not (has_profile_kw and not has_interaction_kw):
            from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
            all_ddi_meds = [nlu_res.primary_drug, nlu_res.secondary_drug] + (nlu_res.additional_drugs or [])
            ctx.session.set_comparison_drugs(all_ddi_meds)
            ctx.session.set_active_medication(name=nlu_res.primary_drug)
            ddi_res = format_multi_ddi_response(all_ddi_meds, ctx.query, session_id=ctx.session_id)
            if ddi_res and ddi_res.source_status != "unresolved_drug_entity":
                ddi_res.active_medication_name = ctx.session.active_medication_name
                return ddi_res
            return await clarify_fn(
                ctx.query, ctx.lower_query, ctx.session_id, ctx.user_name, ctx.user_role, session=ctx.session
            )
    return None


async def execute_portal_guidance(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    ctx.session.set_active_medication(name="", ingredient="", sdk="")
    drug_count, monograph_count = await portal_catalog_counts(ctx.db)
    return CopilotResponse(
        intent="MEDICATION_LOOKUP_GUIDE",
        reply_text=portal_guidance_text_with_counts(drug_count, monograph_count),
        legal_basis="Dược thư Quốc gia Việt Nam & Cục Quản lý Dược (DAV)",
        suggested_chips=["Thông tin thuốc Coversyl", "Thông tin thuốc Augmentin", "Thông tin thuốc Zithromax"],
        session_id=ctx.session_id,
        answer_type="medication_lookup_guide",
        source_status="exact_match",
        confidence=1.0,
    )


async def execute_conversation(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    intent = ctx.workflow_intent
    from app.services.chatbot.conversational_handler import (
        handle_greeting_and_acknowledgment,
        handle_out_of_scope_or_pricing,
    )
    greeting_fn = _get_hook(ctx, "handle_greeting_and_acknowledgment", handle_greeting_and_acknowledgment)
    oos_fn = _get_hook(ctx, "handle_out_of_scope_or_pricing", handle_out_of_scope_or_pricing)

    if intent == "CAPABILITY_OPENING":
        from app.services.chatbot.conversational_steering import handle_capability_opening
        ctx.session.set_active_medication(name="", ingredient="", sdk="")
        return handle_capability_opening(user_role=ctx.user_role, user_name=ctx.user_name, session_id=ctx.session_id)
    if intent in ("CONVERSATIONAL_FEEDBACK", "GREETING_WELLBEING"):
        greeting_res = greeting_fn(ctx.lower_query, ctx.user_name, ctx.user_role)
        if greeting_res:
            ctx.session.set_active_medication(name="", ingredient="", sdk="")
            return greeting_res
    if intent == "OUT_OF_SCOPE":
        from app.services.chatbot.conversational_steering import handle_gentle_chitchat_steering
        ctx.session.set_active_medication(name="", ingredient="", sdk="")
        out_scope_type = getattr(ctx.nlu_res, "out_of_scope_type", None)
        if out_scope_type in ("MATH_LOGIC", "GENERAL_CHITCHAT"):
            return handle_gentle_chitchat_steering(
                ctx.query, out_of_scope_type=out_scope_type, user_name=ctx.user_name,
                user_role=ctx.user_role, session_id=ctx.session_id,
            )
        out_scope = oos_fn(ctx.lower_query)
        if out_scope:
            return out_scope
        return handle_gentle_chitchat_steering(
            ctx.query, out_of_scope_type=out_scope_type, user_name=ctx.user_name,
            user_role=ctx.user_role, session_id=ctx.session_id,
        )
    return None


async def execute_sandwich(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    from app.services.chatbot.sandwich_pipeline import execute_clinical_sandwich_pipeline
    sandwich_fn = _get_hook(ctx, "execute_clinical_sandwich_pipeline", execute_clinical_sandwich_pipeline)
    target_med = ctx.nlu_res.primary_drug or ctx.session.active_medication_name
    if not target_med:
        return None
    try:
        return await sandwich_fn(
            ctx.query, ctx.user_role, ctx.user_name, ctx.session_id, ctx.db, nlu_result=ctx.nlu_res
        )
    except TypeError:
        return await sandwich_fn(ctx.query, ctx.user_role, ctx.user_name, ctx.session_id, ctx.db)


async def execute_specialty(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    from app.services.chatbot.hospital_business_dispatcher import dispatch_clinical_subflows
    from app.services.chatbot.conversational_clinical_engine import (
        find_clinical_specialty_consultation,
        synthesize_specialty_response,
    )
    dispatch_fn = _get_hook(ctx, "dispatch_clinical_subflows", dispatch_clinical_subflows)
    norm_q = normalize_conversational_query(ctx.query)

    ctx.tried_stages.add("clinical_subflows")
    subflow_res = await dispatch_fn(norm_q, norm_q.lower(), ctx.user_name, ctx.db, user_role=ctx.user_role)
    if subflow_res:
        return subflow_res

    ctx.tried_stages.add("specialty_registry")
    spec_res = find_clinical_specialty_consultation(ctx.query) or find_clinical_specialty_consultation(norm_q)
    if spec_res:
        return await synthesize_specialty_response(
            ctx.query, spec_res, user_name=ctx.user_name, user_role=ctx.user_role, session_id=ctx.session_id
        )

    ctx.tried_stages.add("deep_rag")
    return await handle_deep_rag_consultation(
        ctx.query, ctx.lower_query, ctx.user_role, _effective_rag_history(ctx), ctx.session_id, ctx.user_name,
        is_deep_pharmacology=True, inference_required=ctx.inference_required,
    )


async def execute_clarification(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    if ctx.workflow_intent == "MEDICATION_INTERACTION_CLARIFICATION" and not any(
        c in ctx.lower_query for c in (" và ", " cùng ", " với ", "+")
    ):
        from app.services.chatbot.session_routing import check_interaction_examples_request
        ddi_ex = check_interaction_examples_request(ctx.lower_query, ctx.session_id)
        if ddi_ex:
            return ddi_ex
        clarify_fn = _get_hook(ctx, "handle_interaction_clarification", handle_interaction_clarification)
        clarification_res = await clarify_fn(
            ctx.query, ctx.lower_query, ctx.session_id, ctx.user_name, ctx.user_role, session=ctx.session
        )
        if clarification_res:
            return clarification_res
    if ctx.workflow_intent == "AMBIGUOUS_INTENT":
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Chưa xác định được ý định cần xử lý. Vui lòng diễn đạt lại câu hỏi hoặc nêu rõ thuốc, chủ đề hay nghiệp vụ cần hỗ trợ.",
            answer_type="clarification",
            source_status="ambiguous_intent",
            confidence=1.0,
            abstention_reason="Kết quả phân loại không ánh xạ được sang một ý định đã quản lý",
            session_id=ctx.session_id,
        )
    return None


MANAGED_EXECUTORS: dict[str, ExecutorFn] = {
    "multi_intent": execute_multi_intent,
    "drug_lookup": execute_drug_lookup,
    "clinical_reasoning": execute_clinical_reasoning,
    "ddi": execute_ddi,
    "portal_guidance": execute_portal_guidance,
    "conversation": execute_conversation,
    "sandwich": execute_sandwich,
    "specialty": execute_specialty,
    "clarification": execute_clarification,
}


async def dispatch_managed_workflow(ctx: WorkflowExecutionContext) -> Optional[CopilotResponse]:
    """
    Single-pass authoritative dispatch for a managed RouteDecision.
    Handles high-precedence prescription blocks and direct multi-drug DDI before executor lookup.
    """
    decision = ctx.workflow_decision
    if decision is None:
        return None

    # 1. Prescription block audit takes top precedence
    if decision.reason_code == "managed_precedence:prescription_block":
        from app.services.chatbot.prescription_block_handler import handle_prescription_block_audit
        return await handle_prescription_block_audit(
            ctx.query, ctx.nlu_res.prescription_lines, ctx.user_name, ctx.user_role, ctx.session_id, ctx.db
        )

    # 2. Explicit multi-drug interaction query overrides generic multi-intent decomposition
    interaction_terms = (
        "tương tác", "tương kỵ", "uống cùng", "dùng cùng",
        "uống chung", "phối hợp", "có uống được", "kỵ nhau",
    )
    direct_ddi_meds = get_drug_lexical_matcher().extract_medications(ctx.query)
    has_unrelated_multi_topic = any(
        kw in ctx.lower_query
        for kw in (
            "tủ trực", "chuỗi lạnh", "tồn kho", "nhiệt độ", "báo hỏng", "thiết bị",
            "thông tư", "nghị định", "bhyt", "liều dùng", "chỉ định", "tác dụng phụ",
        )
    )
    if (
        (decision.executor_key != "multi_intent" or not has_unrelated_multi_topic)
        and any(term in ctx.lower_query for term in interaction_terms)
        and len(direct_ddi_meds) >= 2
    ):
        from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
        ctx.session.set_comparison_drugs(direct_ddi_meds)
        ddi_res = format_multi_ddi_response(direct_ddi_meds, ctx.query, session_id=ctx.session_id)
        if ddi_res and ddi_res.source_status != "unresolved_drug_entity":
            return ddi_res

    # 3. Topic-shift session update before executor runs
    if getattr(ctx.nlu_res, "is_topic_shift", False) and decision.executor_key != "drug_lookup":
        if ctx.nlu_res.primary_drug:
            ctx.session.set_active_medication(name=ctx.nlu_res.primary_drug)
        else:
            ctx.session.set_active_medication(name="", ingredient="", sdk="")

    # 4. Registry lookup & single-pass execution
    executor = MANAGED_EXECUTORS.get(decision.executor_key)
    if executor is None:
        return None
    resp = await executor(ctx)
    if resp is not None and not getattr(resp, "workflow_executor", None):
        resp.workflow_executor = decision.executor_key
    return resp
