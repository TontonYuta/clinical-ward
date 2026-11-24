"""
Thẩm định Hợp đồng Bằng chứng Lâm sàng (Evidence & Provenance Contract Validator).
Tách từ copilot_orchestrator.py nhằm tinh gọn kiến trúc, độc lập kiểm thử và chống over-gating.
Đảm bảo 100% phản hồi lâm sàng factual có xuất xứ chứng cứ, đồng thời cho phép các ý định
hội thoại / hướng dẫn nghiệp vụ (non-factual) phản hồi tức thì mà không bị chặn nhầm.
"""
from typing import Any
from app.schemas.copilot import CopilotResponse


def _has_verified_source_version(value: object) -> bool:
    """Kiểm tra nguồn tri thức có phiên bản xác thực rõ ràng (khác unversioned/none)."""
    normalized = str(value or "").strip().casefold()
    return bool(normalized) and normalized not in {"unversioned", "unknown", "none"}


def validate_response_evidence_contract(resp: CopilotResponse) -> CopilotResponse:
    """Thẩm định tính xác thực của câu trả lời dựa trên trích dẫn (citations) và bằng chứng (evidence)."""
    if resp.intent in ("MULTIMODAL_CLINICAL_VISION", "GROUNDED_WEB_SEARCH"):
        return resp

    non_factual_types = {
        "clarification", "corrective_clarification", "safe_abstention", "feedback_acknowledgment",
        "conversational_feedback", "conversational_correction",
        "conversational_guidance", "capability_overview", "unavailable",
        "operational_result", "action_result", "action_confirmation", "cdss_alert",
        "guideline", "medication_lookup_guide", "acknowledgment", "image_extraction",
        "navigation", "system_navigation",
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
        "NAVIGATE_TAB",
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
            or (claim.claim_type == "source_fact" and " ".join(str(claim.text).casefold().split()) not in " ".join(str(item.get("content") or "").casefold().split()))
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
        resp.reply_text = (
            "Chưa thể xác minh nội dung câu trả lời bằng khẳng định đã được liên kết trực tiếp "
            "với bằng chứng có nguồn gốc rõ ràng."
        )
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
