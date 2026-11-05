"""
Orchestration pipeline for Clinical Copilot Chat (<=200 LOC).
"""
import re
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

def resolve_copilot_identity(payload: CopilotQuery, request: Request) -> tuple[str, str, str]:
    authenticated = getattr(request.state, "authenticated_user", None)
    user_name = authenticated.username if authenticated else payload.user_name
    user_role = authenticated.role if authenticated else payload.user_role
    req_session = (payload.session_id or "default_session").strip()
    session_id = req_session if req_session.startswith(f"{user_name.casefold()}:") else f"{user_name.casefold()}:{req_session}"
    return user_name, user_role, session_id

async def handle_copilot_chat(payload: CopilotQuery, request: Request, db: AsyncSession, *, session, history: str) -> CopilotResponse:
    user_name, user_role, session_id = resolve_copilot_identity(payload, request)
    guard_res = validate_input_guardrail(payload.query, user_role=user_role)
    if not guard_res.is_safe:
        return CopilotResponse(
            intent="SECURITY_GUARDRAIL_BLOCKED", reply_text=guard_res.safe_response,
            legal_basis="OWASP LLM01:2025, TT 20/2017 & An toàn An ninh Y tế",
            suggested_chips=["Tra cứu Dược Thư Quốc Gia", "Quy chế thuốc gây nghiện TT 20", "Hướng dẫn sử dụng hệ thống"]
        )

    query = guard_res.sanitized_query
    lower_query = query.lower()

    # 1. First-line filter: Greetings, Thanks, Dissatisfaction/Corrections, Frivolous/Out-of-scope
    greeting_res = handle_greeting_and_acknowledgment(lower_query, user_name, user_role)
    if greeting_res:
        if greeting_res.intent in {
            "CONVERSATIONAL_CORRECTION", "FEEDBACK_DATA_ENRICHMENT",
            "FEEDBACK_UI_ADJUSTMENT", "CONVERSATIONAL_FEEDBACK",
            "GREETING_WELCOME", "GREETING_WELLBEING"
        }:
            session.set_active_medication(name="", ingredient="", sdk="")
        return greeting_res

    out_scope = handle_out_of_scope_or_pricing(lower_query)
    if out_scope:
        session.set_active_medication(name="", ingredient="", sdk="")
        return out_scope

    # 2. SOTA RAG: CRAG Contextual Query Rewriter & Multi-turn Clinical De-contextualization
    from app.services.rag.query_rewriter import rewrite_clinical_query
    rewritten_res = await rewrite_clinical_query(query, history=history)
    query = rewritten_res.rewritten_query
    lower_query = query.lower()

    is_renal = any(t in lower_query for t in ("suy thận", "chức năng thận", "egfr", "crcl", "creatinine", "chỉnh liều"))
    renal_res = check_renal_adjustment_request(query, lower_query)
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
        portal_text = (
            "### CỔNG TRA CỨU DƯỢC THƯ QUỐC GIA VIỆT NAM (DĐVN V)\n\n"
            "Hệ thống đã nạp sẵn toàn bộ **771 chuyên luận Dược Thư Quốc Gia Việt Nam (QĐ 2033/QĐ-BYT)** "
            "và **54.885 số đăng ký thuốc Cục Quản lý Dược (DAV)**.\n\n"
            "Đồng nghiệp có thể tra cứu nhanh bằng cách:\n"
            "• Gõ trực tiếp tên biệt dược hoặc hoạt chất vào ô chat (ví dụ: *Coversyl, Augmentin, Zithromax, Ciprofloxacin...*).\n"
            "• Hoặc bấm vào nút **'Thông tin thuốc' / 'Tra cứu Dược thư'** trên thanh công cụ để mở giao diện tìm kiếm nâng cao."
        )
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

    # =========================================================================
    # MULTI-HOP CLINICAL AGENT & COT REASONING (IRCoT ACL 2023 / Med-PaLM 2)
    # Intercept complex multi-condition & polypharmacy cases before subflows or 1-drug consults
    # =========================================================================
    from app.services.rag.multihop_clinical_agent import is_multihop_clinical_case, execute_multihop_clinical_evaluation
    if is_multihop_clinical_case(query, norm_lower):
        multihop_rag = await execute_multihop_clinical_evaluation(query, user_role=user_role)
        citations_data = [
            c.to_dict() if hasattr(c, "to_dict") else (c.model_dump() if hasattr(c, "model_dump") else dict(c))
            for c in multihop_rag.citations
        ] if multihop_rag.citations else []
        from app.schemas.copilot import CopilotCdssAlert
        cdss_alert_obj = CopilotCdssAlert(**multihop_rag.cdss_alert) if multihop_rag.cdss_alert else None
        return CopilotResponse(
            intent="CLINICAL_AI_CONSULTATION",
            reply_text=multihop_rag.answer,
            legal_basis=multihop_rag.legal_basis,
            citations=citations_data,
            suggested_chips=[
                "Hiệu chỉnh liều theo ClCr",
                "Phác đồ thay thế an toàn cho thận",
                "Theo dõi điện giải đồ K+ và Creatinin"
            ],
            confidence=multihop_rag.confidence_score,
            rag_grounded=multihop_rag.rag_grounded,
            answer_type="multihop_case_consultation",
            source_status="rag_grounded_verified" if multihop_rag.critique_verdict == "PASS" else "rag_grounded_caution",
            critique_verdict=multihop_rag.critique_verdict,
            factuality_score=multihop_rag.factuality_score,
            session_id=session_id,
            cdss_alert=cdss_alert_obj
        )

    subflow_res = await dispatch_clinical_subflows(norm_query, norm_lower, user_name, db, user_role=user_role)
    if subflow_res:
        return subflow_res

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
    has_single_cand = (has_candidate_drug or len(resolved_meds) == 1 or len(extracted_kw) >= 3 or active_in_query) and not is_two_drug and not is_deictic_interaction
    is_single_interaction = has_single_cand and has_interaction_term and not any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp ", " va ", " voi ", " cung "))

    is_multi_drug_active = is_two_drug or len(resolved_meds) >= 2 or len(lex_meds) >= 2
    excluded_field_terms = [
        "tương tác thuốc của thuốc", "tương tác thuốc paracetamol",
        "tác dụng phụ", "tác dụng không mong muốn", "liều dùng", "liều tối đa",
        "thành phần", "hoạt chất", "tac dung phu", "lieu dung",
        "kỵ rượu", "uống rượu", "uống bia", "rượu bia", "say rượu", "với rượu", "với bia",
        "uống cùng sữa", "với sữa", "uống sữa", "nước cam", "thức ăn", "kiêng ăn gì",
        "trước ăn", "sau ăn", "lúc đói", "lúc no", "sáng hay tối", "uống sáng", "uống tối",
        "suy gan", "xơ gan", "men gan", "người già", "người cao tuổi", "quá liều", "ngộ độc"
    ]
    if not is_multi_drug_active:
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
    
    is_deep_pharm = any(w in lower_query for w in [
        "thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng",
        "dị ứng chéo", "thải trừ", "sinh khả dụng"
    ])

    is_therapeutic_alternative = any(term in lower_query for term in (
        "đổi sang", "chuyển sang", "thay thế", "thay bằng", "đổi nhóm", "đổi thuốc", "lựa chọn thay thế"
    )) or ("ho khan" in lower_query and any(term in lower_query for term in ("coversyl", "enalapril", "perindopril", "acei", "ức chế men chuyển")))
    if is_therapeutic_alternative:
        deep_rag = await handle_deep_rag_consultation(query, lower_query, user_role, history, session_id, user_name, is_deep_pharm)
        if deep_rag:
            return deep_rag

    if not is_renal and not is_therapeutic_alternative and has_drug_ent and any(cue in lower_query or cue in norm_lower for cue in drug_cues) and not is_two_drug and not is_deep_complex:
        is_personalized_request = any(w in lower_query for w in ["dặn dò", "bệnh nhân hiểu", "người nhà", "3 ý", "giải thích cho", "lưu ý quan trọng", "dễ hiểu", "dành cho điều dưỡng", "dành cho bác sĩ", "súc tích"])
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

    contextual_rag = await handle_contextual_rag_followup(query, lower_query, user_role, history, session_id, user_name, is_interaction_q, explicit_named, session.active_medication_name)
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
        is_personalized_request = any(w in lower_query for w in ["dặn dò", "bệnh nhân hiểu", "người nhà", "3 ý", "giải thích cho", "lưu ý quan trọng", "dễ hiểu", "dành cho điều dưỡng", "dành cho bác sĩ", "súc tích"])
        if is_personalized_request:
            sandwich_res = await execute_clinical_sandwich_pipeline(query, user_role, user_name, session_id, db)
            if sandwich_res:
                return sandwich_res
        return await lookup_drug_authoritative(norm_query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation, synthesize_specialty_response, get_clinical_persona_greeting
    spec_direct = find_clinical_specialty_consultation(query) or find_clinical_specialty_consultation(norm_query)
    if spec_direct:
        return await synthesize_specialty_response(query, spec_direct, user_name=user_name, user_role=user_role, session_id=session_id)

    clean_greeting = re.sub(r"[^\w\s]", "", lower_query).strip()
    if len(lower_query.strip()) >= 4 and clean_greeting not in {"ừ", "uhm", "uh", "123", "abc", "test", "vâng", "dạ"}:
        deep_rag = await handle_deep_rag_consultation(query, lower_query, user_role, history, session_id, user_name, is_deep_pharm)
        if deep_rag:
            return deep_rag

    greeting = get_clinical_persona_greeting(user_name, user_role)
    fallback_reply = (
        f"{greeting} em đã tiếp nhận câu hỏi chuyên môn của đồng nghiệp.\n\n"
        f"Để đảm bảo an toàn điều trị chính xác theo Dược thư Quốc gia và danh mục Cục Quản lý Dược, "
        f"đồng nghiệp vui lòng cung cấp thêm tên thuốc/hoạt chất hoặc ca bệnh cụ thể:\n"
        f"• **Tra cứu thuốc:** Tên biệt dược, hoạt chất (INN) hoặc số đăng ký (SĐK).\n"
        f"• **Kiểm tra tương tác:** Cặp thuốc phối hợp (ví dụ: *Clopidogrel + Omeprazol*).\n"
        f"• **Quy chế & Nghiệp vụ:** Thẩm định đơn TT 26, phác đồ phản vệ TT 51, hạn dùng FEFO TT 36.\n\n"
        f"Em luôn sẵn sàng hỗ trợ đồng nghiệp ngay ạ!"
    )
    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE", reply_text=fallback_reply,
        legal_basis="Thông tư 26/2025, TT 52/2017, QĐ 5948 & DĐVN V",
        suggested_chips=[]
    )
