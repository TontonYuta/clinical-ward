from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_lookup import lookup_drug_authoritative, extract_drug_keywords
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.chatbot.session_routing import (
    find_dav_candidate_drug, build_insufficient_formulation_response,
    check_contextless_clinical_question, check_pediatric_guidance_request,
    check_interaction_examples_request,
    TIMING_TERMS, FIELD_ONLY_TERMS
)

async def resolve_active_drug_and_terms(
    query: str,
    lower_query: str,
    db: AsyncSession,
    *,
    session,
    session_id: str,
    user_name: str,
    user_role: str,
    is_renal: bool,
    is_deep_complex: bool,
) -> tuple[str, str, bool, bool, bool, CopilotResponse | None]:
    ddi_examples_res = check_interaction_examples_request(lower_query, session_id)
    if ddi_examples_res:
        return query, lower_query, False, False, False, ddi_examples_res

    cand_drug, has_candidate_drug = await find_dav_candidate_drug(lower_query, db)
    is_complaint = any(c in lower_query for c in ("sai", "nham", "nhầm", "lỗi", "loi", "cải thiện", "cai thien", "điều chỉnh", "dieu chinh", "lệch", "lech", "kém", "kem", "dở", "do", "tệ", "te"))
    is_specialty_topic = any(w in lower_query for w in (
        "thông tư", "tt 20", "tt 51", "tt 26", "tt 36", "tt 22", "tt 52",
        "quy chế", "quản lý", "chuỗi lạnh", "kho lạnh", "gsp", "hủy vỏ",
        "dược thư quốc gia", "dược thư 2015", "dược thư qg", "cổng tra cứu",
        "ung thư", "ung bướu", "giảm nhẹ", "ca trực", "giao ban", "kiểm toán"
    ))
    is_field_only = not is_complaint and not is_specialty_topic and any(term in lower_query for term in (
        "liều tối đa", "còn liều", "liều dùng", "liều lượng", "tác dụng phụ", "tác dụng không mong muốn",
        "chống chỉ định", "thành phần", "hoạt chất", "chỉ định", "công dụng", "có gây nghiện", "gây nghiện không", "độc tính",
        "sáng hay tối", "uống sáng", "uống tối", "lúc đói", "lúc no", "trước ăn", "sau ăn", "trước/sau ăn", "trước hay sau ăn",
        "thời điểm", "thời điểm uống", "uống lúc nào", "uống khi nào", "cách uống", "cách dùng",
        "tóm tắt cho tôi", "tóm tắt lại", "tóm tắt", "chi tiết về thuốc này", "chi tiết thuốc này", "thông tin chi tiết",
        "tiêm nhắc lại", "bao lâu thì tiêm", "tần suất", "mỗi bao lâu",
        "chong chi dinh", "tac dung phu", "lieu dung", "lieu luong", "lieu toi da", "thanh phan", "chi dinh", "cong dung", "tuong tac",
        "trẻ em", "cho trẻ em", "tre em", "cho tre em", "nhi khoa", "cho bé", "cho be", "trẻ nhỏ", "tre nho",
        "kỵ rượu", "uống rượu", "uống bia", "rượu bia", "say rượu", "với rượu", "với bia", "ky ruou", "uong ruou", "uong bia",
        "uống cùng sữa", "với sữa", "uống sữa", "nước cam", "nước bưởi", "thức ăn", "kiêng ăn gì", "uong cung sua", "voi sua",
        "suy gan", "xơ gan", "men gan", "viêm gan", "chức năng gan",
        "người già", "người cao tuổi", "người lớn tuổi", "nguoi gia", "nguoi cao tuoi",
        "quá liều", "ngộ độc", "uống nhầm", "giải độc", "antidote", "qua lieu", "ngo doc"
    ))
    is_oresol = any(w in lower_query for w in ["oresol", "ors", "hydrite", "bù nước điện giải"])
    effective_med = session.active_medication_name or getattr(session, "last_active_medication_name", None)
    if effective_med and not is_renal and not is_deep_complex and not is_oresol and not is_specialty_topic and is_field_only:
        from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
        lex_meds = get_drug_lexical_matcher().extract_medications(lower_query)
        if lex_meds and all(m.casefold() not in effective_med.casefold() for m in lex_meds):
            new_med_name = lex_meds[0]
            session.set_active_medication(name=new_med_name, ingredient=new_med_name)
            resp = await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
            return query, lower_query, False, True, False, resp

        resolved_new_drugs = resolve_registered_medications(lower_query)
        current_has_explicit = (
            find_matched_med(lower_query) is not None
            or bool(resolved_new_drugs)
            or has_candidate_drug
            or bool(effective_med.casefold() in lower_query)
        )
        if current_has_explicit and resolved_new_drugs:
            new_key = resolved_new_drugs[0]
            session.set_active_medication(name=DRUG_REGISTRY[new_key].get("display", new_key.title()), ingredient=new_key)
            resp = await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
            return query, lower_query, False, True, False, resp
        if current_has_explicit and has_candidate_drug and cand_drug:
            session.set_active_medication(name=cand_drug.title(), ingredient=cand_drug)
            resp = await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
            return query, lower_query, False, True, has_candidate_drug, resp
        if current_has_explicit:
            resp = await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
            return query, lower_query, False, True, False, resp
        
        session.set_active_medication(name=effective_med)
        query = f"{query} của thuốc {effective_med}"
        lower_query = query.lower()
        resp = await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
        return query, lower_query, False, False, False, resp

    active_in_query = bool(effective_med and effective_med.casefold() in lower_query)
    if effective_med and not active_in_query:
        explicit_reg = any(a.casefold() in lower_query for entry in DRUG_REGISTRY.values() for a in entry.get("aliases", []) if len(a) >= 4)
        if find_matched_med(lower_query) is None and not explicit_reg and not has_candidate_drug:
            if not is_complaint and not is_specialty_topic and (any(term in lower_query for term in FIELD_ONLY_TERMS) or lower_query.endswith("của thuốc")):
                query = f"{query} của thuốc {effective_med}"
                lower_query = query.lower()
                active_in_query = True

    explicit_named = find_matched_med(lower_query) is not None or any(
        a.casefold() in lower_query for entry in DRUG_REGISTRY.values() for a in entry.get("aliases", []) if len(a) >= 4
    ) or has_candidate_drug or active_in_query

    field_triggers = (
        "liều tối đa", "còn liều", "liều dùng", "liều lượng", "tác dụng phụ", "tác dụng không mong muốn",
        "chống chỉ định", "thành phần", "hoạt chất", "chỉ định", "công dụng", "độc tính",
        "thời điểm", "thời điểm uống", "trước/sau ăn", "trước hay sau ăn", "uống lúc nào", "uống khi nào",
        "cách uống", "cách dùng", "tóm tắt cho tôi", "tóm tắt lại", "tóm tắt", "chi tiết về thuốc này", "chi tiết thuốc này", "thông tin chi tiết",
        "kỵ rượu", "uống rượu", "uống bia", "rượu bia", "say rượu", "với rượu", "với bia",
        "uống cùng sữa", "với sữa", "uống sữa", "nước cam", "thức ăn", "kiêng ăn gì",
        "suy gan", "xơ gan", "men gan", "người già", "người cao tuổi", "quá liều", "ngộ độc"
    )

    if effective_med and not is_renal and not is_specialty_topic and not explicit_named and (
        any(term in lower_query for term in field_triggers) or any(term in lower_query for term in TIMING_TERMS)
    ):
        session.set_active_medication(name=effective_med)
        if effective_med.casefold() not in lower_query:
            query = f"{query} của thuốc {effective_med}"
            lower_query = query.lower()
        resp = await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
        return query, lower_query, active_in_query, explicit_named, has_candidate_drug, resp

    if not is_renal and not explicit_named and not active_in_query and any(term in lower_query for term in ("liều dùng", "liều tối đa", "thông tin thuốc", "thuốc là gì")):
        cand = extract_drug_keywords(lower_query)
        if cand and len(cand) >= 4 and cand.lower() not in ("tóm tắt", "tom tat", "thông tin", "thong tin", "chi tiết"):
            resp = await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
            return query, lower_query, active_in_query, explicit_named, has_candidate_drug, resp

    if explicit_named:
        active_in_query = False

    if active_in_query and any(term in lower_query for term in TIMING_TERMS):
        resp = await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)
        return query, lower_query, active_in_query, explicit_named, has_candidate_drug, resp

    is_anaphylaxis_query = any(w in lower_query for w in ["phản vệ", "sốc phản vệ", "tt 51", "thông tư 51"])
    if not effective_med and not is_renal and not explicit_named and not is_anaphylaxis_query:
        from app.services.chatbot.conversational_clinical_engine import find_clinical_specialty_consultation, synthesize_specialty_response
        spec_hit = find_clinical_specialty_consultation(query)
        if spec_hit:
            resp = await synthesize_specialty_response(query, spec_hit, user_name=user_name, user_role=user_role, session_id=session_id)
            return query, lower_query, active_in_query, explicit_named, has_candidate_drug, resp
        ped_res = check_pediatric_guidance_request(lower_query, query, session_id)
        if ped_res:
            return query, lower_query, active_in_query, explicit_named, has_candidate_drug, ped_res
        ddi_examples_res = check_interaction_examples_request(lower_query, session_id)
        if ddi_examples_res:
            return query, lower_query, active_in_query, explicit_named, has_candidate_drug, ddi_examples_res
        contextless_res = check_contextless_clinical_question(lower_query)
        if contextless_res:
            return query, lower_query, active_in_query, explicit_named, has_candidate_drug, contextless_res

    return query, lower_query, active_in_query, explicit_named, has_candidate_drug, None
