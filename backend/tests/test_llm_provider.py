"""
Unit tests for Universal Clinical LLM Provider Gateway
"""
import sys
import os
import pytest
from unittest.mock import patch, MagicMock
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.llm_provider import query_clinical_llm, _compute_prompt_hash, _LLM_CACHE, reset_llm_execution, get_last_llm_execution

@pytest.mark.asyncio
async def test_offline_mode_returns_none():
    """Chế độ offline không gửi bất kỳ request mạng nào và trả về None ngay lập tức."""
    with patch.object(settings, "LLM_PROVIDER", "offline"):
        res = await query_clinical_llm("Liều dùng Paracetamol")
        assert res is None

@pytest.mark.asyncio
async def test_openai_compatible_mode_success():
    """Kiểm tra gọi endpoint chuẩn OpenAI-compatible (Ollama/vLLM/DeepSeek)."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": "Liều dùng Paracetamol từ mô hình cục bộ Ollama."
                }
            }
        ]
    }

    with patch.object(settings, "LLM_PROVIDER", "openai_compatible"), \
         patch.object(settings, "OPENAI_API_BASE", "http://localhost:11434/v1"), \
         patch.object(settings, "OPENAI_MODEL", "qwen2.5:7b-instruct"), \
         patch("httpx.AsyncClient.post", return_value=mock_resp):
        res = await query_clinical_llm("Liều dùng Paracetamol", system_instruction="Y lệnh lâm sàng")
        assert res == "Liều dùng Paracetamol từ mô hình cục bộ Ollama."

@pytest.mark.asyncio
async def test_openai_compatible_fallback_on_network_error():
    """Khi máy chủ Ollama/vLLM gặp sự cố hoặc timeout, fallback về None để kích hoạt RAG ngoại tuyến."""
    with patch.object(settings, "LLM_PROVIDER", "openai_compatible"), \
         patch.object(settings, "OPENAI_API_BASE", "http://localhost:11434/v1"), \
         patch("httpx.AsyncClient.post", side_effect=Exception("Connection refused")):
        res = await query_clinical_llm("Liều dùng Paracetamol")
        assert res is None

def test_prompt_hashing():
    h1 = _compute_prompt_hash("gemini", "flash", "prompt A", "sys")
    h2 = _compute_prompt_hash("gemini", "flash", "prompt A", "sys")
    h3 = _compute_prompt_hash("openai_compatible", "qwen2.5", "prompt A", "sys")
    assert h1 == h2
    assert h1 != h3

@pytest.mark.asyncio
async def test_estimated_usage_never_reports_zero_for_successful_provider_result():
    """Khi provider không trả usage metadata, telemetry vẫn phải có ước tính > 0."""
    import app.services.llm_provider as provider
    _LLM_CACHE.clear()
    reset_llm_execution()
    with patch.object(settings, "LLM_PROVIDER", "gemini"), \
         patch.object(provider, "_call_gemini_api", return_value="Kết quả lâm sàng có căn cứ"):
        result = await query_clinical_llm("Liều dùng Paracetamol")
    usage = get_last_llm_execution()
    assert result == "Kết quả lâm sàng có căn cứ"
    assert usage["model_call_count"] == 1
    assert usage["usage_source"] == "estimated"
    assert usage["total_tokens"] > 0

@pytest.mark.asyncio
async def test_zero_gemini_usage_metadata_is_estimated():
    from app.services.llm_provider import _call_gemini_api
    reset_llm_execution()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Có căn cứ"}]}}],
        "usageMetadata": {"promptTokenCount": 0, "candidatesTokenCount": 0},
    }
    with patch("httpx.AsyncClient.post", return_value=mock_resp):
        result = await _call_gemini_api("Một câu hỏi lâm sàng", api_key="test-api-key-value")
    usage = get_last_llm_execution()
    assert result == "Có căn cứ"
    assert usage["usage_source"] == "estimated"
    assert usage["total_tokens"] > 0

@pytest.mark.asyncio
async def test_gemini_auto_failover_on_429(monkeypatch, tmp_path):
    """Kiểm tra tự động chuyển đổi sang API key khác khi gặp HTTP 429 (hết token/quota)."""
    from unittest.mock import AsyncMock
    from app.config import settings
    from app.services import admin_key_vault
    from app.services.llm_provider import _call_gemini_api
    from app.services.admin_key_vault import add_api_key, delete_api_key

    monkeypatch.setattr(settings, "IDENTITY_DATABASE_URL", "")
    monkeypatch.setattr(settings, "KEY_ENCRYPTION_KEY", "")
    monkeypatch.setattr(admin_key_vault, "_VAULT_FILE", str(tmp_path / "vault.json"))
    admin_key_vault._ACTIVE_KEY_CACHE.clear()

    raw_fail = "AIzaSyMockFailKey429Testing111111"
    raw_succ = "AIzaSyMockSuccKey200Testing222222"
    k_fail = add_api_key("Fail Key 429", raw_fail)
    k_succ = add_api_key("Backup Key 200", raw_succ)

    resp_429 = MagicMock()
    resp_429.status_code = 429
    resp_429.text = '{"error": {"code": 429, "message": "RESOURCE_EXHAUSTED"}}'

    resp_200 = MagicMock()
    resp_200.status_code = 200
    resp_200.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "Phản hồi thành công từ key dự phòng."}]}}],
        "usageMetadata": {"promptTokenCount": 20, "candidatesTokenCount": 35}
    }

    # Giả lập: Lần gọi đầu dính 429, lần gọi tiếp theo bằng key dự phòng thành công 200
    call_count = 0
    async def mock_post(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        sent_key = (kwargs.get("headers") or {}).get("x-goog-api-key", "")
        if raw_fail in str(url) or sent_key == raw_fail:
            return resp_429
        return resp_200

    try:
        with patch("app.services.gemini_model_discovery.get_available_gemini_models_async", AsyncMock(return_value=["gemini-3.1-flash-lite"])), \
             patch("httpx.AsyncClient.post", side_effect=mock_post):
            answer = await _call_gemini_api("Xin chào", api_key=raw_fail, timeout_sec=5.0)
            assert answer == "Phản hồi thành công từ key dự phòng."
            assert call_count >= 2
    finally:
        delete_api_key(k_fail["key_id"])
        delete_api_key(k_succ["key_id"])
        admin_key_vault._ACTIVE_KEY_CACHE.clear()

@pytest.mark.asyncio
async def test_gemini_sends_json_schema_in_generation_config():
    from app.services.llm_provider import _call_gemini_api

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "candidates": [{"content": {"parts": [{"text": "{}"}]}}],
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 2},
    }
    schema = {"type": "object", "properties": {"intent": {"type": "string"}}}
    captured = {}

    async def capture_post(url, *, json, **kwargs):
        captured.update(json)
        return mock_resp

    with patch("httpx.AsyncClient.post", side_effect=capture_post):
        result = await _call_gemini_api(
            "classify", api_key="test-api-key-value", response_schema=schema
        )

    assert result == "{}"
    assert captured["generationConfig"]["responseMimeType"] == "application/json"
    assert captured["generationConfig"]["responseJsonSchema"] == schema
