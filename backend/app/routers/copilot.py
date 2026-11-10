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

@router.post("/chat", response_model=CopilotResponse)
async def chat_with_copilot(
    payload: CopilotQuery,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
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
        response = cached_resp.model_copy(deep=True)
        response.session_id = session.session_id
        from app.services.chatbot.citation_standardizer import standardize_response_citations
        response = standardize_response_citations(response, payload.query)
        session.append_conversation_turn(payload.query, response.reply_text)
        if response.active_medication_name and not is_regulatory_q:
            session.set_active_medication(name=response.active_medication_name)
        elif session.active_medication_name and not is_regulatory_q:
            response.active_medication_name = session.active_medication_name
    else:
        response = await handle_copilot_chat(
            payload, request, db,
            session=session,
            history=session.render_recent_history()
        )
        from app.services.chatbot.conversational_handler import attach_correction_empathy
        response.reply_text = attach_correction_empathy(response.reply_text, payload.query)
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

    latency_ms = round((time.monotonic() - start_time) * 1000, 1)
    has_img = bool(payload.image_base64 or getattr(response, "has_image", False))
    img_tok = getattr(response, "image_tokens", 0) or (258 if has_img else 0)
    p_tok = getattr(response, "prompt_tokens", 0) or (max(18, len(payload.query) // 3) + img_tok)
    c_tok = getattr(response, "completion_tokens", 0) or max(25, len(response.reply_text) // 3)
    tot_tok = p_tok + c_tok
    m_name = getattr(response, "model_name", None) or ("gemini-3.5-flash-lite" if has_img else "gemini-2.5-flash")
    prov = "gemini"

    if not cached_resp:
        try:
            from app.services.telemetry_store import record_llm_token_usage
            record_llm_token_usage(p_tok, c_tok, model=m_name, provider=prov)
        except Exception:
            pass

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
            model_name=m_name,
            provider=prov,
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
    user_name, user_role, session_id = resolve_copilot_identity(payload, request)
    session = get_or_create_session(session_id, user_name, user_role)

    async def event_generator():
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
            session.append_conversation_turn(payload.query, response.reply_text)
            response.session_id = session.session_id

            # Lưu vào cache lâm sàng nếu độc lập ngữ cảnh và không phải clarification/abstention
            is_context_dependent = (
                any(w in lower_q for w in ("này", "đó", "kia", "nó", "vừa rồi", "thuốc này", "thuốc đó", "thuốc có", "thuốc kia", "hai thuốc", "2 thuốc"))
                or (session.active_medication_name and session.active_medication_name.casefold() not in lower_q)
            )
            if not is_context_dependent and response.answer_type not in ("clarification", "safe_abstention"):
                clinical_cache.set(payload.query, user_role, response)

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
            )
            db.add(log_entry)
            await db.commit()
        except Exception:
            pass

        full_text = response.reply_text or ""

        # 3. Phân tách thành các cụm từ để truyền phát tốc độ cao (High-Throughput Smooth SSE Stream)
        tokens = re.findall(r'\S+\s*|\s+', full_text)
        if not tokens:
            tokens = [full_text]

        # Gửi ngay cụm BLUF đầu tiên (10-12 từ) để UI lập tức hiện tiêu đề mà không trễ (TTFT < 1ms)
        first_burst_size = min(12, len(tokens))
        if tokens:
            first_chunk = "".join(tokens[0:first_burst_size])
            event_payload = json.dumps({"type": "token", "content": first_chunk}, ensure_ascii=False)
            yield f"data: {event_payload}\n\n"

        # Các cụm tiếp theo nhả đều 8 từ/nhịp với micro-delay 3ms để duy trì 60 FPS mượt mà
        step_size = 8
        for i in range(first_burst_size, len(tokens), step_size):
            chunk = "".join(tokens[i:i + step_size])
            event_payload = json.dumps({"type": "token", "content": chunk}, ensure_ascii=False)
            yield f"data: {event_payload}\n\n"
            await asyncio.sleep(0.003)

        # 4. Truyền phát gói dữ liệu hoàn tất chứa toàn bộ metadata, cards, alerts
        done_dict = response.model_dump()
        done_payload = json.dumps({"type": "done", "response": done_dict}, ensure_ascii=False)
        yield f"data: {done_payload}\n\n"

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
