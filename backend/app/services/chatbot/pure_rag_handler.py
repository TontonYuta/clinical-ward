from app.schemas.copilot import CopilotResponse
from app.services.rag import rag_pipeline
from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.session_context import get_or_create_session
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.chatbot.output_validator import validate_grounded_reply
from app.services.chatbot.chip_generator import generate_suggested_chips
from app.security.guardrails import validate_output_guardrail

async def handle_contextual_rag_followup(
    query: str,
    lower_query: str,
    user_role: str,
    history: str,
    session_id: str,
    user_name: str,
    is_interaction_question: bool,
    explicit_medication_named: bool,
    active_medication_name: str | None,
) -> CopilotResponse | None:
    has_contextual_clinical_followups = any(
        term in lower_query for term in ("dùng gì", "uống gì", "gợi ý", "nên dùng", "nên uống", "đau đầu", "đau bụng")
    )
    if not ((is_interaction_question or has_contextual_clinical_followups) and (explicit_medication_named or active_medication_name)):
        return None

    rag_res = await rag_pipeline.execute_clinical_rag(query, user_role=user_role, conversation_context=history)
    if not rag_res:
        return None

    session = get_or_create_session(session_id, user_name, user_role)
    contextual_suggestions = [
        "Rà soát danh sách thuốc đang dùng của người bệnh",
        "Đánh giá dấu hiệu cảnh báo ở người bệnh sốt",
        "Kiểm tra tương tác trong danh sách thuốc đang dùng",
    ] if has_contextual_clinical_followups and not is_interaction_question else [
        "Rà soát danh sách thuốc đang dùng của người bệnh",
        "Cơ chế và mức độ nghiêm trọng của tương tác này là gì?",
        "Nội dung cần trao đổi với dược sĩ lâm sàng về phối hợp này",
    ]
    return CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION",
        reply_text=validate_output_guardrail(rag_res.answer, query),
        legal_basis=rag_res.legal_basis or None,
        suggested_chips=[],
        session_id=session.session_id,
        citations=[c.to_dict() for c in rag_res.citations],
        rag_grounded=rag_res.rag_grounded,
        answer_type="grounded_reference" if rag_res.rag_grounded else "safe_abstention",
        source_status="retrieved_evidence" if rag_res.rag_grounded else "insufficient_retrieval_evidence",
        confidence=rag_res.confidence_score,
        abstention_reason=None if rag_res.rag_grounded else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
        factuality_score=getattr(rag_res, "factuality_score", 1.0),
        critique_verdict=getattr(rag_res, "critique_verdict", "PASS"),
    )

CLINICAL_KNOWLEDGE_GATE_PATTERNS = (
    "thông tư", "tt 51", "tt 20", "tt 22", "qđ 5948", "qd 5948", "phác đồ", "hướng dẫn điều trị",
    "nghị định", "quy chế", "phản vệ", "sốc phản vệ", "ngộ độc", "cấp cứu", "mất nước", "bù nước",
    "bù dịch", "tiêu chảy", "sốt co giật", "sốt cao", "dược động học", "thời gian bán thải",
    "bán thải", "cơ chế tác dụng", "cơ chế", "chuyển hóa", "cyp", "cyp3a4", "cyp2c19", "nồng độ đáy",
    "nồng độ đỉnh", "trough", "peak", "huyết tương", "tương kỵ", "pha chung", "đường truyền",
    "dị ứng chéo", "phối hợp", "tương tác", "chống chỉ định", "suy thận", "suy gan", "phụ nữ mang thai",
    "thai kỳ", "cho con bú", "trẻ sơ sinh", "lọc máu", "chạy thận", "đau bụng", "buồn nôn",
    "đau đầu", "chóng mặt", "khó thở", "triệu chứng", "biểu hiện của",
    "nhiễm khuẩn", "nhiễm trùng", "nhiễm khuẩn huyết", "nhiễm trùng huyết", "sốc nhiễm khuẩn", "sốc nhiễm trùng",
    "sepsis", "viêm phổi", "viêm màng não", "suy hô hấp", "hôn mê", "co giật", "kháng sinh",
    "sốt xuất huyết", "dengue", "dấu hiệu cảnh báo", "cảnh báo đỏ", "red flag", "hạ sốt", "thuốc hạ sốt", "oresol",
    "macrolid", "statin", "acei", "arb", "ccb", "chẹn beta", "quinolon", "nsaid", "opioid", "benzodiazepin",
    "sglt2", "dpp4", "tiểu đường", "đái tháo đường", "huyết áp", "đổi thuốc", "thay thế", "ho khan", "nhóm thuốc",
    "đổi sang", "chuyển sang", "thay bằng", "đổi nhóm", "thay thế bằng"
)

def is_qualified_clinical_rag_query(lower_query: str, session) -> bool:
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    has_clinical_pattern = any(p in lower_query for p in CLINICAL_KNOWLEDGE_GATE_PATTERNS)
    has_active_or_explicit = bool(
        resolve_registered_medications(lower_query)
        or bool(get_drug_lexical_matcher().extract_medications(lower_query))
        or (session and session.active_medication_name)
    )
    return has_clinical_pattern or (has_active_or_explicit and any(t in lower_query for t in ("như thế nào", "tại sao", "cơ chế", "dược lực", "lưu ý", "xử trí", "tác dụng", "điều trị", "dùng", "uống")))

async def handle_deep_rag_consultation(
    query: str,
    lower_query: str,
    user_role: str,
    history: str,
    session_id: str,
    user_name: str,
    is_deep_pharmacology: bool,
) -> CopilotResponse | None:
    session = get_or_create_session(session_id, user_name, user_role)
    is_doc = any(k in (user_role or "").lower() for k in ("doctor", "bac_si", "physician", "bs")) or any(k in (user_name or "").lower() for k in ("bác", "bac", "bs", "dr", "doctor"))
    is_nurse = any(k in (user_role or "").lower() for k in ("nurse", "dieu_duong", "dd")) or any(k in (user_name or "").lower() for k in ("đd", "điều dưỡng", "dieu duong", "yt", "y tá"))
    role_label = "Bác sĩ" if is_doc else ("Điều dưỡng" if is_nurse else "Nhân viên y tế")

    if not is_qualified_clinical_rag_query(lower_query, session) and not is_deep_pharmacology:
        return CopilotResponse(
            intent="CLINICAL_SAFE_ABSTENTION",
            reply_text=(
                "### 🛡️ TỪ CHỐI TIẾP NHẬN (Nằm ngoài phạm vi tri thức hoặc chưa rõ ngữ cảnh lâm sàng)\n\n"
                "Trợ lý AI nội viện chỉ cung cấp thông tin chuyên môn khi xác định rõ chủ đề y khoa đã được kiểm chứng:\n"
                "1. **Tra cứu Dược thư & Thuốc:** Biệt dược, hoạt chất (54.885 thuốc DAV), chỉ định, liều dùng, chống chỉ định.\n"
                "2. **Tương tác thuốc (DDI):** Kiểm tra tương tác chống chỉ định theo QĐ 5948/QĐ-BYT.\n"
                "3. **Phác đồ cấp cứu & Thông tư:** Xử trí phản vệ (TT 51/2017), quản lý thuốc kiểm soát đặc biệt (TT 20/2017).\n"
                "4. **Kho Dược & Tủ trực:** Kiểm tra số lượng tồn kho và hạn dùng FEFO.\n\n"
                f"{role_label} vui lòng nêu rõ tên thuốc, phác đồ điều trị hoặc nội dung chuyên môn cụ thể để em hỗ trợ chính xác ạ."
            ),
            answer_type="safe_abstention",
            source_status="unqualified_clinical_query",
            confidence=1.0,
            session_id=session.session_id,
            suggested_chips=[],
            legal_basis="Thông tư 22/2011/TT-BYT & Quyết định 5948/QĐ-BYT"
        )

    top_results = HybridRetriever().retrieve(query, top_k=1)
    if not top_results:
        return CopilotResponse(
            intent="CLINICAL_SAFE_ABSTENTION",
            reply_text="Hiện chưa tìm thấy thông tin chuyên môn phù hợp trong nguồn tri thức của hệ thống. Hãy nêu rõ chủ đề, thuốc hoặc văn bản cần tra cứu.",
            answer_type="safe_abstention", source_status="no_retrieval_results",
            confidence=0.0, abstention_reason="Không có tài liệu truy xuất phù hợp",
        )
    rag_res = await rag_pipeline.execute_clinical_rag(query, user_role=user_role, conversation_context=history)
    if not (rag_res and (rag_res.citations or not rag_res.rag_grounded or is_deep_pharmacology)):
        return None

    cleaned_reply = validate_output_guardrail(rag_res.answer, query)
    from app.services.copilot_drug_keyword_extractor import extract_drug_keywords
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    cand_kw = extract_drug_keywords(lower_query)
    extracted_meds = get_drug_lexical_matcher().extract_medications(query)
    resolved_query_drugs = resolve_registered_medications(lower_query) or extracted_meds
    if resolved_query_drugs:
        target_drugs = [d.lower() for d in resolved_query_drugs]
    elif cand_kw and len(cand_kw) >= 3 and (cand_kw.lower() in DRUG_REGISTRY or any(cand_kw.lower() in v.get("aliases", []) for v in DRUG_REGISTRY.values())):
        target_drugs = [cand_kw.lower()]
    elif session.active_medication_ingredient:
        target_drugs = [session.active_medication_ingredient.lower()]
    else:
        target_drugs = []
    cleaned_reply, validated_citations, is_grounded = validate_grounded_reply(
        cleaned_reply, [c.to_dict() for c in rag_res.citations], target_drugs, query=query
    )
    active_key = target_drugs[0] if target_drugs else None
    # chips = generate_suggested_chips(active_key, "general")
    return CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION",
        reply_text=cleaned_reply,
        legal_basis=rag_res.legal_basis or None,
        suggested_chips=[],
        session_id=session.session_id,
        citations=validated_citations,
        rag_grounded=rag_res.rag_grounded and is_grounded,
        answer_type="grounded_reference" if (rag_res.rag_grounded and is_grounded) else "safe_abstention",
        source_status="retrieved_evidence" if (rag_res.rag_grounded and is_grounded) else "insufficient_retrieval_evidence",
        confidence=rag_res.confidence_score if is_grounded else 0.5,
        abstention_reason=None if (rag_res.rag_grounded and is_grounded) else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
        factuality_score=getattr(rag_res, "factuality_score", 1.0),
        critique_verdict=getattr(rag_res, "critique_verdict", "PASS"),
    )
