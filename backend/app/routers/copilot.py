"""
Router API Trợ Lý Agent Lâm Sàng Thông Minh (Copilot & Clinical RAG) (<=80 LOC)
"""
import uuid
import time
import json
import asyncio
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.models.copilot_log import CopilotChatLog
from app.schemas.copilot import CopilotQuery, CopilotResponse, RagQuery, RagResponse, CopilotChatLogResponse
from app.services.session_context import get_or_create_session
from app.security.guardrails import validate_input_guardrail, validate_output_guardrail
from app.services.chatbot.chat_telemetry_logger import reconcile_copilot_telemetry, record_chat_telemetry_log
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

_CHAT_RATE_BUCKETS: dict[str, list[float]] = {}
_CHAT_RATE_LIMIT_MAX = 30
_CHAT_RATE_WINDOW_SEC = 60.0


def _check_chat_rate_limit(request: Request, user_name: str) -> None:
    """Giới hạn tần suất gọi AI theo người dùng/IP (chống spam đốt quota - OWASP LLM10)."""
    client_host = getattr(getattr(request, "client", None), "host", None) or "unknown"
    key = f"{client_host}:{(user_name or 'anon').strip().lower()}"
    now = time.monotonic()
    history = [ts for ts in _CHAT_RATE_BUCKETS.get(key, []) if now - ts < _CHAT_RATE_WINDOW_SEC]
    if len(history) >= _CHAT_RATE_LIMIT_MAX:
        _CHAT_RATE_BUCKETS[key] = history
        raise HTTPException(
            status_code=429,
            detail="Bạn đang gửi yêu cầu quá nhanh. Vui lòng chờ vài giây rồi thử lại.",
            headers={"Retry-After": "10"},
        )
    history.append(now)
    _CHAT_RATE_BUCKETS[key] = history


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
    _check_chat_rate_limit(request, user_name)
    session = get_or_create_session(session_id, user_name, user_role)

    from app.services.cache.clinical_cache import get_clinical_cache
    clinical_cache = get_clinical_cache()

    # 0. Kiểm tra kho Q&A đã thẩm định trong Đồ thị Tri thức (Verified Clinical Q&A Node)
    # Tách biệt hẳn Web Search: chỉ tra cứu đồ thị nội bộ khi tắt Web Search và bỏ qua các node web search cũ
    from app.services.rag.verified_qa_service import get_verified_qa_service
    vqa_service = get_verified_qa_service()
    verified_node = (
        vqa_service.lookup_verified_qa(payload.query, user_role=user_role)
        if (not payload.image_base64 and not payload.enable_web_search)
        else None
    )
    if verified_node and (
        verified_node.get("intent") == "GROUNDED_WEB_SEARCH"
        or "web_search" in str(verified_node.get("verification_source", ""))
    ):
        verified_node = None

    if verified_node:
        response = vqa_service.format_as_copilot_response(verified_node, session=session)
        session.append_conversation_turn(payload.query, response.reply_text)
        from app.services.chatbot.citation_standardizer import standardize_response_citations
        response = standardize_response_citations(response, payload.query)
        response = format_offline_drug_response(response)

        latency_ms = round((time.monotonic() - start_time) * 1000, 1)
        reconcile_copilot_telemetry(
            response,
            last_exec=None,
            cached_resp=True,
            default_model="verified-knowledge-graph",
            default_provider="knowledge-graph-qa",
        )
        await record_chat_telemetry_log(
            db,
            payload=payload,
            response=response,
            session_id=session.session_id,
            user_name=user_name,
            user_role=user_role,
            latency_ms=latency_ms,
            has_image=False,
            image_tokens=0,
        )
        return response

    can_use_cache = True
    if payload.image_base64 or payload.enable_web_search:
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
        response.reply_text = attach_correction_empathy(response.reply_text, payload.query, user_name=user_name, user_role=user_role)
        response = format_offline_drug_response(response)
        response.has_image = bool(payload.image_base64 or response.has_image)
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
        if not is_context_dependent and not payload.enable_web_search and response.answer_type not in ("clarification", "safe_abstention"):
            clinical_cache.set(payload.query, user_role, response)

        # Tự động thăng hạng câu trả lời nội viện chất lượng cao vào Đồ thị Tri thức Q&A (không trộn web search)
        if not is_context_dependent and not payload.enable_web_search and response.intent != "GROUNDED_WEB_SEARCH":
            vqa_service.auto_register_candidate(
                payload.query,
                response,
                source="copilot_rag"
            )

    response = format_offline_drug_response(response)

    latency_ms = round((time.monotonic() - start_time) * 1000, 1)
    has_img = bool(payload.image_base64 or getattr(response, "has_image", False))
    img_tok = getattr(response, "image_tokens", 0) or 0

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
    elif last_exec.get("model_call_count", 0) > 0 and getattr(response, "model_name", None) and response.model_name not in ("gemini-2.5-flash", None):
        m_name = response.model_name
        prov = getattr(response, "provider", "gemini")
    elif last_exec.get("model") and last_exec["model"] != "gemini-2.5-flash":
        m_name = last_exec["model"]
        prov = last_exec.get("provider", "gemini")
    else:
        m_name = "local-rag-engine"
        prov = "local"

    # Đồng bộ số lượng token và thông số execution từ execution trace
    reconcile_copilot_telemetry(
        response,
        last_exec=last_exec,
        cached_resp=bool(cached_resp),
        default_model=m_name,
        default_provider=prov,
    )

    await record_chat_telemetry_log(
        db,
        payload=payload,
        response=response,
        session_id=session.session_id,
        user_name=user_name,
        user_role=user_role,
        latency_ms=latency_ms,
        has_image=has_img,
        image_tokens=img_tok,
    )

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
    _check_chat_rate_limit(request, user_name)
    session = get_or_create_session(session_id, user_name, user_role)

    async def response_events():
        # 0. Kiểm tra kho Q&A đã thẩm định trong Đồ thị Tri thức (Verified Clinical Q&A Node)
        from app.services.rag.verified_qa_service import get_verified_qa_service
        vqa_service = get_verified_qa_service()
        verified_node = (
            vqa_service.lookup_verified_qa(payload.query, user_role=user_role)
            if (not payload.image_base64 and not payload.enable_web_search)
            else None
        )
        if verified_node and (
            verified_node.get("intent") == "GROUNDED_WEB_SEARCH"
            or "web_search" in str(verified_node.get("verification_source", ""))
        ):
            verified_node = None

        # 1. Kiểm tra bộ nhớ đệm lâm sàng (Clinical LRU Cache) để đạt latency < 1ms
        from app.services.cache.clinical_cache import get_clinical_cache
        clinical_cache = get_clinical_cache()

        streamed_live = False
        if verified_node:
            response = vqa_service.format_as_copilot_response(verified_node, session=session)
            session.append_conversation_turn(payload.query, response.reply_text)
            cached_resp = response
        else:
            can_use_cache = True
            if payload.image_base64 or payload.enable_web_search:
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
                response = None
                if payload.enable_web_search and not payload.image_base64:
                    guard_res = validate_input_guardrail(payload.query, user_role=user_role)
                    if guard_res.is_safe:
                        from app.services.chatbot.grounded_web_search_handler import stream_grounded_web_search_turn
                        from app.services.chatbot.copilot_response_postprocessor import post_process_copilot_response
                        from app.services.chatbot.evidence_contract_validator import validate_response_evidence_contract
                        async for ev_kind, ev_data in stream_grounded_web_search_turn(
                            payload,
                            user_role=user_role,
                            session=session,
                            history=session.render_recent_history(),
                        ):
                            if ev_kind == "token" and ev_data:
                                streamed_live = True
                                yield _sse_event("token", content=ev_data)
                            elif ev_kind == "done" and ev_data is not None:
                                response = post_process_copilot_response(
                                    ev_data, request, payload,
                                    validator_fn=validate_response_evidence_contract,
                                )

                if response is None:
                    # Xử lý câu truy vấn qua bộ máy Copilot Orchestrator (non-stream hoặc fallback)
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
                if not is_context_dependent and not payload.enable_web_search and response.answer_type not in ("clarification", "safe_abstention"):
                    clinical_cache.set(payload.query, user_role, response)

                # Tự động thăng hạng câu trả lời nội viện chất lượng cao vào Đồ thị Tri thức Q&A (không trộn web search)
                if not is_context_dependent and not payload.enable_web_search and response.intent != "GROUNDED_WEB_SEARCH":
                    vqa_service.auto_register_candidate(
                        payload.query,
                        response,
                        source="copilot_rag"
                    )

        response = format_offline_drug_response(response)
        response.has_image = bool(payload.image_base64 or response.has_image)

        from app.services.llm_provider import get_last_llm_execution
        usage = get_last_llm_execution()
        latency_ms = round((time.monotonic() - start_time) * 1000, 1)

        # Chuẩn hóa telemetry và siêu dữ liệu thực thi
        reconcile_copilot_telemetry(
            response,
            last_exec=usage,
            cached_resp=bool(cached_resp),
            default_model="clinical-cache-engine" if cached_resp else (getattr(settings, "GEMINI_DEFAULT_MODEL", None) or "gemini-2.5-flash"),
            default_provider="local-cache" if cached_resp else "gemini",
        )
        if response.answer_type == "unavailable":
            response.availability_mode = "local_only"

        # Phát nội dung ngay sau khi pipeline hoàn tất. Ghi telemetry phía sau
        # không được chặn TTFT/UX của người dùng; telemetry chỉ là side effect.
        full_text = response.reply_text or ""
        if full_text and not streamed_live:
            yield _sse_event("token", content=full_text)

        # 2. Ghi nhật ký bất đồng bộ
        await record_chat_telemetry_log(
            db,
            payload=payload,
            response=response,
            session_id=session.session_id,
            user_name=user_name,
            user_role=user_role,
            latency_ms=latency_ms,
            has_image=bool(payload.image_base64 or response.has_image),
            image_tokens=response.image_tokens or 0,
        )

        # 4. Truyền phát gói dữ liệu hoàn tất chứa toàn bộ metadata, cards, alerts
        done_dict = response.model_dump()
        yield _sse_event("done", response=done_dict)

    async def event_generator():
        try:
            async for event in response_events():
                yield event
        except asyncio.CancelledError:
            raise
        except Exception as e:
            import traceback
            traceback.print_exc()
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
    request: Request,
    limit: int = 5,
    filter_useful: bool = False,
    min_score: float = 0.0,
    db: AsyncSession = Depends(get_db)
):
    safe_limit = max(1, min(limit, 50))
    stmt = select(CopilotChatLog)
    authenticated = getattr(request.state, "authenticated_user", None)
    if authenticated and getattr(authenticated, "role", None) != "director":
        caller_name = (getattr(authenticated, "name", None) or getattr(authenticated, "username", "")).strip()
        if caller_name:
            stmt = stmt.where(func.lower(CopilotChatLog.user_name) == caller_name.lower())
    if filter_useful:
        stmt = stmt.where(CopilotChatLog.is_useful.is_(True))
    if min_score > 0.0:
        stmt = stmt.where(CopilotChatLog.utility_score >= min_score)
    stmt = stmt.order_by(CopilotChatLog.created_at.desc()).limit(safe_limit)
    res = await db.execute(stmt)
    return res.scalars().all()


def _truncate_word_boundary(text: str, max_len: int = 40) -> str:
    clean = " ".join((text or "").split()).strip(" .,:;\"'")
    if len(clean) <= max_len:
        return clean
    cut = clean[:max_len - 1].rsplit(" ", 1)[0].strip()
    return (cut or clean[:max_len - 1]).rstrip(" .,:;") + "…"


def _generate_session_title(first_query: str) -> str:
    clean = " ".join((first_query or "").strip().split())
    if not clean:
        return "Cuộc trò chuyện mới"

    # Bỏ qua câu chào hỏi đơn thuần
    if re.fullmatch(r"(?:xin\s+)?(?:chào|hello|hi|alo|ok|cảm\s+ơn)(?:\s+(?:bạn|bot|bác\s+sĩ|dược\s+sĩ))?[!.\s]*", clean, re.IGNORECASE):
        return "Cuộc trò chuyện mới"

    # Chỉ bắt tên riêng bệnh nhân khi viết hoa đầu từ (tránh bắt nhầm 'nam', 'nữ', 'suy thận'...)
    bn_match = re.search(
        r"(?:bệnh nhân|bn)\s+([A-ZÀ-ỸĐ][a-zà-ỹđ]+(?:\s+[A-ZÀ-ỸĐ][a-zà-ỹđ]+){1,2})",
        clean,
    )
    if bn_match:
        return _truncate_word_boundary(f"BN {bn_match.group(1).strip()}", 38)

    if re.search(r"cận hạn|fefo", clean, re.IGNORECASE):
        return "Kiểm tra FEFO & Hạn dùng"
    if re.search(r"hỏng|sự cố", clean, re.IGNORECASE):
        return "Báo cáo sự cố thiết bị"
    if re.search(r"giao ban|đối soát", clean, re.IGNORECASE):
        return "Bàn giao ca trực"

    # Ưu tiên trích xuất thực thể thuốc + chỉ số lâm sàng nếu là ca dài
    try:
        from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
        drugs = get_drug_lexical_matcher().extract_medications(clean)
    except Exception:
        drugs = []
    markers = re.findall(r"\b(?:CYP\w*(?:\*\d+(?:/\*\d+)?)?|VKORC1|eGFR|INR|HbA1c|TT\s*\d+|Thông tư\s*\d+)\b", clean, re.IGNORECASE)
    entities = list(dict.fromkeys([*drugs[:2], *markers[:2]]))
    if entities and len(clean) > 45:
        return _truncate_word_boundary(" · ".join(entities), 40)

    # Tinh lọc từ đệm mở đầu
    stripped = re.sub(
        r"^(?:tôi\s+muốn\s+(?:bạn\s+)?|bạn\s+hãy\s+|hãy\s+|cho\s+(?:tôi|mình)\s+(?:hỏi|biết)\s+|tìm\s+kiếm\s+|tra\s+cứu\s+)(?:thông\s+tin\s+)?(?:về\s+)?",
        "",
        clean,
        flags=re.IGNORECASE,
    ).strip()
    return _truncate_word_boundary(stripped or clean, 40)


class GenerateTitleRequest(BaseModel):
    query: str
    reply_snippet: str | None = None
    session_id: str | None = None


@router.post("/generate-title")
async def generate_copilot_session_title(
    payload: GenerateTitleRequest,
    request: Request,
):
    """Dùng Gemini LLM đặt tiêu đề ngắn gọn, chuẩn lâm sàng cho phiên chat (fallback deterministic nếu offline)."""
    fallback_title = _generate_session_title(payload.query)
    raw_q = " ".join((payload.query or "").strip().split())
    if not raw_q or fallback_title == "Cuộc trò chuyện mới":
        return {"title": fallback_title, "source": "fallback"}

    try:
        from app.services.llm_provider import query_clinical_llm
        prompt = (
            "Đặt MỘT tiêu đề ngắn gọn bằng tiếng Việt (4–8 từ, tối đa 42 ký tự) cho cuộc hội thoại y tế sau.\n"
            "Quy tắc: Nêu thẳng tên thuốc, bệnh lý, mã gen hoặc văn bản pháp lý chính. Không dùng dấu ngoặc kép, không dấu chấm cuối, không viết 'Cuộc trò chuyện về'.\n\n"
            f"Câu hỏi: {raw_q[:400]}"
        )
        if payload.reply_snippet:
            prompt += f"\nTóm tắt trả lời: {' '.join(payload.reply_snippet.split())[:200]}"

        llm_title = await query_clinical_llm(
            prompt=prompt,
            temperature=0.1,
            max_output_tokens=32,
            timeout_sec=5.0,
        )
        if llm_title:
            cleaned = llm_title.strip().splitlines()[0].strip(" \"'`*#.-:")
            cleaned = _truncate_word_boundary(cleaned, 42)
            if 4 <= len(cleaned) <= 45:
                return {"title": cleaned, "source": "gemini"}
    except Exception:
        pass

    return {"title": fallback_title, "source": "fallback"}


class CopilotMessageItem(BaseModel):
    id: str
    sender: str
    text: str
    timestamp: str


class CopilotSessionSummary(BaseModel):
    id: str
    title: str
    createdAt: int
    updatedAt: int
    messages: list[CopilotMessageItem]


def _resolve_user_identity_names(request: Request) -> tuple[list[str], list[str]]:
    """Trả về (danh sách tên user_name thường gặp, danh sách prefix session_id) của người dùng hiện hành."""
    authenticated = getattr(request.state, "authenticated_user", None)
    names: list[str] = []
    if authenticated:
        uname = (getattr(authenticated, "username", None) or "").strip()
        dname = (getattr(authenticated, "name", None) or "").strip()
        if uname:
            names.append(uname.lower())
        if dname and dname.lower() not in names:
            names.append(dname.lower())
    if not names:
        q_user = request.query_params.get("username", "").strip() or "test_director"
        names.append(q_user.lower())
    prefixes = [f"{n}:" for n in names]
    return names, prefixes


@router.get("/user-sessions", response_model=list[CopilotSessionSummary])
async def get_user_chat_sessions(
    request: Request,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Lấy danh sách các phiên trò chuyện đám mây của người dùng hiện hành để tự động đồng bộ (SWR)."""
    user_names, prefixes = _resolve_user_identity_names(request)

    stmt = (
        select(CopilotChatLog)
        .where(func.lower(CopilotChatLog.user_name).in_(user_names))
        .order_by(CopilotChatLog.created_at.asc())
        .limit(300)
    )
    res = await db.execute(stmt)
    logs = res.scalars().all()
    if not logs:
        return []

    from collections import defaultdict
    sessions_map: dict[str, list[CopilotChatLog]] = defaultdict(list)
    for log in logs:
        clean_sid = log.session_id
        lower_sid = clean_sid.lower()
        for prefix in prefixes:
            if lower_sid.startswith(prefix):
                clean_sid = clean_sid[len(prefix):]
                break
        sessions_map[clean_sid].append(log)

    result: list[CopilotSessionSummary] = []
    for sid, s_logs in sessions_map.items():
        if not s_logs:
            continue
        first_query = s_logs[0].query or "Cuộc trò chuyện mới"
        title = _generate_session_title(first_query)
        earliest_ts = int(s_logs[0].created_at.timestamp() * 1000) if s_logs[0].created_at else int(time.time() * 1000)
        latest_ts = int(s_logs[-1].created_at.timestamp() * 1000) if s_logs[-1].created_at else earliest_ts

        messages: list[CopilotMessageItem] = []
        for log in s_logs:
            time_str = log.created_at.strftime("%H:%M") if log.created_at else "10:00"
            messages.append(CopilotMessageItem(
                id=f"{log.id}-u",
                sender="user",
                text=log.query,
                timestamp=time_str
            ))
            messages.append(CopilotMessageItem(
                id=f"{log.id}-a",
                sender="bot",
                text=log.reply_text,
                timestamp=time_str
            ))

        result.append(CopilotSessionSummary(
            id=sid,
            title=title,
            createdAt=earliest_ts,
            updatedAt=latest_ts,
            messages=messages
        ))

    result.sort(key=lambda s: s.updatedAt, reverse=True)
    return result[:limit]


@router.delete("/user-sessions")
async def delete_all_user_chat_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Xóa toàn bộ lịch sử chatbot của người dùng hiện tại trên máy chủ để đồng bộ các thiết bị."""
    user_names, _prefixes = _resolve_user_identity_names(request)
    del_stmt = (
        delete(CopilotChatLog)
        .where(func.lower(CopilotChatLog.user_name).in_(user_names))
    )
    await db.execute(del_stmt)
    await db.commit()

    from app.services.chatbot.grounded_web_search_cache import get_grounded_web_cache
    from app.services.chatbot.web_search_engine import clear_search_cache
    get_grounded_web_cache().clear()
    clear_search_cache()
    return {"status": "ok", "cleared_all": True}


@router.delete("/user-sessions/{session_id}")
async def delete_user_chat_session(
    session_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Xóa toàn bộ log của một phiên thuộc về người dùng hiện tại (bảo mật tuyệt đối, không xóa chéo)."""
    user_names, prefixes = _resolve_user_identity_names(request)
    target_sids = [session_id] + [f"{p}{session_id}" for p in prefixes]

    del_stmt = (
        delete(CopilotChatLog)
        .where(
            func.lower(CopilotChatLog.user_name).in_(user_names),
            CopilotChatLog.session_id.in_(target_sids)
        )
    )
    await db.execute(del_stmt)
    await db.commit()

    from app.services.chatbot.grounded_web_search_cache import get_grounded_web_cache
    from app.services.chatbot.web_search_engine import clear_search_cache
    web_cache = get_grounded_web_cache()
    for sid in target_sids:
        web_cache.invalidate_session(sid)
    clear_search_cache()

    return {"status": "ok", "deleted_session_id": session_id}


@router.post("/user-sessions/{session_id}/reset-cache")
async def reset_user_session_web_cache(
    session_id: str,
    request: Request,
):
    """Xóa bộ nhớ đệm Web Search của phiên khi người dùng bấm Làm mới phiên hội thoại."""
    _user_names, prefixes = _resolve_user_identity_names(request)
    target_sids = [session_id] + [f"{p}{session_id}" for p in prefixes]

    from app.services.chatbot.grounded_web_search_cache import get_grounded_web_cache
    from app.services.chatbot.web_search_engine import clear_search_cache
    web_cache = get_grounded_web_cache()
    removed = sum(web_cache.invalidate_session(sid) for sid in target_sids)
    clear_search_cache()
    return {"status": "ok", "cleared_entries": removed}

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
