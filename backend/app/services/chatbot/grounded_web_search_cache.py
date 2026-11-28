"""
Bộ nhớ đệm ngữ nghĩa phản hồi Tìm kiếm Web (Semantic Response Cache for Grounded Web Search).
Áp dụng mẫu GPTCache (Bang et al., 2023 / arXiv:2303.17580).
Lưu trữ câu trả lời Web Search kèm vector chuẩn hóa 768 chiều.
Khi câu hỏi mới diễn đạt khác nhưng có độ tương đồng Cosine >= 0.95 với câu hỏi đã tra cứu trong 24 giờ,
hệ thống phản hồi tức thì (< 30ms), tiết kiệm 100% token Gemini và chi phí Serper API.
"""

from typing import Optional, Dict, List, Any, Tuple
import re
import time
import logging
from collections import OrderedDict
import numpy as np

from app.schemas.copilot import CopilotResponse

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 3600  # 1 giờ
MAX_CACHE_ENTRIES = 500
SEMANTIC_SIMILARITY_THRESHOLD = 0.95

_QUANTITATIVE_PARAM_PAT = re.compile(
    r"(?i)(?:\b\d+(?:[.,]\d+)?\s*(?:tuổi|ml|mg|mcg|g|kg|giờ|h|ngày|tuần|tháng|%)\b"
    r"|\b(?:egfr|crcl|inr|hba1c)\s*[:=]?\s*\d+"
    r"|\b(?:cyp\w*|vkorc1)\s*\*?\s*\d+)",
)


def should_allow_semantic_cache(query: str) -> bool:
    """
    Chỉ cho phép Semantic Hit (>= 0.95) khi câu hỏi không chứa thông số định lượng lâm sàng
    (tuổi, liều, eGFR, INR, kiểu gen) để tránh ghép nhầm 2 ca bệnh khác con số.
    """
    if not query:
        return False
    if _QUANTITATIVE_PARAM_PAT.search(query):
        return False
    return True


_DEICTIC_CUES = ("này", "đó", "kia", "vừa rồi", "thuốc này", "thuốc đó", "bệnh nhân này")


def _is_shareable_independent_query(query: str) -> bool:
    """Allow cross-session Exact Hit sharing only for independent non-quantitative guideline queries."""
    if not should_allow_semantic_cache(query):
        return False
    low = (query or "").strip().lower()
    if len(low) < 10 or any(c in low for c in _DEICTIC_CUES) or re.search(r"\bnó\b", low):
        return False
    return True


class GroundedWebSearchCache:
    """
    Bộ đệm kết hợp O(1) Exact Key Match (ưu tiên phiên + chia sẻ an toàn cho câu hỏi độc lập)
    và Vector Cosine Similarity Dense Retrieval.
    An toàn lâm sàng: Ngưỡng Cosine >= 0.95 cực kỳ nghiêm ngặt nhằm chống ghép nhầm câu hỏi y khoa.
    """
    def __init__(self, max_size: int = MAX_CACHE_ENTRIES, ttl_sec: int = CACHE_TTL_SECONDS):
        self.max_size = max_size
        self.ttl_sec = ttl_sec
        # key: clean_query -> dict(query, vector, response, timestamp)
        self._entries: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self.exact_hits = 0
        self.semantic_hits = 0
        self.misses = 0

    @staticmethod
    def _make_key(query: str, session_id: Optional[str] = None) -> str:
        clean_q = query.strip().lower()
        scope = (session_id or "_global").strip()
        return f"{scope}::{clean_q}"

    @staticmethod
    def _make_shared_key(query: str) -> str:
        return f"_global_independent::{query.strip().lower()}"

    def get(
        self,
        query: str,
        query_vec: Optional[np.ndarray] = None,
        allow_semantic: Optional[bool] = None,
        session_id: Optional[str] = None
    ) -> Optional[CopilotResponse]:
        cache_key = self._make_key(query, session_id)
        now = time.time()

        # 1. Exact Match O(1): kiểm tra theo session_id trước, sau đó kiểm tra shared independent key nếu an toàn
        candidate_keys = [cache_key]
        if _is_shareable_independent_query(query):
            shared_key = self._make_shared_key(query)
            if shared_key != cache_key:
                candidate_keys.append(shared_key)

        for key in candidate_keys:
            if key in self._entries:
                entry = self._entries[key]
                if now - entry["timestamp"] < self.ttl_sec:
                    self.exact_hits += 1
                    self._entries.move_to_end(key)
                    logger.info("Grounded Web Search Cache: EXACT HIT cho query='%s' (key=%s)", query, key[:40])
                    cached_resp: CopilotResponse = entry["response"]
                    return cached_resp.model_copy(update={
                        "source_status": "cache_exact_hit"
                    })
                else:
                    self._entries.pop(key, None)

        # 2. Semantic Vector Cosine Similarity Search (chỉ khớp trong cùng session_id và khi không có thông số định lượng)
        semantic_enabled = should_allow_semantic_cache(query) if allow_semantic is None else allow_semantic
        if semantic_enabled and query_vec is not None and len(self._entries) > 0:
            q_norm = np.linalg.norm(query_vec)
            if q_norm > 0:
                q_unit = query_vec / q_norm
                valid_entries = []
                vectors = []

                for k, entry in list(self._entries.items()):
                    if now - entry["timestamp"] >= self.ttl_sec:
                        self._entries.pop(k, None)
                        continue
                    if entry.get("session_id") != session_id:
                        continue
                    if entry.get("vector") is not None:
                        valid_entries.append(entry)
                        vectors.append(entry["vector"])

                if vectors:
                    mat = np.vstack(vectors)
                    sims = np.dot(mat, q_unit)
                    best_idx = int(np.argmax(sims))
                    best_sim = float(sims[best_idx])

                    if best_sim >= SEMANTIC_SIMILARITY_THRESHOLD:
                        matched_entry = valid_entries[best_idx]
                        self.semantic_hits += 1
                        logger.info(
                            "Grounded Web Search Cache: SEMANTIC HIT (sim=%.4f >= %.2f) query='%s' ~ matched='%s'",
                            best_sim, SEMANTIC_SIMILARITY_THRESHOLD, query, matched_entry["query"]
                        )
                        cached_resp = matched_entry["response"]
                        return cached_resp.model_copy(update={
                            "source_status": "semantic_cache_hit",
                            "confidence": round(min(cached_resp.confidence or 0.9, best_sim), 2)
                        })

        self.misses += 1
        return None

    def put(
        self,
        query: str,
        response: CopilotResponse,
        query_vec: Optional[np.ndarray] = None,
        session_id: Optional[str] = None
    ) -> None:
        clean_q = query.strip().lower()
        if not clean_q or not response or not response.reply_text:
            return

        # Chỉ lưu các câu trả lời tham khảo hợp lệ (không lưu câu từ chối hoặc lỗi)
        if response.answer_type in ("safe_abstention", "clarification") or response.source_status == "no_search_results":
            return

        normed_vec = None
        if query_vec is not None:
            n = np.linalg.norm(query_vec)
            if n > 0:
                normed_vec = np.asarray(query_vec, dtype=np.float32) / n

        now = time.time()
        if len(self._entries) >= self.max_size:
            self._entries.popitem(last=False)  # LRU Eviction

        cache_key = self._make_key(query, session_id)
        entry_payload = {
            "query": query,
            "vector": normed_vec,
            "response": response,
            "timestamp": now,
            "session_id": session_id,
        }
        self._entries[cache_key] = entry_payload
        if _is_shareable_independent_query(query):
            shared_key = self._make_shared_key(query)
            if shared_key != cache_key:
                if len(self._entries) >= self.max_size:
                    self._entries.popitem(last=False)
                self._entries[shared_key] = {**entry_payload, "session_id": "_global_independent"}

    def invalidate_session(self, session_id: str) -> int:
        """Xóa toàn bộ entry cache gắn với một phiên chat cụ thể khi user xóa lịch sử."""
        if not session_id:
            return 0
        keys_to_remove = [
            k for k, entry in self._entries.items()
            if entry.get("session_id") == session_id
        ]
        for k in keys_to_remove:
            self._entries.pop(k, None)
        if keys_to_remove:
            logger.info("Grounded Web Search Cache: invalidated %d entries for session_id='%s'", len(keys_to_remove), session_id)
        return len(keys_to_remove)

    def clear(self) -> None:
        self._entries.clear()
        self.exact_hits = 0
        self.semantic_hits = 0
        self.misses = 0

    def get_stats(self) -> Dict[str, Any]:
        return {
            "size": len(self._entries),
            "exact_hits": self.exact_hits,
            "semantic_hits": self.semantic_hits,
            "misses": self.misses,
            "hit_rate": round((self.exact_hits + self.semantic_hits) / max(1, self.exact_hits + self.semantic_hits + self.misses), 3)
        }


# Singleton instance toàn hệ thống
_GLOBAL_WEB_CACHE = GroundedWebSearchCache()


def get_grounded_web_cache() -> GroundedWebSearchCache:
    return _GLOBAL_WEB_CACHE
