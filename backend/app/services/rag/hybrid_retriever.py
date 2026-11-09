"""
Hybrid Clinical Retriever: Reciprocal Rank Fusion (RRF k=60)
Combines Sparse BM25 (SQLite FTS5), Dense Semantic Vector Similarity (Google MRL 768-dim),
and Knowledge Graph Entity Gating according to Medical SOTA Standards
(Self-MedRAG, Jan 2026; MedRAG, arXiv:2402.13178; PaperQA2, Nature 2024).
"""
import asyncio
import logging
import re
from typing import Optional, List, Dict, Set, Tuple

from app.services.rag.types import RagChunk, RetrievedChunk
from app.services.rag.sqlite_fts import SqliteFtsIndex
from app.services.rag.clinical_indexer import load_all_clinical_chunks
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.rag.embeddings.provider import (
    BaseEmbeddingProvider,
    get_embedding_provider
)
from app.services.rag.embeddings.vector_store import (
    VectorStore,
    get_vector_store
)
from app.services.rag.lightrag_data import (
    PHARMACOLOGICAL_CLASS_TAXONOMY,
    CLASS_INTERACTION_GRAPH,
    ORGAN_CONDITION_HIERARCHY,
    THERAPEUTIC_ALTERNATIVE_MAP
)
from app.services.rag.lightrag_query_analyzer import analyze_dual_level_query
from app.services.rag.sqlite_graph_service import ClinicalGraphTraversalService

logger = logging.getLogger("hybrid_retriever")

RRF_K_CONSTANT = 60


def calculate_adaptive_rrf_weights(
    query: str,
    detected_drugs: Optional[List[str]] = None
) -> Tuple[float, float]:
    """
    Tính trọng số động cho Reciprocal Rank Fusion (Adaptive RRF):
    - Trả về (w_sparse, w_dense) với tổng bằng 1.0.
    - Truy vấn Lexical (SĐK, biệt dược chuẩn xác, số thông tư/nghị định, nồng độ/hàm lượng):
      Ưu tiên Sparse BM25 (w_sparse >= 0.70, w_dense <= 0.30).
    - Truy vấn Semantic (triệu chứng lâm sàng gián tiếp, ho khan, đổi thuốc, cơ chế, dược động học):
      Ưu tiên Dense Vector (w_sparse <= 0.40, w_dense >= 0.60).
    - Truy vấn cân bằng thông thường: w_sparse = 0.50, w_dense = 0.50.
    """
    lower_q = query.casefold()

    # 1. Nhận diện đặc tính Lexical / Mã kỹ thuật / Quy chế
    has_sdk = bool(re.search(r"\b(?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+\b", lower_q))
    has_tech_code = any(code in lower_q for code in ("sđk", "số đăng ký", "sdk", "mã thuốc", "số công bố"))
    has_regulatory = any(reg in lower_q for reg in ("thông tư", "nghị định", "tt 26", "tt 51", "tt 36", "tt 20", "qđ 5948", "5948"))
    has_dosage_exact = bool(re.search(r"\b\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|ui)\b", lower_q))

    # 2. Nhận diện đặc tính Semantic / Suy luận ca bệnh / Cơ chế / Tác dụng phụ
    semantic_cues = (
        "ho khan", "phù mạch", "dị ứng", "đổi sang", "chuyển sang", "thay thế",
        "thay bằng", "lựa chọn thay thế", "tác dụng phụ", "tác dụng không mong muốn",
        "triệu chứng", "thời gian bán thải", "dược động học", "cơ chế tác dụng",
        "cơ chế", "chuyển hóa", "thải trừ", "đào thải", "sinh khả dụng",
        "suy gan", "suy thận", "chỉnh liều", "lọc máu", "crcl", "egfr"
    )
    has_semantic = any(cue in lower_q for cue in semantic_cues)

    # Phân bổ trọng số động chuẩn hóa
    if has_sdk or has_tech_code or has_regulatory:
        return 0.75, 0.25
    if has_semantic:
        return 0.35, 0.65
    if has_dosage_exact:
        return 0.65, 0.35

    return 0.50, 0.50


def _is_direct_subject_chunk(chunk: RagChunk, drug_name: str) -> bool:
    """Kiểm tra chunk có phải chuyên luận trực tiếp của thuốc được hỏi hay không."""
    clean_title = chunk.title.casefold().split(" - ")[0]
    return drug_name.casefold() in clean_title or chunk.page_or_section.casefold().startswith(drug_name.casefold())


def _get_classes_for_drug(drug_name: str) -> List[str]:
    """Tìm danh sách nhóm dược lý (ATC Class) chứa hoạt chất hoặc biệt dược này."""
    d = drug_name.casefold()
    matched = []
    for c_key, c_info in PHARMACOLOGICAL_CLASS_TAXONOMY.items():
        members = [m.casefold() for m in c_info.get("members", [])]
        kws = [k.casefold() for k in c_info.get("keywords", [])]
        if d in members or d in kws or any(d in m for m in members):
            matched.append(c_key)
    return matched


def _detect_classes_in_text(text: str) -> Set[str]:
    """Nhận diện các nhóm dược lý được nhắc tới trực tiếp trong văn bản."""
    lower = text.casefold()
    matched = set()
    for c_key, c_info in PHARMACOLOGICAL_CLASS_TAXONOMY.items():
        if c_key.casefold() in lower or c_info.get("name_vi", "").casefold() in lower:
            matched.add(c_key)
            continue
        for kw in c_info.get("keywords", []):
            if kw.casefold() in lower:
                matched.add(c_key)
                break
    return matched


def _matches_substitution_trigger(query: str, triggers: list) -> bool:
    """Kiểm tra câu hỏi người dùng có khớp với trigger khuyến cáo thay thế thuốc hay không."""
    q = query.casefold()
    for trig in triggers:
        if isinstance(trig, str):
            if trig.casefold() in q:
                return True
        elif isinstance(trig, (list, tuple)):
            if all(item.casefold() in q for item in trig):
                return True
    return False


class HybridRetriever:
    """
    Bộ truy xuất lai đa tầng kết hợp Sparse BM25 và Dense Vector Embedding:
    - Sparse: SQLite FTS5 bắt chính xác tên thuốc, hoạt chất, số đăng ký, hàm lượng.
    - Dense: Vector Store (NumPy RAM ma trận) bắt trọn ngữ cảnh, triệu chứng và từ đồng nghĩa.
    - Fusion: Reciprocal Rank Fusion (RRF k=60) chuẩn hóa và kết hợp hai không gian xếp hạng.
    - Chốt chặn: Aho-Corasick Trie lọc thuốc đơn lẻ và DDI Gating an toàn lâm sàng.
    """

    def __init__(
        self,
        fts_index: Optional[SqliteFtsIndex] = None,
        vector_store: Optional[VectorStore] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None
    ):
        self.fts_index = fts_index or SqliteFtsIndex()
        self.all_chunks = load_all_clinical_chunks()
        self.fts_index.sync_chunks(self.all_chunks)

        # SOTA Dense Vector Retrieval
        self.vector_store = vector_store or get_vector_store()
        self.embedding_provider = embedding_provider or get_embedding_provider()

    def retrieve(
        self,
        query: str,
        kg_entities: Optional[list[str]] = None,
        top_k: int = 5,
        query_vector: Optional[List[float]] = None
    ) -> list[RetrievedChunk]:
        """
        Truy xuất Top-K tài liệu y văn lâm sàng phù hợp nhất.
        Tự động fallback an toàn về 100% BM25 nếu gặp sự cố mạng khi gọi embedding API.
        Hỗ trợ tái sử dụng query_vector nếu đã được tính trước đó (Request Memoization).
        """
        kg_entities = kg_entities or []
        lower_query = query.casefold()

        # 0. LightRAG Dual-Level Query Analysis & Subgraph Traversal (Section 3.2)
        dual_kw = analyze_dual_level_query(query)
        subgraph_info = ClinicalGraphTraversalService.traverse_clinical_subgraph(
            start_drugs=dual_kw.identified_drugs,
            condition_terms=dual_kw.clinical_domains
        )

        asks_about_interactions = any(term in lower_query for term in (
            "tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng",
            "kết hợp", "uống chung", "dùng chung", "cặp thuốc"
        )) or bool(subgraph_info.get("active_class_ddis"))
        resolved_query_drugs = list(dict.fromkeys(resolve_registered_medications(query) + dual_kw.identified_drugs))
        mentions_multiple_known_drugs = len(resolved_query_drugs) >= 2
        allow_ddi = bool(resolved_query_drugs) and (asks_about_interactions or mentions_multiple_known_drugs)

        candidate_limit = max(50, top_k * 5)

        # 1. Sparse BM25 Retrieval qua SQLite FTS5 (Dual-Level Querying)
        bm25_results = self.fts_index.search_bm25(query, top_k=candidate_limit)
        bm25_rank_map: Dict[str, int] = {
            r.chunk.chunk_id: idx + 1 for idx, r in enumerate(bm25_results)
        }

        # 1b. High-Level Macro Concept BM25 Querying (LightRAG Global Level)
        if dual_kw.high_level_keywords:
            high_q = " ".join(dual_kw.high_level_keywords[:5])
            high_bm25 = self.fts_index.search_bm25(high_q, top_k=20)
            for idx, r in enumerate(high_bm25):
                cid = r.chunk.chunk_id
                if cid not in bm25_rank_map or (idx + 1) < bm25_rank_map[cid]:
                    bm25_rank_map[cid] = idx + 1

        # 2. Dense Semantic Vector Retrieval qua VectorStore & Google MRL 768-dim
        dense_rank_map: Dict[str, int] = {}
        dense_score_map: Dict[str, float] = {}
        try:
            resolved_vector = query_vector if query_vector is not None else self.embedding_provider.embed_query_sync(query)
            if resolved_vector:
                # Ngưỡng cosine min_score=0.35 để loại bỏ các chunk hoàn toàn không liên quan
                vector_candidates = self.vector_store.search_cosine(
                    resolved_vector,
                    top_k=candidate_limit,
                    min_score=0.35
                )
                for idx, (cid, cos_score) in enumerate(vector_candidates):
                    dense_rank_map[cid] = idx + 1
                    dense_score_map[cid] = cos_score
        except Exception as e:
            logger.warning(f"[HybridRetriever] Lỗi truy vấn vector, tự động fallback sang BM25 thuần: {e}")

        return self._fuse_and_rank(
            query=query,
            lower_query=lower_query,
            bm25_rank_map=bm25_rank_map,
            dense_rank_map=dense_rank_map,
            dense_score_map=dense_score_map,
            resolved_query_drugs=resolved_query_drugs,
            dual_kw=dual_kw,
            subgraph_info=subgraph_info,
            kg_entities=kg_entities,
            asks_about_interactions=asks_about_interactions,
            mentions_multiple_known_drugs=mentions_multiple_known_drugs,
            allow_ddi=allow_ddi,
            top_k=top_k
        )

    async def retrieve_async(
        self,
        query: str,
        kg_entities: Optional[list[str]] = None,
        top_k: int = 5,
        query_vector: Optional[List[float]] = None
    ) -> list[RetrievedChunk]:
        """
        Phiên bản bất đồng bộ của retrieve(): Chạy BM25 và Dense Embedding đồng thời (Async Concurrent Retrieval).
        Tiết kiệm độ trễ nối tiếp giữa SQLite và HTTP API.
        """
        kg_entities = kg_entities or []
        lower_query = query.casefold()

        dual_kw = analyze_dual_level_query(query)
        subgraph_info = ClinicalGraphTraversalService.traverse_clinical_subgraph(
            start_drugs=dual_kw.identified_drugs,
            condition_terms=dual_kw.clinical_domains
        )

        asks_about_interactions = any(term in lower_query for term in (
            "tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng",
            "kết hợp", "uống chung", "dùng chung", "cặp thuốc"
        )) or bool(subgraph_info.get("active_class_ddis"))
        resolved_query_drugs = list(dict.fromkeys(resolve_registered_medications(query) + dual_kw.identified_drugs))
        mentions_multiple_known_drugs = len(resolved_query_drugs) >= 2
        allow_ddi = bool(resolved_query_drugs) and (asks_about_interactions or mentions_multiple_known_drugs)

        candidate_limit = max(50, top_k * 5)

        # Chạy đồng thời BM25 và Dense Embedding
        async def _run_bm25():
            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, self.fts_index.search_bm25, query, candidate_limit)

        async def _run_embed():
            if query_vector is not None:
                return query_vector
            try:
                return await self.embedding_provider.embed_query(query)
            except Exception as e:
                logger.warning(f"[HybridRetriever] Lỗi async embedding: {e}")
                return None

        bm25_task = _run_bm25()
        embed_task = _run_embed()
        bm25_res, resolved_vector = await asyncio.gather(bm25_task, embed_task, return_exceptions=True)

        bm25_results = [] if isinstance(bm25_res, Exception) else (bm25_res or [])
        if isinstance(resolved_vector, Exception):
            resolved_vector = None

        bm25_rank_map: Dict[str, int] = {
            r.chunk.chunk_id: idx + 1 for idx, r in enumerate(bm25_results)
        }

        # 1b. High-Level Macro Concept BM25 Querying (LightRAG Global Level)
        if dual_kw.high_level_keywords:
            high_q = " ".join(dual_kw.high_level_keywords[:5])
            high_bm25 = self.fts_index.search_bm25(high_q, top_k=20)
            for idx, r in enumerate(high_bm25):
                cid = r.chunk.chunk_id
                if cid not in bm25_rank_map or (idx + 1) < bm25_rank_map[cid]:
                    bm25_rank_map[cid] = idx + 1

        # 2. Dense Semantic Vector Retrieval qua VectorStore & Google MRL 768-dim
        dense_rank_map: Dict[str, int] = {}
        dense_score_map: Dict[str, float] = {}
        if resolved_vector:
            try:
                vector_candidates = self.vector_store.search_cosine(
                    resolved_vector,
                    top_k=candidate_limit,
                    min_score=0.35
                )
                for idx, (cid, cos_score) in enumerate(vector_candidates):
                    dense_rank_map[cid] = idx + 1
                    dense_score_map[cid] = cos_score
            except Exception as e:
                logger.warning(f"[HybridRetriever] Lỗi async search_cosine: {e}")

        return self._fuse_and_rank(
            query=query,
            lower_query=lower_query,
            bm25_rank_map=bm25_rank_map,
            dense_rank_map=dense_rank_map,
            dense_score_map=dense_score_map,
            resolved_query_drugs=resolved_query_drugs,
            dual_kw=dual_kw,
            subgraph_info=subgraph_info,
            kg_entities=kg_entities,
            asks_about_interactions=asks_about_interactions,
            mentions_multiple_known_drugs=mentions_multiple_known_drugs,
            allow_ddi=allow_ddi,
            top_k=top_k
        )

    def _fuse_and_rank(
        self,
        query: str,
        lower_query: str,
        bm25_rank_map: Dict[str, int],
        dense_rank_map: Dict[str, int],
        dense_score_map: Dict[str, float],
        resolved_query_drugs: List[str],
        dual_kw: Any,
        subgraph_info: Dict[str, Any],
        kg_entities: List[str],
        asks_about_interactions: bool,
        mentions_multiple_known_drugs: bool,
        allow_ddi: bool,
        top_k: int
    ) -> List[RetrievedChunk]:
        """Tầng hợp nhất xếp hạng đa tầng Reciprocal Rank Fusion với trọng số động Adaptive RRF."""
        # Thưởng điểm cho KG Entities nếu có
        kg_matched_ids: Set[str] = set()
        if kg_entities:
            for kg in kg_entities:
                clean_kg = kg.split(":")[-1].casefold()
                if len(clean_kg) >= 3:
                    for c in self.all_chunks:
                        if clean_kg in c.title.casefold():
                            kg_matched_ids.add(c.chunk_id)

        # 3. Lọc an toàn DDI (Tương tác thuốc)
        allowed_ddi_ids: Set[str] = set()
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

        # 3b. Nhận diện nhóm dược lý & Lọc an toàn DDI cấp vĩ mô (LightRAG)
        detected_classes = _detect_classes_in_text(query)
        for drug in resolved_query_drugs:
            for cls_key in _get_classes_for_drug(drug):
                detected_classes.add(cls_key)
        for cls_key in dual_kw.identified_classes + subgraph_info.get("discovered_classes", []):
            detected_classes.add(cls_key)

        allow_class_ddi = (
            asks_about_interactions
            or len(detected_classes) >= 2
            or (mentions_multiple_known_drugs and bool(detected_classes))
            or bool(subgraph_info.get("active_class_ddis"))
        )

        # Lọc bỏ class DDI chunks nếu câu hỏi không liên quan tương tác
        if not allow_class_ddi:
            bm25_rank_map = {cid: rank for cid, rank in bm25_rank_map.items() if not cid.startswith("lightrag_class_ddi")}
            dense_rank_map = {cid: rank for cid, rank in dense_rank_map.items() if not cid.startswith("lightrag_class_ddi")}

        # 4. Tập hợp toàn bộ ứng viên từ cả 2 nguồn Sparse & Dense
        chunk_map: Dict[str, RagChunk] = {c.chunk_id: c for c in self.all_chunks}
        all_candidate_ids = set(bm25_rank_map.keys()).union(dense_rank_map.keys()).union(kg_matched_ids)

        # 4b. Chủ động đưa các Graph Chunks phù hợp vào ứng viên (Dual-Level Knowledge Routing)
        # Khuyến cáo thay thế (Therapeutic Substitutions)
        for subst_key, s_info in THERAPEUTIC_ALTERNATIVE_MAP.items():
            if _matches_substitution_trigger(query, s_info.get("trigger", [])):
                subst_cid = f"lightrag_therapeutic_subst_{subst_key.lower()}"
                if subst_cid in chunk_map:
                    all_candidate_ids.add(subst_cid)

        # Tương tác nhóm vĩ mô (Class-to-Class DDI)
        if allow_class_ddi:
            for c_ddi in CLASS_INTERACTION_GRAPH:
                ca, cb = c_ddi["class_a"], c_ddi["class_b"]
                if ca in detected_classes and cb in detected_classes:
                    c_ddi_id = f"lightrag_class_ddi_{ca.lower()}_{cb.lower()}"
                    if c_ddi_id in chunk_map:
                        all_candidate_ids.add(c_ddi_id)
            for act_ddi in subgraph_info.get("active_class_ddis", []):
                ca, cb = act_ddi["class_a"], act_ddi["class_b"]
                c_ddi_id1 = f"lightrag_class_ddi_{ca.lower()}_{cb.lower()}"
                c_ddi_id2 = f"lightrag_class_ddi_{cb.lower()}_{ca.lower()}"
                if c_ddi_id1 in chunk_map:
                    all_candidate_ids.add(c_ddi_id1)
                if c_ddi_id2 in chunk_map:
                    all_candidate_ids.add(c_ddi_id2)

        # Phân tầng bệnh nền & cơ quan (Organ & Condition Hierarchy)
        for cond_key, cond_info in ORGAN_CONDITION_HIERARCHY.items():
            if any(kw in lower_query for kw in cond_info.get("keywords", [])):
                cond_cid = f"lightrag_organ_risk_{cond_key.lower()}"
                if cond_cid in chunk_map:
                    all_candidate_ids.add(cond_cid)

        # Nhóm dược lý ATC (Pharmacological Class Taxonomy)
        if any(term in lower_query for term in ("nhóm", "phân loại", "cơ chế", "dược lý", "tác dụng phụ")):
            for c_key in detected_classes:
                class_cid = f"lightrag_class_{c_key.lower()}"
                if class_cid in chunk_map:
                    all_candidate_ids.add(class_cid)

        is_protocol_query = any(p in lower_query for p in (
            "quy trình", "tiêu hủy", "thu hồi", "vỏ ống", "thông tư", "nghị định",
            "phản vệ", "xử trí", "cấp cứu", "tủ trực"
        ))

        target_drugs_for_filtering = list(resolved_query_drugs)
        if not target_drugs_for_filtering and kg_entities:
            for kg in kg_entities:
                c_kg = kg.split(":")[-1].casefold()
                if len(c_kg) >= 3 and c_kg not in target_drugs_for_filtering:
                    target_drugs_for_filtering.append(c_kg)

        # Chốt chặn: Nếu câu hỏi hỏi đích danh 1 thuốc cụ thể, ưu tiên tuyệt đối chuyên luận của thuốc đó
        if len(target_drugs_for_filtering) == 1 and not is_protocol_query:
            requested_drug = target_drugs_for_filtering[0]
            direct_monograph_chunks = [
                c for c in self.all_chunks
                if c.entity_type != "ddi" and (_is_direct_subject_chunk(c, requested_drug) or requested_drug in c.title.casefold())
            ]
            if direct_monograph_chunks:
                for c in direct_monograph_chunks:
                    all_candidate_ids.add(c.chunk_id)

            has_direct_monographs = bool(direct_monograph_chunks)
            incompatible_ids = set()
            for cid in all_candidate_ids:
                chunk = chunk_map.get(cid)
                if not chunk or chunk.entity_type in {"ddi", "circular", "protocol", "guideline", "regulatory"} or chunk.entity_type.startswith("graph_"):
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

        # Safeguard: Với câu hỏi sốt thông thường (không phải sốt rét hay sốt vàng)
        if "sốt" in lower_query and not any(term in lower_query for term in ("rét", "vàng", "xuất huyết")):
            offtarget_fever_ids = {
                cid for cid in all_candidate_ids
                if any(k in chunk_map[cid].title.casefold() for k in ("sốt rét", "sốt vàng"))
            }
            all_candidate_ids -= offtarget_fever_ids
            for c in self.all_chunks:
                if "paracetamol" in c.title.casefold() and ("hạ sốt" in c.title.casefold() or "giảm đau" in c.title.casefold()):
                    all_candidate_ids.add(c.chunk_id)

        if not allow_ddi:
            all_candidate_ids = {cid for cid in all_candidate_ids if chunk_map.get(cid) and chunk_map[cid].entity_type != "ddi"}

        if not allow_class_ddi:
            all_candidate_ids = {cid for cid in all_candidate_ids if not (chunk_map.get(cid) and chunk_map[cid].entity_type == "graph_class_ddi")}

        if not all_candidate_ids:
            return []

        # 5. Thuật toán Reciprocal Rank Fusion (Adaptive RRF k=60)
        w_sparse, w_dense = calculate_adaptive_rrf_weights(query, resolved_query_drugs)
        rrf_scored: List[RetrievedChunk] = []
        for cid in all_candidate_ids:
            chunk = chunk_map.get(cid)
            if not chunk:
                continue

            r_bm25 = bm25_rank_map.get(cid)
            r_dense = dense_rank_map.get(cid)

            rrf_score = 0.0
            reasons = []

            if r_bm25:
                rrf_score += w_sparse / (RRF_K_CONSTANT + r_bm25)
                reasons.append(f"BM25 rank #{r_bm25} (weight={w_sparse:.2f})")
            if r_dense:
                rrf_score += w_dense / (RRF_K_CONSTANT + r_dense)
                cos_val = dense_score_map.get(cid)
                if cos_val is not None:
                    reasons.append(f"Dense vector rank #{r_dense} (weight={w_dense:.2f}, cosine={cos_val:.3f})")
                else:
                    reasons.append(f"Dense vector rank #{r_dense} (weight={w_dense:.2f})")

            if is_protocol_query and chunk.entity_type in {"circular", "protocol", "guideline", "regulatory"}:
                rrf_score += 0.30
                reasons.append("Clinical circular / regulatory protocol match")
            else:
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

                # Phân hóa chủ đề lâm sàng chuyên biệt (thai kỳ, cho con bú, suy gan, ngộ độc...)
                title_clean = chunk.title.casefold()
                non_drug_tokens = [
                    tok for tok in lower_query.split()
                    if len(tok) >= 3 and not any(tok in d for d in resolved_query_drugs)
                ]
                matched_topics = [t for t in non_drug_tokens if t in title_clean]
                if matched_topics:
                    rrf_score += 0.04 * min(len(matched_topics), 3)
                    reasons.append(f"Clinical topic relevance ({', '.join(matched_topics[:3])})")

            if chunk.entity_type == "ddi" and cid in allowed_ddi_ids:
                rrf_score += 0.20
                reasons.append("Registered medicine overlap with DDI evidence")

            if cid in kg_matched_ids:
                rrf_score += 0.20
                reasons.append("Knowledge Graph entity match")

            # 5b. Thưởng điểm cho Đồ thị Tri thức Đa Tầng LightRAG (Dual-Level RRF Boost)
            if chunk.entity_type == "graph_substitution":
                subst_slug = chunk.chunk_id.replace("lightrag_therapeutic_subst_", "").upper()
                s_info = THERAPEUTIC_ALTERNATIVE_MAP.get(subst_slug, {})
                if _matches_substitution_trigger(query, s_info.get("trigger", [])):
                    rrf_score += 0.30
                    reasons.append("LightRAG dual-level therapeutic substitution match")
                else:
                    rrf_score += 0.15
                    reasons.append("LightRAG therapeutic substitution relevance")

            elif chunk.entity_type == "graph_class_ddi":
                if allow_class_ddi:
                    rrf_score += 0.30
                    reasons.append("LightRAG dual-level class interaction match")

            elif chunk.entity_type == "graph_condition_risk":
                cond_slug = chunk.chunk_id.replace("lightrag_organ_risk_", "").upper()
                cond_info = ORGAN_CONDITION_HIERARCHY.get(cond_slug, {})
                if any(kw in lower_query for kw in cond_info.get("keywords", [])):
                    rrf_score += 0.25
                    reasons.append("LightRAG dual-level organ condition risk match")
                else:
                    rrf_score += 0.10
                    reasons.append("LightRAG organ condition relevance")

            elif chunk.entity_type == "graph_class":
                class_slug = chunk.chunk_id.replace("lightrag_class_", "").upper()
                if class_slug in detected_classes:
                    rrf_score += 0.20
                    reasons.append(f"LightRAG dual-level pharmacological taxonomy match ({class_slug})")

            # LightRAG Graph Traversal: Thưởng điểm cho ngoại lệ chuyển hóa enzym gan
            if subgraph_info.get("metabolic_notes"):
                for m_note in subgraph_info["metabolic_notes"]:
                    m_drug = m_note["drug"].casefold()
                    if m_drug in chunk.title.casefold() or m_drug in chunk.content.casefold():
                        rrf_score += 0.15
                        reasons.append(f"LightRAG CYP metabolic exception traversal match ({m_drug})")
                        break

            rrf_scored.append(RetrievedChunk(
                chunk=chunk,
                score=round(rrf_score, 5),
                bm25_rank=r_bm25,
                semantic_rank=r_dense,
                match_reasons=reasons
            ))

        # Sắp xếp theo điểm RRF giảm dần
        rrf_scored.sort(key=lambda x: x.score, reverse=True)
        return rrf_scored[:top_k]
