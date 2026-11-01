"""
Citation Grounder & PaperQA2 Claim-Level Attribution
Gắn trích dẫn từ chunk có nguồn; không tự suy ra provenance khi thiếu bằng chứng (<=190 LOC)
"""
import re
import unicodedata
from app.services.rag.types import RagCitation, RetrievedChunk, RagResult

_QUERY_STOPWORDS = {
    "bao", "bằng", "biết", "các", "có", "của", "được", "gì", "hãy",
    "không", "là", "làm", "một", "muốn", "nào", "như", "thế",
    "thì", "tôi", "và", "về", "với", "xin", "cho", "hôm", "nay",
}

def _normalize_terms(text: str) -> set[str]:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char)).replace("đ", "d")
    return {term for term in re.findall(r"[a-z0-9]+", normalized) if len(term) > 2 and term not in _QUERY_STOPWORDS}

def _has_evidence_overlap(query: str, chunk: RetrievedChunk) -> bool:
    query_terms = _normalize_terms(query)
    evidence_terms = _normalize_terms(" ".join([chunk.chunk.title, chunk.chunk.content, *chunk.chunk.keywords]))
    if not query_terms or not evidence_terms:
        return False
    overlap = query_terms & evidence_terms
    return bool(overlap) and len(overlap) / len(query_terms) >= 0.25

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

        # Trích đoạn ngắn gọn (excerpt) không quá 180 ký tự
        lines = [line.strip() for line in c.content.split("\n") if line.strip() and not line.startswith("#")]
        excerpt = " ".join(lines[:3])[:180] + "..." if lines else c.title

        citations.append(RagCitation(
            source=c.source_doc,
            legal_basis=c.legal_basis,
            section=c.page_or_section,
            excerpt=excerpt,
            relevance_score=min(1.0, r.score * 30.0),
            chunk_id=c.chunk_id,
        ))
    return citations

def format_grounded_answer(
    query: str,
    retrieved_chunks: list[RetrievedChunk],
    citations: list[RagCitation],
    kg_data: dict,
    llm_generated_text: str | None = None
) -> RagResult:
    # RRF rank scores are relative, not calibrated relevance probabilities.
    # Require lexical topic support before exposing a retrieved passage.
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

    # Nếu có văn bản sinh từ LLM (đã qua grounded prompt), kiểm tra và gắn citations
    if llm_generated_text and len(llm_generated_text.strip()) > 30:
        clean_text = llm_generated_text.strip()
        # Đính kèm danh mục trích dẫn pháp lý vào cuối nếu chưa có
        if "Nguồn:" not in clean_text and citations:
            sources = list(dict.fromkeys(_display_source(c) for c in citations[:3] if _display_source(c)))
            clean_text += f"\n\n**Nguồn:** {', '.join(sources)}"

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

    # Chế độ tất định (Deterministic Grounded Synthesis) khi offline hoặc không có LLM key
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
    # 1. Cảnh báo DDI từ Knowledge Graph nếu có
    if kg_data.get("active_ddi_alerts"):
        for alert in kg_data["active_ddi_alerts"]:
            parts.append(
                f"⚠️ **CẢNH BÁO TƯƠNG TÁC THUỐC CHỐNG CHỈ ĐỊNH ({alert['severity']}):**\n"
                f"- **Cặp hoạt chất:** {alert['drug_a']} + {alert['drug_b']}\n"
                f"- **Cơ chế:** {alert['mechanism']}\n"
                f"- **Hậu quả lâm sàng:** {alert['consequence']}"
            )

    # 2. Cảnh báo cơ quan / suy tạng
    if kg_data.get("contra_warnings"):
        contra_str = "\n".join([f"- {w}" for w in kg_data["contra_warnings"]])
        parts.append(f"🛑 **LƯU Ý AN TOÀN LÂM SÀNG & BỆNH NỀN:**\n{contra_str}")

    # 3. Trích xuất nội dung từ chunk chính
    parts.append(top_chunk.content)

    # 4. Bảng trích dẫn PaperQA2
    if citations:
        sources = list(dict.fromkeys(_display_source(c) for c in citations[:3] if _display_source(c)))
        parts.append(f"**Nguồn:** {', '.join(sources)}")

    full_answer = "\n\n".join(parts)
    primary_basis = top_chunk.legal_basis or (citations[0].legal_basis if citations else "")

    return RagResult(
        query=query,
        answer=full_answer,
        citations=citations,
        retrieved_chunks=retrieved_chunks,
        kg_entities=kg_data.get("kg_entities", []),
        confidence_score=min(0.75, max(0.3, 0.3 + len(_normalize_terms(query) & _normalize_terms(retrieved_chunks[0].chunk.title + " " + retrieved_chunks[0].chunk.content)) * 0.08)),
        legal_basis=primary_basis
    )
