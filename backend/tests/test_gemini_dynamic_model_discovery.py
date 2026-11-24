"""
Unit tests for Gemini Dynamic Model Discovery & Auto-Ranking.
Xác minh loại bỏ 100% hardcode model, tự động lọc model không phù hợp (TTS, Embedding),
xếp hạng tối ưu Flash -> Pro, hoạt động của bộ nhớ đệm RAM và cơ chế Override bằng biến môi trường.
"""

import pytest
import os
from unittest.mock import patch, AsyncMock, MagicMock
from app.services.gemini_model_discovery import (
    filter_and_rank_gemini_models,
    extract_model_version,
    get_available_gemini_models_async,
    invalidate_gemini_model_cache,
    SAFE_FALLBACK_GEMINI_MODELS
)
from app.config import settings


def test_extract_model_version():
    assert extract_model_version("gemini-2.5-flash") == 2.5
    assert extract_model_version("gemini-2.0-flash") == 2.0
    assert extract_model_version("gemini-1.5-pro") == 1.5
    assert extract_model_version("gemini-flash-latest") == 1.0


def test_filter_and_rank_gemini_models_excludes_disallowed_and_ranks_flash_first():
    sample_models = [
        "gemini-1.5-pro",
        "gemini-2.5-flash-preview-tts",
        "gemini-2.5-flash",
        "text-embedding-004",
        "gemini-2.5-pro",
        "gemini-2.0-flash",
        "gemini-2.5-pro-preview-tts",
        "aqa",
        "gemma-4-26b-a4b-it"
    ]

    ranked = filter_and_rank_gemini_models(sample_models)

    # Disallowed models must be excluded
    assert "gemini-2.5-flash-preview-tts" not in ranked
    assert "gemini-2.5-pro-preview-tts" not in ranked
    assert "text-embedding-004" not in ranked
    assert "aqa" not in ranked

    # Flash models must rank higher than Pro and Gemma
    assert ranked[0] == "gemini-2.5-flash"
    assert ranked[1] == "gemini-2.0-flash"
    assert "gemini-2.5-pro" in ranked
    assert "gemini-1.5-pro" in ranked
    assert "gemma-4-26b-a4b-it" in ranked

    # 2.5-flash must precede 2.5-pro
    assert ranked.index("gemini-2.5-flash") < ranked.index("gemini-2.5-pro")
    # 2.5-pro must precede gemma
    assert ranked.index("gemini-2.5-pro") < ranked.index("gemma-4-26b-a4b-it")


def test_filter_and_rank_returns_safe_fallback_on_empty():
    assert filter_and_rank_gemini_models([]) == SAFE_FALLBACK_GEMINI_MODELS
    assert filter_and_rank_gemini_models(["text-embedding-004", "invalid-tts"]) == SAFE_FALLBACK_GEMINI_MODELS


@pytest.mark.asyncio
async def test_get_available_gemini_models_environment_override(monkeypatch):
    invalidate_gemini_model_cache()
    monkeypatch.setattr(settings, "GEMINI_DEFAULT_MODEL", "custom-hospital-gemini")
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODELS", "custom-fallback-1,custom-fallback-2")

    models = await get_available_gemini_models_async("dummy-key-1234567890")
    assert models == ["custom-hospital-gemini", "custom-fallback-1", "custom-fallback-2"]


@pytest.mark.asyncio
async def test_get_available_gemini_models_dynamic_discovery_and_ram_caching(monkeypatch):
    invalidate_gemini_model_cache()
    monkeypatch.setattr(settings, "GEMINI_DEFAULT_MODEL", None)
    monkeypatch.setattr(settings, "GEMINI_FALLBACK_MODELS", None)

    fake_api_response = {
        "models": [
            {"name": "models/gemini-2.5-flash", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-2.5-pro", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/gemini-2.5-flash-preview-tts", "supportedGenerationMethods": ["generateContent"]},
            {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]},
        ]
    }

    mock_get = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = fake_api_response
    mock_get.return_value = mock_resp

    test_key = "AIzaSyTestDynamicKey1234567890"

    with patch("httpx.AsyncClient.get", mock_get):
        # Lần 1: Gọi Google API và lưu RAM
        models_1 = await get_available_gemini_models_async(test_key)
        assert models_1 == ["gemini-2.5-flash", "gemini-2.5-pro"]
        assert mock_get.call_count == 1

        # Lần 2: Đọc trực tiếp từ RAM (0ms, không gọi lại Google API)
        models_2 = await get_available_gemini_models_async(test_key)
        assert models_2 == ["gemini-2.5-flash", "gemini-2.5-pro"]
        assert mock_get.call_count == 1  # Không tăng số lần gọi


@pytest.mark.asyncio
async def test_get_available_gemini_models_fallback_on_network_failure(monkeypatch):
    invalidate_gemini_model_cache()
    monkeypatch.setattr(settings, "GEMINI_DEFAULT_MODEL", None)

    with patch("httpx.AsyncClient.get", side_effect=Exception("Connection reset by peer")):
        models = await get_available_gemini_models_async("AIzaSyFailedKey1234567890")
        assert models == SAFE_FALLBACK_GEMINI_MODELS
