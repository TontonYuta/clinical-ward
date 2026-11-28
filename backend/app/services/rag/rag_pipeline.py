"""
Clinical Pure RAG Pipeline Coordinator
Điều phối toàn diện: Query -> KG Expansion -> Hybrid RRF -> Context Packing -> LLM Grounding -> Claim Verification
"""
from typing import Optional
import time

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
    stream_grounded_response,
    synthesize_grounded_response,
    verify_and_finalize_claims,
)
from app.services.rag.rag_context_builder import build_evidence_context
from app.services.rag.types import RagResult

_INITIAL_HYBRID_RETRIEVER_CLS = HybridRetriever
_GLOBAL_RETRIEVER: Optional[HybridRetriever] = None
_PREFETCH_CACHE: dict[str, tuple[float, dict, list]] = {}
_PREFETCH_TTL_SEC = 15.0

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
    from app.services.rag import hybrid_retriever as _hr_mod
    if _hr_mod.HybridRetriever is not _INITIAL_HYBRID_RETRIEVER_CLS:
        return _hr_mod.HybridRetriever()
    if _GLOBAL_RETRIEVER is None:
        _GLOBAL_RETRIEVER = HybridRetriever()
    return _GLOBAL_RETRIEVER


def reload_rag_retriever() -> HybridRetriever:
    """Tải lại HybridRetriever và xóa cache manifest + prefetch khi có tài liệu PDF mới được nạp hoặc xóa."""
    global _GLOBAL_RETRIEVER
    import gc
    from app.config import trim_process_memory
    from app.services.rag.source_resolver import reload_source_documents
    reload_source_documents()
    _PREFETCH_CACHE.clear()
    _GLOBAL_RETRIEVER = None
    gc.collect()
    trim_process_memory()
    _GLOBAL_RETRIEVER = HybridRetriever()
    return _GLOBAL_RETRIEVER


def _prefetch_key(query: str, patient_info: Optional[dict]) -> str:
    return f"{(query or '').strip().lower()}|{bool(patient_info)}"


async def prefetch_clinical_rag_evidence(
    query: str,
    *,
    patient_info: Optional[dict] = None,
) -> tuple[dict, list]:
    """
    Speculative parallel prefetch: warm KG expansion + Hybrid RRF retrieval concurrently
    with upstream NLU routing so subsequent RAG execution reuses results in <1ms.
    """
    key = _prefetch_key(query, patient_info)
    now = time.monotonic()
    cached = _PREFETCH_CACHE.get(key)
    if cached and (now - cached[0]) <= _PREFETCH_TTL_SEC:
        return cached[1], cached[2]

    retriever = get_rag_retriever()
    budget_cfg = classify_query_complexity(query)
    kg_data = expand_clinical_graph(query, patient_info=patient_info) if budget_cfg.include_graph else {}
    retrieved_chunks = await _retrieve_with_correction(
        retriever,
        query,
        budget_cfg.top_k,
        kg_entities=kg_data.get("kg_entities", []) if kg_data else [],
    )
    if len(_PREFETCH_CACHE) >= 16:
        oldest = min(_PREFETCH_CACHE.keys(), key=lambda k: _PREFETCH_CACHE[k][0])
        _PREFETCH_CACHE.pop(oldest, None)
    _PREFETCH_CACHE[key] = (time.monotonic(), kg_data, retrieved_chunks)
    return kg_data, retrieved_chunks


def _pop_prefetched(query: str, patient_info: Optional[dict]) -> Optional[tuple[dict, list]]:
    key = _prefetch_key(query, patient_info)
    item = _PREFETCH_CACHE.pop(key, None)
    if item and (time.monotonic() - item[0]) <= _PREFETCH_TTL_SEC:
        return item[1], item[2]
    return None


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

    prefetched = _pop_prefetched(query, patient_info)
    if prefetched is not None:
        kg_data, retrieved_chunks = prefetched
    else:
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


async def execute_clinical_rag_stream(
    query: str,
    patient_info: Optional[dict] = None,
    user_role: str = "nurse",
    api_key: Optional[str] = None,
    conversation_context: str = "",
    inference_required: bool = False,
):
    """
    True Live Token Streaming for Grounded Clinical RAG.
    Yields:
      - ("status", (phase, label))
      - ("token", safe_delta) screened in real-time by StreamingOutputGuardrail
      - ("done", RagResult) fully verified against claims & citations
    """
    from app.security.output_guardrail import StreamingOutputGuardrail

    retriever = get_rag_retriever()
    budget_cfg = classify_query_complexity(query)

    yield ("status", ("retrieving", "Đang tra cứu Dược thư, Thông tư & Đồ thị Tri thức..."))
    prefetched = _pop_prefetched(query, patient_info)
    if prefetched is not None:
        kg_data, retrieved_chunks = prefetched
    else:
        kg_data = expand_clinical_graph(query, patient_info=patient_info) if budget_cfg.include_graph else {}
        retrieved_chunks = await _retrieve_with_correction(
            retriever,
            query,
            budget_cfg.top_k,
            kg_entities=kg_data.get("kg_entities", []) if kg_data else [],
        )

    ctx = build_evidence_context(
        retrieved_chunks,
        kg_data,
        include_graph=budget_cfg.include_graph,
        max_context_chars=budget_cfg.max_context_chars,
    )
    citations = build_claim_citations(ctx.selected_chunks, query=query)

    raw_chunks: list[str] = []
    if ctx.selected_chunks:
        yield ("status", ("synthesizing", "Đang tổng hợp lâm sàng & đối chiếu trích dẫn..."))
        stream_guard = StreamingOutputGuardrail(
            stop_markers=("<answer_claims", "<follow_up_questions", "```json"),
            hold_chars=160,
        )
        async for delta in stream_grounded_response(
            query=query,
            user_role=user_role,
            conversation_context=conversation_context,
            evidence_context=ctx.evidence_context,
            ddi_alert_context=ctx.ddi_alert_context,
            api_key=api_key,
            default_api_key=getattr(settings, "GEMINI_API_KEY", "") or "",
        ):
            raw_chunks.append(delta)
            if stream_guard.tripped or stream_guard.stopped_at_marker:
                continue
            safe_emit, tripped = stream_guard.feed(delta)
            if not tripped and safe_emit:
                yield ("token", safe_emit)

        tail_emit = stream_guard.flush()
        if tail_emit:
            yield ("token", tail_emit)

    llm_answer = "".join(raw_chunks).strip() or None
    if llm_answer is None and ctx.selected_chunks:
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
    rag_res = format_grounded_answer(
        query=query,
        retrieved_chunks=ctx.selected_chunks,
        citations=citations,
        kg_data={**kg_data, "graph_context_text": ctx.graph_text_for_audit},
        llm_generated_text=answer_text,
        inference_required=inference_required,
    )
    final_res = verify_and_finalize_claims(
        rag_res,
        query=query,
        answer_text=answer_text,
        generated_claims=generated_claims,
        evidence_records=ctx.evidence_records,
        inference_required=inference_required,
    )
    yield ("done", final_res)
