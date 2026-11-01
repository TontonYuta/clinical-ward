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
        lower_query = query.casefold()
        asks_about_interactions = any(term in lower_query for term in (
            "tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng",
            "kết hợp", "uống chung", "dùng chung", "cặp thuốc"
        ))
        from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
        mentioned_drug_aliases = [
            alias
            for entry in DRUG_REGISTRY.values()
            for alias in entry.get("aliases", [])
            if len(alias) >= 4 and alias in lower_query
        ]
        names_known_drugs = bool(mentioned_drug_aliases)
        # Common symptom words inside an adverse-event description must not
        # retrieve DDI evidence unless the user asks about an interaction and
        # names at least one medicine.
        mentions_multiple_known_drugs = sum(any(alias in lower_query for alias in entry.get("aliases", []) if len(alias) >= 4) for entry in DRUG_REGISTRY.values()) >= 2
        allow_ddi = names_known_drugs and (asks_about_interactions or mentions_multiple_known_drugs)

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

        # DDI chunks are omitted unless a query names a known drug and either
        # asks about interactions or explicitly names a second known medicine.
        if not allow_ddi:
            allowed_ids = {c.chunk_id for c in self.all_chunks if c.entity_type != "ddi"}
            bm25_rank_map = {cid: rank for cid, rank in bm25_rank_map.items() if cid in allowed_ids}
            dense_rank_map = {cid: rank for cid, rank in dense_rank_map.items() if cid in allowed_ids}

        # 3. Thuật toán Hợp nhất Xếp hạng Nghịch đảo (Reciprocal Rank Fusion - RRF k=60)
        chunk_map: dict[str, RagChunk] = {c.chunk_id: c for c in self.all_chunks}
        all_candidate_ids = set(bm25_rank_map.keys()).union(dense_rank_map.keys())

        if not all_candidate_ids:
            return []

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

            # When a question names a medicine, prioritize evidence about that
            # medicine over unrelated monographs matching generic clinical terms.
            chunk_text = f"{chunk.title} {chunk.content} {' '.join(chunk.keywords)}".casefold()
            named_drug_match = any(alias in chunk_text for alias in mentioned_drug_aliases)
            if named_drug_match:
                rrf_score += 0.05
                reasons.append("Explicit named medicine match")

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
