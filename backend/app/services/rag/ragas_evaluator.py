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
    llm_error: bool = False


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
    answer_correctness: Optional[float] = None
    unsupported_claims: List[str] = field(default_factory=list)
    generated_questions: List[str] = field(default_factory=list)
    relevant_context_flags: List[bool] = field(default_factory=list)
    judge_error: bool = False
    llm_error: bool = False

    @property
    def overall_score(self) -> float:
        scores = [self.faithfulness, self.answer_relevance, self.context_precision]
        if self.context_recall is not None:
            scores.append(self.context_recall)
        if self.answer_correctness is not None:
            scores.append(self.answer_correctness)
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
            "answer_correctness": round(self.answer_correctness, 4) if self.answer_correctness is not None else None,
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
    from app.services.admin_key_vault import get_active_api_key_async, rotate_to_next_key
    from app.services.gemini_model_discovery import get_available_gemini_models_async

    key = await get_active_api_key_async(provider="gemini") or settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        raise RuntimeError("Missing valid GEMINI_API_KEY for RAGAS LLM judge.")

    models = await get_available_gemini_models_async(api_key=key)
    preferred = [m for m in models if "flash" in m.lower()] or models or ["gemini-3.5-flash-lite"]

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json",
        },
    }
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_sec, connect=5.0)) as client:
        for model in preferred[:4]:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            for _attempt in range(5):
                try:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code in (429, 503):
                        nxt = rotate_to_next_key(key, f"HTTP {resp.status_code}", provider="gemini")
                        if nxt and nxt != key:
                            key = nxt
                            headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
                        await asyncio.sleep(0.8)
                        continue
                    if resp.status_code != 200:
                        break
                    body = resp.json()
                    candidates = body.get("candidates") or []
                    if not candidates:
                        continue
                    parts = (candidates[0].get("content") or {}).get("parts") or []
                    text = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))
                    parsed = _extract_json_dict(text)
                    if parsed:
                        return parsed
                except Exception as exc:
                    logger.warning("RAGAS judge model %s failed: %s", model, exc)
                    break

    # Fallback to multi-provider LiteLLM Router (Groq -> OpenRouter -> Mistral -> Ollama)
    from app.services.litellm_gateway import routed_json_completion

    return await routed_json_completion(
        prompt,
        temperature=0.0,
        max_tokens=1800,
        timeout_sec=timeout_sec,
        preferred_order=["groq-tier", "openrouter-tier", "mistral-tier", "ollama-tier"],
    )


async def default_embed_texts(texts: List[str]) -> List[Optional[List[float]]]:
    """Embed texts using DoAn2's configured EmbeddingProvider with key-pool rotation on transient failures."""
    from app.services.admin_key_vault import get_active_api_key_async, rotate_to_next_key
    from app.services.rag.embeddings.provider import get_embedding_provider

    active_key = await get_active_api_key_async(provider="gemini") or ""
    provider = get_embedding_provider(mock=False)
    vectors = await provider.batch_embed_chunks(texts)
    if texts and any(v is None for v in vectors):
        for _ in range(4):
            rotated = rotate_to_next_key(active_key, provider="gemini")
            if not rotated:
                break
            active_key = rotated
            vectors = await provider.batch_embed_chunks(texts)
            if all(v is not None for v in vectors):
                break
    return vectors


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


async def compute_answer_correctness(
    answer: str,
    ground_truth: str,
    judge_fn: JudgeFn,
    embed_fn: EmbedFn,
) -> Optional[float]:
    """
    RAGAS Answer Correctness (requires ground_truth):
      0.75 * Factual_F1(TP, FP, FN) + 0.25 * Semantic_Similarity(answer, ground_truth)
    """
    clean_gt = (ground_truth or "").strip()
    if not clean_gt:
        return None
    clean_ans = (answer or "").strip()
    if not clean_ans:
        return 0.0

    prompt = (
        "Bạn là giám khảo RAGAS Answer Correctness.\n"
        "Hãy so sánh Câu trả lời với Đáp án chuẩn (Ground Truth) và đếm số mệnh đề:\n"
        "- TP: số ý đúng trong câu trả lời khớp với đáp án chuẩn\n"
        "- FP: số ý trong câu trả lời bị sai hoặc mâu thuẫn/thừa ngoài đáp án chuẩn\n"
        "- FN: số ý quan trọng trong đáp án chuẩn bị thiếu trong câu trả lời\n"
        'Trả về JSON đúng định dạng: {"tp": 2, "fp": 0, "fn": 1}\n\n'
        f"Đáp án chuẩn:\n{clean_gt}\n\n"
        f"Câu trả lời:\n{clean_ans[:6000]}"
    )
    res, vectors = await asyncio.gather(
        judge_fn(prompt),
        embed_fn([clean_ans[:4000], clean_gt]),
    )

    tp = max(0, int(res.get("tp", 0) or 0))
    fp = max(0, int(res.get("fp", 0) or 0))
    fn = max(0, int(res.get("fn", 0) or 0))
    denom = (2 * tp) + fp + fn
    f1 = (2 * tp / denom) if denom > 0 else 0.0

    sem_sim = 0.0
    if vectors and len(vectors) == 2 and vectors[0] is not None and vectors[1] is not None:
        sem_sim = _cosine_similarity(vectors[0], vectors[1])

    return float(0.75 * f1 + 0.25 * sem_sim)


async def evaluate_ragas_sample(
    sample: RagasSample,
    judge_fn: Optional[JudgeFn] = None,
    embed_fn: Optional[EmbedFn] = None,
) -> RagasCaseResult:
    """Evaluate a single RagasSample across all 5 RAGAS metrics."""
    judge = judge_fn or default_gemini_judge
    embedder = embed_fn or default_embed_texts

    if judge_fn is None:
        # Pace live Gemini judge calls sequentially to avoid 503/429 bursts
        faith, unsupported = await compute_faithfulness(sample.answer, sample.contexts, judge)
        await asyncio.sleep(0.4)
        ans_rel, gen_q = await compute_answer_relevance(sample.question, sample.answer, judge, embedder)
        await asyncio.sleep(0.4)
        ctx_prec, rel_flags = await compute_context_precision(sample.question, sample.contexts, judge)
        await asyncio.sleep(0.4)
        ctx_rec = await compute_context_recall(sample.ground_truth or "", sample.contexts, judge)
        await asyncio.sleep(0.4)
        ans_corr = await compute_answer_correctness(sample.answer, sample.ground_truth or "", judge, embedder)
    else:
        (faith, unsupported), (ans_rel, gen_q), (ctx_prec, rel_flags), ctx_rec, ans_corr = await asyncio.gather(
            compute_faithfulness(sample.answer, sample.contexts, judge),
            compute_answer_relevance(sample.question, sample.answer, judge, embedder),
            compute_context_precision(sample.question, sample.contexts, judge),
            compute_context_recall(sample.ground_truth or "", sample.contexts, judge),
            compute_answer_correctness(sample.answer, sample.ground_truth or "", judge, embedder),
        )

    judge_err = bool(judge_fn is None and sample.answer.strip() and not gen_q)
    return RagasCaseResult(
        case_id=sample.case_id,
        category=sample.category,
        question=sample.question,
        faithfulness=faith,
        answer_relevance=ans_rel,
        context_precision=ctx_prec,
        context_recall=ctx_rec,
        answer_correctness=ans_corr,
        unsupported_claims=unsupported,
        generated_questions=gen_q,
        relevant_context_flags=rel_flags,
        judge_error=judge_err,
        llm_error=sample.llm_error,
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
        if judge_fn is None:
            await asyncio.sleep(0.8)

    valid = [r for r in results if not r.judge_error and not r.llm_error]
    scored = valid if valid else results
    n = len(scored)
    avg_faith = sum(r.faithfulness for r in scored) / n if n else 0.0
    avg_ans_rel = sum(r.answer_relevance for r in scored) / n if n else 0.0
    avg_ctx_prec = sum(r.context_precision for r in scored) / n if n else 0.0
    recall_vals = [r.context_recall for r in scored if r.context_recall is not None]
    avg_ctx_rec = (sum(recall_vals) / len(recall_vals)) if recall_vals else None
    corr_vals = [r.answer_correctness for r in scored if r.answer_correctness is not None]
    avg_ans_corr = (sum(corr_vals) / len(corr_vals)) if corr_vals else None

    metric_avgs = [avg_faith, avg_ans_rel, avg_ctx_prec]
    if avg_ctx_rec is not None:
        metric_avgs.append(avg_ctx_rec)
    if avg_ans_corr is not None:
        metric_avgs.append(avg_ans_corr)

    skipped_ids = [r.case_id for r in results if r.judge_error or r.llm_error]
    return {
        "framework": "RAGAS (arXiv:2309.15217)",
        "case_count": len(results),
        "valid_case_count": len(valid),
        "skipped_gemini_error_count": len(skipped_ids),
        "skipped_case_ids": skipped_ids,
        "summary": {
            "faithfulness": round(avg_faith, 4),
            "answer_relevance": round(avg_ans_rel, 4),
            "context_precision": round(avg_ctx_prec, 4),
            "context_recall": round(avg_ctx_rec, 4) if avg_ctx_rec is not None else None,
            "answer_correctness": round(avg_ans_corr, 4) if avg_ans_corr is not None else None,
            "ragas_overall": round(sum(metric_avgs) / len(metric_avgs), 4) if metric_avgs else 0.0,
        },
        "cases": [r.to_dict() for r in results],
    }


async def collect_live_ragas_samples(
    cases_path: Path = DEFAULT_RAGAS_CASES_PATH,
    top_k: int = 5,
    mode: str = "gemini",
) -> tuple[List[RagasSample], float]:
    """Query DoAn2's live retriever/chatbot in the selected mode ('offline' | 'gemini' | 'gemini_serper')."""
    import os
    import time
    from app.services.rag.hybrid_retriever import HybridRetriever
    from app.services.rag.rag_pipeline import execute_clinical_rag

    cases = json.loads(cases_path.read_text(encoding="utf-8"))
    retriever = HybridRetriever()
    samples: List[RagasSample] = []
    latencies_ms: List[float] = []

    saved_env_key = os.environ.get("GEMINI_API_KEY")
    saved_settings_key = settings.GEMINI_API_KEY
    active_key = (saved_settings_key or saved_env_key or "").strip()
    key_pool: List[str] = []
    try:
        from app.services.admin_key_vault import _load_vault_data
        for k_item in _load_vault_data():
            raw_k = (k_item.get("raw_key") or "").strip()
            if k_item.get("provider") == "gemini" and raw_k and k_item.get("status") in ("active", "standby"):
                if raw_k not in key_pool:
                    key_pool.append(raw_k)
    except Exception:
        pass
    if active_key and active_key not in key_pool:
        key_pool.insert(0, active_key)

    try:
        for idx, case in enumerate(cases):
            cid = case["id"]
            query = case["query"]
            t0 = time.monotonic()
            case_key = key_pool[idx % len(key_pool)] if key_pool else active_key
            llm_err = False

            if mode == "offline":
                os.environ.pop("GEMINI_API_KEY", None)
                settings.GEMINI_API_KEY = ""
                retrieved = retriever.retrieve(query, top_k=top_k)
                rag_res = await execute_clinical_rag(query=query, user_role="doctor", api_key="")
                answer = str(getattr(rag_res, "answer", "") or "")
                contexts = _format_retrieved_contexts(retrieved, rag_res)
            elif mode == "gemini_serper":
                from app.services.chatbot.web_search_engine import search_serper
                if case_key:
                    os.environ["GEMINI_API_KEY"] = case_key
                    settings.GEMINI_API_KEY = case_key
                web_res = await search_serper(query, max_results=top_k)
                contexts = [
                    f"[{getattr(it, 'title', 'Web')}] {getattr(it, 'snippet', '')}".strip()
                    for it in (web_res or [])
                    if (getattr(it, "snippet", "") or "").strip()
                ]
                answer = await _synthesize_serper_answer(query, contexts, case_key) if contexts and case_key else ""
                llm_err = bool(contexts and not answer.strip())
                await asyncio.sleep(1.0)
            else:
                if case_key:
                    os.environ["GEMINI_API_KEY"] = case_key
                    settings.GEMINI_API_KEY = case_key
                retrieved = await retriever.retrieve_async(query, top_k=top_k)
                rag_res = await execute_clinical_rag(query=query, user_role="doctor", api_key=case_key or None)
                answer = str(getattr(rag_res, "answer", "") or "")
                contexts = _format_retrieved_contexts(retrieved, rag_res)
                if contexts and (
                    answer.startswith("### Tóm tắt nhanh")
                    or answer.startswith("### Thông tin trích xuất")
                    or not answer.strip()
                ):
                    llm_err = True
                await asyncio.sleep(1.0)

            latencies_ms.append((time.monotonic() - t0) * 1000.0)
            samples.append(
                RagasSample(
                    case_id=cid,
                    category=case.get("category", "general"),
                    question=query,
                    answer=answer,
                    contexts=contexts,
                    ground_truth=case.get("ground_truth"),
                    llm_error=llm_err,
                )
            )
    finally:
        if saved_env_key is not None:
            os.environ["GEMINI_API_KEY"] = saved_env_key
        else:
            os.environ.pop("GEMINI_API_KEY", None)
        settings.GEMINI_API_KEY = saved_settings_key

    avg_latency_ms = round(sum(latencies_ms) / len(latencies_ms), 1) if latencies_ms else 0.0
    return samples, avg_latency_ms


def _format_retrieved_contexts(retrieved: Sequence[Any], rag_res: Any) -> List[str]:
    contexts: List[str] = []
    seen_texts: set[str] = set()
    evidence_items = getattr(rag_res, "evidence", None) or []
    for ev in evidence_items:
        if isinstance(ev, dict):
            content = str(ev.get("content") or "").strip()
            src = str(ev.get("source_id") or ev.get("evidence_type") or "Tài liệu").strip()
            if content and content not in seen_texts:
                seen_texts.add(content)
                contexts.append(f"[{src}] {content}")

    for item in retrieved:
        chunk = getattr(item, "chunk", item)
        if isinstance(chunk, dict):
            title = chunk.get("title") or chunk.get("source_doc") or chunk.get("source") or "Tài liệu"
            content = (chunk.get("content") or "").strip()
        else:
            title = getattr(chunk, "title", None) or getattr(chunk, "source_doc", None) or "Tài liệu"
            content = (getattr(chunk, "content", "") or "").strip()
        if content and content not in seen_texts:
            seen_texts.add(content)
            contexts.append(f"[{title}] {content}")
    if not contexts:
        for cit in getattr(rag_res, "citations", None) or []:
            snippet = str(getattr(cit, "excerpt", None) or getattr(cit, "source", "") or "").strip()
            if snippet:
                contexts.append(snippet)
    return contexts


async def _synthesize_serper_answer(query: str, contexts: List[str], api_key: str) -> str:
    from app.services.gemini_model_discovery import get_available_gemini_models_async

    prompt = (
        "Bạn là Dược sĩ Lâm sàng. Hãy trả lời ngắn gọn, chính xác câu hỏi sau chỉ dựa trên các nguồn web dưới đây:\n\n"
        f"Câu hỏi: {query}\n\nNguồn web:\n" + "\n".join(f"- {c}" for c in contexts[:5])
    )
    models = await get_available_gemini_models_async(api_key=api_key)
    preferred = [m for m in models if "flash" in m.lower()] or ["gemini-2.5-flash"]
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {"temperature": 0.1}}
    async with httpx.AsyncClient(timeout=25.0) as client:
        for model in preferred[:3]:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                resp = await client.post(url, headers=headers, json=payload)
            except Exception as exc:
                logger.warning("Serper synthesis model %s failed: %s", model, exc)
                continue
            if resp.status_code != 200:
                continue
            cands = resp.json().get("candidates") or []
            if cands:
                parts = (cands[0].get("content") or {}).get("parts") or []
                txt = "".join(p.get("text", "") for p in parts if isinstance(p, dict)).strip()
                if txt:
                    return txt
    return ""


async def run_live_ragas_evaluation(
    cases_path: Path = DEFAULT_RAGAS_CASES_PATH,
    top_k: int = 5,
    collect_only: bool = False,
    mode: str = "gemini",
) -> Dict[str, Any]:
    """End-to-end live RAGAS evaluation against DoAn2 chatbot + retriever."""
    if mode == "all" and not collect_only:
        comparison: Dict[str, Any] = {}
        for m in ("offline", "gemini", "gemini_serper"):
            samples, avg_ms = await collect_live_ragas_samples(cases_path=cases_path, top_k=top_k, mode=m)
            rep = await evaluate_ragas_dataset(samples)
            rep["mode"] = m
            rep["avg_latency_ms"] = avg_ms
            comparison[m] = rep
        return {
            "framework": "RAGAS (arXiv:2309.15217)",
            "mode": "all",
            "summary_by_mode": {
                m: {**comparison[m]["summary"], "avg_latency_ms": comparison[m]["avg_latency_ms"]}
                for m in ("offline", "gemini", "gemini_serper")
            },
            "reports": comparison,
        }

    samples, avg_ms = await collect_live_ragas_samples(cases_path=cases_path, top_k=top_k, mode=mode)
    if collect_only:
        return {
            "framework": "RAGAS (arXiv:2309.15217)",
            "mode": f"collect_only:{mode}",
            "avg_latency_ms": avg_ms,
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
    report = await evaluate_ragas_dataset(samples)
    report["mode"] = mode
    report["avg_latency_ms"] = avg_ms
    return report


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run RAGAS evaluation for DoAn2.")
    parser.add_argument("--collect-only", action="store_true")
    parser.add_argument("--mode", choices=["offline", "gemini", "gemini_serper", "all"], default="gemini")
    args = parser.parse_args()
    report = asyncio.run(run_live_ragas_evaluation(collect_only=args.collect_only, mode=args.mode))
    print(json.dumps(report, ensure_ascii=False, indent=2))
