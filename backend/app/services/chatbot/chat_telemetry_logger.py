"""
Dịch vụ Quản lý & Ghi nhận Telemetry Hội thoại Chatbot (Chat Telemetry Logger).
Tách từ copilot.py nhằm tinh gọn router, loại bỏ mã lặp giữa luồng sync và stream,
đồng thời đồng bộ chính xác số lượng tokens và siêu dữ liệu thực thi từ LLM Provider.
"""
import time
import uuid
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.copilot_log import CopilotChatLog
from app.schemas.copilot import CopilotQuery, CopilotResponse
from app.security.prompt_utility_scorer import compute_prompt_utility

logger = logging.getLogger("chat_telemetry_logger")


def reconcile_copilot_telemetry(
    response: CopilotResponse,
    last_exec: Optional[dict] = None,
    cached_resp: bool = False,
    default_model: str = "local-rag-engine",
    default_provider: str = "local",
) -> tuple[int, int, int]:
    """
    Chuẩn hóa số lượng token và thông số execution giữa execution trace và CopilotResponse.
    Trả về (prompt_tokens, completion_tokens, total_tokens).
    """
    exec_data = last_exec or {}
    
    # Lấy token từ execution trace nếu có, hoặc từ response đã sinh
    p_tok = max(exec_data.get("prompt_tokens", 0), response.prompt_tokens or 0)
    c_tok = max(exec_data.get("completion_tokens", 0), response.completion_tokens or 0)
    tot_tok = p_tok + c_tok

    response.prompt_tokens = p_tok
    response.completion_tokens = c_tok
    response.total_tokens = tot_tok
    response.usage_source = exec_data.get("usage_source", response.usage_source or "none")
    
    call_cnt = exec_data.get("model_call_count", exec_data.get("call_count", response.model_call_count or 0))
    response.model_call_count = call_cnt
    response.usage_call_count = exec_data.get("provider_call_count", response.usage_call_count or 0)
    response.cache_hit_count = exec_data.get("cache_hits", response.cache_hit_count or 0) + (1 if cached_resp else 0)
    response.availability_mode = "online_ai" if response.model_call_count else "local_only"

    if cached_resp:
        response.availability_mode = "local_only"
        response.model_name = "clinical-cache-engine"
        response.provider = "local-cache"
        response.cache_hit_count = max(1, response.cache_hit_count)
    elif (exec_data.get("call_count", 0) or exec_data.get("model_call_count", 0)) and exec_data.get("model"):
        response.model_name = exec_data["model"]
        response.provider = exec_data.get("provider", default_provider)
    elif not response.model_name:
        response.model_name = default_model
        response.provider = default_provider

    return p_tok, c_tok, tot_tok


async def record_chat_telemetry_log(
    db: AsyncSession,
    *,
    payload: CopilotQuery,
    response: CopilotResponse,
    session_id: str,
    user_name: str,
    user_role: str,
    latency_ms: float,
    has_image: bool = False,
    image_tokens: int = 0,
) -> Optional[CopilotChatLog]:
    """
    Tạo và lưu bản ghi nhật ký lâm sàng CopilotChatLog vào cơ sở dữ liệu.
    Không bao giờ ném ngoại lệ làm gián đoạn luồng phản hồi của người dùng.
    """
    try:
        util = compute_prompt_utility(payload.query, reply_text=response.reply_text, intent=response.intent)
        log_entry = CopilotChatLog(
            id=f"CHAT-{int(time.time()*1000)}-{uuid.uuid4().hex[:6]}",
            session_id=session_id,
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
            model_name=response.model_name,
            provider=response.provider,
            has_image=has_image,
            image_tokens=image_tokens,
            latency_ms=latency_ms,
            availability_mode=response.availability_mode,
            rag_grounded=bool(response.rag_grounded),
            evidence_count=len(response.evidence or []),
            status_reason=response.abstention_reason or response.source_status,
            telemetry_version="v2",
        )
        db.add(log_entry)
        await db.commit()
        return log_entry
    except Exception as e:
        logger.warning("Không thể ghi log telemetry copilot: %s", e)
        return None
