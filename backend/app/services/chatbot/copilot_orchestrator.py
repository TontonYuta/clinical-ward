"""
Orchestration pipeline for Clinical Copilot Chat (<=200 LOC).
"""
import re
from sqlalchemy import func, select
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_lookup import lookup_drug_authoritative, extract_drug_keywords
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.copilot_business_overview import CLINICAL_BUSINESS_DIRECTORY
from app.services.copilot_gemini_scenarios import detect_and_handle_gemini_clinical_scenario
from app.security.guardrails import validate_input_guardrail, validate_output_guardrail
from app.services.chatbot.conversational_handler import handle_greeting_and_acknowledgment, handle_out_of_scope_or_pricing
from app.services.chatbot.session_routing import check_renal_adjustment_request
from app.services.chatbot.multiturn_handler import resolve_active_drug_and_terms
from app.services.chatbot.field_routing import handle_interaction_clarification, handle_field_or_drug_inquiry
from app.services.chatbot.hospital_business_dispatcher import dispatch_clinical_subflows, dispatch_operational_business
from app.services.chatbot.pure_rag_handler import handle_contextual_rag_followup, handle_deep_rag_consultation
from app.services.chatbot.drug_comparison import handle_clinical_drug_comparison
from app.services.chatbot.fsm_router import route_fsm_context
from app.services.chatbot.sandwich_pipeline import execute_clinical_sandwich_pipeline
from app.services.chatbot.evidence_contract_validator import (
    validate_response_evidence_contract,
    _has_verified_source_version,
)
from app.services.chatbot.copilot_response_postprocessor import post_process_copilot_response


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
        r"\s*\?+$"
    ]
    for p in suffix_patterns:
        cleaned = re.sub(p, "", cleaned, flags=re.IGNORECASE).strip()
    return cleaned if len(cleaned) >= 3 else text

def _portal_guidance_text() -> str:
    return (
        "### CỔNG TRA CỨU THUỐC\n\n"
        "Hãy nhập tên biệt dược, hoạt chất hoặc số đăng ký để tra cứu trong các nguồn hiện có."
        " Nếu chưa tìm thấy tài liệu phù hợp, hệ thống sẽ yêu cầu bổ sung hoặc thông báo chưa có nguồn xác minh.\n\n"
        "Bạn cũng có thể mở mục Thông tin thuốc để tìm kiếm trong danh mục."
    )

def _requested_fields_from_managed_schema(
    query: str,
    requested_field: str | None = None,
    requested_fields: list[str] | None = None,
) -> list[str]:
    """Resolve requested facets without widening a specific NLU field.

    ``requested_field`` is the structured classifier's primary decision. When it
    names a specific facet, lexical scoring may disambiguate the dosage subtype,
    but must not add unrelated facets merely because their terms appear as
    patient context (for example, hepatic impairment alongside a dosage cue).
    """
    from app.services.chatbot.intent_feature_matrix import rank_clinical_intents
    # The ranker also scores contextual mentions (e.g. an illness in the
    # patient's background). Keep only clearly expressed facets when refining
    # the NLU's field list. NLU remains the fallback when lexical evidence is
    # weak or paraphrased.
    scored_fields = [field for field, _ in rank_clinical_intents(query, min_score=2.5)]
    nlu_fields = list(dict.fromkeys(requested_fields or []))
    if scored_fields:
        # When the classifier explicitly identified multiple requested facets,
        # retain that contract even if some facets lack a current schema field.
        # The authoritative lookup layer will abstain on unsupported fields;
        # filtering them here would silently turn a compound question into a
        # partial answer.
        if len(nlu_fields) > 1 and all(field in scored_fields for field in nlu_fields):
            return nlu_fields
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
        if matching:
            return matching
        return [specific_fields[0]]

    return scored_fields

async def _portal_catalog_counts(db: AsyncSession) -> tuple[int, int]:
    from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
    drug_result = await db.execute(select(func.count()).select_from(DavNationalDrug))
    monograph_result = await db.execute(select(func.count()).select_from(ClinicalDrugMonograph))
    return int(drug_result.scalar_one()), int(monograph_result.scalar_one())

def _portal_guidance_text_with_counts(drug_count: int, monograph_count: int) -> str:
    return f"{_portal_guidance_text()}\n\nDanh mục hiện có {drug_count:,} thuốc và {monograph_count:,} chuyên luận."

def resolve_copilot_identity(payload: CopilotQuery, request: Request, session=None) -> tuple[str, str, str]:
    authenticated = getattr(request.state, "authenticated_user", None)
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
        session_id = session.session_id
        return user_name, user_role, session_id

    user_name = payload.user_name if payload.user_name and payload.user_name not in generic_placeholders else (authenticated.username if authenticated else "Đồng nghiệp")
    user_role = payload.user_role or (authenticated.role if authenticated else "doctor")
    req_session = (payload.session_id or "default_session").strip()
    session_id = req_session if req_session.startswith(f"{user_name.casefold()}:") else f"{user_name.casefold()}:{req_session}"
    return user_name, user_role, session_id

async def _handle_copilot_chat_core(payload: CopilotQuery, request: Request, db: AsyncSession, *, session, history: str) -> CopilotResponse:
    user_name, user_role, session_id = resolve_copilot_identity(payload, request, session=session)
    guard_res = validate_input_guardrail(payload.query, user_role=user_role)
    if not guard_res.is_safe:
        return CopilotResponse(
            intent="SECURITY_GUARDRAIL_BLOCKED", reply_text=guard_res.safe_response,
            legal_basis="OWASP LLM01:2025, TT 20/2017 & An toàn An ninh Y tế",
            suggested_chips=["Tra cứu Dược Thư Quốc Gia", "Quy chế thuốc gây nghiện TT 20", "Hướng dẫn sử dụng hệ thống"]
        )

    query = guard_res.sanitized_query
    lower_query = query.lower()

    # NẾU CÓ ẢNH ĐÍNH KÈM: Chuyển thẳng sang luồng Multimodal Vision Analysis chuyên sâu
    if payload.image_base64:
        from app.services.chatbot.multimodal_vision_handler import handle_multimodal_vision_turn
        vision_resp = await handle_multimodal_vision_turn(payload, user_role=user_role)
        if vision_resp is not None:
            return vision_resp

    # Ưu tiên số 1: Điều hướng Phân hệ & Mở Form nội viện (Semantic Navigation Router)
    # Bất kể người dùng đang bật hay tắt Web Search, nếu câu lệnh là hành động chuyển tab/mở form trong viện thì phải ưu tiên thực thi ngay
    from app.services.chatbot.semantic_navigation_router import route_semantic_navigation
    nav_response = await route_semantic_navigation(query, lower_query=lower_query, user_role=user_role)
    if nav_response is not None:
        if session is not None and hasattr(session, "append_conversation_turn"):
            session.append_conversation_turn(payload.query, nav_response.reply_text)
        return nav_response.model_copy(update={"session_id": session_id})

    # NẾU BẬT TÌM KIẾM WEB THỜI GIAN THỰC (Grounded Web Search)
    if payload.enable_web_search:
        # Nếu câu hỏi nhắm vào một thuốc có trong Dược thư Quốc gia hoặc Thông tư/Quy chế chuyên môn nội viện,
        # ưu tiên tra cứu nguồn Dược thư chính thống trước. Nếu Dược thư không có dữ liệu phù hợp,
        # sẽ tự động fallback sang Grounded Web Search tại tầng Adaptive CRAG.
        lower_q = query.lower()
        is_explicit_web_intent = any(term in lower_q for term in (
            "tìm trên mạng", "tim tren mang", "search web", "tìm web", "tra trên web",
            "tìm kiếm trên web", "google", "search google", "tin tức", "mới nhất 202",
            "cập nhật 202", "khuyến cáo 202", "trên internet", "thông tin trên mạng"
        ))
        has_internal_kb_anchor = (
            bool(get_drug_lexical_matcher().extract_medications(query))
            or any(t in lower_q for t in ("thông tư", "tt 22", "tt 20", "tt 51", "qđ 5948", "qd 5948", "phác đồ"))
        )
        if is_explicit_web_intent or not has_internal_kb_anchor:
            from app.services.chatbot.grounded_web_search_handler import handle_grounded_web_search_turn
            web_search_resp = await handle_grounded_web_search_turn(
                payload, user_role=user_role, session=session, history=history
            )
            if web_search_resp is not None:
                if session is not None and hasattr(session, "append_conversation_turn"):
                    session.append_conversation_turn(payload.query, web_search_resp.reply_text)
                return web_search_resp.model_copy(update={"session_id": session_id})

    # Stage 1: Clinical text sanitization & modifier deconstruction
    from app.services.chatbot.clinical_text_sanitizer import sanitize_clinical_input
    sanitized_ctx = sanitize_clinical_input(query)
    query = sanitized_ctx.clean_query
    lower_query = query.lower()

    # Reject clearly non-clinical requests before remote NLU. This keeps the
    # request out of medication/session context and avoids an unnecessary
    # provider call. Legacy route checks remain as a secondary guard.
    early_boundary = handle_out_of_scope_or_pricing(lower_query)
    if early_boundary is not None:
        return early_boundary.model_copy(update={"session_id": session_id})

    # Gemini NLU Router (Structured Intent & Entity Resolution - Zero Hardcode)
    from app.services.chatbot.gemini_nlu_router import parse_clinical_nlu
    nlu_res = await parse_clinical_nlu(query, history=history, active_med=session.active_medication_name)
    from app.services.chatbot.workflow_router import prepare_request, decide_route
    from app.schemas.clinical_nlu import ClinicalNluExtraction
    policy_state = request.scope.get("app") if hasattr(request, "scope") and isinstance(getattr(request, "scope", None), dict) else None
    workflow_policy = getattr(getattr(policy_state, "state", None), "workflow_policy", None) if policy_state is not None else None
    from app.services.chatbot.workflow_policy import WorkflowPolicy, load_workflow_policy
    if not isinstance(workflow_policy, WorkflowPolicy):
        from app.config import settings
        workflow_policy = load_workflow_policy(
            settings.WORKFLOW_POLICY_PATH,
            registered_executors={"conversation", "drug_lookup", "portal_guidance", "ddi",
                                  "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent"},
        )
    if not nlu_res:
        fallback_intent = "CLINICAL_CASE_CLARIFICATION"
        fallback_res = ClinicalNluExtraction(intent=fallback_intent)
        workflow_context = prepare_request(payload.query, normalized_query=query, user_role=user_role,
                                           nlu_result=fallback_res, session=session)
        workflow_decision = decide_route(workflow_context, None, workflow_policy, fallback_intent=fallback_intent)
        workflow_decision = workflow_decision.model_copy(update={"reason_code": "managed_nlu_unavailable_fallback"})
        if policy_state is not None:
            request.state.workflow_context = workflow_context
            request.state.workflow_route = workflow_decision
        return CopilotResponse(
            intent=fallback_intent,
            reply_text="Chưa xác định được chủ đề từ bộ phân loại hiện tại. Vui lòng nêu rõ tên thuốc, hoạt chất, văn bản hoặc nghiệp vụ cần tra cứu.",
            answer_type="clarification",
            source_status="nlu_unavailable",
            confidence=1.0,
            abstention_reason="Bộ phân loại ý định tạm thời không khả dụng",
            session_id=session_id,
        )

    if nlu_res:
        request.state.clinical_nlu_result = nlu_res
        from app.services.chatbot.answer_operation import requires_reference_note
        inference_required = requires_reference_note(nlu_res)
        # Capture the single NLU decision with immutable query identity before
        # topic updates or query rewriting. Ordered legacy handlers remain the
        # executor implementation until their adapter parity tasks are complete.
        workflow_context = prepare_request(
            payload.query,
            normalized_query=query,
            user_role=user_role,
            nlu_result=nlu_res,
            session=session,
        )
        # Session entities are eligible only for an explicitly contextual turn.
        # An independent turn must not inherit the previous medication merely
        # because the session still has an active slot.
        from app.services.chatbot.session_routing import FIELD_ONLY_TERMS
        from app.services.chatbot.gemini_nlu_router import _has_explicit_context_reference
        is_field_inquiry = bool(session.active_medication_name and any(term in lower_query for term in FIELD_ONLY_TERMS))
        query_has_medication_entity = bool(
            get_drug_lexical_matcher().extract_medications(query)
            or resolve_registered_medications(query)
            or find_matched_med(query.lower())
        )
        has_session_reference = bool(
            session.active_medication_name
            and _has_explicit_context_reference(query)
            and (
                is_field_inquiry
                or getattr(nlu_res, "conversation_mode", "independent") == "contextual_followup"
                or getattr(nlu_res, "is_deictic_referent", False)
                or getattr(nlu_res, "intent", "") == "MEDICATION_INTERACTION_CLARIFICATION"
            )
        )
        is_generic_interaction_followup = (
            bool(session.active_medication_name)
            and getattr(nlu_res, "intent", "") == "MEDICATION_INTERACTION_CLARIFICATION"
        )
        if (
            session.active_medication_name
            and not query_has_medication_entity
            and not has_session_reference
            and not is_generic_interaction_followup
            and getattr(nlu_res, "intent", "") in {
                "MEDICATION_LOOKUP", "MEDICATION_INTERACTION_CHECK",
                "MEDICATION_INTERACTION_CLARIFICATION", "PATIENT_CASE_REASONING",
                "PATIENT_MEDICATION_COUNSELING",
            }
        ):
            from app.services.chatbot.conversational_steering import handle_gentle_chitchat_steering
            session.set_active_medication(name="", ingredient="", sdk="")
            return handle_gentle_chitchat_steering(
                query, out_of_scope_type="GENERAL_CHITCHAT", user_name=user_name,
                user_role=user_role, session_id=session_id
            ).model_copy(update={"source_status": "unanchored_turn"})
        if (
            getattr(nlu_res, "conversation_mode", "independent") == "independent"
            and not getattr(nlu_res, "is_deictic_referent", False)
            and not is_field_inquiry
        ):
            workflow_context = workflow_context.model_copy(update={"required_entities": []})
        request_app = policy_state
        if request_app is not None:
            request.state.workflow_context = workflow_context
        # One managed decision owns the intent and precedence used by dispatch.
        nlu_intent = str(getattr(nlu_res, "intent", "") or "").strip()
        if nlu_intent not in workflow_policy.routes:
            nlu_intent = ""
        workflow_decision = decide_route(
            workflow_context, nlu_res, workflow_policy,
            fallback_intent="AMBIGUOUS_INTENT" if not nlu_intent else None,
        )
        workflow_intent = workflow_decision.intent
        if request_app is not None:
            request.state.workflow_route = workflow_decision
        if workflow_intent == "AMBIGUOUS_INTENT":
            return CopilotResponse(
                intent="CLINICAL_CASE_CLARIFICATION",
                reply_text="Chưa xác định được ý định cần xử lý. Vui lòng diễn đạt lại câu hỏi hoặc nêu rõ thuốc, chủ đề hay nghiệp vụ cần hỗ trợ.",
                answer_type="clarification",
                source_status="ambiguous_intent",
                confidence=1.0,
                abstention_reason="Kết quả phân loại không ánh xạ được sang một ý định đã quản lý",
                session_id=session_id,
            )

        # Nhận diện đơn thuốc thô nhiều dòng -> kích hoạt Prescription Block Audit Mode
        if workflow_decision.reason_code == "managed_precedence:prescription_block":
            from app.services.chatbot.prescription_block_handler import handle_prescription_block_audit
            return await handle_prescription_block_audit(
                query, nlu_res.prescription_lines, user_name, user_role, session_id, db
            )

        # An explicit multi-drug interaction query has one authoritative DDI
        # workflow. Resolve it before generic multi-intent decomposition so
        # source claims cannot be lost during synthesis.
        interaction_terms = (
            "tương tác", "tương kỵ", "uống cùng", "dùng cùng",
            "uống chung", "phối hợp", "có uống được", "kỵ nhau"
        )
        direct_ddi_meds = get_drug_lexical_matcher().extract_medications(query)
        if (
            workflow_decision.executor_key != "multi_intent"
            and any(term in lower_query for term in interaction_terms)
            and len(direct_ddi_meds) >= 2
        ):
            from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
            session.set_comparison_drugs(direct_ddi_meds)
            ddi_res = format_multi_ddi_response(direct_ddi_meds, query, session_id=session_id)
            if ddi_res:
                return ddi_res

        # Xử lý câu hỏi kép / đa ý định -> phân rã sub_queries song song
        if workflow_decision.executor_key == "multi_intent":
            from app.services.chatbot.multi_intent_handler import handle_multi_intent_chat
            return await handle_multi_intent_chat(
                nlu_res.sub_queries, payload, request, db, session=session, history=history, core_handler_fn=_handle_copilot_chat_core
            )
        if workflow_decision.executor_key == "drug_lookup":
            has_contextual_entity = (
                getattr(nlu_res, "conversation_mode", "independent") == "contextual_followup"
                or getattr(nlu_res, "is_deictic_referent", False)
                or is_field_inquiry
            )
            from app.services.chatbot.gemini_nlu_router import _has_explicit_context_reference
            has_explicit_context_reference = _has_explicit_context_reference(query)
            # Never trust an LLM-extracted medication that has no support in
            # the current query or the explicitly referenced session context.
            # This prevents unrelated turns from entering the medication RAG
            # path and wasting a second generation call.
            current_medication_supported = bool(
                has_explicit_context_reference and has_contextual_entity
                or get_drug_lexical_matcher().extract_medications(query)
                or resolve_registered_medications(query)
                or find_matched_med(query.lower())
            )
            query_mode = getattr(nlu_res, "query_mode", "clinical_qa")
            if nlu_res.primary_drug and not current_medication_supported and not has_contextual_entity:
                return CopilotResponse(
                    intent="MEDICATION_LOOKUP_CLARIFICATION",
                    reply_text="Chưa xác định được thuốc cần tra cứu. Vui lòng nêu tên thuốc, hoạt chất hoặc số đăng ký.",
                    answer_type="clarification", source_status="unsupported_medication_entity",
                    confidence=1.0, session_id=session_id,
                )
            if not current_medication_supported:
                if not nlu_res.primary_drug and query_mode == "clinical_qa" and len(query.split()) >= 5:
                    rag_clinical_res = await handle_deep_rag_consultation(
                        query, lower_query, user_role, history, session_id, user_name,
                        is_deep_pharmacology=True, inference_required=inference_required,
                    )
                    if rag_clinical_res is not None:
                        return rag_clinical_res
                return CopilotResponse(
                    intent="MEDICATION_LOOKUP_CLARIFICATION",
                    reply_text="Chưa xác định được thuốc cần tra cứu. Vui lòng nêu tên thuốc, hoạt chất hoặc số đăng ký.",
                    answer_type="clarification", source_status="missing_medication_entity",
                    confidence=1.0, session_id=session_id,
                )
            if not nlu_res.primary_drug and not has_contextual_entity:
                if query_mode == "clinical_qa" and len(query.split()) >= 5:
                    rag_clinical_res = await handle_deep_rag_consultation(
                        query, lower_query, user_role, history, session_id, user_name,
                        is_deep_pharmacology=True, inference_required=inference_required,
                    )
                    if rag_clinical_res is not None:
                        return rag_clinical_res
                return CopilotResponse(
                    intent="MEDICATION_LOOKUP_CLARIFICATION",
                    reply_text="Chưa xác định được thuốc cần tra cứu. Vui lòng nêu tên thuốc, hoạt chất hoặc số đăng ký.",
                    answer_type="clarification", source_status="missing_medication_entity",
                    confidence=1.0, session_id=session_id,
                )
            if nlu_res.primary_drug and getattr(nlu_res, "is_topic_shift", False):
                session.set_active_medication(name=nlu_res.primary_drug)
            medication_query = query
            if (has_contextual_entity or is_field_inquiry) and not nlu_res.primary_drug and session.active_medication_name:
                medication_query = f"{query} của thuốc {session.active_medication_name}"
            lookup_response = await lookup_drug_authoritative(
                medication_query, db, session_id=session_id, user_name=user_name, user_role=user_role,
                requested_fields=(
                    _requested_fields_from_managed_schema(
                        query,
                        getattr(nlu_res, "requested_field", None),
                        getattr(nlu_res, "requested_fields", None),
                    ) or None
                ),
                query_mode=query_mode,
            )
            from app.services.copilot_drug_lookup import _attach_database_claims
            return _attach_database_claims(lookup_response)
        if workflow_decision.executor_key == "clinical_reasoning":
            is_advice_or_schedule = any(w in lower_query for w in ["dặn dò", "nhắc uống thuốc", "nhắc thuốc", "lịch uống", "lên lịch nhắc", "thông báo uống"])
            if not is_advice_or_schedule:
                from app.services.clinical_reasoning.patient_dose_reasoner import evaluate_patient_dose_reasoning
                patient_dose_res = await evaluate_patient_dose_reasoning(
                    query=query, session=session, db=db, user_name=user_name,
                    user_role=user_role, nlu_extraction=nlu_res,
                )
                if patient_dose_res is not None:
                    return patient_dose_res
            # Complex case questions use the same indexed evidence, claim
            # validation, and citation path as the rest of RAG. The legacy
            # multi-hop rule engine builds fixed drafts and placeholder sources.
            reasoning_response = await handle_deep_rag_consultation(
                query, lower_query, user_role, history, session_id, user_name,
                is_deep_pharmacology=False, inference_required=inference_required,
            )
            if reasoning_response is not None:
                return reasoning_response
        if (
            workflow_decision.executor_key == "ddi"
            and getattr(nlu_res, "secondary_entity_type", None)
            and nlu_res.secondary_entity_type != "drug"
        ):
            # Non-drug interaction entities use the common evidence retriever;
            # the pairwise DDI matrix only accepts resolved medication pairs.
            ddi_evidence_response = await handle_deep_rag_consultation(
                query, lower_query, user_role, history, session_id, user_name,
                is_deep_pharmacology=True, inference_required=inference_required,
            )
            if ddi_evidence_response is not None:
                return ddi_evidence_response

        # Quản lý chuyển chủ đề tự động (Topic Shift) ngay từ đầu để đảm bảo tính liên tục của session
        if getattr(nlu_res, "is_topic_shift", False):
            if nlu_res.primary_drug:
                session.set_active_medication(name=nlu_res.primary_drug)
            else:
                session.set_active_medication(name="", ingredient="", sdk="")

        # Complex clinical reasoning continues through the common RAG workflow.

        # Once the managed policy has resolved the route, downstream intent
        # dispatch must read that decision rather than the raw NLU label. This
        # keeps policy precedence (for example multi-intent overrides) authoritative.
        if workflow_intent == "MEDICATION_LOOKUP_GUIDE":
            session.set_active_medication(name="", ingredient="", sdk="")
            drug_count, monograph_count = await _portal_catalog_counts(db)
            portal_text = _portal_guidance_text_with_counts(drug_count, monograph_count)
            return CopilotResponse(
                intent="MEDICATION_LOOKUP_GUIDE",
                reply_text=portal_text,
                legal_basis="Dược thư Quốc gia Việt Nam & Cục Quản lý Dược (DAV)",
                suggested_chips=["Thông tin thuốc Coversyl", "Thông tin thuốc Augmentin", "Thông tin thuốc Zithromax"],
                session_id=session_id,
                answer_type="medication_lookup_guide",
                source_status="exact_match",
                confidence=1.0
            )
        elif workflow_intent == "CAPABILITY_OPENING":
            from app.services.chatbot.conversational_steering import handle_capability_opening
            session.set_active_medication(name="", ingredient="", sdk="")
            return handle_capability_opening(user_role=user_role, user_name=user_name, session_id=session_id)
        elif workflow_intent == "CONVERSATIONAL_FEEDBACK":
            greeting_res = handle_greeting_and_acknowledgment(lower_query, user_name, user_role)
            if greeting_res:
                session.set_active_medication(name="", ingredient="", sdk="")
                return greeting_res
        elif workflow_intent == "GREETING_WELLBEING":
            greeting_res = handle_greeting_and_acknowledgment(lower_query, user_name, user_role)
            if greeting_res:
                session.set_active_medication(name="", ingredient="", sdk="")
                return greeting_res
        elif workflow_intent == "OUT_OF_SCOPE":
            from app.services.chatbot.conversational_steering import handle_gentle_chitchat_steering
            session.set_active_medication(name="", ingredient="", sdk="")
            out_scope_type = getattr(nlu_res, "out_of_scope_type", None)
            if out_scope_type in ("MATH_LOGIC", "GENERAL_CHITCHAT"):
                return handle_gentle_chitchat_steering(query, out_of_scope_type=out_scope_type, user_name=user_name, user_role=user_role, session_id=session_id)
            out_scope = handle_out_of_scope_or_pricing(lower_query)
            if out_scope:
                return out_scope
            return handle_gentle_chitchat_steering(query, out_of_scope_type=out_scope_type, user_name=user_name, user_role=user_role, session_id=session_id)
        elif workflow_intent == "MEDICATION_INTERACTION_CLARIFICATION" and not any(c in lower_query for c in (" và ", " cùng ", " với ", "+")):
            from app.services.chatbot.session_routing import check_interaction_examples_request
            ddi_ex = check_interaction_examples_request(lower_query, session_id)
            if ddi_ex:
                return ddi_ex
            clarification_res = await handle_interaction_clarification(query, lower_query, session_id, user_name, user_role, session=session)
            if clarification_res:
                return clarification_res
        elif workflow_intent == "MEDICATION_INTERACTION_CHECK" and nlu_res.primary_drug and nlu_res.secondary_drug:
            has_interaction_kw = any(w in lower_query for w in ("tương tác", "tương kỵ", "kỵ nhau", "kỵ thuốc", "uống cùng", "dùng cùng", "uống chung", "phối hợp"))
            has_profile_kw = any(w in lower_query for w in ("chỉ định", "chống chỉ định", "liều dùng", "công dụng", "tác dụng phụ"))
            if has_profile_kw and not has_interaction_kw:
                # Không chặn DDI khi người dùng hỏi hồ sơ chuyên môn của thuốc phối hợp
                pass
            else:
                from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
                all_ddi_meds = [nlu_res.primary_drug, nlu_res.secondary_drug] + (nlu_res.additional_drugs or [])
                session.set_comparison_drugs(all_ddi_meds)
                if nlu_res.primary_drug:
                    session.set_active_medication(name=nlu_res.primary_drug)
                ddi_res = format_multi_ddi_response(all_ddi_meds, query, session_id=session_id)
                if ddi_res:
                    ddi_res.active_medication_name = session.active_medication_name
                    return ddi_res
                clarification_res = await handle_interaction_clarification(query, lower_query, session_id, user_name, user_role, session=session)
                if clarification_res:
                    return clarification_res
        elif workflow_intent == "MEDICATION_LOOKUP" and nlu_res.primary_drug and nlu_res.is_deictic_referent:
            session.set_active_medication(name=nlu_res.primary_drug)
        elif workflow_intent == "PATIENT_MEDICATION_COUNSELING":
            target_med = nlu_res.primary_drug or session.active_medication_name
            if target_med:
                sandwich_res = await execute_clinical_sandwich_pipeline(query, user_role, user_name, session_id, db)
                if sandwich_res:
                    return sandwich_res
        elif workflow_intent == "SPECIALTY_CLINICAL_PROTOCOL":
            from app.services.chatbot.conversational_clinical_engine import (
                find_clinical_specialty_consultation,
                synthesize_specialty_response,
            )
            norm_q = normalize_conversational_query(query)
            subflow_res = await dispatch_clinical_subflows(norm_q, norm_q.lower(), user_name, db, user_role=user_role)
            if subflow_res:
                return subflow_res
            # Ưu tiên Hybrid RAG trên kho Thông tư & Dược thư chính thức trước để tránh khớp từ khóa sai chủ đề
            rag_spec_res = await handle_deep_rag_consultation(
                query, lower_query, user_role, history, session_id, user_name,
                is_deep_pharmacology=True, inference_required=inference_required,
            )
            if rag_spec_res is not None and rag_spec_res.rag_grounded and rag_spec_res.answer_type != "safe_abstention":
                return rag_spec_res
            spec_res = find_clinical_specialty_consultation(query) or find_clinical_specialty_consultation(norm_q)
            if spec_res:
                return await synthesize_specialty_response(query, spec_res, user_name=user_name, user_role=user_role, session_id=session_id)



    matcher = get_drug_lexical_matcher()
    has_known_med = bool(matcher.extract_medications(query) or matcher.extract_sdk(query) or resolve_registered_medications(lower_query))
    if not has_known_med:
        out_scope = handle_out_of_scope_or_pricing(lower_query)
        if out_scope:
            session.set_active_medication(name="", ingredient="", sdk="")
            return out_scope

    # 2. SOTA RAG: CRAG Contextual Query Rewriter & Multi-turn Clinical De-contextualization
    from app.services.rag.query_rewriter import rewrite_clinical_query
    rewritten_res = await rewrite_clinical_query(query, history=history, active_med=session.active_medication_name)
    query = rewritten_res.rewritten_query
    lower_query = query.lower()
    if nlu_res and request_app is not None:
        request.state.workflow_context = workflow_context.model_copy(update={"rewritten_query": query})

    # 2.1. Neuro-Symbolic Patient Dose Reasoning (Cockcroft-Gault CrCl & Dược Thư Grounding)
    is_advice_or_schedule = any(w in lower_query for w in ["dặn dò", "nhắc uống thuốc", "nhắc thuốc", "lịch uống", "lên lịch nhắc", "thông báo uống"])
    if not is_advice_or_schedule:
        from app.services.clinical_reasoning.patient_dose_reasoner import evaluate_patient_dose_reasoning
        patient_dose_res = await evaluate_patient_dose_reasoning(
            query=query,
            session=session,
            db=db,
            user_name=user_name,
            user_role=user_role,
            nlu_extraction=nlu_res
        )
        if patient_dose_res:
            return patient_dose_res

    is_renal = any(t in lower_query for t in ("suy thận", "chức năng thận", "egfr", "crcl", "creatinine", "crystalin", "creatin", "chỉnh liều"))
    nlu_drug_name = nlu_res.primary_drug if nlu_res else None
    renal_res = check_renal_adjustment_request(query, lower_query, nlu_drug=nlu_drug_name)
    if renal_res:
        return renal_res

    is_general_ref = any(term in lower_query for term in (
        "thông tin về", "thông tin", "tài liệu", "tra cứu", "hướng dẫn", "phác đồ",
        "thuốc hạ sốt", "thuốc giảm đau", "nhóm thuốc", "danh mục", "chuyên luận",
        "kiêng gì", "kiêng", "chăm sóc", "ăn uống"
    ))
    has_patient_context = any(term in lower_query for term in ("bệnh nhân", "người bệnh", "ca bệnh", "ca này", "hồ sơ", "bn-", "bn ", "trẻ em", "trẻ nhỏ", "trẻ", "bé"))
    has_known_med = bool(get_drug_lexical_matcher().extract_medications(lower_query) or resolve_registered_medications(lower_query))
    is_self_symptom = not is_general_ref and not has_patient_context and not has_known_med and bool(
        re.search(r"\b(tôi|(?<!trẻ\s)em|mình)\b.{0,45}\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b|\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b.{0,45}\b(tôi|(?<!trẻ\s)em|mình)\b", lower_query)
    )
    if is_self_symptom:
        chips = [
            "Hướng dẫn sử dụng thuốc hạ sốt",
            "Liều Paracetamol hạ sốt người lớn",
            "Dấu hiệu cảnh báo sốt xuất huyết"
        ] if "sốt" in lower_query else [
            "Tra cứu tài liệu tham khảo chung",
            "Thông tin chuyên luận Dược Thư"
        ]
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Trợ lý này phục vụ tra cứu và nghiệp vụ chuyên môn. Nếu bác sĩ đang xử trí một ca bệnh, vui lòng nêu thông tin nhận diện ca/người bệnh và dữ liệu lâm sàng liên quan; nếu cần thông tin tham khảo chung, hãy nêu chủ đề hoặc thuốc cần tra cứu.",
            answer_type="clarification", source_status="missing_case_context", confidence=1.0, abstention_reason="Câu hỏi triệu chứng chưa xác định người bệnh hoặc ca bệnh",
            suggested_chips=chips
        )

    if session.active_medication_name:
        is_legal_or_regulatory = any(w in lower_query for w in (
            "thông tư", "tt 26", "tt 20", "tt 51", "tt 36", "tt 22", "tt 52",
            "nghị định", "luật dược", "quy chế", "quản lý", "chuỗi lạnh", "fefo", "kê đơn", "đơn thuốc", "bảo hiểm", "bhyt"
        ))
        from app.services.chatbot.fsm_router import has_explicit_new_medication
        has_new_med = has_explicit_new_medication(lower_query, session.active_medication_name)
        from app.services.chatbot.gemini_nlu_router import _has_explicit_context_reference
        has_context_reference = _has_explicit_context_reference(query)

        if not is_legal_or_regulatory and not has_new_med and has_context_reference:
            from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic
            from app.services.chatbot.adaptive_drug_slicer import slice_clinical_drug_evidence
            from app.services.chatbot.adaptive_clinical_synthesizer import synthesize_adaptive_clinical_response

            adapt_analysis = extract_clinical_query_schema_deterministic(
                query, session_context={"active_medication": session.active_medication_name}
            )
            if (
                (adapt_analysis.is_followup_question or (adapt_analysis.medications and session.active_medication_name and any(getattr(m, "canonical_id", str(m)).lower() == session.active_medication_name.lower() or getattr(m, "surface_form", str(m)).lower() == session.active_medication_name.lower() for m in adapt_analysis.medications)))
                and adapt_analysis.query_depth == "DEEP_FACET"
            ):
                evidence, _, status = await slice_clinical_drug_evidence(adapt_analysis, db, session)
                if status == "ok" and evidence:
                    return synthesize_adaptive_clinical_response(
                        evidence,
                        user_name=user_name,
                        user_role=user_role,
                        session_id=session_id
                    )

    is_deep_complex = any(term in lower_query for term in ("thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng"))
    query, lower_query, active_in_query, explicit_named, has_candidate_drug, early_resp = await resolve_active_drug_and_terms(
        query, lower_query, db, session=session, session_id=session_id, user_name=user_name,
        user_role=user_role, is_renal=is_renal, is_deep_complex=is_deep_complex
    )
    if early_resp:
        return early_resp

    fsm_res = await route_fsm_context(query, lower_query, db, session=session, session_id=session_id, user_name=user_name, user_role=user_role)
    if fsm_res:
        return fsm_res

    if lower_query.strip().strip("?.!") in {
        "tra cứu dược thư quốc gia", "tra cuu duoc thu quoc gia", "tra cứu dược thư", "tra cuu duoc thu",
        "dược thư quốc gia", "duoc thu quoc gia", "tra cứu thuốc", "tra cuu thuoc", "cổng tra cứu",
        "tra cứu dược thư 2015", "dược thư 2015", "dược thư", "dược thư qg"
    }:
        session.set_active_medication(name="", ingredient="", sdk="")
        drug_count, monograph_count = await _portal_catalog_counts(db)
        portal_text = _portal_guidance_text_with_counts(drug_count, monograph_count)
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_GUIDE",
            reply_text=portal_text,
            legal_basis="Dược thư Quốc gia Việt Nam & Cục Quản lý Dược (DAV)",
            suggested_chips=["Thông tin thuốc Coversyl", "Thông tin thuốc Augmentin", "Thông tin thuốc Zithromax"],
            session_id=session_id,
            answer_type="medication_lookup_guide",
            source_status="exact_match",
            confidence=1.0
        )

    norm_query = normalize_conversational_query(query)
    norm_lower = norm_query.lower()

    # Complex clinical reasoning continues through the common RAG workflow.

    subflow_res = await dispatch_clinical_subflows(norm_query, norm_lower, user_name, db, user_role=user_role)
    if subflow_res:
        return subflow_res

    has_deictic_followup = bool(session.active_medication_name and any(w in lower_query for w in ("thuốc đó", "thuốc này", "nó", "thuốc vừa nói", "thuốc trên", "thuốc có")))
    if not has_deictic_followup and not has_candidate_drug and not explicit_named:
        from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation, synthesize_specialty_response
        spec_early = find_clinical_specialty_consultation(query) or find_clinical_specialty_consultation(norm_query)
        if spec_early:
            return await synthesize_specialty_response(query, spec_early, user_name=user_name, user_role=user_role, session_id=session_id)

    extracted_kw, resolved_meds = extract_drug_keywords(norm_query), resolve_registered_medications(norm_lower)
    matcher = get_drug_lexical_matcher()
    lex_meds = matcher.extract_medications(norm_query)

    is_two_drug = len(resolved_meds) >= 2 or len(lex_meds) >= 2 or (
        len(extracted_kw.split()) >= 2 and any(term in lower_query for term in ("tương tác", "tương kỵ", "kỵ thuốc", "kỵ với", "phối hợp", "uống cùng", "uống chung", "dùng cùng", "uong cung", "dung cung", "tuong tac"))
    )
    has_interaction_term = any(term in lower_query for term in ("tương tác", "tương kỵ", "kỵ thuốc", "kỵ với", "kỵ gì", "tuong tac", "tuong ky", "ky thuoc"))
    is_check_multi = is_two_drug and ("+" in lower_query or any(w in lower_query for w in ("kiểm tra", "kiem tra", "check", "rà soát", "ra soat")))
    has_feasibility_term = any(term in lower_query for term in (
        "có uống được", "có dùng được", "uống được không", "dùng được không", "có được không",
        "đang dùng", "đang uống", "uống cả", "dùng cả", "uống thêm", "dùng thêm",
        "uống chung", "uống cùng", "dùng cùng", "đi kèm", "kèm theo", "uong duoc", "dung duoc",
        "an toàn không", "nguy hiểm không"
    )) or bool(re.search(r'\b(?:được|uống|dùng)\b.*?\bkhông\b', lower_query))
    is_two_drug_inquiry = is_two_drug and (
        any(term in lower_query for term in ("thì sao", "thi sao", "thế nào", "the nao", "được không", "duoc khong", "như thế nào", "sao", "đi với nhau", "uống cả hai", "dùng cả hai"))
        or has_feasibility_term
        or len(lower_query.split()) <= 6
    )
    is_interaction_q = has_interaction_term or is_check_multi or is_two_drug_inquiry or any(term in lower_query for term in ("phối hợp", "uống cùng", "dùng cùng", "kết hợp", "uống chung", "dùng chung", "uong cung", "dung cung"))
    is_deictic_interaction = has_interaction_term and any(ref in lower_query for ref in ("2 thuốc", "hai thuốc", "thuốc kia", "thuốc đó", "vừa rồi", "hai loại", "2 loại", "chúng nó", "cơ mà"))
    is_non_drug_kw = extracted_kw.lower() in ("tương tác", "tuong tac", "tương kỵ", "tuong ky", "thuốc", "thuoc", "thông tin", "tóm tắt", "tom tat")
    has_single_cand = (has_candidate_drug or len(resolved_meds) == 1 or (len(extracted_kw) >= 3 and not is_non_drug_kw) or active_in_query) and not is_two_drug and not is_deictic_interaction
    is_single_interaction = has_single_cand and has_interaction_term and not any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp ", " va ", " voi ", " cung "))

    has_explicit_interaction_term = any(term in lower_query for term in (
        "tương tác", "tương kỵ", "kỵ nhau", "kỵ thuốc", "kỵ với", "kỵ gì",
        "tuong tac", "tuong ky", "ky thuoc", "phối hợp", "uống cùng", "uống chung",
        "dùng cùng", "uong cung", "dung cung", "kết hợp"
    ))
    excluded_field_terms = [
        "tương tác thuốc của thuốc", "tương tác thuốc paracetamol",
        "tác dụng phụ", "tác dụng không mong muốn", "liều dùng", "liều tối đa",
        "thành phần", "hoạt chất", "tac dung phu", "lieu dung",
        "kỵ rượu", "uống rượu", "uống bia", "rượu bia", "say rượu", "với rượu", "với bia",
        "uống cùng sữa", "với sữa", "uống sữa", "nước cam", "thức ăn", "kiêng ăn gì",
        "trước ăn", "sau ăn", "lúc đói", "lúc no", "sáng hay tối", "uống sáng", "uống tối",
        "suy gan", "xơ gan", "men gan", "người già", "người cao tuổi", "quá liều", "ngộ độc"
    ]
    if not has_explicit_interaction_term:
        excluded_field_terms.extend(["chống chỉ định", "chong chi dinh", "chỉ định", "chi dinh", "công dụng", "cong dung"])

    if (is_interaction_q or is_deictic_interaction) and not is_single_interaction and not any(term in lower_query for term in excluded_field_terms):
        clarification_res = await handle_interaction_clarification(query, lower_query, session_id, user_name, user_role, session=session)
        if clarification_res:
            return clarification_res

    comp_res = await handle_clinical_drug_comparison(query, lower_query, db, session_id, user_name, user_role)
    if comp_res:
        return comp_res

    field_res = await handle_field_or_drug_inquiry(
        query, lower_query, db, session=session, session_id=session_id, user_name=user_name,
        user_role=user_role, has_candidate_drug=has_candidate_drug, active_name_in_query=active_in_query,
        is_renal_adjustment_request=is_renal
    )
    if field_res:
        return field_res

    if not is_renal and not explicit_named and any(term in lower_query for term in ("suy thận", "suy gan", "thai kỳ", "phụ nữ có thai", "cho con bú", "thuốc giảm đau", "thuốc chống đông", "thuốc tim mạch", "thuốc dạ dày", "thuốc tiểu đường", "pha chung", "tương kỵ", "tương tác thuốc")) and not session.active_medication_name:
        from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation, synthesize_specialty_response
        spec_item = find_clinical_specialty_consultation(query)
        if spec_item:
            return await synthesize_specialty_response(query, spec_item, user_name=user_name, user_role=user_role, session_id=session_id)
        if not any(term in lower_query for term in ("huyết áp", "tăng huyết áp", "hạ huyết áp", "ung thư", "u bướu", "hen phế quản", "đái tháo đường")):
            return CopilotResponse(
                intent="MEDICATION_LOOKUP_CLARIFICATION",
                reply_text="Vui lòng nêu tên thuốc/hoạt chất và thông tin người bệnh liên quan (nếu cần đánh giá ca cụ thể) để tra cứu đúng nguồn. Với tương tác hoặc pha truyền, hãy cung cấp đầy đủ các thuốc/dịch cần rà soát.",
                answer_type="clarification", source_status="missing_clinical_subject", confidence=1.0,
                abstention_reason="Thiếu thuốc hoặc đối tượng cần đánh giá"
            )

    deictic_or_unanchored = (
        any(term in lower_query for term in ("thuốc này", "thuốc đó", "thuốc vừa nói", "nó có", "của thuốc này", "của thuốc đó"))
        or lower_query.strip().strip("?.!") in (
            "thông tin chi tiết đầy đủ", "thong tin chi tiet day du", "thông tin chi tiết", "thong tin chi tiet",
            "thông tin đầy đủ", "thong tin day du", "tóm tắt thông tin thuốc đó", "tom tat thong tin thuoc do",
            "tóm tắt thông tin", "tom tat thong tin", "tóm tắt thuốc đó", "tom tat thuoc do", "tóm tắt", "tom tat",
            "hồ sơ đầy đủ", "ho so day du", "hồ sơ chi tiết", "ho so chi tiet", "toàn bộ thông tin", "toan bo thong tin"
        )
    )
    if deictic_or_unanchored and not session.active_medication_name:
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Dạ xin lỗi bác sĩ, hiện chưa xác định được thuốc đang được nhắc tới trong phiên hội thoại này. Bác sĩ vui lòng gửi tên thuốc, hoạt chất hoặc số đăng ký để tra cứu thông tin chi tiết / tóm tắt ạ.",
            answer_type="clarification", source_status="missing_medication_context", confidence=1.0, session_id=session.session_id, suggested_chips=["Tra cứu thông tin thuốc", "Nhập tên hoạt chất hoặc biệt dược"]
        )

    if not is_two_drug and not is_deep_complex and any(term in lower_query for term in ("dùng cho bệnh gì", "dùng để làm gì", "công dụng", "chỉ định", "điều trị gì", "trị gì", "chữa gì")) and (
        has_candidate_drug or any(alias in lower_query for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", []) if len(alias) >= 4)
    ):
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    from app.services.copilot_gemini_scenarios import detect_and_handle_gemini_clinical_scenario
    sc_res = await detect_and_handle_gemini_clinical_scenario(query, lower_query, user_name, db, user_role=user_role, session_id=session_id)
    if sc_res:
        from app.security.guardrails import validate_output_guardrail
        sc_res.reply_text = validate_output_guardrail(sc_res.reply_text, query)
        return sc_res

    is_deep_pharm = any(w in lower_query for w in [
        "thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng",
        "dị ứng chéo", "thải trừ", "sinh khả dụng"
    ])
    if not is_deep_complex and not is_deep_pharm:
        from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation, synthesize_specialty_response
        spec_item = find_clinical_specialty_consultation(query)
        if spec_item:
            return await synthesize_specialty_response(query, spec_item, user_name=user_name, user_role=user_role, session_id=session_id)

    drug_cues = (
        "thông tin thuốc", "thông tin", "tra cứu thuốc", "thuốc ", "liều dùng", "liều lượng",
        "liều tối đa", "còn liều", "liều", "chỉ định", "công dụng", "tác dụng phụ", "tác dụng không mong muốn",
        "chống chỉ định", "thành phần", "hoạt chất", "tương tác", "điều trị", "dùng để", "dùng cho",
        "chữa", "tác dụng", "uống", "tiêm", "truyền", "sử dụng",
        "thong tin thuoc", "thong tin", "tra cuu thuoc", "thuoc", "lieu dung", "chong chi dinh", "tac dung phu", "tuong tac",
        "số lượng", "so luong", "tồn kho", "ton kho", "trong kho"
    )
    has_drug_ent = find_matched_med(lower_query) is not None or find_matched_med(norm_lower) is not None or active_in_query or any(alias in lower_query or alias in norm_lower for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", []) if len(alias) >= 4) or has_candidate_drug or bool(lex_meds)

    is_therapeutic_alternative = any(term in lower_query for term in (
        "đổi sang", "chuyển sang", "thay thế", "thay bằng", "đổi nhóm", "đổi thuốc", "lựa chọn thay thế"
    )) or ("ho khan" in lower_query and any(term in lower_query for term in ("coversyl", "enalapril", "perindopril", "acei", "ức chế men chuyển")))
    if is_therapeutic_alternative:
        deep_rag = await handle_deep_rag_consultation(query, lower_query, user_role, history, session_id, user_name, is_deep_pharm, inference_required=inference_required)
        if deep_rag:
            return deep_rag

    if not is_renal and not is_therapeutic_alternative and has_drug_ent and any(cue in lower_query or cue in norm_lower for cue in drug_cues) and not is_two_drug and not is_deep_complex:
        is_personalized_request = workflow_intent == "PATIENT_MEDICATION_COUNSELING" or any(w in lower_query for w in ["dặn dò", "bệnh nhân hiểu", "người nhà", "3 ý", "giải thích cho", "lưu ý quan trọng", "dễ hiểu", "dành cho điều dưỡng", "dành cho bác sĩ", "súc tích"])
        if is_personalized_request:
            sandwich_res = await execute_clinical_sandwich_pipeline(query, user_role, user_name, session_id, db)
            if sandwich_res:
                return sandwich_res
        return await lookup_drug_authoritative(
            norm_query, db, session_id=session_id, user_name=user_name, user_role=user_role,
            query_mode=(getattr(nlu_res, "query_mode", None) or ("clinical_qa" if len(query.split()) >= 5 else "card_lookup")),
        )

    contextual_rag = await handle_contextual_rag_followup(query, lower_query, user_role, history, session_id, user_name, is_interaction_q, explicit_named, session.active_medication_name, inference_required=inference_required)
    if contextual_rag:
        return contextual_rag

    ops_res = await dispatch_operational_business(norm_query, norm_lower, user_name, db)
    if ops_res:
        return ops_res

    has_sdk = bool(re.search(r"((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)", lower_query))
    is_deep_pharm = any(w in lower_query for w in [
        "thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng",
        "dị ứng chéo", "thải trừ", "sinh khả dụng"
    ])
    has_reg_drug = bool(resolve_registered_medications(lower_query))
    matched_med = find_matched_med(lower_query)
    is_med_info = any(w in lower_query for w in ["thời gian bán thải", "chỉ định", "chống chỉ định", "tác dụng phụ", "tác dụng", "công dụng", "tương tác", "dùng để làm gì", "liều tối đa", "liều dùng", "là gì", "dị ứng", "huyết tương", "dược động học", "cơ chế", "thành phần", "uống lúc nào", "thế nào", "như thế nào", "bao nhiêu", "hỏi về", "thông tin"])
    has_drug_ask = lower_query.startswith("thuốc ") or " thuốc " in lower_query or any(w in lower_query for w in ["thông tin", "tra cứu thuốc", "sđk", "số đăng ký", "là thuốc gì", "dược thư", "về thuốc", "hỏi về thuốc", "biệt dược", "hoạt chất", "liều dùng", "liều lượng", "còn liều", "liều", "uống thế nào", "dùng thế nào", "dùng để làm gì", "chỉ định", "chống chỉ định", "tác dụng phụ", "uống được không", "dùng được không", "uống lúc nào"]) or has_reg_drug or bool(lex_meds) or (matched_med is not None and is_med_info and not is_deep_pharm)

    cand_kw_present = bool(extract_drug_keywords(lower_query))
    is_short_drug_candidate = len(lower_query.split()) <= 3 and cand_kw_present and not any(w in lower_query for w in ["chào", "hello", "hi", "tủ trực", "báo hỏng", "hư hỏng", "máy thở", "monitor", "kiểm kê", "giao ban"])
    if (has_sdk or ((has_drug_ask or is_short_drug_candidate) and (has_drug_ent or cand_kw_present))) and not is_deep_pharm and not is_interaction_q and not is_renal and not is_deep_complex and not is_therapeutic_alternative:
        is_personalized_request = workflow_intent == "PATIENT_MEDICATION_COUNSELING" or any(w in lower_query for w in ["dặn dò", "bệnh nhân hiểu", "người nhà", "3 ý", "giải thích cho", "lưu ý quan trọng", "dễ hiểu", "dành cho điều dưỡng", "dành cho bác sĩ", "súc tích"])
        if is_personalized_request:
            sandwich_res = await execute_clinical_sandwich_pipeline(query, user_role, user_name, session_id, db)
            if sandwich_res:
                return sandwich_res
        return await lookup_drug_authoritative(
            norm_query, db, session_id=session_id, user_name=user_name, user_role=user_role,
            query_mode=(getattr(nlu_res, "query_mode", None) or ("clinical_qa" if len(query.split()) >= 5 else "card_lookup")),
        )

    clean_greeting = re.sub(r"[^\w\s]", "", lower_query).strip()
    if len(lower_query.strip()) >= 4 and clean_greeting not in {"ừ", "uhm", "uh", "123", "abc", "test", "vâng", "dạ"}:
        deep_rag = await handle_deep_rag_consultation(query, lower_query, user_role, history, session_id, user_name, is_deep_pharm, inference_required=inference_required)
        if deep_rag and deep_rag.rag_grounded and deep_rag.answer_type != "safe_abstention":
            return deep_rag

    if not is_deep_pharm and not is_deep_complex:
        from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation, synthesize_specialty_response, get_clinical_persona_greeting
        spec_direct = find_clinical_specialty_consultation(query) or find_clinical_specialty_consultation(norm_query)
        if spec_direct:
            return await synthesize_specialty_response(query, spec_direct, user_name=user_name, user_role=user_role, session_id=session_id)

    if len(lower_query.strip()) >= 4 and clean_greeting not in {"ừ", "uhm", "uh", "123", "abc", "test", "vâng", "dạ"}:
        if "deep_rag" in locals() and deep_rag is not None:
            return deep_rag

    greeting = get_clinical_persona_greeting(user_name, user_role)
    fallback_reply = "Chưa xác định được ý định và chủ đề cần tra cứu. Vui lòng nêu rõ tên thuốc, hoạt chất, văn bản hoặc nghiệp vụ cần hỗ trợ."
    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE", reply_text="Chưa xác định được ý định và chủ đề cần tra cứu. Vui lòng nêu rõ tên thuốc, hoạt chất, văn bản hoặc nghiệp vụ cần hỗ trợ.",
        suggested_chips=[]
    )


# Lưu ý: validate_response_evidence_contract và _has_verified_source_version đã được
# tách thành module độc lập backend/app/services/chatbot/evidence_contract_validator.py
# và được import / re-export tại đầu tệp để đảm bảo tính tinh gọn và tương thích ngược 100%.


async def handle_copilot_chat(payload: CopilotQuery, request: Request, db: AsyncSession, *, session, history: str) -> CopilotResponse:
    """Entrypoint chính của Copilot: Xử lý chat và tự động chuẩn hóa 100% nguồn đối chứng (citations)."""
    resp = await _handle_copilot_chat_core(payload, request, db, session=session, history=history)

    # Adaptive Corrective RAG (CRAG) Fallback:
    # 1. Khi ở chế độ ONLINE (enable_web_search=True): Bất kỳ câu hỏi lâm sàng nào bị safe_abstention / unindexed
    #    đều tự động kích hoạt Grounded Web Search để trả lời, không bao giờ rơi vào Request_Unavailable.
    # 2. Khi ở chế độ OFFLINE (enable_web_search=False): Tự động kích hoạt Web Search nếu CSDL nội bộ
    #    chưa có thông tin thuốc thực tế (unindexed_clinical_drug / unsupported_medication_entity).
    is_abstention_or_unindexed = (
        resp is not None
        and (
            resp.answer_type == "safe_abstention"
            or resp.source_status in ("unsupported_medication_entity", "unindexed_clinical_drug")
        )
        and resp.source_status not in ("out_of_scope", "unanchored_turn", "pricing_inquiry", "general_chitchat", "security_guardrail_blocked", "missing_clinical_subject", "missing_medication_context")
    )
    if (
        not payload.image_base64
        and is_abstention_or_unindexed
    ):
        lower_q = payload.query.lower()
        is_regulatory = any(w in lower_q for w in (
            "thông tư", "quy định", "quy chế", "nghị định", "hướng dẫn", "tiêu chuẩn",
            "pháp lý", "văn bản", "chính sách", "luật", "phác đồ"
        ))
        is_internal_operational = not is_regulatory and any(term in lower_q for term in (
            "tồn kho", "trong kho", "kho dược", "tủ trực", "báo hỏng", "hư hỏng",
            "máy thở", "monitor", "kiểm kê", "giao ban", "kho viện", "phiếu lĩnh"
        ))
        if not is_internal_operational:
            user_role = getattr(payload, "user_role", "doctor") or "doctor"
            user_name = getattr(payload, "user_name", "Bác sĩ") or "Bác sĩ"
            from app.services.chatbot.semantic_web_intent_router import check_semantic_web_bypass
            bypass = await check_semantic_web_bypass(payload.query, user_name=user_name, user_role=user_role, history=history)
            if bypass is None:
                from app.services.copilot_drug_keyword_extractor import extract_drug_keywords
                from app.services.chatbot.grounded_web_search_handler import handle_grounded_web_search_turn
                fallback_payload = payload.model_copy(update={"enable_web_search": True})
                web_resp = await handle_grounded_web_search_turn(
                    fallback_payload, user_role=user_role, session=session, history=history
                )
                if (
                    web_resp is not None
                    and web_resp.answer_type not in ("safe_abstention", "clarification")
                    and (web_resp.source_status != "no_search_results" or payload.enable_web_search)
                ):
                    cand_kw = extract_drug_keywords(lower_q)
                    clean_kw = cand_kw.split()[0] if cand_kw else ""
                    has_verified_entity = True
                    if not payload.enable_web_search and clean_kw and len(clean_kw) >= 4:
                        all_web_text = " ".join([
                            (c.get("title", "") + " " + c.get("snippet", ""))
                            for c in (web_resp.citations or [])
                            if isinstance(c, dict)
                        ]).lower()
                        # Thuốc ứng viên bắt buộc phải xuất hiện trong dữ liệu tìm kiếm web thực tế khi ở chế độ offline
                        if clean_kw not in all_web_text:
                            has_verified_entity = False

                    if has_verified_entity:
                        if session is not None and hasattr(session, "append_conversation_turn"):
                            session.append_conversation_turn(payload.query, web_resp.reply_text)
                        resp = web_resp.model_copy(update={"session_id": session.session_id if session else payload.session_id})

    return post_process_copilot_response(
        resp, request, payload,
        validator_fn=validate_response_evidence_contract,
    )

