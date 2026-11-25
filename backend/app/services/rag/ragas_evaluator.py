"""
RAGAS (Retrieval Augmented Generation Assessment) evaluator for DoAn2.

Implements the core metrics from:
  Es et al. (2023), "RAGAS: Automated Evaluation of Retrieval Augmented Generation"
  (arXiv:2309.15217, https://github.com/explodinggradients/ragas)

Metrics:
  - Faithfulness: atomic statement decomposition + context verification
  - Answer Relevance: reverse-question generation + embedding cosine similarity
  - Context Precision: ranked relevance (Precision@k) of retrieved contexts
  - Context Recall: ground-truth statement attribution in retrieved contexts
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence

import httpx
import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)

JudgeFn = Callable[[str], Awaitable[Dict[str, Any]]]
EmbedFn = Callable[[List[str]], Awaitable[List[Optional[List[float]]]]]

DEFAULT_RAGAS_CASES_PATH = (
    Path(__file__).resolve().parents[3]
    / "data"
    / "knowledge_base"
    / "evaluation"
    / "ragas_cases.json"
)


@dataclass
class RagasSample:
    """Single RAGAS evaluation sample."""
    case_id: str
    question: str
    answer: str
    contexts: List[str]
    ground_truth: Optional[str] = None
    category: str = "general"


@dataclass
class RagasCaseResult:
    """Per-case RAGAS scores and diagnostics."""
    case_id: str
    category: str
    question: str
    faithfulness: float
    answer_relevance: float
    context_precision: float
    context_recall: Optional[float] = None
    unsupported_claims: List[str] = field(default_factory=list)
    generated_questions: List[str] = field(default_factory=list)
    relevant_context_flags: List[bool] = field(default_factory=list)

    @property
    def overall_score(self) -> float:
        scores = [self.faithfulness, self.answer_relevance, self.context_precision]
        if self.context_recall is not None:
            scores.append(self.context_recall)
        return float(sum(scores) / len(scores)) if scores else 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "case_id": self.case_id,
            "category": self.category,
            "question": self.question,
            "faithfulness": round(self.faithfulness, 4),
            "answer_relevance": round(self.answer_relevance, 4),
            "context_precision": round(self.context_precision, 4),
            "context_recall": round(self.context_recall, 4) if self.context_recall is not None else None,
            "overall_score": round(self.overall_score, 4),
            "unsupported_claims": self.unsupported_claims,
            "generated_questions": self.generated_questions,
            "relevant_context_flags": self.relevant_context_flags,
        }


def _cosine_similarity(vec_a: Sequence[float], vec_b: Sequence[float]) -> float:
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)
    norm_a = float(np.linalg.norm(a))
    norm_b = float(np.linalg.norm(b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    sim = float(np.dot(a, b) / (norm_a * norm_b))
    return max(0.0, min(1.0, sim))


def _extract_json_dict(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        return {}
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, dict) else {}
            except json.JSONDecodeError:
                return {}
        return {}


async def default_gemini_judge(prompt: str, timeout_sec: float = 25.0) -> Dict[str, Any]:
    """Call Gemini REST API as a structured JSON judge using the active vault key."""
    from app.services.admin_key_vault import get_active_api_key_async
    from app.services.gemini_model_discovery import get_available_gemini_models_async

    key = await get_active_api_key_async(provider="gemini") or settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        raise RuntimeError("Missing valid GEMINI_API_KEY for RAGAS LLM judge.")

    models = await get_available_gemini_models_async(api_key=key)
    preferred = [m for m in models if "flash" in m.lower()] or models or ["gemini-2.5-flash"]

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json",
        },
    }
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_sec, connect=5.0)) as client:
        for model in preferred[:3]:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code != 200:
                    continue
                body = resp.json()
                candidates = body.get("candidates") or []
                if not candidates:
                    continue
                parts = (candidates[0].get("content") or {}).get("parts") or []
                text = "".join(p.get("text", "") for p in parts if isinstance(p, dict))
                parsed = _extract_json_dict(text)
                if parsed:
                    return parsed
            except Exception as exc:
                logger.warning("RAGAS judge model %s failed: %s", model, exc)
    return {}


async def default_embed_texts(texts: List[str]) -> List[Optional[List[float]]]:
    """Embed texts using DoAn2's configured EmbeddingProvider."""
    from app.services.rag.embeddings.provider import get_embedding_provider

    provider = get_embedding_provider(mock=False)
    return await provider.batch_embed_chunks(texts)


async def compute_faithfulness(
    answer: str,
    contexts: List[str],
    judge_fn: JudgeFn,
) -> tuple[float, List[str]]:
    """
    RAGAS Faithfulness:
      1. Decompose `answer` into atomic factual claims.
      2. Verify each claim against `contexts`.
      3. Return (supported_count / total_claims, unsupported_claims).
    """
    clean_answer = (answer or "").strip()
    if not clean_answer:
        return 0.0, []

    decomp_prompt = (
        "Hãy tách câu trả lời y tế/pháp lý sau thành danh sách các mệnh đề sự thật nguyên tử (atomic claims). "
        "Bỏ qua lời chào xã giao hoặc câu chuyển tiếp.\n"
        'Trả về JSON đúng định dạng: {"statements": ["mệnh đề 1", "mệnh đề 2"]}\n\n'
        f"Câu trả lời:\n{clean_answer}"
    )
    decomp_res = await judge_fn(decomp_prompt)
    statements = [str(s).strip() for s in (decomp_res.get("statements") or []) if str(s).strip()]
    if not statements:
        return 1.0, []

    joined_context = "\n\n---\n\n".join(c.strip() for c in contexts if c and c.strip())
    if not joined_context:
        return 0.0, statements

    verify_prompt = (
        "Bạn là giám khảo đánh giá độ trung thực RAG (RAGAS Faithfulness).\n"
        "Dựa DUY NHẤT vào Ngữ cảnh dưới đây, hãy kiểm tra từng mệnh đề xem có được ngữ cảnh hỗ trợ/suy ra trực tiếp hay không (verdict: true/false).\n"
        'Trả về JSON đúng định dạng: {"verdicts": [{"statement": "...", "supported": true}]}\n\n'
        f"Ngữ cảnh:\n{joined_context[:12000]}\n\n"
        f"Danh sách mệnh đề:\n{json.dumps(statements, ensure_ascii=False)}"
    )
    verify_res = await judge_fn(verify_prompt)
    verdicts = verify_res.get("verdicts") or []

    supported_count = 0
    unsupported: List[str] = []
    for idx, stmt in enumerate(statements):
        verdict_item = verdicts[idx] if idx < len(verdicts) and isinstance(verdicts[idx], dict) else {}
        is_supported = bool(verdict_item.get("supported", False))
        if is_supported:
            supported_count += 1
        else:
            unsupported.append(stmt)

    score = supported_count / len(statements)
    return float(score), unsupported


async def compute_answer_relevance(
    question: str,
    answer: str,
    judge_fn: JudgeFn,
    embed_fn: EmbedFn,
    n_questions: int = 3,
) -> tuple[float, List[str]]:
    """
    RAGAS Answer Relevance:
      1. Reverse-generate `n_questions` questions that `answer` directly addresses.
      2. Compute mean cosine similarity between `question` and each generated question.
    """
    clean_answer = (answer or "").strip()
    clean_question = (question or "").strip()
    if not clean_answer or not clean_question:
        return 0.0, []

    rev_prompt = (
        f"Dựa vào câu trả lời sau, hãy sinh ra đúng {n_questions} câu hỏi tiếng Việt tự nhiên mà câu trả lời này giải đáp trực tiếp.\n"
        'Trả về JSON đúng định dạng: {"questions": ["câu hỏi 1", "câu hỏi 2", "câu hỏi 3"]}\n\n'
        f"Câu trả lời:\n{clean_answer[:6000]}"
    )
    rev_res = await judge_fn(rev_prompt)
    generated = [str(q).strip() for q in (rev_res.get("questions") or []) if str(q).strip()][:n_questions]
    if not generated:
        return 0.0, []

    vectors = await embed_fn([clean_question, *generated])
    if not vectors or vectors[0] is None:
        return 0.0, generated

    q_vec = vectors[0]
    sims = [_cosine_similarity(q_vec, v) for v in vectors[1:] if v is not None]
    if not sims:
        return 0.0, generated
    return float(sum(sims) / len(sims)), generated


async def compute_context_precision(
    question: str,
    contexts: List[str],
    judge_fn: JudgeFn,
) -> tuple[float, List[bool]]:
    """
    RAGAS Context Precision@k:
      Evaluates whether relevant chunks are ranked at the top of `contexts`.
      AP@K = sum_{k=1..K} (Precision@k * rel_k) / total_relevant
    """
    clean_contexts = [c.strip() for c in contexts if c and c.strip()]
    if not clean_contexts:
        return 0.0, []

    numbered = [{"index": i, "text": c[:1500]} for i, c in enumerate(clean_contexts)]
    prompt = (
        "Bạn là giám khảo đánh giá chất lượng truy xuất RAG (RAGAS Context Precision).\n"
        "Với mỗi đoạn ngữ cảnh, hãy xác định xem đoạn đó có chứa thông tin hữu ích/liên quan để trả lời câu hỏi hay không.\n"
        'Trả về JSON đúng định dạng: {"relevance": [{"index": 0, "relevant": true}]}\n\n'
        f"Câu hỏi: {question}\n\n"
        f"Các đoạn ngữ cảnh:\n{json.dumps(numbered, ensure_ascii=False)}"
    )
    res = await judge_fn(prompt)
    rel_items = res.get("relevance") or []
    flags: List[bool] = []
    for i in range(len(clean_contexts)):
        item = rel_items[i] if i < len(rel_items) and isinstance(rel_items[i], dict) else {}
        flags.append(bool(item.get("relevant", False)))

    total_relevant = sum(1 for f in flags if f)
    if total_relevant == 0:
        return 0.0, flags

    precision_sum = 0.0
    running_rel = 0
    for k, is_rel in enumerate(flags, start=1):
        if is_rel:
            running_rel += 1
            precision_sum += running_rel / k
    return float(precision_sum / total_relevant), flags


async def compute_context_recall(
    ground_truth: str,
    contexts: List[str],
    judge_fn: JudgeFn,
) -> Optional[float]:
    """
    RAGAS Context Recall (requires ground_truth):
      Fraction of statements in `ground_truth` attributable to `contexts`.
    """
    clean_gt = (ground_truth or "").strip()
    if not clean_gt:
        return None
    joined_context = "\n\n---\n\n".join(c.strip() for c in contexts if c and c.strip())
    if not joined_context:
        return 0.0

    prompt = (
        "Hãy tách đáp án chuẩn (Ground Truth) thành các ý chính nguyên tử và kiểm tra từng ý xem có xuất hiện/suy ra được từ Ngữ cảnh truy xuất hay không.\n"
        'Trả về JSON đúng định dạng: {"classifications": [{"statement": "...", "attributed": true}]}\n\n'
        f"Đáp án chuẩn:\n{clean_gt}\n\n"
        f"Ngữ cảnh truy xuất:\n{joined_context[:12000]}"
    )
    res = await judge_fn(prompt)
    items = [it for it in (res.get("classifications") or []) if isinstance(it, dict)]
    if not items:
        return 0.0
    attributed = sum(1 for it in items if bool(it.get("attributed", False)))
    return float(attributed / len(items))


async def evaluate_ragas_sample(
    sample: RagasSample,
    judge_fn: Optional[JudgeFn] = None,
    embed_fn: Optional[EmbedFn] = None,
) -> RagasCaseResult:
    """Evaluate a single RagasSample across all 4 RAGAS metrics."""
    judge = judge_fn or default_gemini_judge
    embedder = embed_fn or default_embed_texts

    (faith, unsupported), (ans_rel, gen_q), (ctx_prec, rel_flags), ctx_rec = await asyncio.gather(
        compute_faithfulness(sample.answer, sample.contexts, judge),
        compute_answer_relevance(sample.question, sample.answer, judge, embedder),
        compute_context_precision(sample.question, sample.contexts, judge),
        compute_context_recall(sample.ground_truth or "", sample.contexts, judge),
    )

    return RagasCaseResult(
        case_id=sample.case_id,
        category=sample.category,
        question=sample.question,
        faithfulness=faith,
        answer_relevance=ans_rel,
        context_precision=ctx_prec,
        context_recall=ctx_rec,
        unsupported_claims=unsupported,
        generated_questions=gen_q,
        relevant_context_flags=rel_flags,
    )


async def evaluate_ragas_dataset(
    samples: List[RagasSample],
    judge_fn: Optional[JudgeFn] = None,
    embed_fn: Optional[EmbedFn] = None,
) -> Dict[str, Any]:
    """Evaluate a list of RagasSample items and compute aggregate RAGAS metrics."""
    results: List[RagasCaseResult] = []
    for sample in samples:
        results.append(await evaluate_ragas_sample(sample, judge_fn=judge_fn, embed_fn=embed_fn))

    n = len(results)
    avg_faith = sum(r.faithfulness for r in results) / n if n else 0.0
    avg_ans_rel = sum(r.answer_relevance for r in results) / n if n else 0.0
    avg_ctx_prec = sum(r.context_precision for r in results) / n if n else 0.0
    recall_vals = [r.context_recall for r in results if r.context_recall is not None]
    avg_ctx_rec = (sum(recall_vals) / len(recall_vals)) if recall_vals else None

    metric_avgs = [avg_faith, avg_ans_rel, avg_ctx_prec]
    if avg_ctx_rec is not None:
        metric_avgs.append(avg_ctx_rec)

    return {
        "framework": "RAGAS (arXiv:2309.15217)",
        "case_count": n,
        "summary": {
            "faithfulness": round(avg_faith, 4),
            "answer_relevance": round(avg_ans_rel, 4),
            "context_precision": round(avg_ctx_prec, 4),
            "context_recall": round(avg_ctx_rec, 4) if avg_ctx_rec is not None else None,
            "ragas_overall": round(sum(metric_avgs) / len(metric_avgs), 4) if metric_avgs else 0.0,
        },
        "cases": [r.to_dict() for r in results],
    }


async def collect_live_ragas_samples(
    cases_path: Path = DEFAULT_RAGAS_CASES_PATH,
    top_k: int = 5,
) -> List[RagasSample]:
    """Query DoAn2's live HybridRetriever + clinical RAG pipeline to build RagasSample items."""
    from app.services.rag.hybrid_retriever import HybridRetriever
    from app.services.rag.rag_pipeline import execute_clinical_rag

    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    retriever = HybridRetriever()
    samples: List[RagasSample] = []

    for case in cases:
        cid = case["id"]
        query = case["query"]

        retrieved = retriever.retrieve(query, top_k=top_k)
        contexts: List[str] = []
        for item in retrieved:
            chunk = getattr(item, "chunk", item)
            if isinstance(chunk, dict):
                title = chunk.get("title") or chunk.get("source_doc") or chunk.get("source") or "Tài liệu"
                content = (chunk.get("content") or "").strip()
            else:
                title = getattr(chunk, "title", None) or getattr(chunk, "source_doc", None) or "Tài liệu"
                content = (getattr(chunk, "content", "") or "").strip()
            if content:
                contexts.append(f"[{title}] {content}")

        rag_res = await execute_clinical_rag(query=query, user_role="doctor")
        answer = str(getattr(rag_res, "answer", "") or "")

        if not contexts:
            for cit in getattr(rag_res, "citations", None) or []:
                snippet = str(getattr(cit, "excerpt", None) or getattr(cit, "source", "") or "").strip()
                if snippet:
                    contexts.append(snippet)

        samples.append(
            RagasSample(
                case_id=cid,
                category=case.get("category", "general"),
                question=query,
                answer=answer,
                contexts=contexts,
                ground_truth=case.get("ground_truth"),
            )
        )
    return samples


async def run_live_ragas_evaluation(
    cases_path: Path = DEFAULT_RAGAS_CASES_PATH,
    top_k: int = 5,
    collect_only: bool = False,
) -> Dict[str, Any]:
    """End-to-end live RAGAS evaluation against DoAn2 chatbot + retriever."""
    samples = await collect_live_ragas_samples(cases_path=cases_path, top_k=top_k)
    if collect_only:
        return {
            "framework": "RAGAS (arXiv:2309.15217)",
            "mode": "collect_only",
            "case_count": len(samples),
            "samples": [
                {
                    "case_id": s.case_id,
                    "category": s.category,
                    "question": s.question,
                    "answer_preview": s.answer[:220],
                    "context_count": len(s.contexts),
                    "top_context_preview": s.contexts[0][:180] if s.contexts else "",
                }
                for s in samples
            ],
        }
    return await evaluate_ragas_dataset(samples)


if __name__ == "__main__":
    import sys

    collect_only_flag = "--collect-only" in sys.argv
    report = asyncio.run(run_live_ragas_evaluation(collect_only=collect_only_flag))
    print(json.dumps(report, ensure_ascii=False, indent=2))
