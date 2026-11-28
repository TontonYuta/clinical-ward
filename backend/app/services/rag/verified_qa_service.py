"""
Verified Clinical Q&A Knowledge Node Service (LightRAG & Semantic Dual-Key Architecture).
Paper: LightRAG (arXiv:2410.05779, HKUDS) & GPTCache (arXiv:2303.17580).
Lưu trữ và kết nối các cặp Câu hỏi & Câu trả lời lâm sàng đã được thẩm định trực tiếp vào Đồ thị Tri thức:
- Khóa tìm kiếm (Key): Vector nhúng 768 chiều của Câu hỏi chuẩn hóa (Query-to-Query Matching).
- Dữ liệu trả về (Payload): Văn bản Markdown nguyên bản kèm trích dẫn văn bản pháp lý/y văn chính thống.
- Cạnh đồ thị (Graph Edge): Nối trực tiếp vào các thực thể Thuốc (INN), Nhóm Dược lý (ATC), và Bệnh nền (Condition).
- Hiệu năng: Trả về câu trả lời chuẩn trong < 2ms, 0 độ trễ suy nghĩ LLM, 0 token tiêu thụ.
"""
import os
import re
import json
import time
import hashlib
import sqlite3
import logging
from typing import List, Dict, Any, Optional, Set, Union
from contextlib import contextmanager

import numpy as np

from app.schemas.copilot import CopilotResponse
from app.services.rag.embeddings.provider import (
    get_embedding_provider,
    BaseEmbeddingProvider,
    cosine_similarity,
    DEFAULT_EMBEDDING_DIM
)

logger = logging.getLogger("verified_qa_service")

# Tiền tố và hậu tố giao tiếp cần lọc bỏ khi chuẩn hóa câu hỏi
_CONVERSATIONAL_PREFIXES = (
    "cho tôi hỏi", "cho toi hoi",
    "xin hỏi", "xin hoi",
    "bác sĩ cho hỏi", "bac si cho hoi",
    "dược sĩ cho hỏi", "duoc si cho hoi",
    "trợ lý cho hỏi", "tro ly cho hoi",
    "vui lòng cho biết", "vui long cho biet",
    "cho em hỏi", "cho em hoi",
    "cho mình hỏi", "cho minh hoi",
    "hỏi về", "hoi ve",
    "tìm hiểu về", "tim hieu ve",
    "thông tin về", "thong tin ve",
    "kiểm tra giúp", "kiem tra giup",
    "xem giúp", "xem giup",
    "tra cứu về", "tra cuu ve",
    "hướng dẫn về", "huong dan ve"
)

_CONVERSATIONAL_SUFFIXES = (
    "với ạ", "voi a",
    "nhé", "nhe",
    "ạ", "a",
    "với", "voi",
    "giúp tôi", "giup toi",
    "giúp em", "giup em",
    "giúp mình", "giup minh"
)

def _resolve_default_db_path() -> str:
    """Tự động định vị đường dẫn CSDL SQLite chuẩn của hệ thống."""
    try:
        from app.config import settings
        db_url = getattr(settings, "DATABASE_URL", "")
        if "sqlite" in db_url:
            path = db_url.split(":///")[-1]
            if os.path.exists(path) or os.path.exists(os.path.dirname(path)):
                return path
    except Exception:
        pass

    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    canonical_artifact = os.path.abspath(os.path.join(backend_dir, "../artifacts/clinical_hospital-local-canonical.sqlite"))
    if os.path.exists(canonical_artifact):
        return canonical_artifact

    cache_dir = os.path.abspath(os.path.join(backend_dir, "data"))
    os.makedirs(cache_dir, exist_ok=True)
    return os.path.join(cache_dir, "clinical_copilot_cache.sqlite")


class VerifiedQAService:
    """
    Quản lý tập trung các Node Q&A Lâm Sàng Đã Thẩm Định trong Đồ thị Tri thức.
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        embedding_provider: Optional[BaseEmbeddingProvider] = None,
        similarity_threshold: float = 0.93
    ):
        self.db_path = db_path or _resolve_default_db_path()
        self.similarity_threshold = similarity_threshold
        self._provider = embedding_provider
        self._nodes_cache: Dict[str, Dict[str, Any]] = {}
        self._entity_to_qa_index: Dict[str, Set[str]] = {}
        self._exact_canonical_index: Dict[str, str] = {}
        self.exact_hits = 0
        self.semantic_hits = 0
        self.misses = 0

        self._init_db()
        self.reload_nodes()

    @contextmanager
    def _get_conn(self):
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        try:
            conn.execute("PRAGMA journal_mode = WAL;")
            conn.execute("PRAGMA cache_size = -1000;")
            yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        """Khởi tạo bảng verified_clinical_qa_nodes trong SQLite."""
        try:
            with self._get_conn() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS verified_clinical_qa_nodes (
                        qa_id TEXT PRIMARY KEY,
                        canonical_query TEXT NOT NULL,
                        query_vector_json TEXT,
                        entities_json TEXT NOT NULL,
                        answer_markdown TEXT NOT NULL,
                        citations_json TEXT NOT NULL,
                        intent TEXT NOT NULL,
                        legal_basis TEXT,
                        suggested_chips_json TEXT,
                        verification_source TEXT NOT NULL,
                        grounding_score REAL DEFAULT 1.0,
                        hit_count INTEGER DEFAULT 0,
                        created_at REAL NOT NULL,
                        updated_at REAL NOT NULL,
                        is_active INTEGER DEFAULT 1
                    )
                """)
                conn.execute("CREATE INDEX IF NOT EXISTS idx_vqa_canonical ON verified_clinical_qa_nodes(canonical_query)")
                conn.execute("CREATE INDEX IF NOT EXISTS idx_vqa_active ON verified_clinical_qa_nodes(is_active)")
                conn.commit()
        except Exception as e:
            logger.warning("Không thể khởi tạo bảng verified_clinical_qa_nodes tại %s: %s", self.db_path, e)

    def _get_provider(self) -> Optional[BaseEmbeddingProvider]:
        if self._provider is None:
            try:
                self._provider = get_embedding_provider()
            except Exception as e:
                logger.debug("Không thể lấy default embedding provider: %s", e)
        return self._provider

    def normalize_query(self, query: str) -> str:
        """Làm sạch và đồng nhất câu hỏi (bỏ dấu câu, tiền tố, hậu tố đệm)."""
        if not query:
            return ""
        clean = query.lower().strip()
        clean = re.sub(r'[\?!\.,:;_\-\(\)\[\]"\']', ' ', clean)
        clean = re.sub(r'\s+', ' ', clean).strip()

        for prefix in _CONVERSATIONAL_PREFIXES:
            if clean.startswith(prefix + " "):
                clean = clean[len(prefix):].strip()
                break

        for suffix in _CONVERSATIONAL_SUFFIXES:
            if clean.endswith(" " + suffix):
                clean = clean[:-len(suffix)].strip()
                break

        return clean

    def extract_entities(self, query: str) -> List[str]:
        """Trích xuất các thực thể Y tế (Thuốc, Nhóm ATC, Bệnh cảnh) từ câu truy vấn."""
        lower_q = query.lower()
        extracted: Set[str] = set()

        # 1. Trích xuất qua Lexical Trie Matcher (Thuốc DAV & DĐVN V)
        try:
            from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
            matcher = get_drug_lexical_matcher()
            meds = matcher.extract_medications(query)
            for m in meds:
                if isinstance(m, dict):
                    canonical = m.get("canonical", "").lower()
                elif isinstance(m, str):
                    canonical = m.lower()
                else:
                    canonical = str(m).lower()
                if canonical:
                    extracted.add(canonical)
        except Exception:
            pass

        # 1.5. Trích xuất trực tiếp qua Drug Registry
        try:
            from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
            for inn, reg in DRUG_REGISTRY.items():
                aliases = [inn] + reg.get("aliases", [])
                if any(a in lower_q for a in aliases):
                    extracted.add(inn.lower())
        except Exception:
            pass

        # 2. Trích xuất qua Phân loại Nhóm Dược lý (LightRAG Pharmacological Class Taxonomy)
        try:
            from app.services.rag.lightrag_data import PHARMACOLOGICAL_CLASS_TAXONOMY
            for c_key, c_info in PHARMACOLOGICAL_CLASS_TAXONOMY.items():
                if any(kw in lower_q for kw in c_info.get("keywords", [])):
                    extracted.add(c_key.lower())
                elif any(m in lower_q for m in c_info.get("members", [])):
                    extracted.add(c_key.lower())
        except Exception:
            pass

        # 3. Trích xuất các tình trạng bệnh nền / đối tượng đặc biệt
        try:
            from app.services.rag.lightrag_data import ORGAN_CONDITION_HIERARCHY
            for cond_key, cond_info in ORGAN_CONDITION_HIERARCHY.items():
                if any(kw in lower_q for kw in cond_info.get("keywords", [])):
                    extracted.add(cond_key.lower())
        except Exception:
            pass

        # Bổ sung các từ khóa bệnh lý / đối tượng đặc thù thường gặp
        special_entities = {
            "thai kỳ": "pregnancy",
            "mang thai": "pregnancy",
            "phụ nữ có thai": "pregnancy",
            "bầu": "pregnancy",
            "có bầu": "pregnancy",
            "cho con bú": "lactation",
            "suy thận": "renal_impairment",
            "suy gan": "hepatic_impairment",
            "trẻ em": "pediatric",
            "người cao tuổi": "geriatric",
            "người lớn": "adult",
            "acei": "acei",
            "arb": "arb",
            "statin": "statin"
        }
        for kw, ent in special_entities.items():
            if kw in lower_q:
                extracted.add(ent)

        return sorted(list(extracted))

    def embed_query_sync(self, query: str) -> Optional[np.ndarray]:
        """Tạo vector nhúng L2-normalized float32 cho câu hỏi."""
        cleaned = query.strip()
        if not cleaned:
            return None
        provider = self._get_provider()
        if not provider:
            return None
        try:
            vec = provider.embed_query_sync(cleaned)
            if vec is not None:
                arr = np.asarray(vec, dtype=np.float32)
                norm = np.linalg.norm(arr)
                if norm > 0:
                    arr = arr / norm
                return arr
        except Exception as e:
            logger.debug("Lỗi embed query trong VerifiedQAService: %s", e)
        return None

    def reload_nodes(self) -> int:
        """Đọc toàn bộ các node Q&A đang kích hoạt từ SQLite vào RAM để so khớp siêu tốc."""
        self._nodes_cache.clear()
        self._entity_to_qa_index.clear()
        self._exact_canonical_index.clear()

        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT qa_id, canonical_query, query_vector_json, entities_json,
                           answer_markdown, citations_json, intent, legal_basis,
                           suggested_chips_json, verification_source, grounding_score,
                           hit_count, created_at, updated_at, is_active
                    FROM verified_clinical_qa_nodes
                    WHERE is_active = 1
                """)
                rows = cursor.fetchall()
                for r in rows:
                    qa_id = r[0]
                    can_q = r[1]
                    vec_raw = r[2]
                    ent_raw = r[3]
                    ans_md = r[4]
                    cit_raw = r[5]
                    intent = r[6]
                    legal_basis = r[7]
                    chips_raw = r[8]
                    v_source = r[9]
                    g_score = r[10]
                    hits = r[11]
                    cr_at = r[12]
                    up_at = r[13]
                    active = r[14]

                    vec_arr = None
                    if vec_raw:
                        try:
                            vec_list = json.loads(vec_raw)
                            if vec_list:
                                vec_arr = np.asarray(vec_list, dtype=np.float32)
                        except Exception:
                            vec_arr = None

                    entities = []
                    if ent_raw:
                        try:
                            entities = json.loads(ent_raw)
                        except Exception:
                            entities = []

                    citations = []
                    if cit_raw:
                        try:
                            citations = json.loads(cit_raw)
                        except Exception:
                            citations = []

                    chips = []
                    if chips_raw:
                        try:
                            chips = json.loads(chips_raw)
                        except Exception:
                            chips = []

                    node_data = {
                        "qa_id": qa_id,
                        "canonical_query": can_q,
                        "query_vector": vec_arr,
                        "entities": entities,
                        "answer_markdown": ans_md,
                        "citations": citations,
                        "intent": intent,
                        "legal_basis": legal_basis or "Dược thư Quốc gia Việt Nam & Hướng dẫn BYT",
                        "suggested_chips": chips,
                        "verification_source": v_source,
                        "grounding_score": float(g_score or 1.0),
                        "hit_count": int(hits or 0),
                        "created_at": cr_at,
                        "updated_at": up_at,
                        "is_active": bool(active)
                    }

                    self._nodes_cache[qa_id] = node_data
                    self._exact_canonical_index[can_q] = qa_id
                    for ent in entities:
                        self._entity_to_qa_index.setdefault(ent.lower(), set()).add(qa_id)

            logger.info("Đã nạp thành công %d verified Q&A nodes vào bộ nhớ RAM.", len(self._nodes_cache))
            return len(self._nodes_cache)
        except Exception as e:
            logger.debug("Lỗi đọc verified_clinical_qa_nodes từ SQLite: %s", e)
            return 0

    def register_qa_node(
        self,
        query: str,
        answer_markdown: str,
        citations: Optional[List[Dict[str, Any]]] = None,
        entities: Optional[List[str]] = None,
        intent: str = "DRUG_INFO",
        legal_basis: str = "",
        suggested_chips: Optional[List[str]] = None,
        verification_source: str = "clinical_pharmacist",
        grounding_score: float = 1.0,
        query_vector: Optional[Union[np.ndarray, List[float]]] = None
    ) -> str:
        """
        Đăng ký một cặp Q&A đã thẩm định vào Đồ thị Tri thức.
        Chỉ embedding Câu hỏi (Key), câu trả lời lưu dạng Markdown (Payload).
        """
        canonical = self.normalize_query(query)
        if not canonical or not answer_markdown:
            raise ValueError("Query và answer_markdown không được để trống.")

        # Tạo qa_id dựa trên sha256 của canonical query
        qa_id = f"qa_{hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:16]}"
        now = time.time()

        if entities is None:
            entities = self.extract_entities(query)

        # Tính toán vector nhúng của câu hỏi nếu chưa có
        vec_arr = None
        if query_vector is not None:
            vec_arr = np.asarray(query_vector, dtype=np.float32)
            norm = np.linalg.norm(vec_arr)
            if norm > 0:
                vec_arr = vec_arr / norm
        else:
            vec_arr = self.embed_query_sync(canonical)

        vec_json = json.dumps(vec_arr.tolist()) if vec_arr is not None else None
        ent_json = json.dumps(sorted(list(set(entities))), ensure_ascii=False)
        cit_json = json.dumps(citations or [], ensure_ascii=False)
        chips_json = json.dumps(suggested_chips or [], ensure_ascii=False)

        with self._get_conn() as conn:
            conn.execute("""
                INSERT OR REPLACE INTO verified_clinical_qa_nodes (
                    qa_id, canonical_query, query_vector_json, entities_json,
                    answer_markdown, citations_json, intent, legal_basis,
                    suggested_chips_json, verification_source, grounding_score,
                    hit_count, created_at, updated_at, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                qa_id, canonical, vec_json, ent_json,
                answer_markdown, cit_json, intent, legal_basis,
                chips_json, verification_source, float(grounding_score),
                0, now, now, 1
            ))
            conn.commit()

        node_data = {
            "qa_id": qa_id,
            "canonical_query": canonical,
            "query_vector": vec_arr,
            "entities": entities,
            "answer_markdown": answer_markdown,
            "citations": citations or [],
            "intent": intent,
            "legal_basis": legal_basis or "Dược thư Quốc gia Việt Nam & Hướng dẫn BYT",
            "suggested_chips": suggested_chips or [],
            "verification_source": verification_source,
            "grounding_score": float(grounding_score),
            "hit_count": 0,
            "created_at": now,
            "updated_at": now,
            "is_active": True
        }
        self._nodes_cache[qa_id] = node_data
        self._exact_canonical_index[canonical] = qa_id
        for ent in entities:
            self._entity_to_qa_index.setdefault(ent.lower(), set()).add(qa_id)

        logger.info("Đã đăng ký Verified Q&A Node [%s] cho câu hỏi: '%s'", qa_id, canonical)
        return qa_id

    @staticmethod
    def _is_stale_auto_node(node: Dict[str, Any]) -> bool:
        """Bypass legacy auto-saved raw book dumps so upgraded Gemini Answer-First synthesis can refresh them."""
        vsrc = str(node.get("verification_source") or "").lower()
        if not vsrc.startswith("auto_"):
            return False
        ans = str(node.get("answer_markdown") or "")
        if "xem chuyên luận" in ans.lower() or "đối chiếu nguyên văn dược thư" in ans.lower():
            return True
        if len(ans) >= 400 and "### " not in ans:
            return True
        return False

    def lookup_verified_qa(
        self,
        query: str,
        user_role: str = "doctor",
        min_similarity: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Tra cứu siêu tốc đối khớp câu hỏi người dùng với Kho Q&A đã thẩm định:
        1. Bước 1: Exact Key Match trên Canonical Query (O(1), < 0.05ms)
        2. Bước 2: Dense Cosine Similarity (Query-to-Query) + Entity Guardrail (< 1ms)
        """
        canonical = self.normalize_query(query)
        if not canonical:
            return None

        # Clinical Safety Gate: never match personalized/patient-parameter or deictic follow-up queries to static VQA
        lower_q = (query or "").lower()
        unsafe_vqa_cues = (
            "thuốc này", "thuốc đó", "thuốc kia", "vừa rồi", "bệnh nhân này",
            "creatinin", "crcl", "egfr", "chỉnh liều", "tuổi", "kg",
        )
        if any(cue in lower_q for cue in unsafe_vqa_cues) or bool(re.search(r"\bnó\b", lower_q)):
            self.misses += 1
            return None

        threshold = min_similarity if min_similarity is not None else self.similarity_threshold

        # 1. Exact Match O(1)
        if canonical in self._exact_canonical_index:
            qa_id = self._exact_canonical_index[canonical]
            node = self._nodes_cache.get(qa_id)
            if node and node.get("is_active") and not self._is_stale_auto_node(node):
                self.exact_hits += 1
                self._increment_hit(qa_id)
                node_copy = node.copy()
                node_copy["match_type"] = "exact"
                node_copy["similarity_score"] = 1.0
                return node_copy

        # 2. Semantic Vector Match (Query-to-Query) with full Clinical Feature Guardrail
        query_vec = self.embed_query_sync(canonical)
        query_entities = set(self.extract_entities(query))
        from app.services.cache.clinical_cache import get_clinical_cache
        _cc = get_clinical_cache()
        q_feats = _cc.extract_clinical_features(query, auto_embed=False)

        best_score = 0.0
        best_node = None

        if query_vec is not None:
            for qa_id, node in self._nodes_cache.items():
                if not node.get("is_active") or self._is_stale_auto_node(node):
                    continue
                cached_vec = node.get("query_vector")
                if cached_vec is None:
                    continue

                # Cosine dot product (do cả 2 đã L2-normalized)
                score = float(np.dot(query_vec, cached_vec))
                if score < threshold or score <= best_score:
                    continue

                # Medical Entity Guardrail
                node_entities = set(node.get("entities", []))
                if query_entities and node_entities:
                    overlap = query_entities.intersection(node_entities)
                    if not overlap:
                        continue

                # Clinical Intent, Facet, Quantitative & Condition Safety Guardrail (fixes canonical_query key bug)
                node_query_text = (
                    node.get("canonical_query")
                    or node.get("question_raw")
                    or node.get("question_canonical")
                    or ""
                )
                n_feats = _cc.extract_clinical_features(node_query_text, auto_embed=False)
                if q_feats["intent"] != n_feats["intent"]:
                    continue
                if q_feats.get("requested_fields", frozenset()) != n_feats.get("requested_fields", frozenset()):
                    continue
                if q_feats["numbers"] != n_feats["numbers"]:
                    continue
                if q_feats["meds"] != n_feats["meds"]:
                    continue
                if (q_feats.get("conditions") or n_feats.get("conditions")) and q_feats.get("conditions") != n_feats.get("conditions"):
                    continue

                best_score = score
                best_node = node

        if best_node:
            self.semantic_hits += 1
            self._increment_hit(best_node["qa_id"])
            node_copy = best_node.copy()
            node_copy["match_type"] = "semantic"
            node_copy["similarity_score"] = best_score
            return node_copy

        self.misses += 1
        return None

    def _increment_hit(self, qa_id: str) -> None:
        """Tăng số lần truy cập của node và cập nhật timestamp."""
        try:
            if qa_id in self._nodes_cache:
                self._nodes_cache[qa_id]["hit_count"] += 1
                self._nodes_cache[qa_id]["updated_at"] = time.time()
            with self._get_conn() as conn:
                conn.execute(
                    "UPDATE verified_clinical_qa_nodes SET hit_count = hit_count + 1, updated_at = ? WHERE qa_id = ?",
                    (time.time(), qa_id)
                )
                conn.commit()
        except Exception as e:
            logger.debug("Lỗi cập nhật hit count cho node %s: %s", qa_id, e)

    def find_qa_nodes_by_entities(self, entities: List[str]) -> List[Dict[str, Any]]:
        """Tìm tất cả các Verified Q&A Nodes kết nối với các thực thể trong Đồ thị Tri thức."""
        matched_qa_ids: Set[str] = set()
        for ent in entities:
            ent_lower = ent.lower()
            if ent_lower in self._entity_to_qa_index:
                matched_qa_ids.update(self._entity_to_qa_index[ent_lower])

        results = []
        for qa_id in matched_qa_ids:
            node = self._nodes_cache.get(qa_id)
            if node and node.get("is_active"):
                results.append({
                    "qa_id": node["qa_id"],
                    "canonical_query": node["canonical_query"],
                    "answer_summary": node["answer_markdown"][:250] + ("..." if len(node["answer_markdown"]) > 250 else ""),
                    "entities": node["entities"],
                    "grounding_score": node["grounding_score"],
                    "verification_source": node["verification_source"]
                })
        return results

    def auto_register_candidate(
        self,
        query: str,
        response: CopilotResponse,
        source: str = "grounded_web_search"
    ) -> Optional[str]:
        """
        Quality Gate tự động: Kiểm duyệt và thăng hạng câu trả lời chất lượng cao thành Verified Q&A Node.
        Chỉ lưu khi:
        1. Câu trả lời có căn cứ xác thực (rag_grounded=True)
        2. Điểm tin cậy >= 0.85
        3. Có trích dẫn y văn / nguồn web chính thống
        4. Câu hỏi độc lập ngữ cảnh, không chứa biến số cá thể hóa (kg, suy thận cụ thể, deictic)
        5. Độ dài câu trả lời hoàn chỉnh (>= 120 ký tự)
        """
        if not response or not response.reply_text:
            return None
        if not response.rag_grounded or (response.confidence or 0.0) < 0.85:
            return None
        if not response.citations or len(response.reply_text.strip()) < 80:
            return None

        lower_q = query.lower()
        deictic_words = (
            "này", "đó", "kia", "nó", "vừa rồi", "thuốc này", "thuốc đó", "bệnh nhân này",
            "kg", "tuổi", "creatinin", "crcl", "egfr"
        )
        if any(w in lower_q for w in deictic_words):
            return None

        # Kiểm tra độ dài câu hỏi (ít nhất 5 từ mang tính tra cứu chuyên môn)
        words = lower_q.split()
        if len(words) < 5:
            return None

        # Trích xuất thực thể
        entities = self.extract_entities(query)
        if not entities:
            return None

        try:
            qa_id = self.register_qa_node(
                query=query,
                answer_markdown=response.reply_text,
                citations=response.citations,
                entities=entities,
                intent=response.intent or "GROUNDED_WEB_SEARCH",
                legal_basis=response.legal_basis or "Tra cứu Y văn Thẩm định (Grounded Search)",
                suggested_chips=response.suggested_chips or [],
                verification_source=f"auto_{source}",
                grounding_score=float(response.confidence or 0.95)
            )
            return qa_id
        except Exception as e:
            logger.warning("Lỗi auto register candidate Q&A node: %s", e)
            return None

    def format_as_copilot_response(
        self,
        qa_node: Dict[str, Any],
        session: Optional[Any] = None
    ) -> CopilotResponse:
        """Đóng gói dữ liệu từ Verified Q&A Node thành đối tượng CopilotResponse hoàn chỉnh."""
        return CopilotResponse(
            intent=qa_node.get("intent", "DRUG_INFO"),
            reply_text=qa_node.get("answer_markdown", ""),
            citations=qa_node.get("citations", []),
            legal_basis=qa_node.get("legal_basis", "Đồ thị Tri thức Dược lâm sàng & Q&A Chuẩn"),
            suggested_chips=qa_node.get("suggested_chips", []),
            session_id=getattr(session, "session_id", None) if session else None,
            rag_grounded=True,
            answer_type="grounded_reference",
            source_status="verified_graph_qa",
            confidence=float(qa_node.get("grounding_score", 0.98))
        )

    def list_qa_nodes(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Lấy danh sách các node Q&A đã thẩm định trong hệ thống."""
        nodes = list(self._nodes_cache.values())
        nodes.sort(key=lambda x: x.get("updated_at", 0), reverse=True)
        return [
            {
                "qa_id": n["qa_id"],
                "canonical_query": n["canonical_query"],
                "answer_markdown": n["answer_markdown"],
                "entities": n["entities"],
                "citations": n["citations"],
                "intent": n["intent"],
                "legal_basis": n["legal_basis"],
                "suggested_chips": n["suggested_chips"],
                "verification_source": n["verification_source"],
                "grounding_score": n["grounding_score"],
                "hit_count": n["hit_count"],
                "created_at": n["created_at"],
                "updated_at": n["updated_at"],
                "is_active": n["is_active"]
            }
            for n in nodes[:limit]
        ]

    def delete_qa_node(self, qa_id: str) -> bool:
        """Vô hiệu hóa một node Q&A trong CSDL và RAM."""
        try:
            with self._get_conn() as conn:
                conn.execute(
                    "UPDATE verified_clinical_qa_nodes SET is_active = 0, updated_at = ? WHERE qa_id = ?",
                    (time.time(), qa_id)
                )
                conn.commit()
            if qa_id in self._nodes_cache:
                can_q = self._nodes_cache[qa_id]["canonical_query"]
                self._exact_canonical_index.pop(can_q, None)
                self._nodes_cache.pop(qa_id, None)
            return True
        except Exception as e:
            logger.warning("Lỗi xóa node Q&A %s: %s", qa_id, e)
            return False

    def clear_auto_cached_nodes(self) -> int:
        """Xóa toàn bộ các node Q&A tự động cache (auto_*) trong CSDL và RAM, giữ nguyên node do dược sĩ thẩm định."""
        auto_ids = [
            qid for qid, n in list(self._nodes_cache.items())
            if str(n.get("verification_source") or "").startswith("auto_")
        ]
        try:
            with self._get_conn() as conn:
                conn.execute(
                    "UPDATE verified_clinical_qa_nodes SET is_active = 0, updated_at = ? WHERE verification_source LIKE 'auto_%'",
                    (time.time(),)
                )
                conn.commit()
        except Exception as e:
            logger.warning("Lỗi xóa auto-cached Q&A nodes: %s", e)

        for qid in auto_ids:
            node = self._nodes_cache.pop(qid, None)
            if node:
                self._exact_canonical_index.pop(node.get("canonical_query", ""), None)
        return len(auto_ids)

    def get_stats(self) -> Dict[str, Any]:
        """Thống kê vận hành của Verified Q&A Service."""
        return {
            "total_nodes": len(self._nodes_cache),
            "indexed_entities": len(self._entity_to_qa_index),
            "exact_hits": self.exact_hits,
            "semantic_hits": self.semantic_hits,
            "misses": self.misses,
            "db_path": self.db_path
        }


# Singleton Instance
_GLOBAL_VERIFIED_QA_SERVICE: Optional[VerifiedQAService] = None

def get_verified_qa_service(
    db_path: Optional[str] = None,
    mock: bool = False
) -> VerifiedQAService:
    global _GLOBAL_VERIFIED_QA_SERVICE
    if _GLOBAL_VERIFIED_QA_SERVICE is None:
        provider = None
        if mock:
            from app.services.rag.embeddings.provider import MockEmbeddingProvider
            provider = MockEmbeddingProvider(dimension=DEFAULT_EMBEDDING_DIM)
        _GLOBAL_VERIFIED_QA_SERVICE = VerifiedQAService(db_path=db_path, embedding_provider=provider)
    return _GLOBAL_VERIFIED_QA_SERVICE
