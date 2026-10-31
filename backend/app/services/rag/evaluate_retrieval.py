"""Run the curated offline RAG retrieval benchmark and report ranking metrics."""
import json
from pathlib import Path

from app.services.rag.hybrid_retriever import HybridRetriever

CASES_PATH = Path(__file__).resolve().parents[3] / "data" / "knowledge_base" / "evaluation" / "rag_retrieval_cases.json"


def evaluate_retrieval(top_k: int = 5) -> dict:
    cases = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    retriever = HybridRetriever()
    reciprocal_ranks: list[float] = []
    per_case: list[dict] = []
    for case in cases:
        results = retriever.retrieve(case["query"], top_k=top_k)
        expected = set(case["expected_chunk_ids"])
        rank = next((i + 1 for i, item in enumerate(results) if any(
            item.chunk.chunk_id == chunk_id or item.chunk.chunk_id.startswith(f"{chunk_id}_")
            for chunk_id in expected
        )), None)
        reciprocal_ranks.append(1 / rank if rank else 0.0)
        per_case.append({"id": case["id"], "rank": rank, "top_chunk": results[0].chunk.chunk_id if results else None})
    return {
        "case_count": len(cases),
        "expert_reviewed_count": sum(1 for case in cases if case.get("clinical_review") == "approved"),
        "candidate_unreviewed_count": sum(1 for case in cases if case.get("clinical_review") != "approved"),
        "recall_at_k": sum(rank > 0 for rank in [row["rank"] or 0 for row in per_case]) / len(cases),
        "mrr_at_k": sum(reciprocal_ranks) / len(cases),
        "k": top_k,
        "cases": per_case,
        "note": "Offline retrieval-only metric; unreviewed cases are engineering candidates and do not establish clinical answer accuracy.",
    }


if __name__ == "__main__":
    print(json.dumps(evaluate_retrieval(), ensure_ascii=False, indent=2))
