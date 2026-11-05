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
    user_name, user_role, session_id = resolve_copilot_identity(payload, request)
    session = get_or_create_session(session_id, user_name, user_role)
    response = await handle_copilot_chat(
        payload, request, db,
        session=session,
        history=session.render_recent_history()
    )
    from app.services.chatbot.conversational_handler import attach_correction_empathy
    response.reply_text = attach_correction_empathy(response.reply_text, payload.query)
    session.append_conversation_turn(payload.query, response.reply_text)
    response.session_id = session.session_id

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
        # 1. Xử lý câu truy vấn qua bộ máy Copilot Orchestrator
        response = await handle_copilot_chat(
            payload, request, db,
            session=session,
            history=session.render_recent_history()
        )
        from app.services.chatbot.conversational_handler import attach_correction_empathy
        response.reply_text = attach_correction_empathy(response.reply_text, payload.query)
        session.append_conversation_turn(payload.query, response.reply_text)
        response.session_id = session.session_id

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

        # 3. Phân tách thành các token/cụm từ để truyền phát (Server-Sent Events)
        tokens = re.findall(r'\S+\s*|\s+', full_text)
        if not tokens:
            tokens = [full_text]

        # Gửi ngay chunk đầu tiên không trễ để lập tức kích hoạt typewriter trên UI (TTFT < 5ms)
        chunk_size = 3
        if tokens:
            first_chunk = "".join(tokens[0:chunk_size])
            event_payload = json.dumps({"type": "token", "content": first_chunk}, ensure_ascii=False)
            yield f"data: {event_payload}\n\n"

        for i in range(chunk_size, len(tokens), chunk_size):
            chunk = "".join(tokens[i:i + chunk_size])
            event_payload = json.dumps({"type": "token", "content": chunk}, ensure_ascii=False)
            yield f"data: {event_payload}\n\n"
            await asyncio.sleep(0.012)

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
