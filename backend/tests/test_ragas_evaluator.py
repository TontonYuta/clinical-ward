import json
from pathlib import Path

import pytest

from app.services.rag.ragas_evaluator import (
    RagasSample,
    compute_answer_correctness,
    compute_answer_relevance,
    compute_context_precision,
    compute_context_recall,
    compute_faithfulness,
    evaluate_ragas_dataset,
)


async def _mock_judge(prompt: str):
    if "tách câu trả lời" in prompt:
        return {"statements": ["Liều tối đa 4 g/ngày.", "Thuốc chữa được mọi bệnh."]}
    if "RAGAS Faithfulness" in prompt:
        return {
            "verdicts": [
                {"statement": "Liều tối đa 4 g/ngày.", "supported": True},
                {"statement": "Thuốc chữa được mọi bệnh.", "supported": False},
            ]
        }
    if "sinh ra đúng" in prompt:
        return {"questions": ["Liều tối đa Paracetamol là bao nhiêu?", "Paracetamol dùng tối đa mấy gam?"]}
    if "RAGAS Context Precision" in prompt:
        return {
            "relevance": [
                {"index": 0, "relevant": True},
                {"index": 1, "relevant": False},
                {"index": 2, "relevant": True},
            ]
        }
    if "Ground Truth" in prompt and "classifications" in prompt:
        return {
            "classifications": [
                {"statement": "Ý 1", "attributed": True},
                {"statement": "Ý 2", "attributed": False},
            ]
        }
    if "RAGAS Answer Correctness" in prompt:
        return {"tp": 2, "fp": 0, "fn": 1}
    return {}


async def _mock_embed(texts):
    # Query and first generated question match closely; second has partial angle.
    mapping = {}
    out = []
    for idx, _ in enumerate(texts):
        if idx == 0:
            out.append([1.0, 0.0, 0.0])
        elif idx == 1:
            out.append([1.0, 0.0, 0.0])
        else:
            out.append([0.6, 0.8, 0.0])
    return out


@pytest.mark.asyncio
async def test_faithfulness_scores_partial_hallucination():
    score, unsupported = await compute_faithfulness(
        answer="Liều tối đa 4 g/ngày. Thuốc chữa được mọi bệnh.",
        contexts=["Paracetamol liều tối đa người lớn 4 g/ngày."],
        judge_fn=_mock_judge,
    )
    assert score == pytest.approx(0.5)
    assert unsupported == ["Thuốc chữa được mọi bệnh."]


@pytest.mark.asyncio
async def test_faithfulness_returns_zero_when_contexts_empty():
    score, unsupported = await compute_faithfulness(
        answer="Liều tối đa 4 g/ngày.",
        contexts=[],
        judge_fn=_mock_judge,
    )
    assert score == 0.0
    assert len(unsupported) == 2


@pytest.mark.asyncio
async def test_answer_relevance_averages_cosine_similarities():
    score, questions = await compute_answer_relevance(
        question="Paracetamol liều tối đa bao nhiêu?",
        answer="Liều tối đa 4 g/ngày.",
        judge_fn=_mock_judge,
        embed_fn=_mock_embed,
        n_questions=2,
    )
    assert len(questions) == 2
    assert score == pytest.approx(0.8, abs=1e-4)


@pytest.mark.asyncio
async def test_context_precision_ap_at_k():
    # Relevant at rank 1 and rank 3 -> (1/1 + 2/3) / 2 = 0.8333...
    score, flags = await compute_context_precision(
        question="Liều tối đa?",
        contexts=["Chunk A", "Chunk B", "Chunk C"],
        judge_fn=_mock_judge,
    )
    assert flags == [True, False, True]
    assert score == pytest.approx((1.0 + 2.0 / 3.0) / 2.0, abs=1e-4)


@pytest.mark.asyncio
async def test_context_recall_and_dataset_aggregation():
    recall = await compute_context_recall(
        ground_truth="Ý 1. Ý 2.",
        contexts=["Chunk chứa ý 1."],
        judge_fn=_mock_judge,
    )
    assert recall == pytest.approx(0.5)

    report = await evaluate_ragas_dataset(
        samples=[
            RagasSample(
                case_id="c1",
                category="drug_dosing",
                question="Paracetamol liều tối đa?",
                answer="Liều tối đa 4 g/ngày. Thuốc chữa được mọi bệnh.",
                contexts=["Chunk A", "Chunk B", "Chunk C"],
                ground_truth="Ý 1. Ý 2.",
            )
        ],
        judge_fn=_mock_judge,
        embed_fn=_mock_embed,
    )
    assert report["case_count"] == 1
    assert report["summary"]["faithfulness"] == pytest.approx(0.5)
    assert report["summary"]["context_recall"] == pytest.approx(0.5)
    assert report["summary"]["answer_correctness"] is not None
    assert report["summary"]["ragas_overall"] > 0.6


@pytest.mark.asyncio
async def test_answer_correctness_combines_factual_f1_and_semantic_similarity():
    # tp=2, fp=0, fn=1 -> F1 = 4/5 = 0.8; identical mock vectors -> sim=1.0
    # 0.75 * 0.8 + 0.25 * 1.0 = 0.85
    score = await compute_answer_correctness(
        answer="Liều tối đa 4 g/ngày.",
        ground_truth="Liều tối đa 4 g/ngày cho người lớn.",
        judge_fn=_mock_judge,
        embed_fn=_mock_embed,
    )
    assert score == pytest.approx(0.85, abs=1e-4)


def test_ragas_cases_json_schema_is_valid():
    cases_path = (
        Path(__file__).resolve().parents[1]
        / "data"
        / "knowledge_base"
        / "evaluation"
        / "ragas_cases.json"
    )
    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    assert len(cases) >= 20
    categories = {c["category"] for c in cases}
    assert {"ddi_safety", "clinical_guideline", "regulatory_circular", "organ_dosing"} <= categories
    for case in cases:
        assert case["id"]
        assert case["query"]
        assert case["ground_truth"]
