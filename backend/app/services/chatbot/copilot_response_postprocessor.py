"""
Copilot Response Postprocessor.
Standardizes citations, enforces evidence contracts, applies reference notes,
and attaches standard clinical summary/abstention schemas.
"""
from fastapi import Request
from app.schemas.copilot import (
    CopilotQuery,
    CopilotResponse,
    ClinicalSummary,
    StructuredClinicalPayload,
    AbstentionDetailsSchema,
)
from app.services.chatbot.citation_standardizer import standardize_response_citations
from app.services.chatbot.evidence_contract_validator import validate_response_evidence_contract
from app.services.chatbot.answer_operation import apply_reference_note


def post_process_copilot_response(
    resp: CopilotResponse,
    request: Request,
    payload: CopilotQuery,
    *,
    validator_fn=None,
) -> CopilotResponse:
    """
    Standardize 100% response citations, validate evidence contracts, and enrich
    safe abstention or clarification metadata.
    """
    if validator_fn is None:
        validator_fn = validate_response_evidence_contract
    resp = standardize_response_citations(resp, payload.query)
    resp = validator_fn(resp)
    route_intent = getattr(getattr(request.state, "workflow_route", None), "intent", None)
    resp = apply_reference_note(resp, getattr(request.state, "clinical_nlu_result", None), route_intent)

    if resp.answer_type == "safe_abstention":
        resp.citations = []
        resp.evidence = []
        if not resp.clinical_summary:
            headline = "Từ chối an toàn (Safe Abstention)"
            takeaway = (resp.abstention_reason or resp.reply_text[:120]).replace("\n", " ").strip()
            resp.clinical_summary = ClinicalSummary(headline=headline, key_takeaway=takeaway, urgency="warning")
        if not resp.clinical_data or not resp.clinical_data.abstention_details:
            reason_code = str(resp.source_status or "SAFE_ABSTENTION").upper()
            resp.clinical_data = StructuredClinicalPayload(
                abstention_details=AbstentionDetailsSchema(
                    reason_code=reason_code,
                    unresolved_entities=[],
                    professional_recommendations=[
                        "Kiểm tra lại tên biệt dược/hoạt chất hoặc tài liệu chuyên môn đã được Bộ Y tế phê duyệt.",
                        "Tham khảo ý kiến Dược sĩ lâm sàng trước khi chỉ định.",
                    ]
                )
            )
    elif resp.answer_type == "clarification":
        if not resp.clinical_summary:
            headline = "Yêu cầu làm rõ thông tin"
            takeaway = resp.reply_text[:120].replace("\n", " ").strip()
            resp.clinical_summary = ClinicalSummary(headline=headline, key_takeaway=takeaway, urgency="routine")

    return resp
