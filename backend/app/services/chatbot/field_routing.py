import re
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.copilot import CopilotResponse
from app.services.copilot_catalog import find_matched_med
from app.services.copilot_drug_lookup import extract_drug_keywords, lookup_drug_authoritative
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.session_context import get_or_create_session
from app.services.rag.knowledge_graph import expand_clinical_graph

RAW_FIELD_SPECS = [
    ("interaction", ["tương tác thuốc", "thuốc tương tác", "tương tác", "tương kỵ", "kỵ thuốc", "tuong tac thuoc", "tuong tac", "tuong ky", "ky thuoc", "kỵ gì"]),
    ("adverse_effects", ["tác dụng không mong muốn", "tác dụng phụ", "tac dung phu", "tac dung khong mong muon"]),
    ("contraindications", ["chống chỉ định", "cấm dùng", "chong chi dinh", "cam dung", "có dùng được", "dùng được", "có uống được", "uống được"]),
    ("dosage", ["liều tối đa", "liều lượng", "liều dùng", "cách dùng", "còn liều", "liều", "lieu toi da", "lieu dung", "lieu luong", "cach dung", "trẻ em", "cho bé", "nhi khoa", "uống lúc nào", "trước hay sau ăn", "trước ăn", "sau ăn"]),
    ("pregnancy", ["phụ nữ có thai", "mang thai", "thai kỳ", "cho con bú", "phu nu co thai", "thai ky"]),
    ("indications", ["chỉ định", "công dụng", "chi dinh", "cong dung", "điều trị", "dieu tri", "chữa bệnh", "chua benh"]),
    ("ingredients", ["thành phần", "hoạt chất", "thanh phan", "hoat chat"]),
    ("registry", ["số đăng ký", "sđk", "so dang ky", "sdk"]),
]

def extract_matched_field_keys(lower_query: str) -> set[str]:
    return {
        key for key, phrases in RAW_FIELD_SPECS
        if (
            (key == "indications" and (any(p in lower_query for p in phrases if p not in ("chỉ định", "chi dinh")) or bool(re.search(r"(?<!chống\s)(?<!chống)(?<!chong\s)(?<!chong)(?:chỉ định|chi dinh)", lower_query))))
            or (key != "indications" and any(p in lower_query for p in phrases))
        )
    }

async def handle_interaction_clarification(
    query: str, lower_query: str, session_id: str, user_name: str, user_role: str
) -> CopilotResponse | None:
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response

    trie_meds = get_drug_lexical_matcher().extract_medications(query)
    if len(trie_meds) >= 2:
        return format_multi_ddi_response(trie_meds, query, session_id=session_id)

    ddi_context = expand_clinical_graph(query).get("kg_entities", [])
    named_drugs = {entity for entity in ddi_context if entity.startswith("INN:")}
    known_interaction_pair = any(entity.startswith("DDI:") for entity in ddi_context)

    named_drugs.update(
        f"INN:{ingredient}"
        for ingredient, entry in DRUG_REGISTRY.items()
        if any(alias.casefold() in lower_query for alias in entry.get("aliases", []) if len(alias) >= 4)
    )
    if len(named_drugs) < 2 and not known_interaction_pair:
        session = get_or_create_session(session_id, user_name, user_role)
        return CopilotResponse(
            intent="MEDICATION_INTERACTION_CLARIFICATION",
            reply_text="Vui lòng cung cấp tên hai thuốc (hoạt chất hoặc biệt dược) cần kiểm tra tương tác. Nếu muốn kiểm tra toàn bộ đơn, hãy gửi danh sách thuốc đang dùng.",
            answer_type="clarification", source_status="missing_interaction_medications",
            confidence=1.0, abstention_reason="Chưa xác định được ít nhất hai thuốc cần kiểm tra",
            session_id=session.session_id,
            suggested_chips=["Tương tác giữa Clopidogrel và Omeprazol", "Tương tác giữa Warfarin và Aspirin", "Tương tác giữa Ciprofloxacin và Canxi"],
        )
    return None

async def handle_field_or_drug_inquiry(
    query: str,
    lower_query: str,
    db: AsyncSession,
    *,
    session,
    session_id: str,
    user_name: str,
    user_role: str,
    has_candidate_drug: bool,
    active_name_in_query: bool,
    is_renal_adjustment_request: bool,
) -> CopilotResponse | None:
    if is_renal_adjustment_request:
        return None

    matched_field_keys = extract_matched_field_keys(lower_query)
    drug_info_cues = (
        "thông tin thuốc", "thông tin", "tra cứu thuốc", "thuốc ", "liều dùng",
        "liều lượng", "liều tối đa", "còn liều", "liều", "chỉ định", "công dụng",
        "tác dụng phụ", "tác dụng không mong muốn", "chống chỉ định", "thành phần",
        "hoạt chất", "tương tác", "thong tin thuoc", "thong tin", "tra cuu thuoc",
        "thuoc", "lieu dung", "chong chi dinh", "tac dung phu", "tuong tac"
    )
    asks_multiple_fields = len(matched_field_keys) > 1
    has_drug_entity = (
        find_matched_med(lower_query) is not None
        or active_name_in_query
        or any(alias in lower_query for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", []) if len(alias) >= 4)
        or has_candidate_drug
    )
    asks_drug_info = any(cue in lower_query for cue in drug_info_cues)
    extracted_kw = extract_drug_keywords(query)
    resolved_meds = resolve_registered_medications(lower_query)
    is_two_drug = (len(extracted_kw.split()) > 1 and any(c in lower_query for c in (" và ", " cùng ", " với ", "+", " kết hợp ", " phối hợp "))) or len(resolved_meds) > 1
    is_interaction_question = any(term in lower_query for term in ("tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng", "kết hợp", "uống chung", "dùng chung"))
    is_two_drug_interaction = is_interaction_question and is_two_drug
    is_deep_complex = any(term in lower_query for term in ("thời gian bán thải", "huyết tương", "dược động học", "cơ chế tác dụng"))

    has_multiple_medication_fields = len(matched_field_keys) > 1 or is_two_drug or is_deep_complex or any(c in lower_query for c in (" và ", " cùng ", ","))
    has_explicit_medication_field = len(matched_field_keys) == 1 and not has_multiple_medication_fields

    if asks_multiple_fields and asks_drug_info and not is_deep_complex and not is_two_drug_interaction:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    if has_explicit_medication_field and (has_drug_entity or active_name_in_query) and not is_deep_complex and not is_two_drug_interaction:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    if active_name_in_query and asks_drug_info and not is_deep_complex and not is_two_drug_interaction:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    is_standalone_drug_query = (has_drug_entity or active_name_in_query) and len(lower_query.split()) <= 4 and not is_deep_complex and not is_two_drug_interaction and not is_interaction_question
    if is_standalone_drug_query:
        return await lookup_drug_authoritative(query, db, session_id=session_id, user_name=user_name, user_role=user_role)

    return None
