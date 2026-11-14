"""
Clinical RAG Data Types & Schemas
Chuẩn hóa mô hình dữ liệu cho RAG Lâm sàng Y tế
"""
from dataclasses import dataclass, field
from typing import Optional, Any

def filter_evidence_for_citations(evidence: list[dict], citations: list[dict]) -> list[dict]:
    cited_chunk_ids = {item.get("chunk_id") for item in citations if item.get("chunk_id")}
    return [
        item for item in evidence
        if item.get("evidence_type") != "document_chunk"
        or item.get("chunk_id") in cited_chunk_ids
    ]

@dataclass
class RagChunk:
    chunk_id: str
    source_doc: str
    legal_basis: str
    page_or_section: str
    title: str
    content: str
    keywords: list[str] = field(default_factory=list)
    entity_type: str = "general"
    source_id: Optional[str] = None
    source_version: Optional[str] = None

@dataclass
class RetrievedChunk:
    chunk: RagChunk
    score: float
    bm25_rank: Optional[int] = None
    semantic_rank: Optional[int] = None
    match_reasons: list[str] = field(default_factory=list)

@dataclass
class RagCitation:
    source: str
    legal_basis: str
    section: str
    excerpt: str
    relevance_score: float = 1.0
    chunk_id: str = ""
    url: Optional[str] = None
    document_id: Optional[str] = None
    page: Optional[int] = None
    source_id: Optional[str] = None
    source_version: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "legal_basis": self.legal_basis,
            "section": self.section,
            "excerpt": self.excerpt,
            "relevance_score": round(self.relevance_score, 3),
            "chunk_id": self.chunk_id,
            "url": self.url,
            "document_id": self.document_id,
            "page": self.page,
            "source_id": self.source_id,
            "source_version": self.source_version,
        }

@dataclass
class EvidenceRecord:
    evidence_id: str
    evidence_type: str
    source_id: str
    source_version: Optional[str]
    content: str
    chunk_id: Optional[str] = None
    source_name: Optional[str] = None
    section: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "evidence_id": self.evidence_id,
            "evidence_type": self.evidence_type,
            "source_id": self.source_id,
            "source_version": self.source_version,
            "content": self.content,
            "chunk_id": self.chunk_id,
            "source_name": self.source_name,
            "section": self.section,
        }

@dataclass
class RagResult:
    query: str
    answer: str
    citations: list[RagCitation] = field(default_factory=list)
    retrieved_chunks: list[RetrievedChunk] = field(default_factory=list)
    kg_entities: list[str] = field(default_factory=list)
    confidence_score: float = 0.0
    legal_basis: str = ""
    rag_grounded: bool = False
    factuality_score: float = 0.0
    hallucination_rate: float = 0.0
    critique_verdict: str = "NOT_RUN"
    claims_audit: list[dict] = field(default_factory=list)
    cdss_alert: Optional[dict] = None
    evidence: list[dict] = field(default_factory=list)
    claims: list[Any] = field(default_factory=list)
    evidence_claim_map: dict[str, list[str]] = field(default_factory=dict)

    def to_response_dict(self) -> dict:
        response_evidence = filter_evidence_for_citations(
            self.evidence, [citation.to_dict() for citation in self.citations]
        )
        return {
            "query": self.query,
            "answer": self.answer,
            "citations": [c.to_dict() for c in self.citations],
            "kg_entities": self.kg_entities,
            "confidence_score": self.confidence_score,
            "legal_basis": self.legal_basis,
            "rag_grounded": self.rag_grounded,
            "factuality_score": self.factuality_score,
            "hallucination_rate": self.hallucination_rate,
            "critique_verdict": self.critique_verdict,
            "claims_audit": self.claims_audit,
            "evidence": response_evidence,
            "claims": [claim.model_dump() if hasattr(claim, "model_dump") else claim for claim in self.claims],
            "evidence_claim_map": self.evidence_claim_map,
        }
