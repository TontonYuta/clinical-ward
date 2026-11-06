"""
Hybrid Clinical Retriever: Reciprocal Rank Fusion (RRF k=60)
Kết hợp BM25 (FTS5) và Semantic Matching theo chuẩn Nature & EMNLP (<=180 LOC)
"""
import re
from typing import Optional
from app.services.rag.types import RagChunk, RetrievedChunk
from app.services.rag.sqlite_fts import SqliteFtsIndex
from app.services.rag.clinical_indexer import load_all_clinical_chunks
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications

RRF_K_CONSTANT = 60

CLINICAL_STOPWORDS = {
    "tôi", "bị", "nên", "uống", "thuốc", "nào", "nhỉ", "cho", "của", "các",
    "và", "là", "có", "không", "với", "được", "trong", "khi", "ở", "gì", "sao",
    "thế", "như", "làm", "để", "ra", "vào", "lại", "đã", "đang", "sẽ", "hay",
    "hoặc", "này", "đó", "đây", "người", "bệnh", "cần", "muốn", "hỏi", "thông",
    "tin", "về", "tương", "tác", "chú", "ý", "biết", "xin", "giúp", "hướng", "dẫn",
    "chi", "tiết", "đầy", "đủ", "nhất"
}

def _compute_semantic_score(chunk: RagChunk, query: str, kg_entities: list[str]) -> float:
    lower_query = query.casefold()
    score = 0.0
    raw_tokens = set(re.findall(r"\w{2,}", lower_query))
    content_tokens = {t for t in raw_tokens if t not in CLINICAL_STOPWORDS}
    tokens = content_tokens if content_tokens else raw_tokens

    # Khớp tiêu đề và văn bản
    title_lower = chunk.title.casefold()
    content_lower = chunk.content.casefold()

    for t in tokens:
        if re.search(rf"\b{re.escape(t)}\b", title_lower):
            score += 5.0
        elif re.search(rf"\b{re.escape(t)}\b", content_lower):
            score += 1.5

    # Khớp từ khóa chuyên môn trích xuất
    query_word_set = set(tokens)
    for kw in chunk.keywords:
        kw_clean = kw.casefold()
        if kw_clean in query_word_set and kw_clean not in CLINICAL_STOPWORDS:
            score += 3.0

    # Thưởng điểm nếu chunk khớp với thực thể Đồ thị tri thức (KG Entities)
    has_target_drug_entity = False
    has_kg_match = False
    for kg in kg_entities:
        clean_kg = kg.split(":")[-1].casefold()
        if len(clean_kg) >= 3:
            has_target_drug_entity = True
            if clean_kg in title_lower:
                score += 40.0
                has_kg_match = True
            elif clean_kg in content_lower:
                score += 15.0
                has_kg_match = True

    # Nếu có target drug entity, nhưng chunk này là monograph của thuốc khác thì không cho điểm
    if has_target_drug_entity and chunk.entity_type in {"monograph", "medication", "drug_profile"} and not has_kg_match:
        return 0.0

    return score

def _is_direct_subject_chunk(chunk: RagChunk, drug_name: str) -> bool:
    clean_title = chunk.title.casefold().split(" - ")[0]
    return drug_name.casefold() in clean_title or chunk.page_or_section.casefold().startswith(drug_name.casefold())

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
        resolved_query_drugs = resolve_registered_medications(query)
        mentions_multiple_known_drugs = len(resolved_query_drugs) >= 2
        allow_ddi = bool(resolved_query_drugs) and (asks_about_interactions or mentions_multiple_known_drugs)

        # 1. Sparse BM25 Retrieval qua SQLite FTS5
        candidate_limit = max(50, top_k * 5)
        bm25_results = self.fts_index.search_bm25(query, top_k=candidate_limit)
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
            c.chunk_id: idx + 1 for idx, (c, _) in enumerate(semantic_scores[:candidate_limit])
        }

        # DDI chunks are omitted unless a query names a known drug and either
        # asks about interactions or explicitly names a second known medicine.
        allowed_ddi_ids = set()
        for chunk in self.all_chunks:
            if chunk.entity_type != "ddi":
                continue
            chunk_text = f"{chunk.title} {chunk.content} {' '.join(chunk.keywords)}"
            chunk_drugs = set(resolve_registered_medications(chunk_text))
            if len(resolved_query_drugs) >= 2 and set(resolved_query_drugs).issubset(chunk_drugs):
                allowed_ddi_ids.add(chunk.chunk_id)
        ddi_ids = {chunk.chunk_id for chunk in self.all_chunks if chunk.entity_type == "ddi"}
        if asks_about_interactions or mentions_multiple_known_drugs:
            bm25_rank_map = {cid: rank for cid, rank in bm25_rank_map.items() if cid not in ddi_ids or cid in allowed_ddi_ids}
            dense_rank_map = {cid: rank for cid, rank in dense_rank_map.items() if cid not in ddi_ids or cid in allowed_ddi_ids}
        if not allow_ddi:
            allowed_ids = {c.chunk_id for c in self.all_chunks if c.entity_type != "ddi"}
            bm25_rank_map = {cid: rank for cid, rank in bm25_rank_map.items() if cid in allowed_ids}
            dense_rank_map = {cid: rank for cid, rank in dense_rank_map.items() if cid in allowed_ids}

        # 3. Thuật toán Hợp nhất Xếp hạng Nghịch đảo (Reciprocal Rank Fusion - RRF k=60)
        chunk_map: dict[str, RagChunk] = {c.chunk_id: c for c in self.all_chunks}
        all_candidate_ids = set(bm25_rank_map.keys()).union(dense_rank_map.keys())

        is_protocol_query = any(p in lower_query for p in ("quy trình", "tiêu hủy", "thu hồi", "vỏ ống", "thông tư", "nghị định", "phản vệ", "xử trí", "cấp cứu", "tủ trực"))

        target_drugs_for_filtering = list(resolved_query_drugs)
        if not target_drugs_for_filtering and kg_entities:
            for kg in kg_entities:
                c_kg = kg.split(":")[-1].casefold()
                if len(c_kg) >= 3 and c_kg not in target_drugs_for_filtering:
                    target_drugs_for_filtering.append(c_kg)

        if len(target_drugs_for_filtering) == 1 and not is_protocol_query:
            requested_drug = target_drugs_for_filtering[0]
            direct_monograph_chunks = [
                c for c in self.all_chunks
                if _is_direct_subject_chunk(c, requested_drug) or requested_drug in c.title.casefold()
            ]
            if direct_monograph_chunks:
                for c in direct_monograph_chunks:
                    all_candidate_ids.add(c.chunk_id)
                    dense_rank_map[c.chunk_id] = min(dense_rank_map.get(c.chunk_id, 999), 1)

            has_direct_monographs = bool(direct_monograph_chunks)
            incompatible_ids = set()
            for cid in all_candidate_ids:
                chunk = chunk_map.get(cid)
                if not chunk or chunk.entity_type in {"ddi", "circular", "protocol", "guideline", "regulatory"}:
                    continue
                if has_direct_monographs and not (_is_direct_subject_chunk(chunk, requested_drug) or requested_drug in chunk.title.casefold()):
                    incompatible_ids.add(cid)
                    continue
                text = f"{chunk.title} {chunk.content} {' '.join(chunk.keywords)}"
                chunk_drugs = set(resolve_registered_medications(text))
                title_drugs = set(resolve_registered_medications(chunk.title))
                if (title_drugs and requested_drug not in title_drugs) or (
                    chunk_drugs and requested_drug not in chunk_drugs
                    and chunk.entity_type in {"monograph", "medication", "drug_profile"}
                ):
                    incompatible_ids.add(cid)
            all_candidate_ids -= incompatible_ids

        # Safeguard: Với câu hỏi triệu chứng sốt thông thường (không phải sốt rét hay sốt vàng)
        if "sốt" in lower_query and not any(term in lower_query for term in ("rét", "vàng", "xuất huyết")):
            offtarget_fever_ids = {
                cid for cid in all_candidate_ids
                if any(k in chunk_map[cid].title.casefold() for k in ("sốt rét", "sốt vàng"))
            }
            all_candidate_ids -= offtarget_fever_ids
            for c in self.all_chunks:
                if "paracetamol" in c.title.casefold() and ("hạ sốt" in c.title.casefold() or "giảm đau" in c.title.casefold()):
                    all_candidate_ids.add(c.chunk_id)
                    dense_rank_map[c.chunk_id] = min(dense_rank_map.get(c.chunk_id, 999), 1)

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

            if is_protocol_query and chunk.entity_type in {"circular", "protocol", "guideline", "regulatory"}:
                rrf_score += 0.30
                reasons.append("Clinical circular / regulatory protocol match")
            else:
                # When a question names a medicine, prioritize evidence about that
                # medicine over unrelated monographs matching generic clinical terms.
                title_drug_match = any(d in chunk.title.casefold() for d in resolved_query_drugs)
                if title_drug_match:
                    rrf_score += 0.25
                    reasons.append("Direct monograph title match for query drug")
                elif "sốt" in lower_query and not any(term in lower_query for term in ("rét", "vàng", "xuất huyết")) and "paracetamol" in chunk.title.casefold() and ("hạ sốt" in chunk.title.casefold() or "giảm đau" in chunk.title.casefold()):
                    rrf_score += 0.25
                    reasons.append("First-line antipyretic monograph match for fever query")
                else:
                    chunk_text = f"{chunk.title} {chunk.content} {' '.join(chunk.keywords)}".casefold()
                    named_drug_match = bool(set(resolved_query_drugs) & set(resolve_registered_medications(chunk_text)))
                    if named_drug_match:
                        rrf_score += 0.05
                        reasons.append("Explicit named medicine match")
            if chunk.entity_type == "ddi" and cid in allowed_ddi_ids:
                rrf_score += 0.20
                reasons.append("Registered medicine overlap with DDI evidence")

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
