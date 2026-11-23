"""
Unit Tests for Gemini Context Caching and Token Cost Optimization.
Verifies:
1. Corpus token count strictly exceeds Google's 2,048 token threshold.
2. GeminiContextCacheManager creation, retrieval, and transparent fallback.
3. Token ledger accurately records cached tokens and applies 75% discount.
4. Seamless fallback in _call_gemini_api when cachedContent returns 400/404.
"""

import time
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.services.cache.gemini_context_cache import (
    GeminiContextCacheManager,
    _build_invariant_clinical_corpus,
    get_active_context_cache,
    _ACTIVE_CACHES,
)
from app.services.telemetry_store import (
    record_llm_token_usage,
    _get_connection,
)


def test_invariant_clinical_corpus_exceeds_minimum_token_threshold():
    """Kiểm tra gói tri thức bất biến phải vượt ngưỡng 2.048 tokens của Google Gemini."""
    sys_prompt, corpus = _build_invariant_clinical_corpus()
    
    assert len(sys_prompt) > 500
    assert "Thông tư 20/2017/TT-BYT" in corpus
    assert "Thông tư 51/2017/TT-BYT" in corpus
    assert "Thông tư 22/2011/TT-BYT" in corpus
    assert "Thông tư 36/2018/TT-BYT" in corpus
    assert "Quyết định 5948/QĐ-BYT" in corpus
    
    total_chars = len(sys_prompt) + len(corpus)
    estimated_tokens = total_chars // 4
    # Ngưỡng bắt buộc của Google Gemini 2.5 là 2.048 tokens
    assert estimated_tokens >= 2048, f"Estimated tokens {estimated_tokens} is below minimum 2048"


@pytest.mark.asyncio
async def test_gemini_context_cache_manager_success_flow():
    """Kiểm tra khởi tạo cache thành công khi Google API trả về HTTP 200."""
    GeminiContextCacheManager.invalidate_all_caches()
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "name": "cachedContents/clinical_test_12345",
        "expireTime": "2026-11-23T20:00:00Z",
        "usageMetadata": {"totalTokenCount": 2850}
    }

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        
        cache_name = await GeminiContextCacheManager.get_or_create_context_cache(
            api_key="AIzaSyTEST_MOCK_KEY_VALID_0001",
            model="gemini-2.5-flash"
        )
        assert cache_name == "cachedContents/clinical_test_12345"
        
        # Lần 2: Lấy trực tiếp từ memory cache mà không cần gọi lại Google API
        mock_post.reset_mock()
        cache_name_2 = await GeminiContextCacheManager.get_or_create_context_cache(
            api_key="AIzaSyTEST_MOCK_KEY_VALID_0001",
            model="gemini-2.5-flash"
        )
        assert cache_name_2 == "cachedContents/clinical_test_12345"
        mock_post.assert_not_called()


@pytest.mark.asyncio
async def test_gemini_context_cache_transparent_fallback_on_error():
    """Kiểm tra cơ chế Fallback khi Google API từ chối tạo cache (HTTP 400)."""
    GeminiContextCacheManager.invalidate_all_caches()
    
    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "Cached content is too small or permission denied"

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response
        
        cache_name = await GeminiContextCacheManager.get_or_create_context_cache(
            api_key="AIzaSyTEST_MOCK_KEY_INVALID",
            model="gemini-2.5-flash"
        )
        # Bắt buộc trả về None để caller tự động chuyển về chế độ truyền thống
        assert cache_name is None


def test_telemetry_cost_calculation_with_75_percent_context_caching_discount():
    """
    Kiểm tra công thức tính chi phí:
    - 2.000 prompt tokens thông thường: (2000/1M * 0.075) * 25500 = 3.825 VNĐ
    - 2.000 prompt tokens trong đó 1.500 tokens là cached:
      + Non-cached (500 tokens): (500/1M * 0.075) * 25500 = 0.956 VNĐ
      + Cached (1.500 tokens): (1500/1M * 0.01875) * 25500 = 0.717 VNĐ
      + Tổng prompt cost = 1.673 VNĐ (Tiết kiệm > 56% trên tổng prompt)
    """
    # 1. Chi phí không có cache
    cost_no_cache = record_llm_token_usage(
        prompt_tokens=2000,
        completion_tokens=400,
        model="gemini-test",
        provider="gemini",
        usage_source="provider",
        cached_tokens=0
    )
    
    # 2. Chi phí CÓ cache 1.500 tokens
    cost_with_cache = record_llm_token_usage(
        prompt_tokens=2000,
        completion_tokens=400,
        model="gemini-test",
        provider="gemini",
        usage_source="provider",
        cached_tokens=1500
    )
    
    assert cost_with_cache < cost_no_cache
    savings = cost_no_cache - cost_with_cache
    assert savings > 1.5, f"Expected substantial savings, got {savings} VND"
    
    # Kiểm tra bản ghi trong database có lưu trường cached_tokens
    with _get_connection() as conn:
        row = conn.execute("SELECT * FROM token_ledger ORDER BY id DESC LIMIT 1").fetchone()
        assert row["cached_tokens"] == 1500
        assert row["prompt_tokens"] == 2000


@pytest.mark.asyncio
async def test_call_gemini_api_uses_cached_content_and_handles_transparent_fallback():
    """Kiểm tra _call_gemini_api tự động dùng cachedContent và fallback an toàn khi gặp lỗi."""
    from app.services.llm_provider import _call_gemini_api
    
    # 1. Test trường hợp có cache khả dụng và gọi thành công
    with patch("app.services.cache.gemini_context_cache.get_active_context_cache", new_callable=AsyncMock) as mock_cache:
        mock_cache.return_value = "cachedContents/mock_cache_9999"
        
        mock_res_200 = MagicMock()
        mock_res_200.status_code = 200
        mock_res_200.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "Liều dùng paracetamol là 500mg"}]}}],
            "usageMetadata": {
                "promptTokenCount": 2100,
                "candidatesTokenCount": 50,
                "cachedContentTokenCount": 1800
            }
        }
        
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_res_200
            
            reply = await _call_gemini_api(
                prompt="Paracetamol liều thế nào?",
                system_instruction="System prompt test",
                api_key="AIzaSyMOCK_KEY_VALID_TEST",
                timeout_sec=5.0
            )
            assert reply == "Liều dùng paracetamol là 500mg"
            # Kiểm tra payload gửi lên Google chứa cachedContent
            called_payload = mock_post.call_args.kwargs["json"]
            assert called_payload.get("cachedContent") == "cachedContents/mock_cache_9999"
            assert "systemInstruction" not in called_payload

    # 2. Test trường hợp cachedContent bị lỗi 400 (hết hạn) -> tự động fallback gửi lại payload thường
    with patch("app.services.cache.gemini_context_cache.get_active_context_cache", new_callable=AsyncMock) as mock_cache:
        mock_cache.return_value = "cachedContents/mock_expired_cache"
        
        mock_res_400 = MagicMock()
        mock_res_400.status_code = 400
        mock_res_400.text = "Cached content expired or not found"
        
        mock_res_fallback_200 = MagicMock()
        mock_res_fallback_200.status_code = 200
        mock_res_fallback_200.json.return_value = {
            "candidates": [{"content": {"parts": [{"text": "Phản hồi fallback thành công"}]}}],
            "usageMetadata": {"promptTokenCount": 500, "candidatesTokenCount": 30}
        }
        
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            # Lần gọi đầu với cache trả về 400, lần 2 fallback trả về 200
            mock_post.side_effect = [mock_res_400, mock_res_fallback_200]
            
            reply = await _call_gemini_api(
                prompt="Câu hỏi test fallback",
                system_instruction="System prompt test",
                api_key="AIzaSyMOCK_KEY_VALID_TEST",
                timeout_sec=5.0
            )
            assert reply == "Phản hồi fallback thành công"
            assert mock_post.call_count == 2
            # Lần gọi thứ 2 (fallback) phải có systemInstruction
            fallback_payload = mock_post.call_args_list[1].kwargs["json"]
            assert "systemInstruction" in fallback_payload
            assert "cachedContent" not in fallback_payload

