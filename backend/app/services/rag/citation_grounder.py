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
}

def _normalize_terms(text: str) -> set[str]:
    accented = {w for w in re.findall(r"[\w]+", text.casefold()) if len(w) >= 2 and w not in _QUERY_STOPWORDS}
    norm = unicodedata.normalize("NFKD", text.casefold())
    unaccented = "".join(char for char in norm if not unicodedata.combining(char)).replace("đ", "d")
    unacc_words = {w for w in re.findall(r"[a-z0-9]+", unaccented) if len(w) >= 3 and w not in _QUERY_STOPWORDS}
    return accented | unacc_words

def _has_evidence_overlap(query: str, chunk: RetrievedChunk) -> bool:
    query_terms = _normalize_terms(query)
    evidence_terms = _normalize_terms(" ".join([chunk.chunk.title, chunk.chunk.content, *chunk.chunk.keywords]))
    if not query_terms or not evidence_terms:
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

def build_claim_citations(retrieved_chunks: list[RetrievedChunk]) -> list[RagCitation]:
    citations: list[RagCitation] = []
    seen_sections = set()

    for r in retrieved_chunks:
        c = r.chunk
        sec_key = f"{c.legal_basis}_{c.page_or_section}"
        if sec_key in seen_sections:
            continue
        seen_sections.add(sec_key)

        lines = [line.strip() for line in c.content.split("\n") if line.strip() and not line.startswith("#")]
        excerpt_text = " ".join(lines[:3]).strip() or c.title
        excerpt = excerpt_text if len(excerpt_text) <= 240 else excerpt_text[:239].rstrip() + "…"

        document_url, document_id, document_page = resolve_citation_document(c.source_doc, c.legal_basis, c.page_or_section)
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
        ))
    return citations

def format_grounded_answer(
    query: str,
    retrieved_chunks: list[RetrievedChunk],
    citations: list[RagCitation],
    kg_data: dict,
    llm_generated_text: str | None = None
) -> RagResult:
    retrieved_chunks, citations = _filter_supported_chunks(query, retrieved_chunks, citations)
    if not retrieved_chunks:
        return RagResult(
            query=query,
            answer="Chưa tìm thấy tài liệu đủ phù hợp để trả lời chính xác câu hỏi này. Vui lòng nêu rõ tên thuốc, nội dung cần tra cứu hoặc văn bản liên quan.",
            citations=[], retrieved_chunks=[], kg_entities=[],
            confidence_score=0.1, legal_basis="", rag_grounded=False,
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
        primary_basis = citations[0].legal_basis if citations else "Dược Thư Quốc Gia Việt Nam"
        return RagResult(
            query=query,
            answer=clean_text,
            citations=citations,
            retrieved_chunks=retrieved_chunks,
            kg_entities=kg_data.get("kg_entities", []),
            confidence_score=min(0.75, max(0.3, 0.3 + len(_normalize_terms(query) & _normalize_terms(retrieved_chunks[0].chunk.title + " " + retrieved_chunks[0].chunk.content)) * 0.08)),
            legal_basis=primary_basis
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
    if kg_data.get("active_ddi_alerts"):
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
    primary_basis = top_chunk.legal_basis or (citations[0].legal_basis if citations else "")

    return RagResult(
        query=query,
        answer="\n\n".join(parts),
        citations=citations,
        retrieved_chunks=retrieved_chunks,
        kg_entities=kg_data.get("kg_entities", []),
        confidence_score=min(0.75, max(0.3, 0.3 + len(_normalize_terms(query) & _normalize_terms(retrieved_chunks[0].chunk.title + " " + retrieved_chunks[0].chunk.content)) * 0.08)),
        legal_basis=primary_basis
    )
