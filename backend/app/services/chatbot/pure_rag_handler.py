import re

from app.schemas.copilot import CopilotResponse
from app.services.rag import rag_pipeline
from app.services.rag.types import filter_evidence_for_citations
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
    inference_required: bool = False,
) -> CopilotResponse | None:
    has_contextual_clinical_followups = any(
        term in lower_query for term in ("dùng gì", "uống gì", "gợi ý", "nên dùng", "nên uống", "đau đầu", "đau bụng")
    )
    if not ((is_interaction_question or has_contextual_clinical_followups) and (explicit_medication_named or active_medication_name)):
        return None

    rag_res = await rag_pipeline.execute_clinical_rag(query, user_role=user_role, conversation_context=history, inference_required=inference_required)
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
    from app.schemas.copilot import CopilotCdssAlert
    cdss_alert_obj = CopilotCdssAlert(**rag_res.cdss_alert) if getattr(rag_res, "cdss_alert", None) else None
    return CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION",
        reply_text=validate_output_guardrail(rag_res.answer, query),
        legal_basis=rag_res.legal_basis or None,
        suggested_chips=[],
        session_id=session.session_id,
        citations=[c.to_dict() for c in rag_res.citations],
        evidence=filter_evidence_for_citations(rag_res.evidence, [c.to_dict() for c in rag_res.citations]),
        claims=rag_res.claims,
        evidence_claim_map=rag_res.evidence_claim_map,
        rag_grounded=rag_res.rag_grounded,
        answer_type="grounded_reference" if rag_res.rag_grounded else "safe_abstention",
        source_status="retrieved_evidence" if rag_res.rag_grounded else "insufficient_retrieval_evidence",
        confidence=rag_res.confidence_score,
        abstention_reason=None if rag_res.rag_grounded else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
        factuality_score=getattr(rag_res, "factuality_score", 0.0),
        critique_verdict=getattr(rag_res, "critique_verdict", "NOT_RUN"),
        cdss_alert=cdss_alert_obj,
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
    "sốt xuất huyết", "dengue", "dấu hiệu cảnh báo", "cảnh báo đỏ", "red flag", "hạ sốt", "thuốc hạ sốt", "oresol", "sốt", "kiêng gì", "kiêng",
    "macrolid", "statin", "acei", "arb", "ccb", "chẹn beta", "quinolon", "nsaid", "opioid", "benzodiazepin",
    "sglt2", "dpp4", "tiểu đường", "đái tháo đường", "huyết áp", "đổi thuốc", "thay thế", "ho khan", "nhóm thuốc",
    "đổi sang", "chuyển sang", "thay bằng", "đổi nhóm", "thay thế bằng",
    "quy định", "quyết định", "văn bản", "tiêu chuẩn", "quy chuẩn", "hướng dẫn", "tài liệu", "chính sách", "luật",
    "trào ngược", "trào ngược dạ dày", "gerd", "loét dạ dày", "dạ dày", "tiêu hóa", "ợ chua", "ợ nóng", "thực quản", "viêm loét", "ppi"
)

def _matches_active_uploaded_pdf(lower_query: str) -> bool:
    """Cho phép câu hỏi khớp trực tiếp với văn bản PDF đã kích hoạt (active) đi thẳng vào Hybrid RAG."""
    try:
        from app.services.rag.sqlite_fts import SqliteFtsIndex
        from app.services.rag.pdf_ingestion_service import get_inactive_document_prefixes

        fts = SqliteFtsIndex()
        hits = fts.search_bm25(lower_query, top_k=5)
        if not hits:
            return False
        inactive_pfxs = tuple(get_inactive_document_prefixes())
        for h in hits:
            if h.chunk.entity_type == "regulatory_pdf":
                if not inactive_pfxs or not h.chunk.chunk_id.startswith(inactive_pfxs):
                    return True
    except Exception:
        return False
    return False


def is_qualified_clinical_rag_query(lower_query: str, session) -> bool:
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    has_clinical_pattern = any(p in lower_query for p in CLINICAL_KNOWLEDGE_GATE_PATTERNS)
    if has_clinical_pattern:
        return True
    has_active_or_explicit = bool(
        resolve_registered_medications(lower_query)
        or bool(get_drug_lexical_matcher().extract_medications(lower_query))
        or (session and session.active_medication_name)
    )
    if has_active_or_explicit and any(t in lower_query for t in ("như thế nào", "tại sao", "cơ chế", "dược lực", "lưu ý", "xử trí", "tác dụng", "điều trị", "dùng", "uống")):
        return True
    return _matches_active_uploaded_pdf(lower_query)

async def handle_deep_rag_consultation(
    query: str,
    lower_query: str,
    user_role: str,
    history: str,
    session_id: str,
    user_name: str,
    is_deep_pharmacology: bool,
    inference_required: bool = False,
) -> CopilotResponse | None:
    session = get_or_create_session(session_id, user_name, user_role)
    from app.services.chatbot.conversational_handler import get_user_salutation
    role_label = get_user_salutation(user_name, user_role)

    if not is_qualified_clinical_rag_query(lower_query, session) and not is_deep_pharmacology:
        return CopilotResponse(
            intent="CLINICAL_SAFE_ABSTENTION",
            reply_text=(
                f"Dạ thưa {role_label}, do câu hỏi chưa xác định rõ thực thể lâm sàng, để hỗ trợ chuyên môn chính xác nhất, {role_label} vui lòng nêu rõ tên thuốc (biệt dược hoặc hoạt chất), phác đồ bệnh lý hoặc nội dung chuyên môn cụ thể ạ.\n\n"
                "Tôi sẵn sàng hỗ trợ tra cứu về:\n"
                "1. **Chuyên khảo thuốc:** Chỉ định, liều lượng, chống chỉ định chuẩn Dược thư Quốc gia Việt Nam.\n"
                "2. **Tương tác thuốc (DDI):** Kiểm tra tương tác chống chỉ định theo QĐ 5948/QĐ-BYT.\n"
                "3. **Phác đồ cấp cứu & Thông tư:** Xử trí phản vệ (TT 51/2017), quản lý thuốc kiểm soát đặc biệt (TT 20/2017).\n"
                "4. **Kho Dược & Tủ trực:** Kiểm tra số lượng tồn kho và hạn dùng FEFO nội viện."
            ),
            answer_type="clarification",
            source_status="unqualified_clinical_query",
            confidence=1.0,
            session_id=session.session_id,
            suggested_chips=[],
            legal_basis="Thông tư 22/2011/TT-BYT & Quyết định 5948/QĐ-BYT"
        )

    rag_res = await rag_pipeline.execute_clinical_rag(query, user_role=user_role, conversation_context=history, inference_required=inference_required)
    if not rag_res or (not rag_res.retrieved_chunks and not rag_res.rag_grounded):
        return CopilotResponse(
            intent="CLINICAL_SAFE_ABSTENTION",
            reply_text=rag_res.answer if rag_res else "Chưa tìm thấy tài liệu đủ phù hợp để trả lời chính xác câu hỏi này.",
            answer_type="safe_abstention", source_status="insufficient_retrieval_evidence",
            confidence=0.0, abstention_reason="Không có tài liệu truy xuất phù hợp",
            citations=[], rag_grounded=False,
            factuality_score=getattr(rag_res, "factuality_score", 0.0),
            critique_verdict=getattr(rag_res, "critique_verdict", "NOT_RUN"),
        )
    if not (rag_res and (rag_res.citations or not rag_res.rag_grounded or is_deep_pharmacology)):
        return None

    cleaned_reply = validate_output_guardrail(rag_res.answer, query)
    from app.services.copilot_drug_keyword_extractor import extract_drug_keywords
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    cand_kw = extract_drug_keywords(lower_query)
    extracted_meds = get_drug_lexical_matcher().extract_medications(query)
    resolved_query_drugs = resolve_registered_medications(lower_query) or extracted_meds
    has_deictic_med_ref = bool(
        history and history.strip() and (
            any(r in lower_query for r in ("thuốc này", "thuốc đó", "thuốc kia", "vừa rồi"))
            or re.search(r"\bnó\b", lower_query)
        )
    )
    is_reg_doc_q = any(t in lower_query for t in ("thông tư", "nghị định", "quyết định", "quy chế", "tt "))
    if resolved_query_drugs:
        target_drugs = [d.lower() for d in resolved_query_drugs]
    elif cand_kw and len(cand_kw) >= 3 and (cand_kw.lower() in DRUG_REGISTRY or any(cand_kw.lower() in v.get("aliases", []) for v in DRUG_REGISTRY.values())):
        target_drugs = [cand_kw.lower()]
    elif session.active_medication_ingredient and has_deictic_med_ref and not is_reg_doc_q:
        target_drugs = [session.active_medication_ingredient.lower()]
    else:
        target_drugs = []
    cleaned_reply, validated_citations, is_grounded = validate_grounded_reply(
        cleaned_reply, [c.to_dict() for c in rag_res.citations], target_drugs, query=query
    )
    active_key = target_drugs[0] if target_drugs else None
    # chips = generate_suggested_chips(active_key, "general")
    filtered_evidence = filter_evidence_for_citations(rag_res.evidence, validated_citations)
    cited_chunk_ids = {
        str(c.get("chunk_id")) for c in validated_citations if isinstance(c, dict) and c.get("chunk_id")
    }
    from app.services.copilot_drug_formatter import _evidence_claim_contract

    rebound_contract = _evidence_claim_contract(filtered_evidence, cleaned_reply, cited_chunk_ids)
    final_claims = rebound_contract["claims"] or rag_res.claims
    final_claim_map = rebound_contract["evidence_claim_map"] if rebound_contract["claims"] else rag_res.evidence_claim_map

    return CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION",
        reply_text=cleaned_reply,
        legal_basis=rag_res.legal_basis or None,
        suggested_chips=[],
        session_id=session.session_id,
        evidence=filtered_evidence,
        claims=final_claims,
        evidence_claim_map=final_claim_map,
        citations=validated_citations,
        rag_grounded=rag_res.rag_grounded and is_grounded and bool(final_claims),
        answer_type="grounded_reference" if (rag_res.rag_grounded and is_grounded and bool(final_claims)) else "safe_abstention",
        source_status="retrieved_evidence" if (rag_res.rag_grounded and is_grounded and bool(final_claims)) else "insufficient_retrieval_evidence",
        confidence=rag_res.confidence_score if (is_grounded and bool(final_claims)) else 0.5,
        abstention_reason=None if (rag_res.rag_grounded and is_grounded and bool(final_claims)) else "Tài liệu truy xuất không đủ phù hợp để hỗ trợ câu trả lời",
        factuality_score=getattr(rag_res, "factuality_score", 0.0),
        critique_verdict=getattr(rag_res, "critique_verdict", "NOT_RUN"),
    )


_DIRECT_STREAMABLE_RAG_CUES = (
    "thông tư", "tt 51", "tt 20", "tt 22", "tt 26", "tt 36", "tt 52", "nghị định", "quyết định",
    "quy chế", "dược động học", "thời gian bán thải", "cơ chế tác dụng", "phác đồ xử trí phản vệ",
    "sốc phản vệ", "dị ứng chéo",
)
_STREAM_BYPASS_BLOCKERS = (
    "mở tab", "chuyển sang", "mở form", "tồn kho", "tủ trực", "báo hỏng", "máy thở", "monitor",
    "kiểm kê", "giao ban", "tương tác", "uống cùng", "dùng cùng", "phối hợp", "creatinin", "crcl",
    "egfr", "chỉnh liều", "tuổi", "kg", "dặn dò", "nhắc uống", "so sánh", "đồng thời",
    "giá thuốc", "bao nhiêu tiền", "giá bán", "mua ở đâu", "bán ở đâu", "chi phí",
)


def is_direct_streamable_rag_query(lower_query: str) -> bool:
    """
    Return True when a query is clearly a pure regulatory / deep pharmacology RAG query
    (and NOT navigation, operational DB, DDI matrix, multi-intent, or patient dose calculation),
    allowing zero-overhead live token streaming via `execute_clinical_rag_stream`.
    """
    q = (lower_query or "").strip()
    if len(q) < 12 or any(b in q for b in _STREAM_BYPASS_BLOCKERS):
        return False
    if any(c in q for c in _DIRECT_STREAMABLE_RAG_CUES):
        return True
    return _matches_active_uploaded_pdf(q)


async def stream_deep_rag_consultation(
    query: str,
    lower_query: str,
    user_role: str,
    history: str,
    session_id: str,
    user_name: str,
    inference_required: bool = False,
):
    """
    Live-streaming counterpart to `handle_deep_rag_consultation`.
    Streams screened tokens in real time and yields a fully verified `CopilotResponse` at `done`.
    """
    session = get_or_create_session(session_id, user_name, user_role)
    rag_res = None
    async for ev_kind, ev_data in rag_pipeline.execute_clinical_rag_stream(
        query,
        user_role=user_role,
        conversation_context=history,
        inference_required=inference_required,
    ):
        if ev_kind in ("status", "token"):
            yield (ev_kind, ev_data)
        elif ev_kind == "done":
            rag_res = ev_data

    if not rag_res or (not rag_res.retrieved_chunks and not rag_res.rag_grounded):
        yield ("done", None)
        return

    cleaned_reply = validate_output_guardrail(rag_res.answer, query)
    from app.services.copilot_drug_keyword_extractor import extract_drug_keywords
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher

    cand_kw = extract_drug_keywords(lower_query)
    extracted_meds = get_drug_lexical_matcher().extract_medications(query)
    resolved_query_drugs = resolve_registered_medications(lower_query) or extracted_meds
    has_deictic_med_ref = bool(
        history and history.strip() and (
            any(r in lower_query for r in ("thuốc này", "thuốc đó", "thuốc kia", "vừa rồi"))
            or re.search(r"\bnó\b", lower_query)
        )
    )
    is_reg_doc_q = any(t in lower_query for t in ("thông tư", "nghị định", "quyết định", "quy chế", "tt "))
    if resolved_query_drugs:
        target_drugs = [d.lower() for d in resolved_query_drugs]
    elif cand_kw and len(cand_kw) >= 3 and (
        cand_kw.lower() in DRUG_REGISTRY
        or any(cand_kw.lower() in v.get("aliases", []) for v in DRUG_REGISTRY.values())
    ):
        target_drugs = [cand_kw.lower()]
    elif session.active_medication_ingredient and has_deictic_med_ref and not is_reg_doc_q:
        target_drugs = [session.active_medication_ingredient.lower()]
    else:
        target_drugs = []

    cleaned_reply, validated_citations, is_grounded = validate_grounded_reply(
        cleaned_reply, [c.to_dict() for c in rag_res.citations], target_drugs, query=query
    )
    filtered_evidence = filter_evidence_for_citations(rag_res.evidence, validated_citations)
    cited_chunk_ids = {
        str(c.get("chunk_id")) for c in validated_citations if isinstance(c, dict) and c.get("chunk_id")
    }
    from app.services.copilot_drug_formatter import _evidence_claim_contract

    rebound_contract = _evidence_claim_contract(filtered_evidence, cleaned_reply, cited_chunk_ids)
    final_claims = rebound_contract["claims"] or rag_res.claims
    final_claim_map = rebound_contract["evidence_claim_map"] if rebound_contract["claims"] else rag_res.evidence_claim_map
    grounded_ok = bool(rag_res.rag_grounded and is_grounded and final_claims)
    if not grounded_ok:
        yield ("done", None)
        return

    yield (
        "done",
        CopilotResponse(
            intent="CLINICAL_AI_CONSULTATION",
            reply_text=cleaned_reply,
            legal_basis=rag_res.legal_basis or None,
            suggested_chips=[],
            session_id=session.session_id,
            evidence=filtered_evidence,
            claims=final_claims,
            evidence_claim_map=final_claim_map,
            citations=validated_citations,
            rag_grounded=True,
            answer_type="grounded_reference",
            source_status="retrieved_evidence",
            confidence=rag_res.confidence_score,
            abstention_reason=None,
            factuality_score=getattr(rag_res, "factuality_score", 0.0),
            critique_verdict=getattr(rag_res, "critique_verdict", "NOT_RUN"),
            workflow_executor="live_rag_stream",
        ),
    )
