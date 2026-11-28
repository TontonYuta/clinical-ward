"""
Package 3 Chatbot Workflow Optimization Test Suite:
- Phase 1: /chat & /chat/stream parity, StageTimer, zero duplicate Guardrail/Sandwich/Rewriter LLM calls
- Phase 2: True live token streaming for Hybrid RAG (execute_clinical_rag_stream) + Parallel Prefetch
- Phase 3: Clean Single-Pass Executor Registry & lean copilot_orchestrator.py (<=220 LOC)
"""
from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from app.schemas.clinical_nlu import ClinicalNluExtraction
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.security.output_guardrail import StreamingOutputGuardrail
from app.services.chatbot import copilot_orchestrator
from app.services.chatbot.chat_endpoint_helpers import (
    StageTimer,
    apply_regulatory_session_reset,
    can_use_clinical_cache,
    lookup_validated_clinical_cache,
    persist_aligned_cache_and_vqa,
)
from app.services.chatbot.executors import (
    MANAGED_EXECUTORS,
    WorkflowExecutionContext,
    dispatch_managed_workflow,
)
from app.services.chatbot.pure_rag_handler import is_direct_streamable_rag_query
from app.services.chatbot.sandwich_pipeline import parse_clinical_prompt_nlu
from app.services.rag import rag_pipeline
from app.services.rag.types import RagChunk, RetrievedChunk
from app.services.session_context import SessionState


# ---------------------------------------------------------------------------
# Phase 1: /chat & /chat/stream Parity + Stage Tracing + Zero Duplicate Calls
# ---------------------------------------------------------------------------

def test_chat_stream_cache_parity_blocks_renal_greetings_and_resets_regulatory():
    session = SessionState("sess-parity", "BS. An", "doctor")
    session.set_active_medication(name="Paracetamol")

    # Greetings & patient renal queries MUST bypass cache in both /chat and /chat/stream
    assert can_use_clinical_cache(CopilotQuery(query="xin chào"), "xin chào", session) is False
    assert can_use_clinical_cache(
        CopilotQuery(query="Bệnh nhân 70 tuổi, 55kg, creatinin 2.1 dùng Levofloxacin chỉnh liều thế nào?"),
        "bệnh nhân 70 tuổi, 55kg, creatinin 2.1 dùng levofloxacin chỉnh liều thế nào?",
        session,
    ) is False

    # Switching to regulatory circular MUST reset active_medication
    is_reg = apply_regulatory_session_reset(session, "thông tư 20/2017/tt-byt quy định thuốc gây nghiện thế nào?")
    assert is_reg is True
    assert session.active_medication_name == ""


def test_stale_safe_abstention_cache_treated_as_miss():
    session = SessionState("sess-stale", "BS. An", "doctor")
    stale_resp = CopilotResponse(intent="CLINICAL_AI_CONSULTATION", reply_text="Chưa đủ dữ liệu", answer_type="safe_abstention")
    fake_cache = SimpleNamespace(get=lambda q, user_role=None: stale_resp)

    hit = lookup_validated_clinical_cache(
        fake_cache,
        query="Thông tư 20 quy định gì?",
        user_role="doctor",
        session=session,
        is_reg=True,
        validate_fn=lambda r: r,
        standardize_fn=lambda r, _q: r,
    )
    assert hit is None


def test_stage_timer_and_aligned_cache_persistence():
    timer = StageTimer()
    timer.mark("cache_lookup")
    timer.mark("orchestrator")
    assert "cache_lookup" in timer.timings and "orchestrator" in timer.timings
    assert timer.total_ms() >= 0.0

    session = SessionState("sess-align", "BS. An", "doctor")
    cache_calls = []
    vqa_calls = []
    fake_cache = SimpleNamespace(set=lambda *a, **k: cache_calls.append(a))
    fake_vqa = SimpleNamespace(auto_register_candidate=lambda *a, **k: vqa_calls.append(a))

    # Drifted/poisoned reply MUST NOT be persisted
    bad_resp = CopilotResponse(
        intent="CLINICAL_AI_CONSULTATION",
        reply_text="Zero Free Claims Policy leaked here",
        answer_type="grounded_reference",
    )
    aligned = persist_aligned_cache_and_vqa(
        payload=CopilotQuery(query="Liều Paracetamol 500mg"),
        response=bad_resp,
        user_role="doctor",
        lower_q="liều paracetamol 500mg",
        session=session,
        pre_guard=SimpleNamespace(soft_risk_delta=0.0),
        clinical_cache=fake_cache,
        vqa_service=fake_vqa,
    )
    assert aligned is False
    assert cache_calls == []
    assert vqa_calls == []


def test_pre_validated_query_skips_duplicate_input_guardrail(monkeypatch):
    session = SessionState("sess-dedup", "BS. An", "doctor")
    req = SimpleNamespace(state=SimpleNamespace(), scope={})
    guard_called = {"count": 0}

    def counting_guard(*args, **kwargs):
        guard_called["count"] += 1
        raise AssertionError("validate_input_guardrail must NOT run again when pre_validated_query is supplied")

    monkeypatch.setattr(copilot_orchestrator, "validate_input_guardrail", counting_guard)
    resp = asyncio.run(
        copilot_orchestrator._handle_copilot_chat_core(
            CopilotQuery(query="xin chào"),
            req,
            db=None,
            session=session,
            history="",
            pre_validated_query="xin chào",
        )
    )
    assert guard_called["count"] == 0
    assert resp.reply_text


def test_sandwich_pipeline_reuses_nlu_result_without_extra_llm_call():
    nlu = ClinicalNluExtraction(intent="PATIENT_MEDICATION_COUNSELING", primary_drug="Metformin")
    with patch(
        "app.services.chatbot.clinical_schema_extractor.extract_clinical_query_schema_async",
        new=AsyncMock(side_effect=AssertionError("Must reuse nlu_result instead of calling schema LLM")),
    ):
        res = asyncio.run(parse_clinical_prompt_nlu("Dặn dò bệnh nhân uống thuốc cho dễ hiểu", "doctor", nlu_result=nlu))
    assert res["primary_drug"] == "Metformin"
    assert res["style"] == "patient_guidance"


# ---------------------------------------------------------------------------
# Phase 2: True Live Token Streaming for Hybrid RAG + Parallel Prefetch
# ---------------------------------------------------------------------------

def test_streaming_guardrail_hides_answer_claims_and_json_markers():
    guard = StreamingOutputGuardrail(
        stop_markers=("<answer_claims", "<follow_up_questions", "```json"),
        hold_chars=60,
    )
    chunks = [
        "### Tóm tắt / Kết luận\nTheo Thông tư 20/2017/TT-BYT, ",
        "thuốc gây nghiện phải được bảo quản trong tủ có khóa chắc chắn.\n\n",
        "<ANSWER_CLAIMS>[{\"claim_id\":\"c1\",\"text\":\"test\"}]</ANSWER_CLAIMS>",
    ]
    emitted = []
    for c in chunks:
        out, tripped = guard.feed(c)
        assert tripped is False
        if out:
            emitted.append(out)
    tail = guard.flush()
    if tail:
        emitted.append(tail)

    rendered = "".join(emitted)
    assert "Thông tư 20/2017/TT-BYT" in rendered
    assert "<ANSWER_CLAIMS" not in rendered
    assert "claim_id" not in rendered


def test_direct_streamable_rag_query_gate():
    assert is_direct_streamable_rag_query("thông tư 20/2017/tt-byt quy định bảo quản thuốc gây nghiện thế nào?") is True
    assert is_direct_streamable_rag_query("phác đồ xử trí phản vệ độ 2 dùng adrenalin ra sao?") is True
    # Must NOT hijack navigation, DDI, or renal dose math
    assert is_direct_streamable_rag_query("mở tab kê đơn cpoe giúp tôi") is False
    assert is_direct_streamable_rag_query("warfarin tương tác với metronidazol có nguy hiểm không?") is False
    assert is_direct_streamable_rag_query("bệnh nhân 70 tuổi creatinin 2.0 chỉnh liều thông tư nào?") is False


def test_execute_clinical_rag_stream_emits_live_tokens_and_hides_claims(monkeypatch):
    sample_chunk = RagChunk(
        chunk_id="tt20_p1_1",
        source_doc="thong_tu_20_2017.pdf",
        legal_basis="Thông tư 20/2017/TT-BYT",
        page_or_section="Trang 1",
        title="Quy định bảo quản thuốc gây nghiện",
        content="Thuốc gây nghiện phải được bảo quản trong kho, tủ riêng có khóa chắc chắn và sổ theo dõi xuất nhập.",
        keywords=["gây nghiện", "bảo quản", "thông tư 20"],
        entity_type="regulatory_pdf",
        source_id="backend/data/knowledge_base/thong_tu_20_2017.pdf",
        source_version="sha256:test123",
    )
    fake_retrieved = [RetrievedChunk(chunk=sample_chunk, score=0.95)]
    fake_retriever = SimpleNamespace(
        all_chunks=[sample_chunk],
        retrieve_async=AsyncMock(return_value=fake_retrieved),
    )

    async def fake_stream_grounded(**_kwargs):
        yield "### Tóm tắt / Kết luận\n"
        yield "Theo Thông tư 20/2017/TT-BYT, thuốc gây nghiện phải bảo quản trong tủ riêng có khóa chắc chắn.\n"
        yield '<ANSWER_CLAIMS>[{"claim_id":"c1","text":"Thuốc gây nghiện bảo quản trong tủ riêng có khóa.","claim_type":"source_fact","evidence_ids":["document:tt20_p1_1"]}]</ANSWER_CLAIMS>'

    rag_pipeline._PREFETCH_CACHE.clear()
    monkeypatch.setattr(rag_pipeline, "get_rag_retriever", lambda: fake_retriever)
    monkeypatch.setattr(rag_pipeline, "is_evidence_relevant", lambda _q, _item: True)
    monkeypatch.setattr(rag_pipeline, "stream_grounded_response", fake_stream_grounded)

    async def _run():
        events = []
        async for kind, data in rag_pipeline.execute_clinical_rag_stream(
            "Thông tư 20/2017/TT-BYT quy định bảo quản thuốc gây nghiện thế nào?",
            user_role="doctor",
        ):
            events.append((kind, data))
        return events

    events = asyncio.run(_run())
    statuses = [d for k, d in events if k == "status"]
    tokens = "".join(d for k, d in events if k == "token")
    done_results = [d for k, d in events if k == "done"]

    assert len(statuses) >= 2
    assert "Thông tư 20/2017/TT-BYT" in tokens
    assert "<ANSWER_CLAIMS" not in tokens
    assert len(done_results) == 1
    assert done_results[0].answer


def test_parallel_prefetch_reuses_retrieval_with_single_call(monkeypatch):
    sample_chunk = RagChunk(
        chunk_id="tt51_p1_1",
        source_doc="thong_tu_51_2017.pdf",
        legal_basis="Thông tư 51/2017/TT-BYT",
        page_or_section="Trang 1",
        title="Xử trí phản vệ",
        content="Adrenalin là thuốc thiết yếu hàng đầu tiêm bắp ngay khi chẩn đoán phản vệ độ II trở lên.",
        keywords=["phản vệ", "adrenalin"],
        entity_type="regulatory_pdf",
    )
    retrieve_mock = AsyncMock(return_value=[RetrievedChunk(chunk=sample_chunk, score=0.92)])
    fake_retriever = SimpleNamespace(all_chunks=[sample_chunk], retrieve_async=retrieve_mock)

    rag_pipeline._PREFETCH_CACHE.clear()
    monkeypatch.setattr(rag_pipeline, "get_rag_retriever", lambda: fake_retriever)
    monkeypatch.setattr(rag_pipeline, "is_evidence_relevant", lambda _q, _item: True)
    monkeypatch.setattr(rag_pipeline, "synthesize_grounded_response", AsyncMock(return_value="Adrenalin tiêm bắp ngay."))

    q = "Phác đồ xử trí phản vệ độ II theo Thông tư 51"
    asyncio.run(rag_pipeline.prefetch_clinical_rag_evidence(q))
    assert retrieve_mock.await_count == 1

    asyncio.run(rag_pipeline.execute_clinical_rag(q, user_role="doctor"))
    # Prefetch cache hit -> retrieve_async must NOT be called a second time
    assert retrieve_mock.await_count == 1


# ---------------------------------------------------------------------------
# Phase 3: Clean Single-Pass Executor Registry & Lean Orchestrator
# ---------------------------------------------------------------------------

def test_orchestrator_is_lean_and_all_managed_executors_registered():
    orch_path = Path(copilot_orchestrator.__file__)
    loc = len(orch_path.read_text(encoding="utf-8").splitlines())
    assert loc <= 220, f"copilot_orchestrator.py grew to {loc} LOC (expected <= 220)"

    expected_keys = {
        "conversation", "drug_lookup", "portal_guidance", "ddi",
        "clinical_reasoning", "sandwich", "specialty", "clarification", "multi_intent",
    }
    assert expected_keys.issubset(set(MANAGED_EXECUTORS.keys()))


def test_managed_executor_dispatch_sets_workflow_executor():
    session = SessionState("sess-exec", "BS. An", "doctor")
    req = SimpleNamespace(state=SimpleNamespace(), scope={})
    decision = SimpleNamespace(
        intent="CAPABILITY_OPENING",
        executor_key="conversation",
        reason_code="managed_nlu_intent",
    )
    ctx = WorkflowExecutionContext(
        payload=CopilotQuery(query="bạn có thể hỗ trợ tôi tra cứu thuốc không?"),
        request=req,
        db=None,
        session=session,
        history="",
        user_name="BS. An",
        user_role="doctor",
        session_id=session.session_id,
        query="bạn có thể hỗ trợ tôi tra cứu thuốc không?",
        lower_query="bạn có thể hỗ trợ tôi tra cứu thuốc không?",
        nlu_res=ClinicalNluExtraction(intent="CAPABILITY_OPENING"),
        workflow_decision=decision,
        orch_module=copilot_orchestrator,
    )
    resp = asyncio.run(dispatch_managed_workflow(ctx))
    assert resp is not None
    assert resp.workflow_executor == "conversation"
