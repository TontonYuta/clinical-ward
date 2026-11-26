"""Context packing and budget filtering for the Clinical RAG pipeline."""
from dataclasses import dataclass
from typing import Any

from app.services.rag.types import EvidenceRecord


@dataclass
class BuiltEvidenceContext:
    """Packed prompt context and aligned backend evidence records."""

    evidence_context: str
    ddi_alert_context: str
    graph_text_for_audit: str
    selected_chunks: list[Any]
    evidence_records: list[EvidenceRecord]


def build_evidence_context(
    retrieved_chunks: list[Any],
    kg_data: dict[str, Any] | None,
    *,
    include_graph: bool,
    max_context_chars: int,
) -> BuiltEvidenceContext:
    """Pack graph and document chunks into a prompt context within `max_context_chars`."""
    kg = kg_data or {}
    evidence_records: list[EvidenceRecord] = []
    evidence_blocks: list[str] = []
    selected_chunks: list[Any] = []
    graph_text_for_audit = ""

    if include_graph and kg.get("graph_context_text"):
        graph_block = (
            "=== [ĐỒ THỊ TƯƠNG TÁC DƯỢC LÝ & AN TOÀN ĐIỀU TRỊ] ===\n"
            + kg["graph_context_text"]
        )
        if len(graph_block) <= max_context_chars:
            evidence_blocks.append(graph_block)
            graph_text_for_audit = kg["graph_context_text"]
            evidence_records.append(EvidenceRecord(
                evidence_id=f"graph:{kg.get('graph_source', 'curated-clinical-graph')}",
                evidence_type="knowledge_graph",
                source_id=kg.get("graph_source", "curated-clinical-graph"),
                source_version=kg.get("graph_version", "unversioned"),
                content=kg["graph_context_text"],
            ))

    doc_scores = [
        item.score for item in retrieved_chunks
        if not str(item.chunk.entity_type or "").startswith("graph_")
    ]
    top_doc_score = (
        max(doc_scores) if doc_scores
        else (retrieved_chunks[0].score if retrieved_chunks else 0.0)
    )

    for idx, r in enumerate(retrieved_chunks):
        is_graph = str(r.chunk.entity_type or "").startswith("graph_")
        if idx > 0 and not is_graph and top_doc_score > 0 and r.score < top_doc_score * 0.45:
            continue
        block = (
            f"=== [CHỨNG CỨ #{idx+1}] Mã: {r.chunk.chunk_id} | Nguồn: {r.chunk.source_doc} "
            f"| Căn cứ: {r.chunk.legal_basis} | Mục: {r.chunk.page_or_section} ===\n"
            f"{r.chunk.content}"
        )
        separator = "\n\n" if evidence_blocks else ""
        used_chars = sum(map(len, evidence_blocks)) + len(separator)
        if used_chars + len(block) > max_context_chars:
            remaining = max_context_chars - used_chars
            if not selected_chunks and remaining >= 300:
                block = block[:remaining - 3].rstrip() + "..."
            else:
                continue
        evidence_blocks.append(block)
        selected_chunks.append(r)
        evidence_records.append(EvidenceRecord(
            evidence_id=f"document:{r.chunk.chunk_id}",
            evidence_type="document_chunk",
            source_id=r.chunk.source_id or r.chunk.source_doc,
            source_version=r.chunk.source_version,
            content=r.chunk.content,
            chunk_id=r.chunk.chunk_id,
            source_name=r.chunk.source_doc,
            section=r.chunk.page_or_section,
        ))

    # The model may refer only to evidence blocks actually included in its context.
    annotated_blocks = [
        block.replace(
            block.splitlines()[0],
            f"{block.splitlines()[0]}\nMã chứng cứ backend: {record.evidence_id}",
            1,
        )
        for block, record in zip(evidence_blocks, evidence_records)
    ]

    ddi_alert_context = ""
    if include_graph and kg.get("active_ddi_alerts") and graph_text_for_audit:
        alerts = [
            f"- {a['drug_a']} + {a['drug_b']}: {a['severity']}. "
            f"Cơ chế: {a['mechanism']}. Hậu quả: {a['consequence']}"
            for a in kg["active_ddi_alerts"]
        ]
        ddi_alert_context = (
            "\n\n[CẢNH BÁO TƯƠNG TÁC THUỐC TỪ ĐỒ THỊ TRI THỨC]:\n"
            + "\n".join(alerts)
        )

    return BuiltEvidenceContext(
        evidence_context="\n\n".join(annotated_blocks),
        ddi_alert_context=ddi_alert_context,
        graph_text_for_audit=graph_text_for_audit,
        selected_chunks=selected_chunks,
        evidence_records=evidence_records,
    )
