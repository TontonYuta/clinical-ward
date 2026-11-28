"""
Deduplicated Clinical Fallback Pipeline (called only when a managed executor returns None).
Eliminates the legacy 5x specialty scans, 3x out-of-scope checks, 2x dose reasoning calls,
and 7x scattered RAG invocations via `ctx.tried_stages` stage tracking.
"""
from __future__ import annotations

import re
from typing import Optional

from app.schemas.copilot import CopilotResponse
from app.security.guardrails import validate_output_guardrail
from app.services.chatbot.drug_comparison import handle_clinical_drug_comparison
from app.services.chatbot.executors.context import (
    WorkflowExecutionContext,
    normalize_conversational_query,
    portal_catalog_counts,
    portal_guidance_text_with_counts,
)
from app.services.chatbot.field_routing import (
    handle_field_or_drug_inquiry,
    handle_interaction_clarification,
)
from app.services.chatbot.fsm_router import route_fsm_context
from app.services.chatbot.hospital_business_dispatcher import (
    dispatch_clinical_subflows,
    dispatch_operational_business,
)
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
from app.services.chatbot.multiturn_handler import resolve_active_drug_and_terms
from app.services.chatbot.pure_rag_handler import (
    handle_contextual_rag_followup,
    handle_deep_rag_consultation,
)
from app.services.chatbot.sandwich_pipeline import execute_clinical_sandwich_pipeline
from app.services.chatbot.session_routing import check_renal_adjustment_request
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_lookup import extract_drug_keywords, lookup_drug_authoritative
from app.services.copilot_gemini_scenarios import detect_and_handle_gemini_clinical_scenario


def _hook(ctx: WorkflowExecutionContext, name: str, default):
    if ctx.orch_module is not None and hasattr(ctx.orch_module, name):
        return getattr(ctx.orch_module, name)
    return default


async def _try_specialty_once(ctx: WorkflowExecutionContext, norm_query: str) -> Optional[CopilotResponse]:
    if "specialty_registry" in ctx.tried_stages:
        return None
    ctx.tried_stages.add("specialty_registry")
    from app.services.chatbot.conversational_clinical_engine import (
        find_clinical_specialty_consultation,
        synthesize_specialty_response,
    )
    spec_item = find_clinical_specialty_consultation(ctx.query) or find_clinical_specialty_consultation(norm_query)
    if spec_item:
        return await synthesize_specialty_response(
            ctx.query, spec_item, user_name=ctx.user_name, user_role=ctx.user_role, session_id=ctx.session_id
        )
    return None


async def run_fallback_clinical_pipeline(ctx: WorkflowExecutionContext) -> CopilotResponse:
    """Single-pass deduplicated fallback clinical workflow."""
    query = ctx.query
    lower_query = ctx.lower_query
    session = ctx.session
    nlu_res = ctx.nlu_res

    # 1. Contextual query rewrite ONLY when the turn is genuinely a contextual follow-up (never bleed independent turns)
    has_deictic_ref = (
        any(r in lower_query for r in ("thuốc này", "thuốc đó", "thuốc kia", "vừa rồi"))
        or bool(re.search(r"\bnó\b", lower_query))
    )
    is_contextual_turn = bool(
        (nlu_res is None and ctx.history and ctx.history.strip())
        or (nlu_res is not None and (
            getattr(nlu_res, "conversation_mode", "independent") == "contextual_followup"
            or getattr(nlu_res, "is_deictic_referent", False)
        ))
        or (has_deictic_ref and bool((ctx.history and ctx.history.strip()) or getattr(session, "active_medication_name", None)))
    )
    if is_contextual_turn:
        from app.services.rag.query_rewriter import rewrite_clinical_query
        rewritten_res = await rewrite_clinical_query(query, history=ctx.history, active_med=session.active_medication_name)
        query = rewritten_res.rewritten_query
        lower_query = query.lower()
        ctx.query = query
        ctx.lower_query = lower_query
        if nlu_res and ctx.policy_state is not None and ctx.workflow_context is not None:
            ctx.request.state.workflow_context = ctx.workflow_context.model_copy(update={"rewritten_query": query})

    # 2. Neuro-Symbolic Patient Dose Reasoning (skip if already tried by clinical_reasoning executor)
    is_advice_or_schedule = any(
        w in lower_query for w in ("dặn dò", "nhắc uống thuốc", "nhắc thuốc", "lịch uống", "lên lịch nhắc", "thông báo uống")
    )
    if not is_advice_or_schedule and "patient_dose_reasoning" not in ctx.tried_stages:
        ctx.tried_stages.add("patient_dose_reasoning")
        from app.services.clinical_reasoning.patient_dose_reasoner import evaluate_patient_dose_reasoning
        patient_dose_res = await evaluate_patient_dose_reasoning(
            query=query, session=session, db=ctx.db, user_name=ctx.user_name,
            user_role=ctx.user_role, nlu_extraction=nlu_res,
        )
        if patient_dose_res:
            return patient_dose_res

    is_renal = any(t in lower_query for t in ("suy thận", "chức năng thận", "egfr", "crcl", "creatinine", "crystalin", "creatin", "chỉnh liều"))
    renal_fn = _hook(ctx, "check_renal_adjustment_request", check_renal_adjustment_request)
    renal_res = renal_fn(query, lower_query, nlu_drug=(getattr(nlu_res, "primary_drug", None) if nlu_res else None))
    if renal_res:
        return renal_res

    # 3. Self-symptom clarification guard
    is_general_ref = any(
        term in lower_query for term in (
            "thông tin về", "thông tin", "tài liệu", "tra cứu", "hướng dẫn", "phác đồ",
            "thuốc hạ sốt", "thuốc giảm đau", "nhóm thuốc", "danh mục", "chuyên luận",
            "kiêng gì", "kiêng", "chăm sóc", "ăn uống",
        )
    )
    has_patient_context = any(
        term in lower_query for term in ("bệnh nhân", "người bệnh", "ca bệnh", "ca này", "hồ sơ", "bn-", "bn ", "trẻ em", "trẻ nhỏ", "trẻ", "bé")
    )
    has_known_med = bool(get_drug_lexical_matcher().extract_medications(lower_query) or resolve_registered_medications(lower_query))
    is_self_symptom = not is_general_ref and not has_patient_context and not has_known_med and bool(
        re.search(
            r"\b(tôi|(?<!trẻ\s)em|mình)\b.{0,45}\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b|"
            r"\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b.{0,45}\b(tôi|(?<!trẻ\s)em|mình)\b",
            lower_query,
        )
    )
    if is_self_symptom:
        chips = (
            ["Hướng dẫn sử dụng thuốc hạ sốt", "Liều Paracetamol hạ sốt người lớn", "Dấu hiệu cảnh báo sốt xuất huyết"]
            if "sốt" in lower_query
            else ["Tra cứu tài liệu tham khảo chung", "Thông tin chuyên luận Dược Thư"]
        )
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Trợ lý này phục vụ tra cứu và nghiệp vụ chuyên môn. Nếu bác sĩ đang xử trí một ca bệnh, vui lòng nêu thông tin nhận diện ca/người bệnh và dữ liệu lâm sàng liên quan; nếu cần thông tin tham khảo chung, hãy nêu chủ đề hoặc thuốc cần tra cứu.",
            answer_type="clarification",
            source_status="missing_case_context",
            confidence=1.0,
            abstention_reason="Câu hỏi triệu chứng chưa xác định người bệnh hoặc ca bệnh",
            suggested_chips=chips,
        )

    # 4. Adaptive deep-facet follow-up slicer
    if session.active_medication_name:
        is_legal = any(w in lower_query for w in (
            "thông tư", "tt 26", "tt 20", "tt 51", "tt 36", "tt 22", "tt 52",
            "nghị định", "luật dược", "quy chế", "quản lý", "chuỗi lạnh", "fefo", "kê đơn", "đơn thuốc", "bảo hiểm", "bhyt",
        ))
        from app.services.chatbot.fsm_router import has_explicit_new_medication
        from app.services.chatbot.gemini_nlu_router import _has_explicit_context_reference
        if not is_legal and not has_explicit_new_medication(lower_query, session.active_medication_name) and _has_explicit_context_reference(query):
            from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic
            from app.services.chatbot.adaptive_drug_slicer import slice_clinical_drug_evidence
            from app.services.chatbot.adaptive_clinical_synthesizer import synthesize_adaptive_clinical_response

            adapt_analysis = extract_clinical_query_schema_deterministic(
                query, session_context={"active_medication": session.active_medication_name}
            )
            if (
                (
                    adapt_analysis.is_followup_question
                    or (
                        adapt_analysis.medications
                        and any(
                            getattr(m, "canonical_id", str(m)).lower() == session.active_medication_name.lower()
                            or getattr(m, "surface_form", str(m)).lower() == session.active_medication_name.lower()
                            for m in adapt_analysis.medications
                        )
                    )
                )
                and adapt_analysis.query_depth == "DEEP_FACET"
            ):
                evidence, _, status = await slice_clinical_drug_evidence(adapt_analysis, ctx.db, session)
                if status == "ok" and evidence:
                    return synthesize_adaptive_clinical_response(
                        evidence, user_name=ctx.user_name, user_role=ctx.user_role, session_id=ctx.session_id
                    )

    is_deep_complex = any(term in lower_query for term in ("thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng"))
    is_deep_pharm = is_deep_complex or any(w in lower_query for w in ("dị ứng chéo", "thải trừ", "sinh khả dụng"))

    query, lower_query, active_in_query, explicit_named, has_candidate_drug, early_resp = await resolve_active_drug_and_terms(
        query, lower_query, ctx.db, session=session, session_id=ctx.session_id,
        user_name=ctx.user_name, user_role=ctx.user_role, is_renal=is_renal, is_deep_complex=is_deep_complex,
    )
    if early_resp:
        return early_resp

    fsm_res = await route_fsm_context(
        query, lower_query, ctx.db, session=session, session_id=ctx.session_id,
        user_name=ctx.user_name, user_role=ctx.user_role,
    )
    if fsm_res:
        return fsm_res

    if lower_query.strip().strip("?.!") in {
        "tra cứu dược thư quốc gia", "tra cuu duoc thu quoc gia", "tra cứu dược thư", "tra cuu duoc thu",
        "dược thư quốc gia", "duoc thu quoc gia", "tra cứu thuốc", "tra cuu thuoc", "cổng tra cứu",
        "tra cứu dược thư 2015", "dược thư 2015", "dược thư", "dược thư qg",
    }:
        session.set_active_medication(name="", ingredient="", sdk="")
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

    norm_query = normalize_conversational_query(query)
    norm_lower = norm_query.lower()

    # 5. Clinical subflows (skip if already executed by specialty executor)
    if "clinical_subflows" not in ctx.tried_stages:
        ctx.tried_stages.add("clinical_subflows")
        dispatch_fn = _hook(ctx, "dispatch_clinical_subflows", dispatch_clinical_subflows)
        subflow_res = await dispatch_fn(norm_query, norm_lower, ctx.user_name, ctx.db, user_role=ctx.user_role)
        if subflow_res:
            return subflow_res

    # 6. Interaction, Comparison, and Field Lookup
    extracted_kw = extract_drug_keywords(norm_query)
    resolved_meds = resolve_registered_medications(norm_lower)
    lex_meds = get_drug_lexical_matcher().extract_medications(norm_query)

    is_two_drug = len(resolved_meds) >= 2 or len(lex_meds) >= 2 or (
        len(extracted_kw.split()) >= 2
        and any(term in lower_query for term in ("tương tác", "tương kỵ", "kỵ thuốc", "kỵ với", "phối hợp", "uống cùng", "uống chung", "dùng cùng", "uong cung", "dung cung", "tuong tac"))
    )
    has_interaction_term = any(term in lower_query for term in ("tương tác", "tương kỵ", "kỵ thuốc", "kỵ với", "kỵ gì", "tuong tac", "tuong ky", "ky thuoc"))
    is_check_multi = is_two_drug and ("+" in lower_query or any(w in lower_query for w in ("kiểm tra", "kiem tra", "check", "rà soát", "ra soat")))
    has_feasibility_term = any(term in lower_query for term in (
        "có uống được", "có dùng được", "uống được không", "dùng được không", "có được không",
        "đang dùng", "đang uống", "uống cả", "dùng cả", "uống thêm", "dùng thêm",
        "uống chung", "uống cùng", "dùng cùng", "đi kèm", "kèm theo", "uong duoc", "dung duoc",
        "an toàn không", "nguy hiểm không",
    )) or bool(re.search(r"\b(?:được|uống|dùng)\b.*?\bkhông\b", lower_query))
    is_two_drug_inquiry = is_two_drug and (
        any(term in lower_query for term in ("thì sao", "thi sao", "thế nào", "the nao", "được không", "duoc khong", "như thế nào", "sao", "đi với nhau", "uống cả hai", "dùng cả hai"))
        or has_feasibility_term
        or len(lower_query.split()) <= 6
    )
    is_interaction_q = has_interaction_term or is_check_multi or is_two_drug_inquiry or any(
        term in lower_query for term in ("phối hợp", "uống cùng", "dùng cùng", "kết hợp", "uống chung", "dùng chung", "uong cung", "dung cung")
    )
    is_deictic_interaction = has_interaction_term and any(
        ref in lower_query for ref in ("2 thuốc", "hai thuốc", "thuốc kia", "thuốc đó", "vừa rồi", "hai loại", "2 loại", "chúng nó", "cơ mà")
    )
    is_non_drug_kw = extracted_kw.lower() in ("tương tác", "tuong tac", "tương kỵ", "tuong ky", "thuốc", "thuoc", "thông tin", "tóm tắt", "tom tat")
    has_single_cand = (has_candidate_drug or len(resolved_meds) == 1 or (len(extracted_kw) >= 3 and not is_non_drug_kw) or active_in_query) and not is_two_drug and not is_deictic_interaction
    is_single_interaction = has_single_cand and has_interaction_term and not any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp ", " va ", " voi ", " cung "))

    excluded_field_terms = [
        "tương tác thuốc của thuốc", "tương tác thuốc paracetamol",
        "tác dụng phụ", "tác dụng không mong muốn", "liều dùng", "liều tối đa",
        "thành phần", "hoạt chất", "tac dung phu", "lieu dung",
        "kỵ rượu", "uống rượu", "uống bia", "rượu bia", "say rượu", "với rượu", "với bia",
        "uống cùng sữa", "với sữa", "uống sữa", "nước cam", "thức ăn", "kiêng ăn gì",
        "trước ăn", "sau ăn", "lúc đói", "lúc no", "sáng hay tối", "uống sáng", "uống tối",
        "suy gan", "xơ gan", "men gan", "người già", "người cao tuổi", "quá liều", "ngộ độc",
    ]
    if not has_interaction_term:
        excluded_field_terms.extend(["chống chỉ định", "chong chi dinh", "chỉ định", "chi dinh", "công dụng", "cong dung"])

    if (is_interaction_q or is_deictic_interaction) and not is_single_interaction and not any(term in lower_query for term in excluded_field_terms):
        clarification_res = await handle_interaction_clarification(
            query, lower_query, ctx.session_id, ctx.user_name, ctx.user_role, session=session
        )
        if clarification_res:
            return clarification_res

    comp_res = await handle_clinical_drug_comparison(query, lower_query, ctx.db, ctx.session_id, ctx.user_name, ctx.user_role)
    if comp_res:
        return comp_res

    field_res = await handle_field_or_drug_inquiry(
        query, lower_query, ctx.db, session=session, session_id=ctx.session_id,
        user_name=ctx.user_name, user_role=ctx.user_role,
        has_candidate_drug=has_candidate_drug, active_name_in_query=active_in_query,
        is_renal_adjustment_request=is_renal,
    )
    if field_res:
        return field_res

    # 7. Unanchored deictic follow-up guard
    deictic_or_unanchored = (
        any(term in lower_query for term in ("thuốc này", "thuốc đó", "thuốc vừa nói", "nó có", "của thuốc này", "của thuốc đó"))
        or lower_query.strip().strip("?.!") in (
            "thông tin chi tiết đầy đủ", "thong tin chi tiet day du", "thông tin chi tiết", "thong tin chi tiet",
            "thông tin đầy đủ", "thong tin day du", "tóm tắt thông tin thuốc đó", "tom tat thong tin thuoc do",
            "tóm tắt thông tin", "tom tat thong tin", "tóm tắt thuốc đó", "tom tat thuoc do", "tóm tắt", "tom tat",
            "hồ sơ đầy đủ", "ho so day du", "hồ sơ chi tiết", "ho so chi tiet", "toàn bộ thông tin", "toan bo thong tin",
        )
    )
    if deictic_or_unanchored and not session.active_medication_name:
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Dạ xin lỗi bác sĩ, hiện chưa xác định được thuốc đang được nhắc tới trong phiên hội thoại này. Bác sĩ vui lòng gửi tên thuốc, hoạt chất hoặc số đăng ký để tra cứu thông tin chi tiết / tóm tắt ạ.",
            answer_type="clarification",
            source_status="missing_medication_context",
            confidence=1.0,
            session_id=session.session_id,
            suggested_chips=["Tra cứu thông tin thuốc", "Nhập tên hoạt chất hoặc biệt dược"],
        )

    # 8. Clinical scenario & authoritative drug lookup / sandwich counseling
    sc_res = await detect_and_handle_gemini_clinical_scenario(
        query, lower_query, ctx.user_name, ctx.db, user_role=ctx.user_role, session_id=ctx.session_id
    )
    if sc_res:
        sc_res.reply_text = validate_output_guardrail(sc_res.reply_text, query)
        return sc_res

    has_drug_ent = (
        find_matched_med(lower_query) is not None
        or find_matched_med(norm_lower) is not None
        or active_in_query
        or any(alias in lower_query or alias in norm_lower for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", []) if len(alias) >= 4)
        or has_candidate_drug
        or bool(lex_meds)
    )
    is_therapeutic_alternative = any(
        term in lower_query for term in ("đổi sang", "chuyển sang", "thay thế", "thay bằng", "đổi nhóm", "đổi thuốc", "lựa chọn thay thế")
    ) or ("ho khan" in lower_query and any(term in lower_query for term in ("coversyl", "enalapril", "perindopril", "acei", "ức chế men chuyển")))

    has_sdk = bool(re.search(r"((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)", lower_query))
    drug_cues = (
        "thông tin thuốc", "thông tin", "tra cứu thuốc", "thuốc ", "liều dùng", "liều lượng",
        "liều tối đa", "còn liều", "liều", "chỉ định", "công dụng", "tác dụng phụ", "tác dụng không mong muốn",
        "chống chỉ định", "thành phần", "hoạt chất", "tương tác", "điều trị", "dùng để", "dùng cho",
        "chữa", "tác dụng", "uống", "tiêm", "truyền", "sử dụng",
        "sđk", "số đăng ký", "là thuốc gì", "dược thư", "biệt dược", "số lượng", "tồn kho", "trong kho",
    )
    cand_kw_present = bool(extract_drug_keywords(lower_query))
    is_short_drug = len(lower_query.split()) <= 3 and cand_kw_present and not any(
        w in lower_query for w in ("chào", "hello", "hi", "tủ trực", "báo hỏng", "hư hỏng", "máy thở", "monitor", "kiểm kê", "giao ban")
    )
    if (
        not is_renal
        and not is_therapeutic_alternative
        and not is_two_drug
        and not is_deep_complex
        and not is_deep_pharm
        and (has_sdk or (has_drug_ent and (any(c in lower_query or c in norm_lower for c in drug_cues) or is_short_drug)))
    ):
        is_personalized = ctx.workflow_intent == "PATIENT_MEDICATION_COUNSELING" or any(
            w in lower_query for w in ("dặn dò", "bệnh nhân hiểu", "người nhà", "3 ý", "giải thích cho", "lưu ý quan trọng", "dễ hiểu", "dành cho điều dưỡng", "dành cho bác sĩ", "súc tích")
        )
        if is_personalized:
            sandwich_fn = _hook(ctx, "execute_clinical_sandwich_pipeline", execute_clinical_sandwich_pipeline)
            try:
                sandwich_res = await sandwich_fn(query, ctx.user_role, ctx.user_name, ctx.session_id, ctx.db, nlu_result=nlu_res)
            except TypeError:
                sandwich_res = await sandwich_fn(query, ctx.user_role, ctx.user_name, ctx.session_id, ctx.db)
            if sandwich_res:
                return sandwich_res
        lookup_fn = _hook(ctx, "lookup_drug_authoritative", lookup_drug_authoritative)
        return await lookup_fn(
            norm_query, ctx.db, session_id=ctx.session_id, user_name=ctx.user_name, user_role=ctx.user_role,
            query_mode=(getattr(nlu_res, "query_mode", None) or ("clinical_qa" if len(query.split()) >= 5 else "card_lookup")),
        )

    # 9. Contextual RAG & Operational Business Dispatch
    contextual_rag = await handle_contextual_rag_followup(
        query, lower_query, ctx.user_role, ctx.history, ctx.session_id, ctx.user_name,
        is_interaction_q, explicit_named, session.active_medication_name,
        inference_required=ctx.inference_required,
    )
    if contextual_rag:
        return contextual_rag

    ops_res = await dispatch_operational_business(norm_query, norm_lower, ctx.user_name, ctx.db)
    if ops_res:
        return ops_res

    # 10. Single Final Deep RAG Consultation + Single Specialty Registry Fallback (never duplicated)
    clean_greeting = re.sub(r"[^\w\s]", "", lower_query).strip()
    deep_rag = None
    if (
        "deep_rag" not in ctx.tried_stages
        and len(lower_query.strip()) >= 4
        and clean_greeting not in {"ừ", "uhm", "uh", "123", "abc", "test", "vâng", "dạ"}
    ):
        ctx.tried_stages.add("deep_rag")
        from app.services.chatbot.executors.managed_executors import _effective_rag_history
        deep_rag = await handle_deep_rag_consultation(
            query, lower_query, ctx.user_role, _effective_rag_history(ctx), ctx.session_id, ctx.user_name,
            is_deep_pharm or is_therapeutic_alternative, inference_required=ctx.inference_required,
        )
        if deep_rag and deep_rag.rag_grounded and deep_rag.answer_type != "safe_abstention":
            return deep_rag

    if not is_deep_pharm and not is_deep_complex:
        spec_resp = await _try_specialty_once(ctx, norm_query)
        if spec_resp:
            return spec_resp

    if deep_rag is not None:
        return deep_rag

    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE",
        reply_text="Chưa xác định được ý định và chủ đề cần tra cứu. Vui lòng nêu rõ tên thuốc, hoạt chất, văn bản hoặc nghiệp vụ cần hỗ trợ.",
        suggested_chips=[],
    )
