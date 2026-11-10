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
                    else:
                        logger.warning("Không còn khóa API dự phòng khả dụng trong Key Pool. Ngắt gọi cloud ngay tức khắc.")
                        break
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
                                p_tok = usage.get("promptTokenCount") or (len(ocr_prompt) // 4 + 258)
                                c_tok = usage.get("candidatesTokenCount") or max(40, len(raw_text) // 4)
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
                                    record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini")
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

3. ĐỊNH DẠNG TRẢ VỀ:
Trả về DUY NHẤT một đối tượng JSON hợp lệ:
{
  "is_clinical": true,
  "category": "PRESCRIPTION" | "MEDICATION" | "BHYT_DOCUMENT" | "NON_CLINICAL",
  "reply_markdown": "Nội dung phân tích chuyên môn chi tiết bằng Markdown y khoa...",
  "legal_basis": "Căn cứ pháp lý chính (ví dụ: Thông tư 20/2022/TT-BYT, Dược Thư Quốc Gia 2015, hoặc Quyết định 3618/QĐ-BHXH)",
  "suggested_chips": ["Kiểm tra điều kiện BHYT TT 20", "Tra cứu tương tác thuốc Dược Thư"],
  "card": null
}
"""

async def query_clinical_multimodal_chat(
    image_base64: str,
    mime_type: str = "image/jpeg",
    user_query: str = "",
    user_role: str = "nurse",
    timeout_sec: float = 20.0
) -> Optional[dict]:
    """
    Điểm truy vấn Gemini Multimodal Vision dành riêng cho Chatbot Dược Lâm Sàng & BHYT:
    Nhận diện đơn thuốc, vỏ/nhãn thuốc, tài liệu BHYT và áp dụng Clinical Guardrails (chỉ Thuốc - Kê đơn - BHYT).
    """
    clean_data, detected_mime = _clean_base64_data(image_base64, mime_type)
    if not clean_data or len(clean_data) < 50:
        return None

    from app.services.admin_key_vault import get_active_api_key
    key = get_active_api_key(provider="gemini") or settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        return None

    models = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.8-flash",
        "gemini-2.5-flash",
    ]

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
                            match = re.search(r'(\{[\s\S]*\})', raw_text)
                            if match:
                                raw_text = match.group(1)
                            parsed = json.loads(raw_text)
                            if isinstance(parsed, dict):
                                usage = data.get("usageMetadata", {})
                                p_tok = usage.get("promptTokenCount") or (len(prompt_text) // 4 + 258)
                                c_tok = usage.get("candidatesTokenCount") or max(30, len(raw_text) // 4)
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
                                    record_llm_token_usage(p_tok, c_tok, model=model, provider="gemini")
                                    record_key_consumption(key, p_tok + c_tok)
                                except Exception:
                                    pass
                                return parsed
            except Exception as e:
                logger.debug("Clinical vision chat model %s failed: %s", model, e)
                continue

    return None

