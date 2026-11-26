"""
Clinical Pure RAG Pipeline Coordinator
Điều phối toàn diện: Query -> KG Expansion -> Hybrid RRF -> Context Packing -> LLM Grounding -> Claim Verification
"""
from typing import Optional

from app.config import settings
from app.services.rag.adaptive_retriever import classify_query_complexity
from app.services.rag.citation_grounder import (
    build_claim_citations,
    format_grounded_answer,
    is_evidence_relevant,
    render_validated_claims,
)
from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.rag.knowledge_graph import expand_clinical_graph
from app.services.rag.rag_claim_grounding import (
    build_extractive_summary as _build_extractive_summary,
    parse_answer_claims as _parse_answer_claims,
    source_fact_claims as _source_fact_claims,
    synthesize_grounded_response,
    verify_and_finalize_claims,
)
from app.services.rag.rag_context_builder import build_evidence_context
from app.services.rag.types import RagResult

_GLOBAL_RETRIEVER: Optional[HybridRetriever] = None

MAX_CORRECTIVE_TOP_K_MULTIPLIER = 2


async def _retrieve_with_correction(retriever, query: str, top_k: int, kg_entities=None):
    """Run one bounded same-query retrieval expansion when first-pass evidence is weak."""
    retrieval_kwargs = {"kg_entities": kg_entities or []}
    initial = await retriever.retrieve_async(query=query, top_k=top_k, **retrieval_kwargs)
    initially_relevant = [item for item in initial if is_evidence_relevant(query, item)]
    if initially_relevant:
        return initially_relevant

    corpus_size = len(getattr(retriever, "all_chunks", ()) or ())
    expanded_top_k = max(top_k + 1, top_k * MAX_CORRECTIVE_TOP_K_MULTIPLIER)
    if corpus_size:
        expanded_top_k = min(expanded_top_k, corpus_size)
    if expanded_top_k <= top_k:
        return initially_relevant
    expanded = await retriever.retrieve_async(query=query, top_k=expanded_top_k, **retrieval_kwargs)
    unique = {}
    for item in [*initial, *expanded]:
        unique.setdefault(item.chunk.chunk_id, item)
    return [item for item in unique.values() if is_evidence_relevant(query, item)]


def get_rag_retriever() -> HybridRetriever:
    global _GLOBAL_RETRIEVER
    if _GLOBAL_RETRIEVER is None:
        _GLOBAL_RETRIEVER = HybridRetriever()
    return _GLOBAL_RETRIEVER


def reload_rag_retriever() -> HybridRetriever:
    """Tải lại HybridRetriever và xóa cache manifest khi có tài liệu PDF mới được nạp hoặc xóa."""
    global _GLOBAL_RETRIEVER
    from app.services.rag.source_resolver import reload_source_documents
    reload_source_documents()
    _GLOBAL_RETRIEVER = HybridRetriever()
    return _GLOBAL_RETRIEVER


async def execute_clinical_rag(
    query: str,
    patient_info: Optional[dict] = None,
    user_role: str = "nurse",
    api_key: Optional[str] = None,
    conversation_context: str = "",
    inference_required: bool = False,
) -> RagResult:
    """Execute end-to-end grounded clinical RAG orchestration."""
    retriever = get_rag_retriever()
    budget_cfg = classify_query_complexity(query)

    # 1. Knowledge Graph expansion (LightRAG / MedGraphRAG Layer)
    kg_data = expand_clinical_graph(query, patient_info=patient_info) if budget_cfg.include_graph else {}

    # 2. Hybrid Retrieval with bounded single-pass correction
    retrieved_chunks = await _retrieve_with_correction(
        retriever,
        query,
        budget_cfg.top_k,
        kg_entities=kg_data.get("kg_entities", []) if kg_data else [],
    )

    # 3. Context packing within budget + claim citations
    ctx = build_evidence_context(
        retrieved_chunks,
        kg_data,
        include_graph=budget_cfg.include_graph,
        max_context_chars=budget_cfg.max_context_chars,
    )
    citations = build_claim_citations(ctx.selected_chunks, query=query)

    # 4. Grounded LLM synthesis + claim extraction
    llm_answer = await synthesize_grounded_response(
        query=query,
        user_role=user_role,
        conversation_context=conversation_context,
        evidence_context=ctx.evidence_context,
        ddi_alert_context=ctx.ddi_alert_context,
        api_key=api_key,
        default_api_key=getattr(settings, "GEMINI_API_KEY", "") or "",
    )
    answer_text, generated_claims = _parse_answer_claims(
        llm_answer,
        {record.evidence_id for record in ctx.evidence_records},
    )

    # 5. Package initial result, verify claim grounding, and finalize
    rag_res = format_grounded_answer(
        query=query,
        retrieved_chunks=ctx.selected_chunks,
        citations=citations,
        kg_data={**kg_data, "graph_context_text": ctx.graph_text_for_audit},
        llm_generated_text=answer_text,
        inference_required=inference_required,
    )
    return verify_and_finalize_claims(
        rag_res,
        query=query,
        answer_text=answer_text,
        generated_claims=generated_claims,
        evidence_records=ctx.evidence_records,
        inference_required=inference_required,
    )
