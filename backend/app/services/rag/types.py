"""
Clinical RAG Data Types & Schemas
Chuẩn hóa mô hình dữ liệu cho RAG Lâm sàng Y tế
"""
from dataclasses import dataclass, field
from typing import Optional

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
        }

@dataclass
class RagResult:
    query: str
    answer: str
    citations: list[RagCitation] = field(default_factory=list)
    retrieved_chunks: list[RetrievedChunk] = field(default_factory=list)
    kg_entities: list[str] = field(default_factory=list)
    confidence_score: float = 0.95
    legal_basis: str = ""
    rag_grounded: bool = True
    factuality_score: float = 1.0
    hallucination_rate: float = 0.0
    critique_verdict: str = "PASS"
    claims_audit: list[dict] = field(default_factory=list)
    cdss_alert: Optional[dict] = None

    def to_response_dict(self) -> dict:
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
        }
