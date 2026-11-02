from app.schemas.copilot import CopilotResponse
from app.services.rag import rag_pipeline
from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.session_context import get_or_create_session
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
        suggested_chips=contextual_suggestions,
        session_id=session.session_id,
        citations=[c.to_dict() for c in rag_res.citations],
        rag_grounded=rag_res.rag_grounded,
        answer_type="grounded_reference" if rag_res.rag_grounded else "safe_abstention",
        source_status="retrieved_evidence" if rag_res.rag_grounded else "insufficient_retrieval_evidence",
        confidence=rag_res.confidence_score,
        abstention_reason=None if rag_res.rag_grounded else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
    )

async def handle_deep_rag_consultation(
    query: str,
    lower_query: str,
    user_role: str,
    history: str,
    session_id: str,
    user_name: str,
    is_deep_pharmacology: bool,
) -> CopilotResponse | None:
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
    session = get_or_create_session(session_id, user_name, user_role)
    target_drugs = resolve_registered_medications(lower_query) or (
        [session.active_medication_ingredient] if session.active_medication_ingredient else []
    )
    cleaned_reply, validated_citations, is_grounded = validate_grounded_reply(
        cleaned_reply, [c.to_dict() for c in rag_res.citations], target_drugs
    )
    active_key = target_drugs[0] if target_drugs else None
    chips = generate_suggested_chips(active_key, "general")
    return CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION",
        reply_text=cleaned_reply,
        legal_basis=rag_res.legal_basis or None,
        suggested_chips=chips,
        session_id=session.session_id,
        citations=validated_citations,
        rag_grounded=rag_res.rag_grounded and is_grounded,
        answer_type="grounded_reference" if (rag_res.rag_grounded and is_grounded) else "safe_abstention",
        source_status="retrieved_evidence" if (rag_res.rag_grounded and is_grounded) else "insufficient_retrieval_evidence",
        confidence=rag_res.confidence_score if is_grounded else 0.5,
        abstention_reason=None if (rag_res.rag_grounded and is_grounded) else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
    )
