"""
Dynamic Cut-Off Hybrid Clinical Retriever (Kỹ thuật 5).
Paper: Reciprocal Rank Fusion (Cormack et al., SIGIR 2009) & Dynamic Retrieval Thresholding.
Tự động tính ngưỡng cắt động theo độ dốc điểm tương quan, loại bỏ cắt cứng top_k.
"""
from typing import Optional, List
from app.services.rag.types import RetrievedChunk
from app.services.rag.hybrid_retriever import HybridRetriever

def calculate_dynamic_cutoff(
    scored_chunks: List[RetrievedChunk],
    min_k: int = 1,
    max_k: int = 8,
    relative_threshold: float = 0.65,
    elbow_drop_ratio: float = 0.25
) -> List[RetrievedChunk]:
    """
    Tính điểm gãy (Elbow Point) và ngưỡng cắt động (Dynamic Cut-Off).
    Loại bỏ các chunk râu ria làm loãng ngữ cảnh khi đã có chunk điểm số vượt trội.
    """
    if not scored_chunks:
        return []

    # Sắp xếp điểm giảm dần
    sorted_chunks = sorted(scored_chunks, key=lambda x: x.score, reverse=True)
    n = len(sorted_chunks)
    if n <= min_k:
        return sorted_chunks

    top_score = sorted_chunks[0].score
    if top_score <= 0.0:
        return sorted_chunks[:min_k]

    selected_count = min_k
    for i in range(min_k, min(n, max_k)):
        current_score = sorted_chunks[i].score
        prev_score = sorted_chunks[i - 1].score

        # 1. Ngưỡng tương đối so với chunk dẫn đầu
        if current_score < (top_score * relative_threshold):
            break

        # 2. Ngưỡng suy giảm đột ngột (Elbow Drop)
        step_drop = prev_score - current_score
        if step_drop > (top_score * elbow_drop_ratio):
            break

        selected_count = i + 1

    return sorted_chunks[:selected_count]

class DynamicHybridRetriever:
    """Bộ truy xuất lai ghép BM25 & Semantic với cơ chế cắt tỉa động."""

    def __init__(self, base_retriever: Optional[HybridRetriever] = None):
        self.base_retriever = base_retriever or HybridRetriever()

    def retrieve(
        self,
        query: str,
        kg_entities: Optional[List[str]] = None,
        min_k: int = 1,
        max_k: int = 8,
        top_k: Optional[int] = None
    ) -> List[RetrievedChunk]:
        """Truy xuất tài liệu với ngưỡng cắt động thông minh theo độ phức tạp câu hỏi."""
        # Nếu người dùng chỉ định top_k cố định cụ thể
        fetch_limit = top_k if top_k is not None else max_k
        raw_candidates = self.base_retriever.retrieve(
            query=query,
            kg_entities=kg_entities,
            top_k=max(fetch_limit, max_k)
        )

        if top_k is not None:
            return raw_candidates[:top_k]

        return calculate_dynamic_cutoff(
            scored_chunks=raw_candidates,
            min_k=min_k,
            max_k=max_k
        )
