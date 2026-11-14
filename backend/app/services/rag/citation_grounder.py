"""
Citation Grounder & PaperQA2 Claim-Level Attribution
Gắn trích dẫn từ chunk có nguồn; không tự suy ra provenance khi thiếu bằng chứng (<=190 LOC)
"""
import re
import unicodedata
from app.services.rag.types import RagCitation, RetrievedChunk, RagResult
from app.services.rag.source_resolver import resolve_citation_document

_QUERY_STOPWORDS = {
    "bao", "bằng", "biết", "các", "có", "của", "được", "gì", "hãy",
    "không", "là", "làm", "một", "muốn", "nào", "như", "thế",
    "thì", "tôi", "và", "về", "với", "xin", "cho", "hôm", "nay",
    "thuốc", "thuoc", "bệnh", "benh", "nhân", "nhan", "người", "nguoi",
    "dùng", "dung", "uống", "uong", "tiêm", "tiem", "truyền", "truyen",
    "điều", "dieu", "trị", "tri", "thông", "thong", "tin", "ở", "tại", "tai",
    "giúp", "giup", "hỏi", "hoi", "bác", "bac", "sĩ", "si", "dược", "duoc",
    "tương", "tuong", "tác", "tac", "chú", "chu", "ý", "y", "cần", "can"
}

def _normalize_terms(text: str) -> set[str]:
    accented = {w for w in re.findall(r"[\w]+", text.casefold()) if len(w) >= 2 and w not in _QUERY_STOPWORDS}
    norm = unicodedata.normalize("NFKD", text.casefold())
    unaccented = "".join(char for char in norm if not unicodedata.combining(char)).replace("đ", "d")
    unacc_words = {w for w in re.findall(r"[a-z0-9]+", unaccented) if len(w) >= 3 and w not in _QUERY_STOPWORDS}
    return accented | unacc_words

def _has_evidence_overlap(query: str, chunk: RetrievedChunk) -> bool:
    # Bắt buộc khớp thực thể dược phẩm nếu câu hỏi nêu đích danh thuốc
    from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher

    matcher = get_drug_lexical_matcher()
    lex_drugs = matcher.extract_medications(query)
    resolved_query_drugs = list(dict.fromkeys(
        [d.lower() for d in resolve_registered_medications(query)] + [m.lower() for m in lex_drugs]
    ))

    if resolved_query_drugs:
        chunk_text = f"{chunk.chunk.title} {chunk.chunk.content} {chunk.chunk.page_or_section}".casefold()
        if not any(d in chunk_text for d in resolved_query_drugs):
            return False

    query_terms = _normalize_terms(query)
    evidence_terms = _normalize_terms(" ".join([chunk.chunk.title, chunk.chunk.content, *chunk.chunk.keywords]))
    if not query_terms or not evidence_terms:
        return False

    core_disease_groups = [
        {"huyết", "áp"}, {"huyet", "ap"},
        {"tiểu", "đường"}, {"tieu", "duong"},
        {"đái", "tháo"}, {"dai", "thao"},
        {"hen", "phế"}, {"hen", "phe"},
    ]
    for grp in core_disease_groups:
        if grp.issubset(query_terms) and not (grp & evidence_terms):
            return False

    overlap = query_terms & evidence_terms
    min_count = 2 if len(query_terms) >= 3 else 1
    return bool(overlap) and len(overlap) >= min_count and len(overlap) / len(query_terms) >= 0.25

def _filter_supported_chunks(query: str, retrieved_chunks: list[RetrievedChunk], citations: list[RagCitation]) -> tuple[list[RetrievedChunk], list[RagCitation]]:
    supported = [chunk for chunk in retrieved_chunks if _has_evidence_overlap(query, chunk)]
    supported_sections = {f"{item.chunk.legal_basis}_{item.chunk.page_or_section}" for item in supported}
    supported_citations = [citation for citation in citations if f"{citation.legal_basis}_{citation.section}" in supported_sections]
    return supported, supported_citations

def _display_source(citation: RagCitation) -> str:
    basis = citation.legal_basis.strip()
    if basis and "nguồn dẫn trong từng bản ghi" not in basis.casefold():
        return basis
    return citation.section or citation.source

def build_claim_citations(retrieved_chunks: list[RetrievedChunk], query: str = "") -> list[RagCitation]:
    citations: list[RagCitation] = []
    seen_chunks = set()

    for r in retrieved_chunks:
        c = r.chunk
        if c.chunk_id in seen_chunks:
            continue
        seen_chunks.add(c.chunk_id)

        lines = [line.strip() for line in c.content.split("\n") if line.strip() and not line.startswith("#")]
        excerpt_text = " ".join(lines[:3]).strip() or c.title
        from app.services.copilot_drug_citation_helper import truncate_clinical_excerpt
        excerpt = truncate_clinical_excerpt(excerpt_text, max_length=240)

        document_url, document_id, _ = resolve_citation_document(
            c.source_doc, c.legal_basis, c.page_or_section, query=""
        )
        if c.source_version is None:
            document_url, document_id = None, None
        page_match = re.search(r"\b(?:page|trang)\s*(\d+)\b", c.page_or_section, re.IGNORECASE)
        document_page = int(page_match.group(1)) if page_match else None
        if document_url and "#page=" in document_url and document_page is None:
            document_url = document_url.split("#page=", 1)[0]
        elif document_url and document_page is not None:
            document_url = f"{document_url.split('#page=', 1)[0]}#page={document_page}"
        citations.append(RagCitation(
            source=c.source_doc,
            legal_basis=c.legal_basis,
            section=c.page_or_section,
            excerpt=excerpt,
            relevance_score=min(1.0, r.score * 30.0),
            chunk_id=c.chunk_id,
            url=document_url,
            document_id=document_id,
            page=document_page,
            source_id=c.source_id,
            source_version=c.source_version,
        ))
    return citations


def render_validated_claims(claims, evidence_records: list[dict], *, inference_required: bool) -> tuple[str | None, list, set[str]]:
    """Render only claim objects explicitly verified against prompt evidence."""
    from app.schemas.copilot import AnswerClaim

    evidence_by_id = {item.get("evidence_id"): item for item in evidence_records if item.get("evidence_id")}
    accepted = [
        claim if isinstance(claim, AnswerClaim) else AnswerClaim.model_validate(claim)
        for claim in claims
        if (claim.support_status if isinstance(claim, AnswerClaim) else claim.get("support_status")) == "supported"
    ]
    accepted = [
        claim for claim in accepted
        if claim.evidence_ids and all(evidence_id in evidence_by_id for evidence_id in claim.evidence_ids)
    ]
    if not accepted:
        return None, [], set()
    parts = [claim.text.strip() for claim in accepted if claim.text.strip()]
    if not parts:
        return None, [], set()
    answer = "\n\n".join(parts)
    if inference_required or any(claim.claim_type == "evidence_inference" for claim in accepted):
        answer = f"**Chỉ mang tính tham khảo.**\n\n{answer}"
    if any(
        claim.support_status != "supported" for claim in claims
    ):
        answer += "\n\nMột số ý chưa đủ căn cứ trong tài liệu được truy xuất nên đã được lược bỏ."
    used_evidence_ids = {evidence_id for claim in accepted for evidence_id in claim.evidence_ids}
    return answer, accepted, used_evidence_ids

def format_grounded_answer(
    query: str,
    retrieved_chunks: list[RetrievedChunk],
    citations: list[RagCitation],
    kg_data: dict,
    llm_generated_text: str | None = None,
    inference_required: bool = False,
) -> RagResult:
    retrieved_chunks, citations = _filter_supported_chunks(query, retrieved_chunks, citations)
    if not retrieved_chunks:
        return RagResult(
            query=query,
            answer="Chưa tìm thấy tài liệu đủ phù hợp để trả lời chính xác câu hỏi này. Vui lòng nêu rõ tên thuốc, nội dung cần tra cứu hoặc văn bản liên quan.",
            citations=[], retrieved_chunks=[], kg_entities=[],
            confidence_score=0.0, legal_basis="", rag_grounded=False,
        )

    if retrieved_chunks and all(r.chunk.entity_type == "ddi" for r in retrieved_chunks):
        asks_about_interactions = any(term in query.casefold() for term in (
            "tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng",
            "kết hợp", "uống chung", "dùng chung", "cặp thuốc"
        ))
        if not asks_about_interactions:
            retrieved_chunks = []
            citations = []

    if llm_generated_text and len(llm_generated_text.strip()) > 30:
        clean_text = llm_generated_text.strip()
        if not citations:
            return RagResult(
                query=query,
                answer="Chưa thể xác minh từng khẳng định với mã đoạn nguồn cụ thể. Vui lòng thử lại hoặc kiểm tra tài liệu đã lập chỉ mục.",
                citations=[], retrieved_chunks=[], kg_entities=kg_data.get("kg_entities", []),
                confidence_score=0.0, legal_basis="", rag_grounded=False,
                critique_verdict="NOT_RUN",
            )
        if inference_required and "chỉ mang tính tham khảo" not in clean_text.casefold():
            clean_text = f"**Chỉ mang tính tham khảo.**\n\n{clean_text}"
        primary_basis = citations[0].legal_basis
        return RagResult(
            query=query,
            answer=clean_text,
            citations=citations,
            retrieved_chunks=retrieved_chunks,
            kg_entities=kg_data.get("kg_entities", []),
            confidence_score=min(0.75, max(0.3, 0.3 + len(_normalize_terms(query) & _normalize_terms(retrieved_chunks[0].chunk.title + " " + retrieved_chunks[0].chunk.content)) * 0.08)),
            legal_basis=primary_basis,
            rag_grounded=True
        )

    top_chunk = retrieved_chunks[0].chunk if retrieved_chunks else None
    if not top_chunk:
        return RagResult(
            query=query,
            answer="Chưa tìm thấy tài liệu đủ phù hợp để trả lời chính xác câu hỏi này. Bạn có thể nêu tên thuốc hoặc chi tiết muốn tra cứu.",
            citations=[],
            retrieved_chunks=[],
            kg_entities=[],
            confidence_score=0.2,
            legal_basis="Dược Thư Quốc Gia"
        )

    parts: list[str] = []
    if kg_data.get("graph_context_text"):
        parts.append(kg_data["graph_context_text"])
    elif kg_data.get("active_ddi_alerts"):
        for alert in kg_data["active_ddi_alerts"]:
            parts.append(
                f"⚠️ **CẢNH BÁO TƯƠNG TÁC THUỐC CHỐNG CHỈ ĐỊNH ({alert['severity']}):**\n"
                f"- **Cặp hoạt chất:** {alert['drug_a']} + {alert['drug_b']}\n"
                f"- **Cơ chế:** {alert['mechanism']}\n"
                f"- **Hậu quả lâm sàng:** {alert['consequence']}"
            )

    if kg_data.get("contra_warnings"):
        contra_str = "\n".join([f"- {w}" for w in kg_data["contra_warnings"]])
        parts.append(f"🛑 **LƯU Ý AN TOÀN LÂM SÀNG & BỆNH NỀN:**\n{contra_str}")

    parts.append(top_chunk.content)
    if inference_required:
        parts.insert(0, "**Chỉ mang tính tham khảo.** Chưa thể tổng hợp suy luận; dưới đây là dữ kiện được tìm thấy trong nguồn.")
    primary_basis = top_chunk.legal_basis or (citations[0].legal_basis if citations else "")

    return RagResult(
        query=query,
        answer="\n\n".join(parts),
        citations=citations,
        retrieved_chunks=retrieved_chunks,
        kg_entities=kg_data.get("kg_entities", []),
        confidence_score=min(0.75, max(0.3, 0.3 + len(_normalize_terms(query) & _normalize_terms(retrieved_chunks[0].chunk.title + " " + retrieved_chunks[0].chunk.content)) * 0.08)),
        legal_basis=primary_basis,
        rag_grounded=bool(citations)
    )
