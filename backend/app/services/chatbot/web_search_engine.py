"""
Dịch vụ tìm kiếm Web thời gian thực (Grounded Web Search Engine)
Kiến trúc 3 lớp:
1. Cache in-memory TTL 30 phút (tiết kiệm quota, chống spam)
2. Nguồn chính Serper.dev (Google Search API chính thức, 2500 lượt miễn phí, không bị chặn trên cloud)
3. Nguồn dự phòng DuckDuckGo (ddgs) khi Serper hết hạn mức / lỗi
Kèm cơ chế chống link ảo (Whitelist) và chống link chết (Async HTTP Ping).
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Tuple, Set
import asyncio
import logging
import os
import re
import time
from urllib.parse import urlparse
import httpx

logger = logging.getLogger(__name__)

@dataclass
class WebSearchResult:
    title: str
    url: str
    snippet: str
    source_domain: str
    is_live: bool = True

# Cache lưu trữ: {clean_query: (timestamp, list[WebSearchResult])}
_SEARCH_CACHE: Dict[str, Tuple[float, List[WebSearchResult]]] = {}
CACHE_TTL_SECONDS: float = 1800.0  # 30 phút


def get_cache_size() -> int:
    return len(_SEARCH_CACHE)


def clear_search_cache() -> None:
    _SEARCH_CACHE.clear()


def extract_domain(url: str) -> str:
    try:
        netloc = urlparse(url).netloc
        return netloc.lower().replace("www.", "")
    except Exception:
        return ""


async def is_url_alive(client: httpx.AsyncClient, url: str) -> bool:
    """
    Kiểm tra nhanh xem link có sống không (Status 200..399 hoặc 403 WAF).
    Loại bỏ link 404, 410, 5xx hoặc timeout / host không tồn tại.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        # Thử HEAD trước để tiết kiệm băng thông
        resp = await client.head(url, headers=headers, timeout=2.5)
        # 405 Method Not Allowed -> thử GET stream=True
        if resp.status_code == 405:
            async with client.stream("GET", url, headers=headers, timeout=2.5) as get_resp:
                return get_resp.status_code < 400 or get_resp.status_code == 403
        
        # 403 Forbidden: Nhiều trang tin tức / Cổng thông tin (VnExpress, Bộ Y Tế) có Cloudflare chặn bot HEAD
        # nhưng link là thật và người dùng vẫn bấm vào đọc bình thường.
        if resp.status_code < 400 or resp.status_code == 403:
            return True
        return False
    except (httpx.TimeoutException, httpx.ConnectError, httpx.HTTPError):
        # Fallback thử stream GET nhanh
        try:
            async with client.stream("GET", url, headers=headers, timeout=2.0) as get_resp:
                return get_resp.status_code < 400 or get_resp.status_code == 403
        except Exception:
            return False
    except Exception:
        return False


async def verify_live_urls(results: List[WebSearchResult]) -> List[WebSearchResult]:
    """Lọc song song danh sách kết quả, loại bỏ link chết (404/server down)."""
    if not results:
        return []
    
    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        tasks = [is_url_alive(client, r.url) for r in results]
        statuses = await asyncio.gather(*tasks, return_exceptions=True)
        
    live_results: List[WebSearchResult] = []
    for item, is_live in zip(results, statuses):
        if is_live is True:
            item.is_live = True
            live_results.append(item)
        else:
            logger.info("Loại bỏ link chết/không truy cập được: %s", item.url)
            
    # Nếu tất cả link đều bị chặn hoặc chết, giữ lại kết quả gốc nhưng đánh dấu cảnh báo
    return live_results if live_results else results


async def search_serper(
    query: str,
    api_key: Optional[str] = None,
    max_results: int = 5
) -> List[WebSearchResult]:
    """
    Tìm kiếm qua Serper.dev REST API (Google Search kết quả thật, ổn định trên VPS/Cloud).
    """
    from app.services.admin_key_vault import get_active_api_key
    key = api_key or os.getenv("SERPER_API_KEY", "").strip() or (get_active_api_key(provider="serper") or "").strip()
    if not key or key == "YOUR_SERPER_API_KEY":
        raise ValueError("Chưa cấu hình SERPER_API_KEY")

    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": key,
        "Content-Type": "application/json"
    }
    payload = {
        "q": query,
        "gl": "vn",
        "hl": "vi",
        "num": max_results
    }

    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    results: List[WebSearchResult] = []
    # 1. Trích xuất AnswerBox (nếu Google có khung trả lời nổi bật)
    if "answerBox" in data:
        ans_box = data["answerBox"]
        ans_snippet = ans_box.get("answer") or ans_box.get("snippet") or ""
        ans_title = ans_box.get("title") or "Khung trả lời trực tiếp Google"
        ans_link = ans_box.get("link") or ""
        if ans_snippet and ans_link:
            results.append(
                WebSearchResult(
                    title=f"[Google Answer] {ans_title}",
                    url=ans_link,
                    snippet=ans_snippet,
                    source_domain=extract_domain(ans_link)
                )
            )

    # 2. Trích xuất Organic Results
    for item in data.get("organic", [])[:max_results]:
        link = item.get("link", "").strip()
        title = item.get("title", "").strip()
        snippet = item.get("snippet", "").strip()
        if link and title:
            results.append(
                WebSearchResult(
                    title=title,
                    url=link,
                    snippet=snippet,
                    source_domain=extract_domain(link)
                )
            )

    return results


def _ddgs_sync_search(query: str, max_results: int = 5) -> List[WebSearchResult]:
    """Thực thi tìm kiếm DuckDuckGo đồng bộ (chạy trong worker thread)."""
    try:
        from duckduckgo_search import DDGS
        with DDGS(timeout=5) as ddgs:
            raw_items = list(ddgs.text(query, max_results=max_results))
            results: List[WebSearchResult] = []
            for r in raw_items:
                link = r.get("href", "").strip()
                title = r.get("title", "").strip()
                snippet = r.get("body", "").strip()
                if link and title:
                    results.append(
                        WebSearchResult(
                            title=title,
                            url=link,
                            snippet=snippet,
                            source_domain=extract_domain(link)
                        )
                    )
            return results
    except Exception as e:
        logger.warning("DuckDuckGo search error: %s", e)
        return []


async def search_duckduckgo(
    query: str,
    max_results: int = 5
) -> List[WebSearchResult]:
    """Tìm kiếm DuckDuckGo dự phòng bất đồng bộ."""
    return await asyncio.to_thread(_ddgs_sync_search, query, max_results)


async def search_and_verify_web(
    query: str,
    max_results: int = 5,
    custom_serper_key: Optional[str] = None
) -> Tuple[List[WebSearchResult], str]:
    """
    Điều phối tìm kiếm web 3 lớp:
    1. Kiểm tra RAM Cache (30 phút)
    2. Nguồn chính Serper (Google Search thật)
    3. Nguồn phụ DuckDuckGo
    Sau đó tự động xác minh độ sống của link (Live Check).
    Trả về: (danh sách kết quả đã xác minh, tên nguồn 'cache' | 'serper' | 'duckduckgo' | 'none')
    """
    clean_query = query.strip().lower()
    now = time.time()

    # 1. Kiểm tra RAM Cache
    if clean_query in _SEARCH_CACHE:
        cached_time, cached_results = _SEARCH_CACHE[clean_query]
        if now - cached_time < CACHE_TTL_SECONDS:
            logger.info("Search cache HIT cho query: '%s'", query)
            return cached_results, "cache"

    # 2. Thử nguồn chính Serper
    source_used = "none"
    results: List[WebSearchResult] = []
    try:
        results = await search_serper(query, api_key=custom_serper_key, max_results=max_results)
        if results:
            source_used = "serper"
    except Exception as serper_err:
        logger.info("Serper không khả dụng (%s), chuyển sang DuckDuckGo fallback", serper_err)

    # 3. Nếu Serper không có kết quả hoặc lỗi, fallback sang DuckDuckGo
    if not results:
        try:
            results = await search_duckduckgo(query, max_results=max_results)
            if results:
                source_used = "duckduckgo"
        except Exception as ddg_err:
            logger.warning("DuckDuckGo fallback thất bại: %s", ddg_err)

    if not results:
        return [], "none"

    # 4. Xác minh link sống (Live URL Verifier)
    verified_results = await verify_live_urls(results)

    # 5. Lưu vào cache
    _SEARCH_CACHE[clean_query] = (now, verified_results)
    return verified_results, source_used


def sanitize_ai_response_urls(ai_text: str, allowed_urls: Set[str]) -> str:
    """
    Chống AI Hallucination URL:
    Quét toàn bộ URL trong câu trả lời của AI.
    Nếu link không nằm trong danh sách các URL có thực từ kết quả search,
    ẩn đường dẫn hoặc thay thế bằng cảnh báo để bảo vệ người dùng.
    """
    if not ai_text:
        return ""
    
    # Chuẩn hóa whitelist
    normalized_allowed = {u.rstrip("/.,;:") for u in allowed_urls}

    def _replace_markdown_link(match: re.Match) -> str:
        label = match.group(1)
        url = match.group(2).rstrip("/.,;:")
        if any(url.startswith(allowed) or allowed.startswith(url) for allowed in normalized_allowed):
            return match.group(0)
        return f"{label} (Nguồn chưa được xác thực trên Internet)"

    # Xử lý [Label](URL)
    sanitized = re.sub(r'\[([^\]]+)\]\((https?://[^\s\)]+)\)', _replace_markdown_link, ai_text)

    # Xử lý raw URLs
    def _replace_raw_url(match: re.Match) -> str:
        raw_url = match.group(0).rstrip("/.,;:")
        if any(raw_url.startswith(allowed) or allowed.startswith(raw_url) for allowed in normalized_allowed):
            return match.group(0)
        return "[Link đã ẩn do không nằm trong nguồn tìm kiếm xác minh]"

    sanitized = re.sub(r'(?<!\()https?://[^\s\)\]\>\"\'”]+', _replace_raw_url, sanitized)
    return sanitized


def format_web_search_context(results: List[WebSearchResult]) -> str:
    """
    Chuyển đổi kết quả tìm kiếm thành chuỗi ngữ cảnh tiêm vào Gemini Prompt.
    """
    if not results:
        return ""

    lines = [
        "### DỮ LIỆU TÌM KIẾM TỪ INTERNET THỜI GIAN THỰC (ĐÃ XÁC MINH LINK SỐNG):",
        "Quy tắc trích dẫn bắt buộc: Chỉ sử dụng thông tin và đường link từ danh sách dưới đây. Tuyệt đối không tự suy đoán đường dẫn web khác.",
        ""
    ]
    for idx, item in enumerate(results, 1):
        lines.append(f"[{idx}] Tiêu đề: {item.title}")
        lines.append(f"     Tên miền: {item.source_domain}")
        lines.append(f"     Đường dẫn (URL): {item.url}")
        lines.append(f"     Nội dung tóm tắt: {item.snippet}")
        lines.append("")

    return "\n".join(lines)
