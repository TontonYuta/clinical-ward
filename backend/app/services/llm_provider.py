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
    key = api_key or settings.GEMINI_API_KEY
    if not key or key == "MY_GEMINI_API_KEY" or len(key.strip()) < 10:
        return None

    models = [
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash-lite",
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
                            return parts[0]["text"].strip()
            except Exception as e:
                logger.debug("Gemini model %s attempt failed: %s", model, e)
                continue
    return None

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
                        return content.strip()
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
