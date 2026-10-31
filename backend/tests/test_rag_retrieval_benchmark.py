"""Small deterministic retrieval benchmark over curated, source-reviewed queries."""
from app.services.rag.evaluate_retrieval import evaluate_retrieval


def test_curated_retrieval_cases_reach_baseline():
    report = evaluate_retrieval(top_k=5)
    assert report["case_count"] >= 8
    assert report["recall_at_k"] >= 0.75
    assert report["mrr_at_k"] >= 0.45
    assert all(case["rank"] is not None for case in report["cases"])


def test_benchmark_reports_clinical_review_status():
    report = evaluate_retrieval(top_k=5)
    assert report["expert_reviewed_count"] == 0
    assert report["candidate_unreviewed_count"] == report["case_count"]
