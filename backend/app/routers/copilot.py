"""
Router API Trợ Lý Agent Lâm Sàng Thông Minh (Copilot & Clinical RAG) (<=80 LOC)
"""
import uuid
import time
import json
import asyncio
import re
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.copilot_log import CopilotChatLog
from app.schemas.copilot import CopilotQuery, CopilotResponse, RagQuery, RagResponse, CopilotChatLogResponse
from app.services.session_context import get_or_create_session
from app.security.guardrails import validate_input_guardrail, validate_output_guardrail
from app.services.chatbot.copilot_orchestrator import (
    resolve_copilot_identity,
    handle_copilot_chat
)

__all__ = ["router", "resolve_copilot_identity"]

router = APIRouter(prefix="/copilot", tags=["Trợ Lý Agent Lâm Sàng Thông Minh"])


def validate_cached_chat_response(response: CopilotResponse) -> CopilotResponse:
    """Recheck persisted responses against the current provenance contract."""
    from app.services.chatbot.offline_drug_reply_formatter import format_offline_drug_reply
    response = format_offline_drug_reply(response)
    from app.services.chatbot.copilot_orchestrator import validate_response_evidence_contract
    response = validate_response_evidence_contract(response)
    if response.answer_type == "safe_abstention":
        response.citations = []
        response.evidence = []
    return response


def format_offline_drug_response(response: CopilotResponse) -> CopilotResponse:
    from app.services.chatbot.offline_drug_reply_formatter import format_offline_drug_reply
    return format_offline_drug_reply(response)

def _sse_event(event_type: str, **payload) -> str:
    event_payload = json.dumps({"type": event_type, **payload}, ensure_ascii=False)
    return f"data: {event_payload}\n\n"

@router.post("/chat", response_model=CopilotResponse)
async def chat_with_copilot(
    payload: CopilotQuery,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    from app.services.llm_provider import reset_llm_execution
    reset_llm_execution()
    start_time = time.monotonic()
    user_name, user_role, session_id = resolve_copilot_identity(payload, request)
    session = get_or_create_session(session_id, user_name, user_role)

    from app.services.cache.clinical_cache import get_clinical_cache
    clinical_cache = get_clinical_cache()

    can_use_cache = True
    if payload.image_base64:
        can_use_cache = False
    lower_q = payload.query.lower()
    if any(w in lower_q for w in (
        "này", "đó", "kia", "nó", "vừa rồi", "thuốc này", "thuốc đó", "thuốc có", "thuốc kia", "hai thuốc", "2 thuốc",
        "tuổi", "kg", "creatinin", "crcl", "egfr", "bệnh nhân", "người bệnh", "suy thận", "chỉnh liều"
    )):
        can_use_cache = False
    elif session.active_medication_name:
        has_explicit_drug = bool(session.active_medication_name.casefold() in lower_q)
        if not has_explicit_drug:
            try:
                from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
                has_explicit_drug = bool(get_drug_lexical_matcher().extract_medications(payload.query))
            except Exception:
                has_explicit_drug = False
        if not has_explicit_drug:
            can_use_cache = False

    is_regulatory_q = any(w in lower_q for w in (
        "thông tư", "tt 26", "tt 20", "tt 51", "tt 36", "tt 22", "tt 52",
        "nghị định", "luật dược", "quy chế", "quản lý", "chuỗi lạnh", "fefo", "kê đơn", "đơn thuốc", "bảo hiểm", "bhyt"
    ))
    if is_regulatory_q:
        session.set_active_medication(name="", ingredient="", sdk="")

    cached_resp = clinical_cache.get(payload.query, user_role=user_role) if can_use_cache else None
    if cached_resp:
        validated = validate_cached_chat_response(cached_resp.model_copy(deep=True))
        if validated.answer_type == "safe_abstention" or (
            cached_resp.intent == "MEDICATION_SAFETY_PROFILE" and not getattr(cached_resp, "clinical_summary", None)
        ):
            # Stale cache entry lacking valid provenance evidence or structured schema -> treat as cache miss & recompute
            cached_resp = None
        else:
            response = validated
            response.session_id = session.session_id
            from app.services.chatbot.citation_standardizer import standardize_response_citations
            response = standardize_response_citations(response, payload.query)
            session.append_conversation_turn(payload.query, response.reply_text)
            if response.active_medication_name and not is_regulatory_q:
                session.set_active_medication(name=response.active_medication_name)
            elif session.active_medication_name and not is_regulatory_q:
                response.active_medication_name = session.active_medication_name

    if not cached_resp:
        response = await handle_copilot_chat(
            payload, request, db,
            session=session,
            history=session.render_recent_history()
        )
        from app.services.chatbot.conversational_handler import attach_correction_empathy
        response.reply_text = attach_correction_empathy(response.reply_text, payload.query)
        response = format_offline_drug_response(response)
        response.has_image = bool(payload.image_base64 or response.has_image)
        if payload.image_base64 and not response.image_tokens:
            response.image_tokens = 258
        session.append_conversation_turn(payload.query, response.reply_text)
        response.session_id = session.session_id
        if response.active_medication_name and not is_regulatory_q:
            session.set_active_medication(name=response.active_medication_name)
        elif session.active_medication_name and not is_regulatory_q:
            response.active_medication_name = session.active_medication_name

        # Lưu kết quả lâm sàng hợp lệ vào cache (chỉ lưu tri thức độc lập ngữ cảnh)
        is_context_dependent = (
            any(w in lower_q for w in ("này", "đó", "kia", "nó", "vừa rồi", "thuốc này", "thuốc đó", "thuốc có", "thuốc kia", "hai thuốc", "2 thuốc"))
            or (session.active_medication_name and session.active_medication_name.casefold() not in lower_q)
        )
        if not is_context_dependent and response.answer_type not in ("clarification", "safe_abstention"):
            clinical_cache.set(payload.query, user_role, response)

    response = format_offline_drug_response(response)

    latency_ms = round((time.monotonic() - start_time) * 1000, 1)
    has_img = bool(payload.image_base64 or getattr(response, "has_image", False))
    img_tok = getattr(response, "image_tokens", 0) or (258 if has_img else 0)

    from app.services.llm_provider import get_last_llm_execution
    last_exec = get_last_llm_execution()

    # Đồng bộ model thực thi chính xác với Google AI Studio và hệ thống Guardrails / Cache
    if cached_resp:
        m_name = "clinical-cache-engine"
        prov = "local-cache"
    elif response.intent in ("MEDICATION_INTERACTION_BLOCKED", "CLINICAL_CONTRAINDICATION_BLOCKED"):
        m_name = "safety-ddi-matrix"
        prov = "clinical-safety"
    elif response.intent in ("SECURITY_GUARDRAIL_BLOCKED", "OFFTOPIC_DECLINED"):
        m_name = "clinical-guardrail-v2"
        prov = "system-guardrail"
    elif getattr(response, "model_name", None) and response.model_name not in ("gemini-2.5-flash", None):
        m_name = response.model_name
        prov = getattr(response, "provider", "gemini")
    elif last_exec.get("model") and last_exec["model"] != "gemini-2.5-flash":
        m_name = last_exec["model"]
        prov = last_exec.get("provider", "gemini")
    elif has_img:
        m_name = "gemini-3.5-flash-lite"
        prov = "gemini"
    else:
        m_name = "gemini-3.5-flash-lite"
        prov = "gemini"

    # Usage stays unknown for handlers/cache paths that did not call an LLM.
    p_tok = last_exec.get("prompt_tokens", 0)
    c_tok = last_exec.get("completion_tokens", 0)
    tot_tok = p_tok + c_tok
    response.prompt_tokens = p_tok
    response.completion_tokens = c_tok
    response.total_tokens = tot_tok
    response.usage_source = last_exec.get("usage_source", "none")
    response.model_call_count = last_exec.get("model_call_count", last_exec.get("call_count", 0))
    response.usage_call_count = last_exec.get("provider_call_count", 0)
    response.cache_hit_count = last_exec.get("cache_hits", 0)
    if last_exec.get("call_count", 0) and last_exec.get("model"):
        response.model_name = last_exec["model"]
    if last_exec.get("call_count", 0) and last_exec.get("provider"):
        response.provider = last_exec["provider"]

    try:
        from app.security.prompt_utility_scorer import compute_prompt_utility
        util = compute_prompt_utility(payload.query, reply_text=response.reply_text, intent=response.intent)
        log_entry = CopilotChatLog(
            id=f"CHAT-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}",
            session_id=session.session_id,
            user_name=user_name,
            user_role=user_role,
            query=payload.query,
            reply_text=response.reply_text,
            intent=response.intent,
            answer_type=response.answer_type,
            utility_score=util.utility_score,
            is_useful=util.is_useful,
            quality_category=util.category,
            grounded_source=util.grounded_source,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=tot_tok,
            usage_source=response.usage_source,
            model_call_count=response.model_call_count or 0,
            usage_call_count=response.usage_call_count or 0,
            cache_hit_count=response.cache_hit_count or 0,
            model_name=response.model_name or m_name,
            provider=response.provider or prov,
            has_image=has_img,
            image_tokens=img_tok,
            latency_ms=latency_ms,
        )
        db.add(log_entry)
        await db.commit()
    except Exception:
        pass

    return response

@router.post("/chat/stream")
async def chat_with_copilot_stream(
    payload: CopilotQuery,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    from app.services.llm_provider import reset_llm_execution
    reset_llm_execution()
    start_time = time.monotonic()
    user_name, user_role, session_id = resolve_copilot_identity(payload, request)
    session = get_or_create_session(session_id, user_name, user_role)

    async def response_events():
        # 1. Kiểm tra bộ nhớ đệm lâm sàng (Clinical LRU Cache) để đạt latency < 1ms
        from app.services.cache.clinical_cache import get_clinical_cache
        clinical_cache = get_clinical_cache()

        can_use_cache = True
        if payload.image_base64:
            can_use_cache = False
        lower_q = payload.query.lower()
        if any(w in lower_q for w in ("này", "đó", "kia", "nó", "vừa rồi", "thuốc này", "thuốc đó", "thuốc có", "thuốc kia", "hai thuốc", "2 thuốc")):
            can_use_cache = False
        elif session.active_medication_name:
            has_explicit_drug = bool(session.active_medication_name.casefold() in lower_q)
            if not has_explicit_drug:
                try:
                    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
                    has_explicit_drug = bool(get_drug_lexical_matcher().extract_medications(payload.query))
                except Exception:
                    has_explicit_drug = False
            if not has_explicit_drug:
                can_use_cache = False

        cached_resp = clinical_cache.get(payload.query, user_role=user_role) if can_use_cache else None
        if cached_resp:
            response = cached_resp.model_copy(deep=True)
            response = validate_cached_chat_response(response)
            response.session_id = session.session_id
            session.append_conversation_turn(payload.query, response.reply_text)
            if response.active_medication_name:
                session.set_active_medication(name=response.active_medication_name)
        else:
            # Xử lý câu truy vấn qua bộ máy Copilot Orchestrator
            response = await handle_copilot_chat(
                payload, request, db,
                session=session,
                history=session.render_recent_history()
            )
            from app.services.chatbot.conversational_handler import attach_correction_empathy
            response.reply_text = attach_correction_empathy(response.reply_text, payload.query)
            response = format_offline_drug_response(response)
            session.append_conversation_turn(payload.query, response.reply_text)
            response.session_id = session.session_id

            # Lưu vào cache lâm sàng nếu độc lập ngữ cảnh và không phải clarification/abstention
            is_context_dependent = (
                any(w in lower_q for w in ("này", "đó", "kia", "nó", "vừa rồi", "thuốc này", "thuốc đó", "thuốc có", "thuốc kia", "hai thuốc", "2 thuốc"))
                or (session.active_medication_name and session.active_medication_name.casefold() not in lower_q)
            )
            if not is_context_dependent and response.answer_type not in ("clarification", "safe_abstention"):
                clinical_cache.set(payload.query, user_role, response)

        response = format_offline_drug_response(response)
        response.has_image = bool(payload.image_base64 or response.has_image)
        if payload.image_base64 and not response.image_tokens:
            response.image_tokens = 258

        from app.services.llm_provider import get_last_llm_execution
        usage = get_last_llm_execution()
        response.prompt_tokens = usage.get("prompt_tokens", 0)
        response.completion_tokens = usage.get("completion_tokens", 0)
        response.total_tokens = usage.get("total_tokens", 0)
        response.usage_source = usage.get("usage_source", "none")
        response.model_call_count = usage.get("model_call_count", usage.get("call_count", 0))
        response.usage_call_count = usage.get("provider_call_count", 0)
        response.cache_hit_count = usage.get("cache_hits", 0) + (1 if cached_resp else 0)
        response.availability_mode = "online_ai" if usage.get("provider_call_count", 0) else "local_only"
        if cached_resp:
            response.availability_mode = "local_only"
        if response.answer_type == "unavailable":
            response.availability_mode = "offline"
        if usage.get("call_count", 0) and usage.get("model"):
            response.model_name = usage["model"]
        if usage.get("call_count", 0) and usage.get("provider"):
            response.provider = usage["provider"]
        latency_ms = round((time.monotonic() - start_time) * 1000, 1)

        # 2. Ghi nhật ký bất đồng bộ
        try:
            from app.security.prompt_utility_scorer import compute_prompt_utility
            util = compute_prompt_utility(payload.query, reply_text=response.reply_text, intent=response.intent)
            log_entry = CopilotChatLog(
                id=f"CHAT-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}",
                session_id=session.session_id,
                user_name=user_name,
                user_role=user_role,
                query=payload.query,
                reply_text=response.reply_text,
                intent=response.intent,
                answer_type=response.answer_type,
                utility_score=util.utility_score,
                is_useful=util.is_useful,
                quality_category=util.category,
                grounded_source=util.grounded_source,
                prompt_tokens=response.prompt_tokens or 0,
                completion_tokens=response.completion_tokens or 0,
                total_tokens=response.total_tokens or 0,
                usage_source=response.usage_source,
                model_call_count=response.model_call_count or 0,
                usage_call_count=response.usage_call_count or 0,
                cache_hit_count=response.cache_hit_count or 0,
                has_image=bool(payload.image_base64 or response.has_image),
                image_tokens=response.image_tokens or 0,
                model_name=response.model_name,
                provider=response.provider,
                latency_ms=latency_ms,
            )
            db.add(log_entry)
            await db.commit()
        except Exception:
            pass

        full_text = response.reply_text or ""

        # Clinical generation and validation have completed before any text is emitted.
        if full_text:
            yield _sse_event("token", content=full_text)

        # 4. Truyền phát gói dữ liệu hoàn tất chứa toàn bộ metadata, cards, alerts
        done_dict = response.model_dump()
        yield _sse_event("done", response=done_dict)

    async def event_generator():
        try:
            async for event in response_events():
                yield event
        except asyncio.CancelledError:
            raise
        except Exception:
            yield _sse_event("error", message="Không thể hoàn tất yêu cầu. Vui lòng thử lại.")

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/cache/stats")
async def get_copilot_cache_stats():
    """Lấy số liệu giám sát hiệu năng bộ nhớ đệm lâm sàng (Hits, Misses, Hit Ratio)."""
    from app.services.cache.clinical_cache import get_clinical_cache
    return get_clinical_cache().get_stats()

@router.get("/history", response_model=list[CopilotChatLogResponse])
async def get_copilot_chat_history(
    limit: int = 5,
    filter_useful: bool = False,
    min_score: float = 0.0,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CopilotChatLog)
    if filter_useful:
        stmt = stmt.where(CopilotChatLog.is_useful.is_(True))
    if min_score > 0.0:
        stmt = stmt.where(CopilotChatLog.utility_score >= min_score)
    stmt = stmt.order_by(CopilotChatLog.created_at.desc()).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/rag", response_model=RagResponse)
async def query_pure_clinical_rag(payload: RagQuery):
    guard_res = validate_input_guardrail(payload.query, user_role=payload.user_role)
    if not guard_res.is_safe:
        return RagResponse(
            query=payload.query,
            answer=guard_res.safe_response or "Yêu cầu bị chặn bởi rào chắn an toàn.",
            citations=[], kg_entities=[], confidence_score=0.0,
            legal_basis="Rào chắn an toàn đầu vào", rag_grounded=False
        )
    from app.services.rag import rag_pipeline
    res = await rag_pipeline.execute_clinical_rag(
        query=guard_res.sanitized_query,
        patient_info=payload.patient_info,
        user_role=payload.user_role
    )
    response = RagResponse(**res.to_response_dict())
    response.answer = validate_output_guardrail(response.answer, guard_res.sanitized_query)
    return response

@router.get("/entities/search")
async def search_copilot_entities(
    q: str,
    limit: int = 20
):
    """
    Nhận diện và tra cứu thực thể thuốc/thiết bị siêu tốc (< 2ms) từ 55.000 thuốc DAV & DĐVN V.
    Hỗ trợ autocomplete và dynamic entity resolution cho Frontend NLP.
    """
    clean_q = (q or "").strip()
    if not clean_q:
        return {"query": "", "total": 0, "items": []}

    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    matcher = get_drug_lexical_matcher()
    results = []
    seen = set()

    # 1. Khớp thực thể chính xác
    exact_meds = matcher.extract_medications(clean_q)
    for m in exact_meds:
        low = m.lower()
        if low not in seen:
            seen.add(low)
            results.append({"name": m, "type": "medication", "matched_by": "exact_trie"})

    # 2. Khớp SĐK
    sdk = matcher.extract_sdk(clean_q)
    if sdk and sdk.lower() not in seen:
        seen.add(sdk.lower())
        results.append({"name": sdk, "type": "registration_code", "matched_by": "sdk_pattern"})

    # 3. Khớp mờ (Fuzzy / Prefix)
    fuzzy_matches = matcher.fuzzy_candidate_search(clean_q, top_k=limit)
    for f in fuzzy_matches:
        low = f.lower()
        if low not in seen and len(results) < limit:
            seen.add(low)
            results.append({"name": f, "type": "medication", "matched_by": "fuzzy_search"})

    return {"query": clean_q, "total": len(results), "items": results}
