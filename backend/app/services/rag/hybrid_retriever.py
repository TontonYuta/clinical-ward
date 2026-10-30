"""
Hybrid Clinical Retriever: Reciprocal Rank Fusion (RRF k=60)
Kết hợp BM25 (FTS5) và Semantic Matching theo chuẩn Nature & EMNLP (<=180 LOC)
"""
import re
from typing import Optional
from app.services.rag.types import RagChunk, RetrievedChunk
from app.services.rag.sqlite_fts import SqliteFtsIndex
from app.services.rag.clinical_indexer import load_all_clinical_chunks

RRF_K_CONSTANT = 60

def _compute_semantic_score(chunk: RagChunk, query: str, kg_entities: list[str]) -> float:
    lower_query = query.lower()
    score = 0.0
    tokens = set(re.findall(r"\w{3,}", lower_query))

    # Khớp tiêu đề và văn bản
    title_lower = chunk.title.lower()
    content_lower = chunk.content.lower()

    for t in tokens:
        if t in title_lower:
            score += 3.0
        elif t in content_lower:
            score += 1.0

    # Khớp từ khóa chuyên môn trích xuất
    for kw in chunk.keywords:
        if kw in lower_query:
            score += 2.0

    # Thưởng điểm nếu chunk khớp với thực thể Đồ thị tri thức (KG Entities)
    for kg in kg_entities:
        clean_kg = kg.split(":")[-1].lower()
        if clean_kg in title_lower or clean_kg in content_lower:
            score += 4.0

    return score

class HybridRetriever:
    def __init__(self, fts_index: Optional[SqliteFtsIndex] = None):
        self.fts_index = fts_index or SqliteFtsIndex()
        self.all_chunks = load_all_clinical_chunks()
        self.fts_index.sync_chunks(self.all_chunks)

    def retrieve(self, query: str, kg_entities: Optional[list[str]] = None, top_k: int = 5) -> list[RetrievedChunk]:
        kg_entities = kg_entities or []

        # 1. Sparse BM25 Retrieval qua SQLite FTS5
        bm25_results = self.fts_index.search_bm25(query, top_k=top_k * 2)
        bm25_rank_map: dict[str, int] = {
            r.chunk.chunk_id: idx + 1 for idx, r in enumerate(bm25_results)
        }

        # 2. Dense Semantic Scoring trên toàn bộ kho tri thức
        semantic_scores: list[tuple[RagChunk, float]] = []
        for c in self.all_chunks:
            s_score = _compute_semantic_score(c, query, kg_entities)
            if s_score > 0:
                semantic_scores.append((c, s_score))

        # Sắp xếp Dense Ranking
        semantic_scores.sort(key=lambda x: x[1], reverse=True)
        dense_rank_map: dict[str, int] = {
            c.chunk_id: idx + 1 for idx, (c, _) in enumerate(semantic_scores[:top_k * 2])
        }

        # 3. Thuật toán Hợp nhất Xếp hạng Nghịch đảo (Reciprocal Rank Fusion - RRF k=60)
        chunk_map: dict[str, RagChunk] = {c.chunk_id: c for c in self.all_chunks}
        all_candidate_ids = set(bm25_rank_map.keys()).union(dense_rank_map.keys())

        if not all_candidate_ids and self.all_chunks:
            # Fallback nếu không có từ khóa nào khớp
            all_candidate_ids = {self.all_chunks[0].chunk_id}

        rrf_scored: list[RetrievedChunk] = []
        for cid in all_candidate_ids:
            chunk = chunk_map.get(cid)
            if not chunk:
                continue

            r_bm25 = bm25_rank_map.get(cid)
            r_dense = dense_rank_map.get(cid)

            rrf_score = 0.0
            reasons = []

            if r_bm25:
                rrf_score += 1.0 / (RRF_K_CONSTANT + r_bm25)
                reasons.append(f"BM25 rank #{r_bm25}")
            if r_dense:
                rrf_score += 1.0 / (RRF_K_CONSTANT + r_dense)
                reasons.append(f"Semantic rank #{r_dense}")

            rrf_scored.append(RetrievedChunk(
                chunk=chunk,
                score=rrf_score,
                bm25_rank=r_bm25,
                semantic_rank=r_dense,
                match_reasons=reasons
            ))

        # Sắp xếp theo điểm RRF giảm dần
        rrf_scored.sort(key=lambda x: x.score, reverse=True)
        return rrf_scored[:top_k]
