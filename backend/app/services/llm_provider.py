"""
Universal Clinical LLM Gateway & Provider Adapter
Supports:
1. Google Gemini (cloud API)
2. OpenAI-Compatible Providers (Ollama, vLLM, DeepSeek, Groq, LocalAI, LM Studio)
3. 100% Offline Mode (Deterministic Extractive RAG - 0 Cloud, 0 VND)
"""
import time
import json
import re
import hashlib
import logging
from typing import Any, Dict, List, Optional, Tuple
from contextvars import ContextVar
from dataclasses import dataclass, field
import threading
import httpx

from app.config import settings

logger = logging.getLogger("clinical_llm_provider")

# Biến ngữ cảnh luồng (ContextVar) ghi nhận model và token thực tế từ Google AI Studio
_EMPTY_LLM_EXECUTION = {
    "model": None,
    "provider": None,
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0,
    "call_count": 0,
    "cache_hits": 0,
    "model_call_count": 0,
    "provider_call_count": 0,
    "usage_source": "none",
    "actual_usage": False,
}

@dataclass
class _LLMExecutionTrace:
    data: dict = field(default_factory=lambda: dict(_EMPTY_LLM_EXECUTION))
    lock: threading.Lock = field(default_factory=threading.Lock)


_current_llm_execution: ContextVar[_LLMExecutionTrace | None] = ContextVar(
    "_current_llm_execution",
    default=None,
)


def _resolve_usage_token(value: object, text: str) -> tuple[int, bool]:
    """Return a positive token count and whether it came from provider metadata.

    Some gateways return zero-valued or partial usage metadata.  Treat those as
    unavailable so telemetry does not claim provider-confirmed zero usage for a
    successful request.
    """
    try:
        parsed = int(value) if value is not None else 0
    except (TypeError, ValueError):
        parsed = 0
    if parsed > 0:
        return parsed, True
    return max(1, len(text or "") // 4), False


def _get_execution_trace() -> _LLMExecutionTrace:
    trace = _current_llm_execution.get()
    if trace is None:
        trace = _LLMExecutionTrace()
        _current_llm_execution.set(trace)
    return trace

def get_last_llm_execution() -> dict:
    trace = _get_execution_trace()
    with trace.lock:
        return dict(trace.data)

def set_last_llm_execution(data: dict) -> None:
    if "usage_source" not in data:
        data = {**data, "usage_source": "estimated", "actual_usage": False}
    _current_llm_execution.set(_LLMExecutionTrace({**_EMPTY_LLM_EXECUTION, **data}))

def reset_llm_execution() -> None:
    """Start a request-scoped usage trace without sharing mutable defaults."""
    _current_llm_execution.set(_LLMExecutionTrace())

def record_llm_execution(
    model: str,
    provider: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    *,
    usage_source: str = "provider",
    cache_hit: bool = False,
) -> dict:
    """Accumulate provider calls in this async request context."""
    trace = _get_execution_trace()
    with trace.lock:
        previous = trace.data
        sources = set(previous.get("usage_sources", []))
        if not cache_hit:
            sources.add(usage_source)
        if not sources:
            combined_source = "none"
        elif len(sources) == 1:
            combined_source = next(iter(sources))
        else:
            combined_source = "mixed"
        p_tokens = int(prompt_tokens or 0)
        c_tokens = int(completion_tokens or 0)
        current = {
        "model": model,
        "provider": provider,
        "prompt_tokens": previous.get("prompt_tokens", 0) + p_tokens,
        "completion_tokens": previous.get("completion_tokens", 0) + c_tokens,
        "total_tokens": previous.get("total_tokens", 0) + p_tokens + c_tokens,
        "call_count": previous.get("call_count", 0) + (0 if cache_hit else 1),
        "cache_hits": previous.get("cache_hits", 0) + (1 if cache_hit else 0),
        "usage_source": combined_source,
        "usage_sources": sorted(sources),
        "actual_usage": bool(sources) and sources == {"provider"},
        "model_call_count": previous.get("model_call_count", 0) + (0 if cache_hit else 1),
        "provider_call_count": previous.get("provider_call_count", 0) + (1 if not cache_hit and usage_source == "provider" else 0),
        }
        trace.data = current
        return dict(current)

# Lightweight response cache to avoid redundant inferences
_LLM_CACHE: Dict[str, Tuple[str, float]] = {}
CACHE_TTL_SEC = 3600  # 1 hour
MAX_CACHE_ITEMS = 300

def _compute_prompt_hash(provider: str, model: str, prompt: str, system: Optional[str]) -> str:
    raw = f"{provider}:{model}:{system or ''}:{prompt.strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

_COOLDOWN_TTL_SEC = 90.0
_MODEL_COOLDOWN_UNTIL: Dict[str, float] = {}
_LAST_HEALTHY_MODEL: Optional[str] = None


def _order_models_by_health(models: List[str], dead_models: set[str]) -> List[str]:
    """Ưu tiên model vừa chạy thành công, đẩy các model đang 503/Timeout xuống cuối hàng đợi."""
    now = time.monotonic()
    healthy: List[str] = []
    cooling: List[str] = []
    for m in models:
        if m in dead_models:
            continue
        if _MODEL_COOLDOWN_UNTIL.get(m, 0.0) > now:
            cooling.append(m)
        else:
            healthy.append(m)
    if _LAST_HEALTHY_MODEL and _LAST_HEALTHY_MODEL in healthy:
        healthy.remove(_LAST_HEALTHY_MODEL)
        healthy.insert(0, _LAST_HEALTHY_MODEL)
    return healthy + cooling


def _mark_model_healthy(model: str) -> None:
    global _LAST_HEALTHY_MODEL
    _LAST_HEALTHY_MODEL = model
    _MODEL_COOLDOWN_UNTIL.pop(model, None)


def _mark_model_cooldown(model: str) -> None:
    _MODEL_COOLDOWN_UNTIL[model] = time.monotonic() + _COOLDOWN_TTL_SEC


async def _call_gemini_api(
    prompt: str,
    system_instruction: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 800,
    timeout_sec: float = 15.0,
    response_schema: Optional[dict] = None,
) -> Optional[str]:
    from app.services.admin_key_vault import (
        get_active_api_key_async,
        record_key_consumption_async,
        rotate_to_next_key_async,
    )
    key = api_key
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        key = await get_active_api_key_async(provider="gemini")
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        key = settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        return None

    from app.services.gemini_model_discovery import get_available_gemini_models_async
    model_tier = "reasoning" if (response_schema is not None or max_output_tokens >= 1400) else "standard"
    models = await get_available_gemini_models_async(api_key=key, high_quota_only=True, model_tier=model_tier)
    generation_config = {"temperature": temperature, "maxOutputTokens": max_output_tokens}
    if response_schema:
        generation_config["responseMimeType"] = "application/json"
        generation_config["responseJsonSchema"] = response_schema

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": generation_config
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    deadline = time.monotonic() + timeout_sec
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    req_client_timeout = max(15.0, timeout_sec)
    dead_models = globals().setdefault("_DEAD_GEMINI_MODELS", set())
    ordered_models = _order_models_by_health(models, dead_models)
    async with httpx.AsyncClient(timeout=httpx.Timeout(req_client_timeout, connect=5.0)) as client:
        for model in ordered_models:
            if model in dead_models:
                continue
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            per_model_timeout = min(remaining, max(8.0, timeout_sec * 0.55))
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

            # 1. Chỉ dùng Context Caching khi không truyền system_instruction tùy biến (tránh mất round-trip & ghi đè prompt)
            cached_content_name = None
            if not system_instruction:
                try:
                    from app.services.cache.gemini_context_cache import get_active_context_cache
                    cached_content_name = await get_active_context_cache(key, model)
                except Exception:
                    cached_content_name = None

            active_payload = dict(payload)
            if cached_content_name:
                active_payload["cachedContent"] = cached_content_name
                active_payload.pop("systemInstruction", None)

            try:
                res = await client.post(
                    url,
                    headers=headers,
                    json=active_payload,
                    timeout=httpx.Timeout(per_model_timeout, connect=min(4.0, per_model_timeout))
                )

                # 2. Transparent Fallback: Nếu dùng cachedContent bị từ chối (HTTP 400/404), gọi lại bằng payload chuẩn
                if res.status_code in (400, 404) and cached_content_name:
                    logger.debug("Gemini cachedContent %s không khả dụng (HTTP %d). Fallback về payload chuẩn.", cached_content_name, res.status_code)
                    res = await client.post(
                        url,
                        headers=headers,
                        json=payload,
                        timeout=httpx.Timeout(per_model_timeout, connect=min(4.0, per_model_timeout))
                    )

                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        finish_reason = candidates[0].get("finishReason")
                        if finish_reason == "MAX_TOKENS":
                            logger.warning(
                                "Gemini model %s chạm trần MAX_TOKENS (maxOutputTokens=%d). Câu trả lời có thể bị gián đoạn.",
                                model, max_output_tokens
                            )
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text_parts = [
                            p.get("text", "") for p in parts
                            if isinstance(p, dict) and p.get("text") and not p.get("thought")
                        ]
                        reply = "".join(text_parts).strip()
                        if reply:
                            usage = data.get("usageMetadata", {})
                            p_value = usage.get("promptTokenCount")
                            c_value = usage.get("candidatesTokenCount")
                            cached_val = usage.get("cachedContentTokenCount")
                            cached_tok = int(cached_val) if cached_val is not None else 0
                            p_tok, p_actual = _resolve_usage_token(p_value, prompt)
                            c_tok, c_actual = _resolve_usage_token(c_value, reply)
                            record_llm_execution(
                                model, "gemini", p_tok, c_tok,
                                usage_source="provider" if p_actual and c_actual else "estimated",
                            )
                            try:
                                from app.services.telemetry_store import record_llm_token_usage
                                record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini", usage_source="provider" if p_value is not None and c_value is not None else "estimated", cached_tokens=cached_tok)
                                await record_key_consumption_async(key, p_tok + c_tok)
                            except Exception:
                                pass
                            _mark_model_healthy(model)
                            return reply
                elif res.status_code == 429 or "RESOURCE_EXHAUSTED" in getattr(res, "text", ""):
                    logger.warning("Gemini 429 Quota Exceeded on %s. Auto-rotating key.", model)
                    try:
                        await record_key_consumption_async(key, 0, is_error_429=True)
                    except Exception:
                        pass
                    next_key = await rotate_to_next_key_async(key, "Chạm hạn ngạch 429")
                    if next_key and next_key != key:
                        key = next_key
                        headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
                        retry_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
                        retry_res = await client.post(retry_url, headers=headers, json=payload, timeout=httpx.Timeout(remaining, connect=min(5.0, remaining)))
                        if retry_res.status_code == 200:
                            data = retry_res.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                if parts and "text" in parts[0]:
                                    reply = parts[0]["text"].strip()
                                    usage = data.get("usageMetadata", {})
                                    p_value = usage.get("promptTokenCount")
                                    c_value = usage.get("candidatesTokenCount")
                                    p_tok, p_actual = _resolve_usage_token(p_value, prompt)
                                    c_tok, c_actual = _resolve_usage_token(c_value, reply)
                                    record_llm_execution(
                                        model, "gemini", p_tok, c_tok,
                                        usage_source="provider" if p_actual and c_actual else "estimated",
                                    )
                                    try:
                                        from app.services.telemetry_store import record_llm_token_usage
                                        record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini", usage_source="provider" if p_value is not None and c_value is not None else "estimated")
                                        await record_key_consumption_async(key, p_tok + c_tok)
                                    except Exception:
                                        pass
                                    _mark_model_healthy(model)
                                    return reply
                    else:
                        logger.warning("Không còn khóa API dự phòng khả dụng trong Key Pool cho model %s. Thử model tiếp theo.", model)
                        continue
                else:
                    if res.status_code == 404:
                        dead_models.add(model)
                    elif res.status_code >= 500:
                        _mark_model_cooldown(model)
                    logger.warning("Gemini model %s returned HTTP %s: %s", model, res.status_code, (getattr(res, "text", "") or "")[:160])
            except Exception as e:
                if isinstance(e, httpx.TimeoutException):
                    _mark_model_cooldown(model)
                logger.warning("Gemini model %s attempt failed (%s): %s", model, type(e).__name__, e)
                continue
    return None

def _clean_base64_data(image_base64: str, default_mime: str = "image/jpeg") -> tuple[str, str]:
    """Tách MIME type và trích xuất chuỗi base64 thuần túy từ data URL nếu có."""
    clean_data = image_base64.strip()
    mime_type = default_mime
    if clean_data.startswith("data:") and ";base64," in clean_data:
        prefix, clean_data = clean_data.split(";base64,", 1)
        mime_type = prefix.replace("data:", "").strip() or default_mime
    return clean_data.strip(), mime_type

DEFAULT_PRESCRIPTION_OCR_PROMPT = """Bạn là chuyên gia AI Vision OCR y tế & dược phẩm lâm sàng chuẩn Bộ Y tế Việt Nam.
Nhiệm vụ: Phân tích và bóc tách tài liệu y tế (Đơn thuốc điều trị, Hóa đơn điện tử VAT, Bảng kê chi phí KCB BHYT mẫu 01/BV 02/BV, Phiếu xuất kho dược CPC1/Sanofi/DHG, Bill bán lẻ).

HƯỚNG DẪN BÓC TÁCH & PHÂN LOẠI CHI TIẾT:
1. PHÂN LOẠI TÀI LIỆU (document_type & is_valid):
   - "PRESCRIPTION": Đơn thuốc điều trị ngoại trú / nội trú (có tên bệnh nhân, chẩn đoán, danh mục thuốc, liều dùng). is_valid = true.
   - "INVOICE": Hóa đơn GTGT điện tử (e-Invoice) hoặc Bảng kê viện phí BHYT (có MST, Số HĐ, Đơn giá, Thành tiền). is_valid = true.
   - "DELIVERY_NOTE": Phiếu xuất/nhập kho dược phẩm, biên bản giao nhận (có Số lô, HSD, SĐK). is_valid = true.
   - "RECEIPT": Hóa đơn bán lẻ / Bill nhiệt POS (K80/K57). is_valid = true.
   - "NON_MEDICAL": Hình ảnh phong cảnh, chân dung, đồ vật, ảnh chụp màn hình không liên quan đến y tế hoặc dược phẩm. is_valid = false.
   - "UNREADABLE": Hình ảnh quá mờ, rung nhòe, thiếu sáng, bị che khuất nghiêm trọng không thể đọc được nội dung chữ. is_valid = false.

2. NGUYÊN TẮC BÓC TÁCH DANH MỤC THUỐC (items):
   - Nhận diện linh hoạt: Bảng có dòng kẻ viền, danh sách đánh số STT (1., 2.), gạch đầu dòng (-), hoặc đoạn văn bản kê thuốc.
   - Tên thuốc (drug_name): Biệt dược hoặc tên hoạt chất sạch (ví dụ: Augmentin, Nexium, Paracetamol, Amlodipin). Không đưa số lô, hạn dùng vào tên thuốc.
   - Hàm lượng (dosage): Tách riêng (500mg, 1g, 40mg, 5mg, 100ml...).
   - Đơn vị tính (unit): Viên, Hộp, Vỉ, Gói, Chai, Lọ, Ống, Tuýp, Nang...
   - Số lượng (quantity): Số lượng cấp phát dạng số thực (float/int).
   - Đường dùng (route): Uống, Tiêm bắp, Tiêm tĩnh mạch, Nhỏ mắt, Bôi ngoài da, Khí dung, Đặt...
   - Cách dùng & Liều lượng (instructions): "Uống 1 viên x 2 lần/ngày sau ăn"...
   - Đơn giá & Thành tiền: Trích xuất nếu có. Nếu không có để 0.0.

3. ĐỊNH DẠNG TRẢ VỀ:
Trả về DUY NHẤT một đối tượng JSON hợp lệ (không kèm văn bản dẫn dắt hay ký hiệu ngoài):
{
  "is_valid": true,
  "document_type": "PRESCRIPTION",
  "validation_message": "Mô tả nếu is_valid = false hoặc có lưu ý",
  "seller_name": "Tên cơ sở KCB / Bệnh viện / Phòng khám / Đơn vị bán nếu có",
  "seller_tax_id": "Mã số thuế bên bán nếu có",
  "invoice_number": "Số hóa đơn hoặc mã phiếu nếu có",
  "patient_name": "Họ và tên bệnh nhân (chữ in hoa chuẩn tiếng Việt)",
  "patient_age": 50,
  "insurance_card_number": "Mã thẻ BHYT (ví dụ GD4790000000000, 15 ký tự nếu có)",
  "primary_icd10": "Mã ICD-10 bệnh chính nếu có (ví dụ I10, E11, J06, K21)",
  "primary_diagnosis": "Chẩn đoán bệnh chính",
  "secondary_icd10s": ["Mã ICD phụ nếu có"],
  "items": [
    {
      "drug_name": "Tên biệt dược hoặc hoạt chất sạch",
      "active_ingredient": "Hoạt chất nếu có",
      "dosage": "500mg",
      "unit": "Viên",
      "quantity": 10.0,
      "days_supply": 7,
      "unit_price": 15000.0,
      "total_price": 150000.0,
      "batch_number": "",
      "expiry_date": "",
      "vat_rate": 0.0,
      "route": "Uống",
      "instructions": "Uống 1 viên x 2 lần/ngày sau ăn"
    }
  ]
}
"""

async def _call_gemini_vision_ocr(
    image_base64: str,
    mime_type: str = "image/jpeg",
    prompt: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout_sec: float = 25.0,
) -> Optional[dict]:
    """
    Gọi Gemini Multimodal API trích xuất đơn thuốc với mô hình thị giác và cascading fallback.
    Ưu tiên các model Flash production (như gemini-2.5-flash) theo danh mục Dynamic Discovery của Google API.
    """
    from app.services.admin_key_vault import get_active_api_key_async, rotate_to_next_key
    key = api_key
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        key = await get_active_api_key_async(provider="gemini")
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        key = settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        return None

    clean_data, detected_mime = _clean_base64_data(image_base64, mime_type)
    if not clean_data or len(clean_data) < 50:
        return None

    ocr_prompt = prompt or DEFAULT_PRESCRIPTION_OCR_PROMPT
    from app.services.gemini_model_discovery import get_available_gemini_models_async
    models = await get_available_gemini_models_async(api_key=key, high_quota_only=True)

    payload = {
        "contents": [{
            "parts": [
                {"text": ocr_prompt},
                {
                    "inline_data": {
                        "mime_type": detected_mime,
                        "data": clean_data
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json"
        }
    }

    deadline = time.monotonic() + timeout_sec
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(min(12.0, timeout_sec), connect=3.0)) as client:
        for model in models:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                res = await client.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=httpx.Timeout(min(12.0, remaining), connect=min(3.0, remaining))
                )
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        finish_reason = candidates[0].get("finishReason")
                        if finish_reason == "MAX_TOKENS":
                            logger.warning(
                                "Gemini model %s chạm trần MAX_TOKENS (maxOutputTokens=%d). Câu trả lời có thể bị gián đoạn.",
                                model, max_output_tokens
                            )
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            raw_text = parts[0]["text"].strip()
                            json_match = re.search(r'(\{[\s\S]*\})', raw_text)
                            if json_match:
                                raw_text = json_match.group(1)
                            elif raw_text.startswith("```json"):
                                raw_text = raw_text.split("```json", 1)[1]
                            elif raw_text.startswith("```"):
                                raw_text = raw_text.split("```", 1)[1]
                            if raw_text.endswith("```"):
                                raw_text = raw_text.rsplit("```", 1)[0]
                            parsed = json.loads(raw_text.strip())
                            if isinstance(parsed, dict):
                                usage = data.get("usageMetadata", {})
                                p_value = usage.get("promptTokenCount")
                                c_value = usage.get("candidatesTokenCount")
                                p_tok, p_actual = _resolve_usage_token(p_value, ocr_prompt)
                                c_tok, c_actual = _resolve_usage_token(c_value, raw_text)
                                record_llm_execution(model, "gemini", p_tok, c_tok, usage_source="provider" if p_actual and c_actual else "estimated")
                                img_tok = 258
                                parsed["_model_used"] = model
                                parsed["_provider"] = "gemini"
                                parsed["_prompt_tokens"] = p_tok
                                parsed["_completion_tokens"] = c_tok
                                parsed["_total_tokens"] = p_tok + c_tok
                                parsed["_image_tokens"] = img_tok
                                try:
                                    from app.services.telemetry_store import record_llm_token_usage
                                    from app.services.admin_key_vault import record_key_consumption
                                    cached_val = usage.get("cachedContentTokenCount")
                                    cached_tok = int(cached_val) if cached_val is not None else 0
                                    record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini", usage_source="provider" if p_value is not None and c_value is not None else "estimated", cached_tokens=cached_tok)
                                    record_key_consumption(key, p_tok + c_tok)
                                except Exception:
                                    pass
                                if "items" not in parsed or not isinstance(parsed.get("items"), list):
                                    parsed["items"] = []
                                doc_t = str(parsed.get("document_type") or "PRESCRIPTION").upper()
                                parsed["document_type"] = doc_t
                                if "is_valid" not in parsed:
                                    parsed["is_valid"] = (doc_t not in ("NON_MEDICAL", "UNREADABLE"))
                                return parsed
            except Exception as e:
                logger.debug("Gemini vision model %s attempt failed: %s", model, e)
                continue
    return None

async def _call_openai_compatible_vision_ocr(
    image_base64: str,
    mime_type: str = "image/jpeg",
    prompt: Optional[str] = None,
    timeout_sec: float = 25.0,
) -> Optional[dict]:
    """
    Hỗ trợ chuẩn mở OpenAI-compatible Vision cho các nhà cung cấp bên thứ 3 (GPT-4o, OpenRouter, Qwen2.5-VL...).
    """
    base_url = settings.OPENAI_API_BASE
    if not base_url:
        return None

    clean_data, detected_mime = _clean_base64_data(image_base64, mime_type)
    if not clean_data or len(clean_data) < 50:
        return None

    url = f"{base_url}/chat/completions"
    ocr_prompt = prompt or DEFAULT_PRESCRIPTION_OCR_PROMPT
    model = settings.OPENAI_MODEL or "gpt-4o-mini"

    messages = [
        {
            "role": "system",
            "content": "You are a clinical OCR system extracting structured Vietnamese medical prescription data strictly as valid JSON."
        },
        {
            "role": "user",
            "content": [
                {"type": "text", "text": ocr_prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:{detected_mime};base64,{clean_data}"
                    }
                }
            ]
        }
    ]

    headers = {"Content-Type": "application/json"}
    if settings.OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {settings.OPENAI_API_KEY}"

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.1,
        "response_format": {"type": "json_object"}
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_sec, connect=3.0)) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                choices = data.get("choices", [])
                if choices:
                    content = choices[0].get("message", {}).get("content", "")
                    if content:
                        raw_content = content.strip()
                        json_match = re.search(r'(\{[\s\S]*\})', raw_content)
                        if json_match:
                            raw_content = json_match.group(1)
                        parsed = json.loads(raw_content.strip())
                        if isinstance(parsed, dict):
                            parsed["_model_used"] = model
                            parsed["_provider"] = "openai_compatible"
                            if "items" not in parsed or not isinstance(parsed.get("items"), list):
                                parsed["items"] = []
                            doc_t = str(parsed.get("document_type") or "PRESCRIPTION").upper()
                            parsed["document_type"] = doc_t
                            if "is_valid" not in parsed:
                                parsed["is_valid"] = (doc_t not in ("NON_MEDICAL", "UNREADABLE"))
                            return parsed
    except Exception as e:
        logger.warning("Failed to query OpenAI-compatible vision endpoint %s: %s", url, e)

    return None

async def query_vision_ocr(
    image_base64: str,
    mime_type: str = "image/jpeg",
    prompt: Optional[str] = None,
    api_key: Optional[str] = None,
    timeout_sec: float = 25.0,
) -> Optional[dict]:
    """
    Điểm truy vấn Multimodal Vision OCR thống nhất cho đơn thuốc BHYT.
    Tự động chuyển tiếp theo cấu hình LLM_PROVIDER ('gemini' hoặc 'openai_compatible').
    """
    provider = (settings.LLM_PROVIDER or "gemini").strip().lower()
    if provider in {"offline", "none", "disable", "disabled"}:
        set_last_llm_execution({"model": "local-extractive", "provider": "local", "usage_source": "none"})
        return None

    if provider == "openai_compatible":
        return await _call_openai_compatible_vision_ocr(
            image_base64=image_base64,
            mime_type=mime_type,
            prompt=prompt,
            timeout_sec=timeout_sec,
        )

    # Mặc định: Google Gemini Vision Gateway
    return await _call_gemini_vision_ocr(
        image_base64=image_base64,
        mime_type=mime_type,
        prompt=prompt,
        api_key=api_key,
        timeout_sec=timeout_sec,
    )

async def _call_openai_compatible_api(
    prompt: str,
    system_instruction: Optional[str] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 800,
    timeout_sec: float = 12.0,
) -> Optional[str]:
    base_url = settings.OPENAI_API_BASE
    if not base_url:
        return None

    url = f"{base_url}/chat/completions"
    messages = []
    if system_instruction:
        messages.append({"role": "system", "content": system_instruction})
    messages.append({"role": "user", "content": prompt})

    headers = {
        "Content-Type": "application/json",
    }
    api_key = settings.OPENAI_API_KEY
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": settings.OPENAI_MODEL or "qwen2.5:7b-instruct",
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_output_tokens,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_sec, connect=3.0)) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code == 200:
                data = res.json()
                choices = data.get("choices", [])
                if choices:
                    msg = choices[0].get("message", {})
                    content = msg.get("content", "")
                    if content:
                        reply = content.strip()
                        usage = data.get("usage", {})
                        p_value = usage.get("prompt_tokens")
                        c_value = usage.get("completion_tokens")
                        p_tok = p_value if p_value is not None else (len(prompt) // 4)
                        c_tok = c_value if c_value is not None else (len(reply) // 4)
                        record_llm_execution(
                            settings.OPENAI_MODEL or "openai-compatible",
                            "openai_compatible", p_tok, c_tok,
                            usage_source="provider" if p_value is not None and c_value is not None else "estimated",
                        )
                        try:
                            from app.services.telemetry_store import record_llm_token_usage
                            record_llm_token_usage(p_tok, c_tok, model=settings.OPENAI_MODEL or "qwen2.5:7b-instruct", provider="openai_compatible", usage_source="provider" if p_value is not None and c_value is not None else "estimated")
                        except Exception:
                            pass
                        return reply
            else:
                logger.warning(
                    "OpenAI-compatible endpoint %s returned status %d: %s",
                    url, res.status_code, res.text[:200]
                )
    except Exception as e:
        logger.warning("Failed to query OpenAI-compatible endpoint %s: %s", url, e)

    return None

async def query_clinical_llm(
    prompt: str,
    system_instruction: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 800,
    timeout_sec: float = 15.0,
    response_schema: Optional[dict] = None,
) -> Optional[str]:
    """
    Điểm truy vấn LLM thống nhất cho toàn bộ hệ thống lâm sàng.
    Tự động chuyển hướng theo cấu hình LLM_PROVIDER:
    - 'gemini': Google Cloud API
    - 'openai_compatible': Ollama, vLLM, DeepSeek, Groq, LM Studio
    - 'offline': Trả về None -> Kích hoạt Extractive Grounded Synthesis 0% ảo giác
    """
    provider = (settings.LLM_PROVIDER or "gemini").strip().lower()

    # 1. Chế độ Ngoại tuyến 100% (Offline Grounded Mode)
    if provider in {"offline", "none", "disable", "disabled"}:
        return None

    # 1.1 Check exact response cache first: returning a prior result incurs no
    # provider usage and must remain available when the daily budget is exhausted.
    model_identifier = settings.OPENAI_MODEL if provider == "openai_compatible" else "gemini-auto"
    schema_fingerprint = json.dumps(response_schema, sort_keys=True) if response_schema else ""
    cache_prompt = f"{prompt}\n<response_schema>{schema_fingerprint}</response_schema>" if response_schema else prompt
    cache_hash = _compute_prompt_hash(provider, model_identifier, cache_prompt, system_instruction)
    cached = _LLM_CACHE.get(cache_hash)
    if cached:
        text, ts = cached
        if time.time() - ts < CACHE_TTL_SEC:
            record_llm_execution(model_identifier, provider, cache_hit=True)
            return text
        _LLM_CACHE.pop(cache_hash, None)

    # 1.2 Only a cache miss can spend provider tokens, so apply the budget gate
    # immediately before dispatching a new external request.
    from app.services.admin_monitoring_service import check_token_budget_gate
    budget_allowed, budget_msg = check_token_budget_gate()
    if not budget_allowed:
        logger.warning("Token budget gate closed: %s. Falling back to local offline RAG.", budget_msg)
        set_last_llm_execution({"model": "local-extractive", "provider": "local", "usage_source": "none"})
        return None

    # 3. Phân phối cuộc gọi theo Provider
    result: Optional[str] = None
    if provider == "openai_compatible":
        result = await _call_openai_compatible_api(
            prompt=prompt,
            system_instruction=system_instruction,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_sec=timeout_sec,
        )
    else:
        # Mặc định: Google Gemini, tự động fallback sang LiteLLM Router (Groq -> OpenRouter -> Mistral -> Ollama) nếu hết quota
        result = await _call_gemini_api(
            prompt=prompt,
            system_instruction=system_instruction,
            api_key=api_key,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_sec=timeout_sec,
            response_schema=response_schema,
        )
        if not result:
            from app.services.litellm_gateway import routed_completion

            routed = await routed_completion(
                prompt,
                system_prompt=system_instruction,
                json_mode=bool(response_schema),
                temperature=temperature,
                max_tokens=max_output_tokens,
                timeout_sec=timeout_sec,
                preferred_order=["groq-tier", "openrouter-tier", "mistral-tier", "ollama-tier"],
            )
            if routed and routed.get("text"):
                result = routed["text"]
                model_identifier = routed.get("model") or "litellm-fallback"
                provider = model_identifier.split("/")[0] if "/" in model_identifier else "litellm"

    # 4. Lưu cache nếu thành công
    if result:
        # A provider call may have occurred without returning token metadata. Track
        # execution separately from usage so request counters don't report zero.
        execution = get_last_llm_execution()
        if execution.get("model_call_count", 0) == 0 and execution.get("cache_hits", 0) == 0:
            p_tok, _ = _resolve_usage_token(None, prompt)
            c_tok, _ = _resolve_usage_token(None, result)
            record_llm_execution(model_identifier, provider, p_tok, c_tok, usage_source="estimated")
        if len(_LLM_CACHE) >= MAX_CACHE_ITEMS:
            oldest = min(_LLM_CACHE.keys(), key=lambda k: _LLM_CACHE[k][1])
            _LLM_CACHE.pop(oldest, None)
        _LLM_CACHE[cache_hash] = (result, time.time())
    elif get_last_llm_execution().get("model_call_count", 0) == 0 and get_last_llm_execution().get("cache_hits", 0) == 0:
        record_llm_execution(model_identifier, provider, usage_source="estimated")

    return result


async def stream_clinical_llm(
    prompt: str,
    system_instruction: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 2048,
    timeout_sec: float = 35.0,
):
    """
    True Streaming generator cho Google Gemini (streamGenerateContent?alt=sse).
    Phát từng đoạn text ngay khi mô hình sinh ra để giảm TTFT xuống ~1–2s.
    """
    from app.services.admin_key_vault import (
        get_active_api_key_async,
        record_key_consumption_async,
        rotate_to_next_key_async,
    )
    from app.services.admin_monitoring_service import check_token_budget_gate
    from app.services.gemini_model_discovery import get_available_gemini_models_async
    from app.config import settings

    budget_allowed, budget_msg = check_token_budget_gate()
    if not budget_allowed:
        logger.warning("Token budget gate closed during stream: %s", budget_msg)
        set_last_llm_execution({"model": "local-extractive", "provider": "local", "usage_source": "none"})
        return

    key = (api_key or "").strip() or (await get_active_api_key_async(provider="gemini") or "").strip() or (getattr(settings, "GEMINI_API_KEY", None) or "").strip()
    if not key or key.startswith("YOUR_"):
        return

    model_tier = "reasoning" if max_output_tokens >= 1400 else "standard"
    models = await get_available_gemini_models_async(api_key=key, high_quota_only=True, model_tier=model_tier)
    dead_models = globals().setdefault("_DEAD_GEMINI_MODELS", set())
    ordered_models = _order_models_by_health(models, dead_models)

    payload: Dict[str, Any] = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_output_tokens,
        },
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    deadline = time.monotonic() + timeout_sec
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    req_client_timeout = max(15.0, timeout_sec)

    async with httpx.AsyncClient(timeout=httpx.Timeout(req_client_timeout, connect=5.0)) as client:
        for model in ordered_models:
            if model in dead_models:
                continue
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break

            per_model_timeout = min(remaining, max(10.0, timeout_sec * 0.5))
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
            yielded_any = False
            accumulated_parts: List[str] = []
            last_usage: Dict[str, Any] = {}

            try:
                async with client.stream(
                    "POST",
                    url,
                    headers=headers,
                    json=payload,
                    timeout=httpx.Timeout(per_model_timeout, connect=min(4.0, per_model_timeout)),
                ) as res:
                    if res.status_code == 404:
                        dead_models.add(model)
                        logger.warning("Gemini stream model %s returned 404 (marked dead).", model)
                        continue
                    if res.status_code == 429:
                        await record_key_consumption_async(key, 0, is_error_429=True)
                        next_key = await rotate_to_next_key_async(key, "Chạm hạn ngạch 429")
                        if next_key and next_key != key:
                            key = next_key
                            headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
                        continue
                    if res.status_code >= 500:
                        _mark_model_cooldown(model)
                        logger.warning("Gemini stream model %s returned HTTP %s", model, res.status_code)
                        continue
                    if res.status_code != 200:
                        logger.warning("Gemini stream model %s returned HTTP %s", model, res.status_code)
                        continue

                    async for raw_line in res.aiter_lines():
                        line = raw_line.strip()
                        if not line or not line.startswith("data:"):
                            continue
                        data_str = line[5:].strip()
                        if not data_str or data_str == "[DONE]":
                            continue
                        try:
                            chunk_json = json.loads(data_str)
                        except Exception:
                            continue
                        if isinstance(chunk_json.get("usageMetadata"), dict):
                            last_usage = chunk_json["usageMetadata"]
                        candidates = chunk_json.get("candidates", [])
                        if not candidates:
                            continue
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            delta = part.get("text")
                            if delta:
                                yielded_any = True
                                accumulated_parts.append(delta)
                                yield delta

                if yielded_any:
                    _mark_model_healthy(model)
                    full_reply = "".join(accumulated_parts)
                    p_val = last_usage.get("promptTokenCount")
                    c_val = last_usage.get("candidatesTokenCount")
                    p_tok, p_actual = _resolve_usage_token(p_val, prompt)
                    c_tok, c_actual = _resolve_usage_token(c_val, full_reply)
                    record_llm_execution(
                        model, "gemini", p_tok, c_tok,
                        usage_source="provider" if p_actual and c_actual else "estimated",
                    )
                    try:
                        from app.services.telemetry_store import record_llm_token_usage
                        record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini", usage_source="provider" if p_val is not None and c_val is not None else "estimated")
                        await record_key_consumption_async(key, p_tok + c_tok)
                    except Exception:
                        pass
                    return
            except Exception as e:
                if isinstance(e, httpx.TimeoutException):
                    _mark_model_cooldown(model)
                logger.warning("Gemini stream model %s attempt failed (%s): %s", model, type(e).__name__, e)
                if yielded_any:
                    # Đã phát một phần nội dung cho user, dừng gọn thay vì nối sang model khác
                    return
                continue

    # Nếu Gemini stream không trả về được dữ liệu (hết quota/429), fallback sang LiteLLM Router
    from app.services.litellm_gateway import routed_completion

    routed = await routed_completion(
        prompt,
        system_prompt=system_instruction,
        temperature=temperature,
        max_tokens=max_output_tokens,
        timeout_sec=timeout_sec,
        preferred_order=["groq-tier", "openrouter-tier", "mistral-tier", "ollama-tier"],
    )
    if routed and routed.get("text"):
        fallback_text = routed["text"]
        used_model = routed.get("model") or "litellm-fallback"
        used_prov = used_model.split("/")[0] if "/" in used_model else "litellm"
        p_tok, _ = _resolve_usage_token(None, prompt)
        c_tok, _ = _resolve_usage_token(None, fallback_text)
        record_llm_execution(used_model, used_prov, p_tok, c_tok, usage_source="estimated")
        yield fallback_text


CLINICAL_MULTIMODAL_SYSTEM_PROMPT = """Bạn là Trợ Lý Trí Tuệ Nhân Tạo Dược Lâm Sàng & Kê Đơn BHYT (Clinical Pharmacist & BHYT Audit AI Copilot) chuyên nghiệp tại Bệnh viện Việt Nam.
Nhiệm vụ: Phân tích hình ảnh Đơn thuốc, Nhãn thuốc / Vỏ thuốc hoặc Tài liệu thanh toán BHYT do nhân viên y tế gửi kèm câu hỏi.

QUY TẮC BẮT BUỘC & PHẠM VI CHUYÊN MÔN (CLINICAL GUARDRAILS - CHỈ THUỐC, KÊ ĐƠN & BHYT):
1. GIỚI HẠN PHẠM VI NGHIÊM NGẶT:
   - CHỈ trả lời các câu hỏi liên quan đến:
     a) Thuốc & Dược lâm sàng: Dược Thư Quốc Gia Việt Nam, hoạt chất, biệt dược, nồng độ/hàm lượng, liều dùng tối đa, tương tác thuốc bất lợi, chống chỉ định, quy chế quản lý thuốc kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT, TT 36/2018/TT-BYT).
     b) Kê đơn điều trị (CPOE): Quy chế kê đơn thuốc ngoại trú/nội trú theo Thông tư 52/2017/TT-BYT, TT 18/2018/TT-BYT, TT 27/2021/TT-BYT, đối chiếu tính phù hợp giữa chẩn đoán ICD-10 và thuốc được kê.
     c) Giám định & Thanh toán BHYT: Danh mục thuốc thanh toán BHYT, tỷ lệ thanh toán (100%, 70%, 50%), điều kiện thanh toán Cột 8 theo Thông tư 20/2022/TT-BYT, quy trình giám định chống xuất toán theo Quyết định 3618/QĐ-BHXH, chuẩn dữ liệu XML chi phí khám chữa bệnh Quyết định 130/QĐ-BYT.
   - TUYỆT ĐỐI TỪ CHỐI:
     + Yêu cầu về trang thiết bị y tế (báo hỏng máy móc, kiểm định thiết bị), cơ sở hạ tầng, tài sản.
     + Viết mã lập trình phần mềm (HTML, CSS, JS, Python, SQL...), tạo website, giải toán ngoài lề hoặc làm việc ngoài ngành y tế.
   - Nếu hình ảnh KHÔNG PHẢI là đơn thuốc, vỏ/nhãn thuốc hoặc tài liệu BHYT (ảnh chụp thiết bị, phong cảnh, cá nhân, meme, động vật...): Đặt "is_clinical": false, "category": "NON_CLINICAL" và trả lời từ chối lịch sự, nêu rõ hệ thống chỉ chuyên trách về Thuốc, Kê đơn và Giám định BHYT.

2. CÁC TÌNH HUỐNG XỬ LÝ HÌNH ẢNH:
   - Đơn thuốc / Toa thuốc / Phiếu CPOE: Đọc họ tên, chẩn đoán ICD-10, trích xuất từng thuốc (tên, hàm lượng, số lượng, liều dùng, đường dùng). Cảnh báo tương tác thuốc nghiêm trọng, trùng lặp nhóm điều trị hoặc liều vượt ngưỡng.
   - Vỏ thuốc / Hộp thuốc / Nhãn thuốc: Đọc tên hoạt chất, biệt dược, nồng độ/hàm lượng, SĐK, số lô, hạn dùng (cảnh báo nếu cận hạn theo TT 36). Nếu là thuốc gây nghiện/hướng tâm thần (Morphin, Fentanyl), hướng dẫn thủ tục thu hồi vỏ theo TT 20/2017.
   - Bảng kê chi phí BHYT / Giám định: Phân tích danh mục thuốc theo Cột 8 TT 20/2022, phát hiện nguy cơ xuất toán do sai mã ICD-10, kê vượt tuyến bệnh viện hoặc thiếu biên bản hội chẩn.
   - QUY TẮC BẢO TOÀN DỮ LIỆU & PHONG CÁCH LÂM SÀNG:
     + TUYỆT ĐỐI KHÔNG TỰ ĐOÁN GIÁ: Nếu trên đơn thuốc không ghi đơn giá/thành tiền, tuyệt đối không tự ý bịa đặt hoặc phỏng đoán giá tiền.
     + TUYỆT ĐỐI KHÔNG DÙNG ICON/EMOJI TRANG TRÍ: Không sử dụng các biểu tượng cảm xúc hoặc emoji trang trí (như 📑, 💊, ⚠️, 🚨, ⛔, 💵, 💡, ✅). Trình bày văn bản y khoa nghiêm túc, dùng markdown chuẩn mực.

3. ĐỊNH DẠNG TRẢ VỀ:
Trả về DUY NHẤT một đối tượng JSON hợp lệ:
{
  "is_clinical": true,
  "category": "PRESCRIPTION" | "MEDICATION" | "BHYT_DOCUMENT" | "NON_CLINICAL",
  "document_type_label": "Tên loại tài liệu bằng tiếng Việt, ví dụ: Đơn thuốc ngoại trú, Nhãn thuốc, Phiếu thanh toán BHYT",
  "extracted_sections": [
    {"title": "Tên nhóm thông tin bằng tiếng Việt", "items": ["Một dữ kiện đọc được trên ảnh"]}
  ],
  "extracted_prescription": {
    "patient_name": "Họ tên bệnh nhân nếu có",
    "patient_age": 50,
    "insurance_card_number": "Mã thẻ BHYT 15 ký tự nếu có",
    "primary_icd10": "Mã ICD-10 bệnh chính nếu có (ví dụ: I10, E11, J06, K21)",
    "primary_diagnosis": "Chẩn đoán bệnh chính",
    "hospital_rank": "HANG_1",
    "items": [
      {
        "drug_name": "Tên thuốc hoặc biệt dược sạch",
        "active_ingredient": "Hoạt chất nếu có",
        "dosage": "Hàm lượng (ví dụ: 500mg, 20mg)",
        "unit": "Viên, gói, lọ...",
        "quantity": 10.0,
        "days_supply": 7,
        "route": "Uống, tiêm...",
        "instructions": "Cách dùng chi tiết"
      }
    ]
  },
  "extracted_text": "Nội dung quan sát/đọc được trên ảnh, không bổ sung suy đoán...",
  "unreadable_fields": ["Các trường không đọc rõ hoặc không xuất hiện"],
  "reply_markdown": "Tóm tắt dữ kiện quan sát được...",
  "legal_basis": null,
  "suggested_chips": ["Kiểm tra điều kiện BHYT TT 20", "Tra cứu tương tác thuốc Dược Thư"],
  "card": null
}
"""

async def query_clinical_multimodal_chat(
    image_base64: str,
    mime_type: str = "image/jpeg",
    user_query: str = "",
    user_role: str = "nurse",
    timeout_sec: float = 30.0
) -> Optional[dict]:
    """
    Điểm truy vấn Gemini Multimodal Vision dành riêng cho Chatbot Dược Lâm Sàng & BHYT:
    Nhận diện đơn thuốc, vỏ/nhãn thuốc, tài liệu BHYT và áp dụng Clinical Guardrails (chỉ Thuốc - Kê đơn - BHYT).
    """
    clean_data, detected_mime = _clean_base64_data(image_base64, mime_type)
    if not clean_data or len(clean_data) < 50:
        return None

    from app.services.admin_key_vault import get_active_api_key_async
    key = await get_active_api_key_async(provider="gemini") or settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        return None

    from app.services.gemini_model_discovery import get_available_gemini_models_async
    models = await get_available_gemini_models_async(api_key=key, high_quota_only=True)

    prompt_text = f"Câu hỏi / Yêu cầu của nhân viên y tế ({user_role}): {user_query or 'Phân tích đơn thuốc / hình ảnh thuốc đính kèm: trích xuất danh mục hoạt chất, liều dùng, tương tác thuốc và rà soát điều kiện thanh toán BHYT.'}"
    payload = {
        "systemInstruction": {
            "parts": [{"text": CLINICAL_MULTIMODAL_SYSTEM_PROMPT}]
        },
        "contents": [{
            "parts": [
                {"text": prompt_text},
                {
                    "inline_data": {
                        "mime_type": detected_mime,
                        "data": clean_data
                    }
                }
            ]
        }],
        "generationConfig": {
            "temperature": 0.15,
            "responseMimeType": "application/json"
        }
    }

    deadline = time.monotonic() + timeout_sec
    headers = {"x-goog-api-key": key, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=httpx.Timeout(min(25.0, timeout_sec), connect=5.0)) as client:
        for model in models:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
            try:
                res = await client.post(
                    url,
                    headers=headers,
                    json=payload,
                    timeout=httpx.Timeout(min(25.0, remaining), connect=min(5.0, remaining))
                )
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        finish_reason = candidates[0].get("finishReason")
                        if finish_reason == "MAX_TOKENS":
                            logger.warning(
                                "Gemini model %s chạm trần MAX_TOKENS (maxOutputTokens=%d). Câu trả lời có thể bị gián đoạn.",
                                model, max_output_tokens
                            )
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            raw_text = parts[0]["text"].strip()
                            match = re.search(r'(\{[\s\S]*\})', raw_text)
                            if match:
                                raw_text = match.group(1)
                            parsed = json.loads(raw_text)
                            if isinstance(parsed, dict):
                                usage = data.get("usageMetadata", {})
                                p_value = usage.get("promptTokenCount")
                                c_value = usage.get("candidatesTokenCount")
                                p_tok = p_value if p_value is not None else (len(prompt_text) // 4 + 258)
                                c_tok = c_value if c_value is not None else max(30, len(raw_text) // 4)
                                record_llm_execution(model, "gemini", p_tok, c_tok, usage_source="provider" if p_value is not None and c_value is not None else "estimated")
                                img_tok = 258
                                parsed["_model_used"] = model
                                parsed["_provider"] = "gemini"
                                parsed["_prompt_tokens"] = p_tok
                                parsed["_completion_tokens"] = c_tok
                                parsed["_total_tokens"] = p_tok + c_tok
                                parsed["_image_tokens"] = img_tok
                                try:
                                    from app.services.telemetry_store import record_llm_token_usage
                                    from app.services.admin_key_vault import record_key_consumption
                                    cached_val = usage.get("cachedContentTokenCount")
                                    cached_tok = int(cached_val) if cached_val is not None else 0
                                    record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini", usage_source="provider" if p_value is not None and c_value is not None else "estimated", cached_tokens=cached_tok)
                                    record_key_consumption(key, p_tok + c_tok)
                                except Exception:
                                    pass
                                return parsed
            except Exception as e:
                logger.debug("Clinical vision chat model %s failed: %s", model, e)
                continue

    return None

