"""
Unit tests for Universal Clinical LLM Provider Gateway
"""
import sys
import os
import pytest
from unittest.mock import patch, MagicMock
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.config import settings
from app.services.llm_provider import query_clinical_llm, _compute_prompt_hash, _LLM_CACHE

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
