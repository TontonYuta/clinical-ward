import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.chatbot.web_search_engine import (
    WebSearchResult,
    extract_domain,
    clear_search_cache,
    get_cache_size,
    is_url_alive,
    verify_live_urls,
    search_serper,
    search_duckduckgo,
    search_and_verify_web,
    sanitize_ai_response_urls,
    format_web_search_context,
    _SEARCH_CACHE
)


def test_extract_domain():
    assert extract_domain("https://moh.gov.vn/tin-tuc-su-kien") == "moh.gov.vn"
    assert extract_domain("https://www.vinmec.com/vi/tin-tuc/") == "vinmec.com"
    assert extract_domain("invalid-url") == ""


@pytest.mark.asyncio
async def test_search_serper_parsing():
    mock_data = {
        "answerBox": {
            "title": "Giá vàng SJC hôm nay",
            "snippet": "Giá vàng SJC hôm nay ở mức 85 triệu đồng/lượng.",
            "link": "https://sjc.com.vn/gia-vang"
        },
        "organic": [
            {
                "title": "Cập nhật giá vàng 24h",
                "link": "https://vnexpress.net/gia-vang-hom-nay",
                "snippet": "Thị trường vàng biến động nhẹ trong phiên sáng..."
            }
        ]
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.json.return_value = mock_data
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        results = await search_serper("giá vàng", api_key="test_key")
        assert len(results) == 2
        assert "[Google Answer]" in results[0].title
        assert results[0].source_domain == "sjc.com.vn"
        assert results[1].url == "https://vnexpress.net/gia-vang-hom-nay"
        assert results[1].source_domain == "vnexpress.net"


@pytest.mark.asyncio
async def test_verify_live_urls_filters_dead_links():
    results = [
        WebSearchResult(title="Live site", url="https://example.com/live", snippet="...", source_domain="example.com"),
        WebSearchResult(title="Dead site", url="https://example.com/dead", snippet="...", source_domain="example.com"),
        WebSearchResult(title="WAF site", url="https://example.com/waf", snippet="...", source_domain="example.com")
    ]

    async def mock_is_alive(client, url):
        if "live" in url:
            return True
        elif "waf" in url:
            return True
        return False

    with patch("app.services.chatbot.web_search_engine.is_url_alive", side_effect=mock_is_alive):
        verified = await verify_live_urls(results)
        assert len(verified) == 2
        assert all("dead" not in r.url for r in verified)


def test_sanitize_ai_response_urls():
    allowed = {
        "https://moh.gov.vn/thong-tu-20",
        "https://kcb.vn/huong-dan-chan-doan"
    }

    # Case 1: Markdown link with allowed URL
    ai_text = "Theo hướng dẫn tại [Bộ Y Tế](https://moh.gov.vn/thong-tu-20) và [Bệnh viện X](https://fake-hospital.com/scam)."
    sanitized = sanitize_ai_response_urls(ai_text, allowed)
    assert "[Bộ Y Tế](https://moh.gov.vn/thong-tu-20)" in sanitized
    assert "fake-hospital.com" not in sanitized
    assert "Nguồn chưa được xác thực" in sanitized

    # Case 2: Raw link
    raw_text = "Tham khảo tại https://kcb.vn/huong-dan-chan-doan hoặc https://phishing-scam.xyz/login"
    sanitized_raw = sanitize_ai_response_urls(raw_text, allowed)
    assert "https://kcb.vn/huong-dan-chan-doan" in sanitized_raw
    assert "phishing-scam.xyz" not in sanitized_raw
    assert "Link đã ẩn" in sanitized_raw


@pytest.mark.asyncio
async def test_search_and_verify_cache_and_fallback():
    clear_search_cache()

    dummy_results = [
        WebSearchResult(title="News", url="https://moh.gov.vn/news", snippet="Snippet", source_domain="moh.gov.vn")
    ]

    # Mock Serper fails, DuckDuckGo succeeds
    with patch("app.services.chatbot.web_search_engine.search_serper", side_effect=Exception("Serper quota exceeded")), \
         patch("app.services.chatbot.web_search_engine.search_duckduckgo", return_value=dummy_results) as mock_ddg, \
         patch("app.services.chatbot.web_search_engine.verify_live_urls", return_value=dummy_results):
        
        # Call 1: Cache Miss -> calls DuckDuckGo
        res1, source1 = await search_and_verify_web("dịch sốt xuất huyết 2026")
        assert source1 == "duckduckgo"
        assert len(res1) == 1
        assert get_cache_size() == 1

        # Call 2: Cache Hit -> doesn't call DDGS
        res2, source2 = await search_and_verify_web("dịch sốt xuất huyết 2026")
        assert source2 == "cache"
        assert len(res2) == 1
        assert mock_ddg.call_count == 1  # Chỉ gọi 1 lần do lần 2 đã hit cache
