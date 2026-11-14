"""
Citation Standardizer & Grounding Verifier.
Đảm bảo 100% các phản hồi nghiệp vụ & lâm sàng của Chatbot (trừ chào hỏi, cảm ơn, từ chối ngoài phạm vi)
đều có danh sách nguồn trích dẫn minh bạch, chuẩn hóa và có thể đối soát (URL PDF + số trang).
"""

from __future__ import annotations

from typing import Any, Dict, List
from app.schemas.copilot import CopilotResponse
from app.services.rag.source_resolver import resolve_citation_document

EXEMPT_INTENTS = {
    "GREETING_WELCOME",
    "GREETING_WELLBEING",
    "CONVERSATIONAL_FEEDBACK",
    "CONVERSATIONAL_CORRECTION",
    "FEEDBACK_DATA_ENRICHMENT",
    "FEEDBACK_UI_ADJUSTMENT",
    "OUT_OF_SCOPE",
    "SECURITY_GUARDRAIL_BLOCKED",
    "CLINICAL_CASE_CLARIFICATION",
    "MEDICATION_LOOKUP_CLARIFICATION",
    "CLINICAL_SAFE_ABSTENTION",
}

def standardize_response_citations(resp: CopilotResponse, query: str = "") -> CopilotResponse:
    """
    Chuẩn hóa và làm giàu mảng citations cho phản hồi của Copilot.
    Đảm bảo 100% câu trả lời nghiệp vụ/lâm sàng đều có bằng chứng tra cứu được.
    """
    if resp.intent in EXEMPT_INTENTS or resp.answer_type in ("safe_abstention", "clarification"):
        resp.citations = []
        return resp

    existing_citations = list(resp.citations or [])
    cleaned_citations: List[Dict[str, Any]] = []

    # 1. Chuẩn hóa các citation đã có sẵn trong response
    for c in existing_citations:
        item = dict(c) if isinstance(c, dict) else c.model_dump() if hasattr(c, "model_dump") else {}
        if not item:
            continue

        # Bổ sung hoặc làm giàu URL PDF và số trang nếu chưa có hoặc đang fallback page 1
        source_str = item.get("source", "")
        basis_str = item.get("legal_basis", "")
        sec_str = item.get("section", "")
        drug_hint = resp.active_medication_name or ""
        has_chunk_identity = bool(item.get("chunk_id"))
        has_verified_source_version = bool(str(item.get("source_version") or "").strip())
        # Do not manufacture a source link/page from query wording when citation
        # is already tied to a retrieved chunk. RAG sets links during retrieval.
        if has_chunk_identity and has_verified_source_version:
            item.setdefault("title", basis_str or source_str or "Tài liệu nguồn")
            cleaned_citations.append(item)
            continue

        need_resolve = (
            not item.get("url")
            or not item.get("page")
            or (item.get("page") == 1 and ("dược thư" in f"{source_str} {basis_str}".lower() or "dtqg" in str(item.get("document_id", "")).lower()))
        )
        if need_resolve:
            url, doc_id, page = resolve_citation_document(source_str, basis_str, sec_str, query=query, active_drug=drug_hint)
            if url:
                item["url"] = url
                item["document_id"] = doc_id or item.get("document_id")
                if page:
                    item["page"] = page

        # Đảm bảo có title ngắn gọn và dễ hiểu trên UI
        if not item.get("title"):
            basis = item.get("legal_basis") or item.get("source") or "Văn bản y văn"
            item["title"] = basis.split("•")[0].strip()

        if item.get("page") and item.get("url") and "#page=" not in item["url"]:
            item["url"] = f"{item['url'].split('#')[0]}#page={item['page']}"
        if not item.get("inn"):
            item["inn"] = drug_hint or sec_str or None

        cleaned_citations.append(item)

    resp.citations = cleaned_citations

    # Nếu có citations nhưng chưa có legal_basis thì cập nhật legal_basis từ citation đầu tiên
    if cleaned_citations and not resp.legal_basis:
        resp.legal_basis = cleaned_citations[0].get("legal_basis") or cleaned_citations[0].get("source")

    return resp
