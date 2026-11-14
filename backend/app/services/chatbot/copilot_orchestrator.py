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


def _has_verified_source_version(value: object) -> bool:
    normalized = str(value or "").strip().casefold()
    return bool(normalized) and normalized not in {"unversioned", "unknown", "none"}

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
    if authenticated:
        user_name = authenticated.username
        user_role = authenticated.role
        req_session = (payload.session_id or getattr(session, "session_id", "default_session")).strip()
        session_id = req_session if req_session.startswith(f"{user_name.casefold()}:") else f"{user_name.casefold()}:{req_session}"
        return user_name, user_role, session_id

    if session and getattr(session, "user_name", None):
        user_name = session.user_name
        user_role = getattr(session, "user_role", payload.user_role)
        session_id = session.session_id
        return user_name, user_role, session_id

    user_name = payload.user_name
    user_role = payload.user_role
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

    # NẾU CÓ ẢNH ĐÍNH KÈM: Chuyển thẳng sang luồng Multimodal Vision Analysis chuyên sâu
    if payload.image_base64:
        from app.services.llm_provider import query_clinical_multimodal_chat
        vision_res = await query_clinical_multimodal_chat(
            image_base64=payload.image_base64,
            mime_type=payload.image_mime_type or "image/jpeg",
            user_query=payload.query,
            user_role=user_role
        )
        if vision_res and isinstance(vision_res, dict):
            reply_text = vision_res.get("reply_markdown") or "Đã phân tích hình ảnh đính kèm thành công."
            evidence = vision_res.get("evidence") or []
            citations = vision_res.get("citations") or []
            is_non_clinical = vision_res.get("is_clinical") is False or vision_res.get("category") == "NON_CLINICAL"
            grounded = bool(evidence and citations and vision_res.get("rag_grounded"))
            if not grounded and not is_non_clinical:
                from app.services.chatbot.image_report_formatter import format_image_extraction_report
                extracted_text = vision_res.get("extracted_text") or vision_res.get("reply_markdown")
                if extracted_text or vision_res.get("extracted_sections"):
                    reply_text = format_image_extraction_report(vision_res)
                else:
                    reply_text = "Chưa đọc được nội dung ảnh. Vui lòng gửi ảnh rõ hơn hoặc dùng chức năng đọc ảnh/biểu mẫu chuyên dụng."
            legal_basis = vision_res.get("legal_basis") if grounded else None
            if is_non_clinical:
                reply_text = str(vision_res.get("reply_markdown") or "Hệ thống chỉ hỗ trợ phân tích ảnh thuốc, đơn thuốc và tài liệu BHYT.")
            suggested_chips = vision_res.get("suggested_chips") or ["Báo hỏng thiết bị", "Tra cứu Dược Thư", "Đối chiếu quy chế"]
            card_obj = None
            if grounded and vision_res.get("card") and isinstance(vision_res.get("card"), dict):
                from app.schemas.copilot import CopilotActionCard
                c = vision_res["card"]
                card_obj = CopilotActionCard(
                    card_type=c.get("card_type", "incident_confirm"),
                    title=c.get("title", "Phiếu Báo Hỏng Thiết Bị Y Tế"),
                    summary=c.get("summary", "Đề xuất lập phiếu báo hỏng thiết bị"),
                    data=c.get("data", {}),
                    primary_action_label=c.get("primary_action_label", "Tạo Phiếu"),
                    primary_action_type=c.get("primary_action_type", "CREATE_TICKET"),
                    target_tab=c.get("target_tab", "asset_audit")
                )
            from app.schemas.copilot import ClinicalSummary
            return CopilotResponse(
                intent="MULTIMODAL_CLINICAL_VISION",
                reply_text=reply_text,
                legal_basis=legal_basis,
                clinical_summary=(
                    ClinicalSummary(
                        headline="Kết quả đọc ảnh chưa xác minh",
                        key_takeaway="Nội dung trích xuất từ ảnh chưa được đối chiếu với nguồn y tế.",
                        urgency="warning",
                    ) if not grounded and not is_non_clinical else None
                ),
                suggested_chips=suggested_chips,
                card=card_obj,
                rag_grounded=grounded,
                citations=citations,
                evidence=evidence,
                answer_type=("out_of_scope" if is_non_clinical else ("grounded_reference" if grounded else "image_extraction")),
                source_status="out_of_scope" if is_non_clinical else ("verified_evidence" if grounded else "image_extracted_unverified"),
                abstention_reason=None if (grounded or is_non_clinical) else "Không có evidence/citation kiểm chứng cho kết quả phân tích ảnh",
                prompt_tokens=vision_res.get("_prompt_tokens", 0),
                completion_tokens=vision_res.get("_completion_tokens", 0),
                total_tokens=vision_res.get("_total_tokens", 0),
                model_name=vision_res.get("_model_used", "gemini-3.5-flash-lite"),
                has_image=True,
                image_tokens=vision_res.get("_image_tokens", 258)
            )

    query = guard_res.sanitized_query
    lower_query = query.lower()

    # Stage 1: Clinical text sanitization & modifier deconstruction
    from app.services.chatbot.clinical_text_sanitizer import sanitize_clinical_input
    sanitized_ctx = sanitize_clinical_input(query)
    query = sanitized_ctx.clean_query
    lower_query = query.lower()

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
        is_field_inquiry = bool(session.active_medication_name and any(term in lower_query for term in FIELD_ONLY_TERMS))
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
            if not nlu_res.primary_drug and not has_contextual_entity:
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

        if not is_legal_or_regulatory and not has_new_med:
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

    # Tạm thời comment chặn triệu chứng bản thân theo yêu cầu người dùng để chuyển sang tra cứu SOTA RAG
    # is_general_ref = any(term in lower_query for term in ("thông tin về", "thông tin", "tài liệu", "tra cứu", "hướng dẫn", "phác đồ", "thuốc hạ sốt", "thuốc giảm đau", "nhóm thuốc", "danh mục", "chuyên luận"))
    # is_self_symptom = not is_general_ref and bool(re.search(r"\b(tôi|em|mình)\b.{0,45}\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b|\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b.{0,45}\b(tôi|em|mình)\b", lower_query))
    # if is_self_symptom and not any(term in lower_query for term in ("bệnh nhân", "người bệnh", "ca bệnh", "ca này", "hồ sơ", "bn-", "bn ")):
    #     chips = [
    #         "Hướng dẫn sử dụng thuốc hạ sốt",
    #         "Liều Paracetamol hạ sốt người lớn",
    #         "Dấu hiệu cảnh báo sốt xuất huyết"
    #     ] if "sốt" in lower_query else [
    #         "Tra cứu tài liệu tham khảo chung",
    #         "Thông tin chuyên luận Dược Thư"
    #     ]
    #     return CopilotResponse(
    #         intent="CLINICAL_CASE_CLARIFICATION",
    #         reply_text="Trợ lý này phục vụ tra cứu và nghiệp vụ chuyên môn. Nếu bác sĩ đang xử trí một ca bệnh, vui lòng nêu thông tin nhận diện ca/người bệnh và dữ liệu lâm sàng liên quan; nếu cần thông tin tham khảo chung, hãy nêu chủ đề hoặc thuốc cần tra cứu.",
    #         answer_type="clarification", source_status="missing_case_context", confidence=1.0, abstention_reason="Câu hỏi triệu chứng chưa xác định người bệnh hoặc ca bệnh",
    #         suggested_chips=chips
    #     )

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
        return await lookup_drug_authoritative(norm_query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    # Tạm thời comment detect_and_handle_gemini_clinical_scenario theo yêu cầu người dùng
    # sc_res2 = await detect_and_handle_gemini_clinical_scenario(query, lower_query, user_name, db, user_role=user_role, session_id=session_id)
    # if sc_res2:
    #     sc_res2.reply_text = validate_output_guardrail(sc_res2.reply_text, query)
    #     return sc_res2

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
        return await lookup_drug_authoritative(norm_query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    if not is_deep_pharm and not is_deep_complex:
        from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation, synthesize_specialty_response, get_clinical_persona_greeting
        spec_direct = find_clinical_specialty_consultation(query) or find_clinical_specialty_consultation(norm_query)
        if spec_direct:
            return await synthesize_specialty_response(query, spec_direct, user_name=user_name, user_role=user_role, session_id=session_id)

    clean_greeting = re.sub(r"[^\w\s]", "", lower_query).strip()
    if len(lower_query.strip()) >= 4 and clean_greeting not in {"ừ", "uhm", "uh", "123", "abc", "test", "vâng", "dạ"}:
        deep_rag = await handle_deep_rag_consultation(query, lower_query, user_role, history, session_id, user_name, is_deep_pharm, inference_required=inference_required)
        if deep_rag:
            return deep_rag

    greeting = get_clinical_persona_greeting(user_name, user_role)
    fallback_reply = "Chưa xác định được ý định và chủ đề cần tra cứu. Vui lòng nêu rõ tên thuốc, hoạt chất, văn bản hoặc nghiệp vụ cần hỗ trợ."
    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE", reply_text="Chưa xác định được ý định và chủ đề cần tra cứu. Vui lòng nêu rõ tên thuốc, hoạt chất, văn bản hoặc nghiệp vụ cần hỗ trợ.",
        suggested_chips=[]
    )


def validate_response_evidence_contract(resp: CopilotResponse) -> CopilotResponse:
    if resp.intent == "MULTIMODAL_CLINICAL_VISION" and resp.answer_type in {"image_extraction", "out_of_scope"}:
        return resp
    non_factual_types = {
        "clarification", "safe_abstention", "feedback_acknowledgment",
        "conversational_feedback", "conversational_correction",
        "conversational_guidance", "capability_overview", "unavailable",
        "operational_result", "action_result", "action_confirmation", "cdss_alert",
        "guideline", "medication_lookup_guide", "acknowledgment", "image_extraction",
    }
    non_factual_intents = {
        "GREETING_WELCOME", "GREETING_WELLBEING", "CONVERSATIONAL_FEEDBACK",
        "CONVERSATIONAL_CORRECTION", "FEEDBACK_DATA_ENRICHMENT",
        "FEEDBACK_UI_ADJUSTMENT", "OUT_OF_SCOPE", "SECURITY_GUARDRAIL_BLOCKED",
        "CLINICAL_CASE_CLARIFICATION", "MEDICATION_LOOKUP_CLARIFICATION",
        "CLINICAL_SAFE_ABSTENTION", "CAPABILITY_OPENING",
        "BUSINESS_OVERVIEW", "GENERAL_CLINICAL_ASSISTANCE", "CLINICAL_ALLERGY_CDSS",
        "MEDICATION_LOOKUP_GUIDE", "ACKNOWLEDGMENT", "CLINICAL_DDI_INTERACTION_LOOKUP",
        "CLINICAL_PEDIATRIC_GUIDANCE", "MEDICATION_INTERACTION_CLARIFICATION",
    }
    clinical_fact_intents = {
        "CLINICAL_ALLERGY_CDSS", "CLINICAL_DDI_INTERACTION_LOOKUP",
        "CLINICAL_PEDIATRIC_GUIDANCE", "MEDICATION_SAFETY_PROFILE",
        "CLINICAL_AI_CONSULTATION", "ONCOLOGY_SPECIALTY_GUIDANCE",
        "LEGAL_GUIDANCE", "MULTI_INTENT_COMPOSITE",
    }
    clinical_factual_types = {
        "grounded_reference", "medication_profile", "medication_summary", "medication_field",
        "medication_fields", "multihop_case_consultation", "composite_answer", "guideline", "cdss_alert",
    }
    is_clinical_factual = resp.intent in clinical_fact_intents or resp.answer_type in clinical_factual_types
    if resp.intent in non_factual_intents and not is_clinical_factual:
        return resp
    if resp.intent in clinical_fact_intents and resp.answer_type not in {"safe_abstention", "clarification"}:
        # Clinical facts always require claim-level validation, regardless of
        # historical intent allowlists or an attached CDSS alert.
        pass
    if resp.answer_type == "safe_abstention" and resp.intent not in non_factual_intents:
        resp.rag_grounded = False
        resp.confidence = 0.0
        resp.citations = []
        resp.evidence = []
        resp.claims = []
        resp.evidence_claim_map = {}
        is_explicit_explanation = any(
            phrase in (resp.reply_text or "").casefold()
            for phrase in ("thiếu nguồn", "chưa thể xác minh", "chưa tìm thấy", "unable to resolve", "vui lòng", "không thể")
        )
        if not is_explicit_explanation and resp.source_status in {None, "evidence_provenance_missing", "evidence_validation_failed", "insufficient_retrieval_evidence"}:
            resp.reply_text = "Chưa thể xác minh nội dung lâm sàng từ nguồn tài liệu có thể truy xuất. Vui lòng thử lại với tài liệu đã được lập chỉ mục hoặc yêu cầu quản trị viên kiểm tra nguồn."
        return resp
    if resp.answer_type in non_factual_types and not is_clinical_factual:
        return resp
    # Citation and provenance metadata alone cannot prove the returned prose.
    # The common boundary accepts only claim objects produced by a validated executor.
    evidence_by_id = {
        item.get("evidence_id"): item
        for item in (resp.evidence or [])
        if isinstance(item, dict) and item.get("evidence_id")
    }
    cited_chunk_ids = {
        str(item.get("chunk_id")) for item in (resp.citations or [])
        if isinstance(item, dict) and item.get("chunk_id")
    }
    valid_claims = []
    for claim in resp.claims or []:
        if claim.support_status != "supported" or not claim.evidence_ids:
            continue
        linked = [evidence_by_id.get(evidence_id) for evidence_id in claim.evidence_ids]
        if any(item is None for item in linked):
            continue
        if any(
            item.get("evidence_type") == "document_chunk"
            and str(item.get("chunk_id")) not in cited_chunk_ids
            for item in linked
        ):
            continue
        if any(claim.claim_id not in (resp.evidence_claim_map or {}).get(evidence_id, []) for evidence_id in claim.evidence_ids):
            continue
        if claim.claim_type == "evidence_inference":
            continue
        if any(
            not item.get("source_id") or not _has_verified_source_version(item.get("source_version"))
            or " ".join(str(claim.text).casefold().split()) not in " ".join(str(item.get("content") or "").casefold().split())
            for item in linked
        ):
            continue
        valid_claims.append(claim)
    reply_normalized = " ".join((resp.reply_text or "").casefold().split())
    if len(valid_claims) != len(resp.claims or []) or any(
        " ".join(claim.text.casefold().split()) not in reply_normalized for claim in valid_claims
    ):
        valid_claims = []
    if not valid_claims:
        resp.rag_grounded = False
        resp.answer_type = "safe_abstention"
        has_versioned_evidence = any(
            isinstance(item, dict) and item.get("source_id")
            and _has_verified_source_version(item.get("source_version"))
            for item in (resp.evidence or [])
        )
        resp.source_status = "evidence_validation_failed" if has_versioned_evidence else "evidence_provenance_missing"
        resp.abstention_reason = "Không có claim lâm sàng đã xác minh với evidence nguồn"
        resp.reply_text = "Chưa thể xác minh nội dung câu trả lời với claim được gắn trực tiếp vào evidence có provenance."
        resp.confidence = 0.0
        resp.citations = []
        resp.evidence = []
        resp.claims = []
        resp.evidence_claim_map = {}
        return resp
    resp.claims = valid_claims
    # A factual response with zero confidence is not eligible to be grounded,
    # even if a later stage attached valid provenance metadata.
    if resp.confidence is not None and resp.confidence <= 0:
        resp.rag_grounded = False
        resp.answer_type = "safe_abstention"
        resp.source_status = resp.source_status or "evidence_validation_failed"
        resp.abstention_reason = resp.abstention_reason or "Phản hồi factual chưa đạt ngưỡng xác thực"
        resp.citations = []
        resp.evidence = []
        return resp

    evidence, citations = resp.evidence or [], resp.citations or []
    def is_real_version(value: object) -> bool:
        normalized = str(value or "").strip().casefold()
        return bool(normalized) and normalized not in {"unversioned", "unknown", "none"}

    cited_chunks = {str(c.get("chunk_id")) for c in citations if isinstance(c, dict) and c.get("chunk_id")}
    has_linked_document = any(
        isinstance(item, dict) and item.get("evidence_type") == "document_chunk"
        and item.get("chunk_id") in cited_chunks
        and item.get("source_id") and item.get("content")
        and is_real_version(item.get("source_version"))
        for item in evidence
    )
    has_versioned_graph = any(
        isinstance(item, dict) and item.get("evidence_type") == "knowledge_graph"
        and item.get("content") and item.get("source_id") and item.get("source_version")
        and is_real_version(item.get("source_version"))
        for item in evidence
    )
    if not (has_linked_document or has_versioned_graph):
        resp.rag_grounded = False
        resp.answer_type = "safe_abstention"
        resp.source_status = "evidence_provenance_missing"
        resp.abstention_reason = "Không xác minh được evidence gắn với citation của câu trả lời"
        resp.reply_text = "Chưa thể xác minh câu trả lời từ nguồn tài liệu có thể truy xuất. Vui lòng thử lại với tài liệu đã được lập chỉ mục hoặc yêu cầu quản trị viên kiểm tra nguồn."
        resp.confidence = 0.0
    elif not resp.rag_grounded:
        resp.answer_type = "safe_abstention"
        resp.abstention_reason = resp.abstention_reason or "Kết quả factual chưa qua xác thực evidence"
        resp.source_status = "evidence_validation_failed"
        resp.reply_text = "Đã tìm thấy tài liệu liên quan nhưng chưa xác minh được nội dung trả lời. Vui lòng thử lại hoặc đối chiếu trực tiếp với nguồn được quản trị."
        resp.confidence = 0.0
    return resp


async def handle_copilot_chat(payload: CopilotQuery, request: Request, db: AsyncSession, *, session, history: str) -> CopilotResponse:
    """Entrypoint chính của Copilot: Xử lý chat và tự động chuẩn hóa 100% nguồn đối chứng (citations)."""
    from app.services.chatbot.citation_standardizer import standardize_response_citations
    resp = await _handle_copilot_chat_core(payload, request, db, session=session, history=history)
    resp = standardize_response_citations(resp, payload.query)
    resp = validate_response_evidence_contract(resp)
    route_intent = getattr(getattr(request.state, "workflow_route", None), "intent", None)
    from app.services.chatbot.answer_operation import apply_reference_note
    resp = apply_reference_note(resp, getattr(request.state, "clinical_nlu_result", None), route_intent)
    if resp.answer_type == "safe_abstention":
        resp.citations = []
        resp.evidence = []
        if not resp.clinical_summary:
            from app.schemas.copilot import ClinicalSummary
            headline = "Từ chối an toàn (Safe Abstention)"
            takeaway = (resp.abstention_reason or resp.reply_text[:120]).replace("\n", " ").strip()
            resp.clinical_summary = ClinicalSummary(headline=headline, key_takeaway=takeaway, urgency="warning")
        if not resp.clinical_data or not resp.clinical_data.abstention_details:
            from app.schemas.copilot import StructuredClinicalPayload, AbstentionDetailsSchema
            reason_code = str(resp.source_status or "SAFE_ABSTENTION").upper()
            resp.clinical_data = StructuredClinicalPayload(
                abstention_details=AbstentionDetailsSchema(
                    reason_code=reason_code,
                    unresolved_entities=[],
                    professional_recommendations=[
                        "Kiểm tra lại tên biệt dược/hoạt chất hoặc tài liệu chuyên môn đã được Bộ Y tế phê duyệt.",
                        "Tham khảo ý kiến Dược sĩ lâm sàng trước khi chỉ định."
                    ]
                )
            )
    elif resp.answer_type == "clarification":
        if not resp.clinical_summary:
            from app.schemas.copilot import ClinicalSummary
            headline = "Yêu cầu làm rõ thông tin"
            takeaway = resp.reply_text[:120].replace("\n", " ").strip()
            resp.clinical_summary = ClinicalSummary(headline=headline, key_takeaway=takeaway, urgency="routine")
    return resp

