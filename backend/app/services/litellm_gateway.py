"""
Unified Multi-Provider Free-Tier LLM Gateway built on LiteLLM Router.
Automatically routes and falls back across active keys in admin_key_vault / env:
  Gemini -> Groq -> OpenRouter (:free) -> Mistral -> Ollama (optional local).
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

import litellm
from litellm import Router

from app.config import settings
from app.services.admin_key_vault import get_active_api_key_async

logger = logging.getLogger(__name__)
litellm.suppress_debug_info = True

DEFAULT_FALLBACK_CHAIN = ["gemini-tier", "groq-tier", "openrouter-tier", "mistral-tier", "ollama-tier"]


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
    """Build LiteLLM Router model_list dynamically from active vault keys & env vars."""
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
    Execute chat completion across configured free/low-cost providers using LiteLLM Router
    with automatic cross-provider fallbacks.
    """
    model_list = await build_router_model_list()
    if not model_list:
        return {}

    available_tiers = list(dict.fromkeys(m["model_name"] for m in model_list))
    order = [t for t in (preferred_order or DEFAULT_FALLBACK_CHAIN) if t in available_tiers]
    if not order:
        order = available_tiers

    primary = order[0]
    fallbacks = [{primary: order[1:]}] if len(order) > 1 else []

    router = Router(
        model_list=model_list,
        fallbacks=fallbacks,
        num_retries=1,
        allowed_fails=2,
        cooldown_time=30,
        set_verbose=False,
    )

    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    kwargs: Dict[str, Any] = {
        "model": primary,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "timeout": timeout_sec,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        resp = await router.acompletion(**kwargs)
        choice = (resp.choices or [None])[0]
        content = getattr(getattr(choice, "message", None), "content", "") or ""
        used_model = getattr(resp, "model", "") or primary
        return {"text": content, "model": used_model}
    except Exception as exc:
        logger.warning("LiteLLM Router exhausted all providers (%s): %s", order, exc)
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
    """Structured JSON completion across free-tier providers via LiteLLM Router."""
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
