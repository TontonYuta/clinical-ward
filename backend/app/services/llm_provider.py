"""
Universal Clinical LLM Gateway & Provider Adapter
Supports:
1. Google Gemini (cloud API)
2. OpenAI-Compatible Providers (Ollama, vLLM, DeepSeek, Groq, LocalAI, LM Studio)
3. 100% Offline Mode (Deterministic Extractive RAG - 0 Cloud, 0 VND)
"""
import time
import hashlib
import logging
from typing import Optional, Dict, Tuple
import httpx

from app.config import settings

logger = logging.getLogger("clinical_llm_provider")

# Lightweight response cache to avoid redundant inferences
_LLM_CACHE: Dict[str, Tuple[str, float]] = {}
CACHE_TTL_SEC = 3600  # 1 hour
MAX_CACHE_ITEMS = 300

def _compute_prompt_hash(provider: str, model: str, prompt: str, system: Optional[str]) -> str:
    raw = f"{provider}:{model}:{system or ''}:{prompt.strip()}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()

async def _call_gemini_api(
    prompt: str,
    system_instruction: Optional[str] = None,
    api_key: Optional[str] = None,
    temperature: float = 0.2,
    max_output_tokens: int = 800,
    timeout_sec: float = 8.0,
) -> Optional[str]:
    from app.services.admin_key_vault import get_active_api_key, rotate_to_next_key
    key = api_key
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        key = get_active_api_key(provider="gemini")
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        key = settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        return None

    models = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-lite-latest",
    ]
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_output_tokens}
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    deadline = time.monotonic() + timeout_sec
    async with httpx.AsyncClient(timeout=httpx.Timeout(min(4.0, timeout_sec), connect=2.0)) as client:
        for model in models:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            try:
                res = await client.post(
                    url,
                    json=payload,
                    timeout=httpx.Timeout(min(4.0, remaining), connect=min(2.0, remaining))
                )
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            reply = parts[0]["text"].strip()
                            usage = data.get("usageMetadata", {})
                            p_tok = usage.get("promptTokenCount") or (len(prompt) // 4)
                            c_tok = usage.get("candidatesTokenCount") or (len(reply) // 4)
                            try:
                                from app.services.telemetry_store import record_llm_token_usage
                                from app.services.admin_key_vault import record_key_consumption
                                record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini")
                                record_key_consumption(key, p_tok + c_tok)
                            except Exception:
                                pass
                            return reply
                elif res.status_code == 429 or "RESOURCE_EXHAUSTED" in getattr(res, "text", ""):
                    logger.warning("Gemini 429 Quota Exceeded on %s. Auto-rotating key.", model)
                    try:
                        from app.services.admin_key_vault import record_key_consumption
                        record_key_consumption(key, 0, is_error_429=True)
                    except Exception:
                        pass
                    next_key = rotate_to_next_key(key, "Chạm hạn ngạch 429")
                    if next_key and next_key != key:
                        key = next_key
                        retry_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
                        retry_res = await client.post(retry_url, json=payload, timeout=httpx.Timeout(min(4.0, remaining), connect=min(2.0, remaining)))
                        if retry_res.status_code == 200:
                            data = retry_res.json()
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                if parts and "text" in parts[0]:
                                    reply = parts[0]["text"].strip()
                                    usage = data.get("usageMetadata", {})
                                    p_tok = usage.get("promptTokenCount") or (len(prompt) // 4)
                                    c_tok = usage.get("candidatesTokenCount") or (len(reply) // 4)
                                    try:
                                        from app.services.telemetry_store import record_llm_token_usage
                                        from app.services.admin_key_vault import record_key_consumption
                                        record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini")
                                        record_key_consumption(key, p_tok + c_tok)
                                    except Exception:
                                        pass
                                    return reply
            except Exception as e:
                logger.debug("Gemini model %s attempt failed: %s", model, e)
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

DEFAULT_PRESCRIPTION_OCR_PROMPT = """Bạn là trợ lý AI Vision OCR y tế & dược phẩm lâm sàng chuyên nghiệp tại Việt Nam.
Nhiệm vụ: Phân tích hình ảnh tài liệu y tế (Đơn thuốc lâm sàng, Hóa đơn điện tử VAT, Phiếu xuất kho kiêm vận chuyển nội bộ, Bảng kê phân phối dược CPC1/Sanofi/DHG, hoặc Bill bán lẻ).

HƯỚNG DẪN BÓC TÁCH CHI TIẾT THEO BỐ CỤC:
1. PHÂN LOẠI TÀI LIỆU (document_type):
   - "PRESCRIPTION": Đơn thuốc điều trị ngoại trú / nội trú (có tên bệnh nhân, chẩn đoán, thuốc, liều dùng).
   - "INVOICE": Hóa đơn GTGT điện tử (e-Invoice VAT) hoặc Bảng kê viện phí (có MST, Số HĐ, Đơn giá, Thành tiền).
   - "DELIVERY_NOTE": Phiếu xuất kho / Phiếu giao nhận dược phẩm (có Số lô, HSD, SĐK).
   - "RECEIPT": Hóa đơn bán lẻ / Bill in nhiệt K80/K57.

2. QUY TẮC BÓC TÁCH BẢNG & DÒNG PHỤ (Sub-row Reconstruction):
   - Gom cụm thông tin: Nếu Số lô (Lot/Batch) và Hạn dùng (Exp/HSD) nằm ở dòng phụ thụt lề dưới tên thuốc (phổ biến ở CPC1/Sanofi), hãy gom vào cùng một mặt hàng.
   - Tách sạch Tên thuốc (drug_name): Chỉ chứa tên thương mại hoặc hoạt chất (ví dụ 'Augmentin', 'Nexium', 'Panadol Extra'), KHÔNG gộp số lô hay hạn dùng vào tên thuốc.
   - Hàm lượng (dosage): Tách riêng nồng độ/hàm lượng (ví dụ '500mg', '1g', '20mg', '100ml').
   - Đơn vị tính (unit): Viên, Hộp, Vỉ, Gói, Lọ, Chai, Ống, Tuýp, Nang...
   - Số lượng (quantity): Số lượng thực xuất/cấp phát dạng số (float/int).
   - Đơn giá & Thành tiền: Trích xuất đơn giá và thành tiền chính xác. Logic: total_price = quantity * unit_price (trừ đi chiết khấu nếu có).
   - Số lô (batch_number) & Hạn dùng (expiry_date): Trích xuất chính xác chuỗi số lô và ngày hết hạn.

3. ĐỊNH DẠNG KẾT QUẢ:
Trả về DUY NHẤT một đối tượng JSON hợp lệ (không chứa markdown fences hay text giải thích ngoài):
{
  "document_type": "PRESCRIPTION",
  "seller_name": "Tên đơn vị phát hành / Bệnh viện / Công ty dược nếu có",
  "seller_tax_id": "Mã số thuế bên bán nếu có",
  "invoice_number": "Số hóa đơn hoặc mã phiếu nếu có",
  "patient_name": "Họ và tên bệnh nhân hoặc khách hàng (chữ hoa chuẩn)",
  "patient_age": 50,
  "insurance_card_number": "Mã thẻ BHYT (ví dụ GD4790000000000, 15 ký tự nếu có)",
  "primary_icd10": "Mã ICD-10 bệnh chính nếu có (ví dụ I10, E11, M16)",
  "primary_diagnosis": "Chẩn đoán bệnh chính nếu có",
  "secondary_icd10s": ["Mã ICD phụ nếu có"],
  "items": [
    {
      "drug_name": "Tên biệt dược hoặc hoạt chất sạch",
      "active_ingredient": "Hoạt chất nếu ghi rõ trên tài liệu",
      "dosage": "500mg",
      "unit": "Viên",
      "quantity": 10.0,
      "days_supply": 7,
      "unit_price": 15000.0,
      "total_price": 150000.0,
      "batch_number": "B24098",
      "expiry_date": "30/12/2027",
      "vat_rate": 5.0,
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
    Ưu tiên gemini-2.5-flash / gemini-3-flash, tự động trượt xuống gemini-3.5-flash-lite khi hết hạn ngạch.
    """
    from app.services.admin_key_vault import get_active_api_key, rotate_to_next_key
    key = api_key
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        key = get_active_api_key(provider="gemini")
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        key = settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        return None

    clean_data, detected_mime = _clean_base64_data(image_base64, mime_type)
    if not clean_data or len(clean_data) < 50:
        return None

    ocr_prompt = prompt or DEFAULT_PRESCRIPTION_OCR_PROMPT
    models = [
        "gemini-3.5-flash-lite",
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-3-flash-preview",
        "gemini-3.1-pro-preview",
    ]

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
    async with httpx.AsyncClient(timeout=httpx.Timeout(min(12.0, timeout_sec), connect=3.0)) as client:
        for model in models:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
            try:
                res = await client.post(
                    url,
                    json=payload,
                    timeout=httpx.Timeout(min(12.0, remaining), connect=min(3.0, remaining))
                )
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            raw_text = parts[0]["text"].strip()
                            if raw_text.startswith("```json"):
                                raw_text = raw_text.split("```json", 1)[1]
                            if raw_text.startswith("```"):
                                raw_text = raw_text.split("```", 1)[1]
                            if raw_text.endswith("```"):
                                raw_text = raw_text.rsplit("```", 1)[0]
                            parsed = json.loads(raw_text.strip())
                            if isinstance(parsed, dict) and "items" in parsed:
                                parsed["_model_used"] = model
                                parsed["_provider"] = "gemini"
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
                        parsed = json.loads(content.strip())
                        if isinstance(parsed, dict) and "items" in parsed:
                            parsed["_model_used"] = model
                            parsed["_provider"] = "openai_compatible"
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
                        p_tok = usage.get("prompt_tokens") or (len(prompt) // 4)
                        c_tok = usage.get("completion_tokens") or (len(reply) // 4)
                        try:
                            from app.services.telemetry_store import record_llm_token_usage
                            record_llm_token_usage(p_tok, c_tok, model=settings.OPENAI_MODEL or "qwen2.5:7b-instruct", provider="openai_compatible")
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
    timeout_sec: float = 8.0,
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

    # 1.1 Kiểm tra Token Budget Cap (Chặn vượt trần chi phí & tự động trượt sang Offline Mode)
    from app.services.admin_monitoring_service import check_token_budget_gate
    budget_allowed, budget_msg = check_token_budget_gate()
    if not budget_allowed:
        logger.warning("Token budget gate closed: %s. Falling back to local offline RAG.", budget_msg)
        return None

    # 2. Kiểm tra bộ nhớ đệm LLM
    model_identifier = settings.OPENAI_MODEL if provider == "openai_compatible" else "gemini-auto"
    cache_hash = _compute_prompt_hash(provider, model_identifier, prompt, system_instruction)
    cached = _LLM_CACHE.get(cache_hash)
    if cached:
        text, ts = cached
        if time.time() - ts < CACHE_TTL_SEC:
            return text
        _LLM_CACHE.pop(cache_hash, None)

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
        # Mặc định: Google Gemini
        result = await _call_gemini_api(
            prompt=prompt,
            system_instruction=system_instruction,
            api_key=api_key,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            timeout_sec=timeout_sec,
        )

    # 4. Lưu cache nếu thành công
    if result:
        if len(_LLM_CACHE) >= MAX_CACHE_ITEMS:
            oldest = min(_LLM_CACHE.keys(), key=lambda k: _LLM_CACHE[k][1])
            _LLM_CACHE.pop(oldest, None)
        _LLM_CACHE[cache_hash] = (result, time.time())

    return result
