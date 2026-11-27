"""
Lightweight Multi-Provider Free-Tier LLM Gateway (zero-overhead httpx router).
Automatically routes and falls back across active keys in admin_key_vault / env:
  Gemini -> Groq -> OpenRouter (:free) -> Mistral -> Ollama (optional local).
Designed to stay well under 512 MiB RAM on Render Free tier while keeping
identical multi-provider failover semantics.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings
from app.services.admin_key_vault import get_active_api_key_async

logger = logging.getLogger(__name__)

DEFAULT_FALLBACK_CHAIN = ["gemini-tier", "groq-tier", "openrouter-tier", "mistral-tier", "ollama-tier"]

_OPENAI_BASE_URLS = {
    "groq": "https://api.groq.com/openai/v1/chat/completions",
    "openrouter": "https://openrouter.ai/api/v1/chat/completions",
    "mistral": "https://api.mistral.ai/v1/chat/completions",
}


def _extract_json_dict(raw_text: str) -> Dict[str, Any]:
    text = (raw_text or "").strip()
    if not text:
        return {}
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE | re.DOTALL).strip()
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except Exception:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            return {}
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}


async def build_router_model_list() -> List[Dict[str, Any]]:
    """Build ordered multi-provider model list dynamically from active vault keys & env vars."""
    model_list: List[Dict[str, Any]] = []

    gemini_key = await get_active_api_key_async("gemini") or (
        settings.GEMINI_API_KEY if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "MY_GEMINI_API_KEY" else None
    )
    if gemini_key and len(gemini_key.strip()) >= 10:
        for gm in ("gemini/gemini-3.5-flash-lite", "gemini/gemini-3-flash-preview"):
            model_list.append(
                {
                    "model_name": "gemini-tier",
                    "litellm_params": {"model": gm, "api_key": gemini_key.strip()},
                }
            )

    groq_key = await get_active_api_key_async("groq") or os.getenv("GROQ_API_KEY")
    if groq_key and len(groq_key.strip()) >= 10:
        for gqm in ("groq/openai/gpt-oss-120b", "groq/openai/gpt-oss-20b"):
            model_list.append(
                {
                    "model_name": "groq-tier",
                    "litellm_params": {"model": gqm, "api_key": groq_key.strip()},
                }
            )

    openrouter_key = await get_active_api_key_async("openrouter") or os.getenv("OPENROUTER_API_KEY")
    if openrouter_key and len(openrouter_key.strip()) >= 10:
        for orm in (
            "openrouter/nvidia/nemotron-3.5-lightning:free",
            "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
            "openrouter/google/gemma-4-31b-it:free",
        ):
            model_list.append(
                {
                    "model_name": "openrouter-tier",
                    "litellm_params": {"model": orm, "api_key": openrouter_key.strip()},
                }
            )

    mistral_key = await get_active_api_key_async("mistral") or os.getenv("MISTRAL_API_KEY")
    if mistral_key and len(mistral_key.strip()) >= 10:
        model_list.append(
            {
                "model_name": "mistral-tier",
                "litellm_params": {"model": "mistral/mistral-small-latest", "api_key": mistral_key.strip()},
            }
        )

    ollama_url = os.getenv("OLLAMA_BASE_URL")
    if ollama_url:
        ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
        model_list.append(
            {
                "model_name": "ollama-tier",
                "litellm_params": {"model": f"ollama/{ollama_model}", "api_base": ollama_url.strip()},
            }
        )

    return model_list


async def _call_provider_entry(
    client: httpx.AsyncClient,
    entry: Dict[str, Any],
    prompt: str,
    *,
    system_prompt: Optional[str],
    json_mode: bool,
    temperature: float,
    max_tokens: int,
) -> Optional[str]:
    params = entry.get("litellm_params") or {}
    full_model = str(params.get("model") or "")
    api_key = str(params.get("api_key") or "").strip()
    if "/" not in full_model:
        return None
    provider, model_id = full_model.split("/", 1)

    if provider == "gemini":
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"
        gen_cfg: Dict[str, Any] = {"temperature": temperature, "maxOutputTokens": max_tokens}
        if json_mode:
            gen_cfg["responseMimeType"] = "application/json"
        payload: Dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": gen_cfg,
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}
        resp = await client.post(url, headers={"x-goog-api-key": api_key, "Content-Type": "application/json"}, json=payload)
        if resp.status_code != 200:
            return None
        parts = (((resp.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
        text = "".join(p.get("text", "") for p in parts if isinstance(p, dict) and not p.get("thought"))
        return text or None

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    if provider == "ollama":
        api_base = str(params.get("api_base") or "http://localhost:11434").rstrip("/")
        url = f"{api_base}/v1/chat/completions"
        headers = {"Content-Type": "application/json"}
    else:
        url = _OPENAI_BASE_URLS.get(provider, "")
        if not url:
            return None
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    payload_oa: Dict[str, Any] = {
        "model": model_id,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode and provider != "ollama":
        payload_oa["response_format"] = {"type": "json_object"}

    resp = await client.post(url, headers=headers, json=payload_oa)
    if resp.status_code != 200:
        return None
    content = ((resp.json().get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    return content or None


async def routed_completion(
    prompt: str,
    *,
    system_prompt: Optional[str] = None,
    json_mode: bool = False,
    temperature: float = 0.0,
    max_tokens: int = 1800,
    timeout_sec: float = 25.0,
    preferred_order: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Execute chat completion across configured free/low-cost providers
    with automatic cross-provider fallbacks and zero heavy SDK memory overhead.
    """
    model_list = await build_router_model_list()
    if not model_list:
        return {}

    available_tiers = list(dict.fromkeys(m["model_name"] for m in model_list))
    order = [t for t in (preferred_order or DEFAULT_FALLBACK_CHAIN) if t in available_tiers]
    if not order:
        order = available_tiers

    ordered_entries: List[Dict[str, Any]] = []
    for tier in order:
        ordered_entries.extend(m for m in model_list if m["model_name"] == tier)

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_sec, connect=5.0)) as client:
        for entry in ordered_entries:
            try:
                text = await _call_provider_entry(
                    client,
                    entry,
                    prompt,
                    system_prompt=system_prompt,
                    json_mode=json_mode,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                if text:
                    return {"text": text, "model": entry["litellm_params"]["model"]}
            except Exception as exc:
                logger.warning("Routed provider %s failed: %s", entry.get("litellm_params", {}).get("model"), exc)
                continue
    return {}


async def routed_json_completion(
    prompt: str,
    *,
    system_prompt: Optional[str] = None,
    temperature: float = 0.0,
    max_tokens: int = 2048,
    timeout_sec: float = 25.0,
    preferred_order: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Structured JSON completion across free-tier providers."""
    res = await routed_completion(
        prompt,
        system_prompt=system_prompt,
        json_mode=True,
        temperature=temperature,
        max_tokens=max_tokens,
        timeout_sec=timeout_sec,
        preferred_order=preferred_order,
    )
    if not res or not res.get("text"):
        return {}
    return _extract_json_dict(res["text"])
