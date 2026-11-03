"""
Orchestration pipeline for Clinical Copilot Chat (<=200 LOC).
"""
import re
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_lookup import lookup_drug_authoritative, extract_drug_keywords
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
            suggested_chips=["Tra cứu Dược Thư 2015", "Quy chế thuốc gây nghiện TT 20", "Hướng dẫn sử dụng hệ thống"]
        )

    query = guard_res.sanitized_query
    lower_query = query.lower()
    is_renal = any(t in lower_query for t in ("suy thận", "chức năng thận", "egfr", "crcl", "creatinine", "chỉnh liều"))
    renal_res = check_renal_adjustment_request(query, lower_query)
    if renal_res:
        return renal_res

    is_deep_complex = any(term in lower_query for term in ("thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng"))
    query, lower_query, active_in_query, explicit_named, has_candidate_drug, early_resp = await resolve_active_drug_and_terms(
        query, lower_query, db, session=session, session_id=session_id, user_name=user_name,
        user_role=user_role, is_renal=is_renal, is_deep_complex=is_deep_complex
    )
    if early_resp:
        return early_resp

    greeting_res = handle_greeting_and_acknowledgment(lower_query, user_name, user_role)
    if greeting_res:
        return greeting_res

    out_scope = handle_out_of_scope_or_pricing(lower_query)
    if out_scope:
        return out_scope

    fsm_res = await route_fsm_context(query, lower_query, db, session=session, session_id=session_id, user_name=user_name, user_role=user_role)
    if fsm_res:
        return fsm_res

    if lower_query.strip().strip("?.!") in {
        "tra cứu dược thư quốc gia", "tra cuu duoc thu quoc gia", "tra cứu dược thư",
        "tra cuu duoc thu", "dược thư quốc gia", "duoc thu quoc gia", "tra cứu thuốc", "tra cuu thuoc", "cổng tra cứu"
    }:
        return await lookup_drug_authoritative("", db, session_id=session_id, user_name=user_name, user_role=user_role)

    subflow_res = await dispatch_clinical_subflows(query, lower_query, user_name, db)
    if subflow_res:
        return subflow_res

    extracted_kw, resolved_meds = extract_drug_keywords(query), resolve_registered_medications(lower_query)
    is_two_drug = (len(extracted_kw.split()) > 1 and any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp ", " va ", " voi ", " cung "))) or len(resolved_meds) > 1
    has_interaction_term = any(term in lower_query for term in ("tương tác", "tương kỵ", "kỵ thuốc", "kỵ với", "kỵ gì", "tuong tac", "tuong ky", "ky thuoc"))
    is_check_multi = is_two_drug and ("+" in lower_query or any(w in lower_query for w in ("kiểm tra", "kiem tra", "check", "rà soát", "ra soat")))
    is_interaction_q = has_interaction_term or is_check_multi or any(term in lower_query for term in ("phối hợp", "uống cùng", "dùng cùng", "kết hợp", "uống chung", "dùng chung", "uong cung", "dung cung"))
    is_deictic_interaction = has_interaction_term and any(ref in lower_query for ref in ("2 thuốc", "hai thuốc", "thuốc kia", "thuốc đó", "vừa rồi", "hai loại", "2 loại", "chúng nó", "cơ mà"))
    has_single_cand = (has_candidate_drug or len(resolved_meds) == 1 or len(extracted_kw) >= 3 or active_in_query) and not is_two_drug and not is_deictic_interaction
    is_single_interaction = has_single_cand and has_interaction_term and not any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp ", " va ", " voi ", " cung "))

    if (is_interaction_q or is_deictic_interaction) and not is_single_interaction and not any(term in lower_query for term in ("tương tác thuốc của thuốc", "tương tác thuốc paracetamol", "tác dụng phụ", "tác dụng không mong muốn", "chống chỉ định", "liều dùng", "liều tối đa", "thành phần", "hoạt chất", "chỉ định", "công dụng", "chong chi dinh", "tac dung phu", "lieu dung")):
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
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text="Vui lòng nêu tên thuốc/hoạt chất và thông tin người bệnh liên quan (nếu cần đánh giá ca cụ thể) để tra cứu đúng nguồn. Với tương tác hoặc pha truyền, hãy cung cấp đầy đủ các thuốc/dịch cần rà soát.",
            answer_type="clarification", source_status="missing_clinical_subject", confidence=1.0,
            abstention_reason="Thiếu thuốc hoặc đối tượng cần đánh giá"
        )

    is_general_ref = any(term in lower_query for term in ("thông tin về", "thông tin", "tài liệu", "tra cứu", "hướng dẫn", "phác đồ", "thuốc hạ sốt", "thuốc giảm đau", "nhóm thuốc", "danh mục", "chuyên luận"))
    is_self_symptom = not is_general_ref and bool(re.search(r"\b(tôi|em|mình)\b.{0,45}\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b|\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b.{0,45}\b(tôi|em|mình)\b", lower_query))
    if is_self_symptom and not any(term in lower_query for term in ("bệnh nhân", "người bệnh", "ca bệnh", "ca này", "hồ sơ", "bn-", "bn ")):
        return CopilotResponse(
            intent="CLINICAL_CASE_CLARIFICATION",
            reply_text="Trợ lý này phục vụ tra cứu và nghiệp vụ chuyên môn. Nếu bác sĩ đang xử trí một ca bệnh, vui lòng nêu thông tin nhận diện ca/người bệnh và dữ liệu lâm sàng liên quan; nếu cần thông tin tham khảo chung, hãy nêu chủ đề hoặc thuốc cần tra cứu.",
            answer_type="clarification", source_status="missing_case_context", confidence=1.0, abstention_reason="Câu hỏi triệu chứng chưa xác định người bệnh hoặc ca bệnh"
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

    if any(term in lower_query for term in ("sốt", "hạ sốt", "thân nhiệt", "nhiệt độ cơ thể")) and not has_candidate_drug:
        sc_res = await detect_and_handle_gemini_clinical_scenario(query, lower_query, user_name, db, user_role=user_role, session_id=session_id)
        if sc_res:
            sc_res.reply_text = validate_output_guardrail(sc_res.reply_text, query)
            return sc_res

    drug_cues = (
        "thông tin thuốc", "thông tin", "tra cứu thuốc", "thuốc ", "liều dùng", "liều lượng",
        "liều tối đa", "còn liều", "liều", "chỉ định", "công dụng", "tác dụng phụ", "tác dụng không mong muốn",
        "chống chỉ định", "thành phần", "hoạt chất", "tương tác", "điều trị", "dùng để", "dùng cho",
        "chữa", "tác dụng", "uống", "tiêm", "truyền", "sử dụng",
        "thong tin thuoc", "thong tin", "tra cuu thuoc", "thuoc", "lieu dung", "chong chi dinh", "tac dung phu", "tuong tac",
        "số lượng", "so luong", "tồn kho", "ton kho", "trong kho"
    )
    has_drug_ent = find_matched_med(lower_query) is not None or active_in_query or any(alias in lower_query for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", []) if len(alias) >= 4) or has_candidate_drug
    if not is_renal and has_drug_ent and any(cue in lower_query for cue in drug_cues) and not is_two_drug and not is_deep_complex:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    sc_res2 = await detect_and_handle_gemini_clinical_scenario(query, lower_query, user_name, db, user_role=user_role, session_id=session_id)
    if sc_res2:
        sc_res2.reply_text = validate_output_guardrail(sc_res2.reply_text, query)
        return sc_res2

    contextual_rag = await handle_contextual_rag_followup(query, lower_query, user_role, history, session_id, user_name, is_interaction_q, explicit_named, session.active_medication_name)
    if contextual_rag:
        return contextual_rag

    ops_res = await dispatch_operational_business(query, lower_query, user_name, db)
    if ops_res:
        return ops_res

    has_sdk = bool(re.search(r"((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)", lower_query))
    is_deep_pharm = any(w in lower_query for w in [
        "thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng", "tương tác", "tương kỵ",
        "phối hợp", "uống cùng", "dùng cùng", "kết hợp", "uống chung", "dùng chung", "chống chỉ định",
        "dị ứng chéo", "kháng sinh", "chống viêm", "hạ huyết áp", "uống gì", "dùng gì", "gợi ý"
    ]) or any(c in lower_query for c in [" và ", " với ", " cùng ", " kèm "])
    has_reg_drug = bool(resolve_registered_medications(lower_query))
    matched_med = find_matched_med(lower_query)
    is_med_info = any(w in lower_query for w in ["thời gian bán thải", "chỉ định", "chống chỉ định", "tác dụng phụ", "tác dụng", "công dụng", "tương tác", "dùng để làm gì", "liều tối đa", "liều dùng", "là gì", "dị ứng", "huyết tương", "dược động học", "cơ chế", "thành phần", "uống lúc nào", "thế nào", "như thế nào", "bao nhiêu", "hỏi về", "thông tin"])
    has_drug_ask = lower_query.startswith("thuốc ") or " thuốc " in lower_query or any(w in lower_query for w in ["thông tin", "tra cứu thuốc", "sđk", "số đăng ký", "là thuốc gì", "dược thư", "về thuốc", "hỏi về thuốc", "biệt dược", "hoạt chất", "liều dùng", "liều lượng", "còn liều", "liều", "uống thế nào", "dùng thế nào", "dùng để làm gì", "chỉ định", "chống chỉ định", "tác dụng phụ", "uống được không", "dùng được không"]) or has_reg_drug or (matched_med is not None and is_med_info and not is_deep_pharm)

    cand_kw_present = bool(extract_drug_keywords(lower_query))
    if (has_sdk or (has_drug_ask and (has_drug_ent or cand_kw_present))) and not is_deep_pharm and not is_interaction_q and not is_renal and not is_deep_complex:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    clean_greeting = re.sub(r"[^\w\s]", "", lower_query).strip()
    if len(lower_query.strip()) >= 4 and clean_greeting not in {"ừ", "uhm", "uh", "123", "abc", "test", "vâng", "dạ"}:
        deep_rag = await handle_deep_rag_consultation(query, lower_query, user_role, history, session_id, user_name, is_deep_pharm)
        if deep_rag:
            return deep_rag

    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE", reply_text=CLINICAL_BUSINESS_DIRECTORY,
        legal_basis="Thông tư 22/2011, TT 20/2017, TT 51/2017 & Nghị định 98/2021",
        suggested_chips=["Đối soát ca trực 07:00 AM", "Tra cứu SĐK VD-24757-16", "Thuốc cận hạn FEFO", "Báo hỏng máy thở PB840"]
    )
