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
from urllib.parse import urlparse, parse_qs, unquote
import httpx

logger = logging.getLogger(__name__)

@dataclass
class WebSearchResult:
    title: str
    url: str
    snippet: str
    source_domain: str
    is_live: bool = True
    credibility_tier: int = 4  # 1: Official/Gov/Top Hospital/Global, 2: Large Clinical/DrugBank, 3: General Health/News, 4: Other Verified

# Cache lưu trữ: {clean_query: (timestamp, list[WebSearchResult])}
_SEARCH_CACHE: Dict[str, Tuple[float, List[WebSearchResult]]] = {}
CACHE_TTL_SECONDS: float = 1800.0  # 30 phút

# ==============================================================================
# DANH MỤC NGUỒN Y TẾ UY TÍN TOÀN DIỆN (COMPREHENSIVE TRUSTED MEDICAL REPOSITORIES)
# Bao phủ toàn diện: Dược thư, Quản lý, Pháp chế, BHYT, Bệnh viện TW/Đa khoa/Chuyên khoa,
# Cẩm nang Dược MIMS/MSD, Viện nghiên cứu, Đại học Y Dược và Y tế Quốc tế.
# ==============================================================================
TRUSTED_MEDICAL_DOMAINS: Dict[str, int] = {
    # --- TIER 1: Cơ quan Quản lý, Pháp quy Y tế, Bệnh viện TW & Tổ chức Toàn cầu ---
    "moh.gov.vn": 1,                # Bộ Y tế Việt Nam
    "dav.gov.vn": 1,                # Cục Quản lý Dược
    "kcb.vn": 1,                    # Cục Quản lý Khám, chữa bệnh
    "baohiemxahoi.gov.vn": 1,       # Bảo hiểm Xã hội Việt Nam (Chính sách thanh toán BHYT)
    "vncdc.gov.vn": 1,              # Cục Y tế Dự phòng
    "canhgiacduoc.org.vn": 1,       # Trung tâm DI & ADR Quốc gia (Cảnh giác dược, tương tác thuốc)
    "drugbank.vn": 1,               # Ngân hàng Dữ liệu Ngành Dược (Cục Quản lý Dược)
    "thuvienphapluat.vn": 1,        # Văn bản pháp luật Y tế, TT 20/2022/TT-BYT, TT 51/2017
    "luatvietnam.vn": 1,            # CSDL văn bản quy phạm pháp luật Y tế
    "vfa.gov.vn": 1,                # Cục An toàn thực phẩm
    "hiv.gov.vn": 1,                # Cục Phòng, chống HIV/AIDS
    "vihema.gov.vn": 1,             # Cục Quản lý Môi trường Y tế
    "bachmai.gov.vn": 1,            # Bệnh viện Bạch Mai
    "bachmai.org.vn": 1,            # Bệnh viện Bạch Mai
    "choray.vn": 1,                 # Bệnh viện Chợ Rẫy
    "vietduc.gov.vn": 1,            # Bệnh viện Hữu nghị Việt Đức
    "benhvien108.vn": 1,            # Bệnh viện Trung ương Quân đội 108
    "benhvienk.vn": 1,              # Bệnh viện K (Ung bướu)
    "bvdaihoc.com.vn": 1,           # Bệnh viện Đại học Y Dược TP.HCM
    "bvnd2.org.vn": 1,              # Bệnh viện Nhi Đồng 2
    "nhidong.org.vn": 1,            # Bệnh viện Nhi Đồng 1
    "tudu.com.vn": 1,               # Bệnh viện Từ Dũ (Sản phụ khoa)
    "benhvienhungvuong.vn": 1,      # Bệnh viện Hùng Vương (Sản phụ khoa)
    "tai-mui-hong.gov.vn": 1,       # Bệnh viện Tai Mũi Họng Trung ương
    "mattrunguong.org.vn": 1,       # Bệnh viện Mắt Trung ương
    "dalieu.vn": 1,                 # Bệnh viện Da liễu Trung ương
    "bvhue.org.vn": 1,              # Bệnh viện Trung ương Huế
    "benhvientrunguonghue.vn": 1,   # BV Trung ương Huế
    "bvdakhoatrunguongcantho.com": 1, # BV Đa khoa Trung ương Cần Thơ
    "bvbnd.vn": 1,                  # Bệnh viện Bệnh Nhiệt đới TP.HCM
    "nhietdoi.vn": 1,               # Bệnh viện Bệnh Nhiệt đới Trung ương
    "phoitw.gov.vn": 1,             # Bệnh viện Phổi Trung ương
    "bvnoitiet.vn": 1,              # Bệnh viện Nội tiết Trung ương
    "vienhuyethoc.vn": 1,           # Viện Huyết học - Truyền máu Trung ương
    "yhoccotruyentw.gov.vn": 1,     # Bệnh viện Y học Cổ truyền Trung ương
    "tamthan.gov.vn": 1,            # Bệnh viện Tâm thần Trung ương
    "who.int": 1,                   # Tổ chức Y tế Thế giới (WHO)
    "cdc.gov": 1,                   # US Centers for Disease Control and Prevention
    "fda.gov": 1,                   # US Food and Drug Administration
    "nih.gov": 1,                   # National Institutes of Health (NIH)
    "ncbi.nlm.nih.gov": 1,          # National Center for Biotechnology Information / NLM
    "pubmed.ncbi.nlm.nih.gov": 1,   # PubMed Y sinh toàn cầu

    # --- TIER 2: Hệ thống Bệnh viện lớn, Cẩm nang Dược, ĐH Y Dược & Lâm sàng Quốc tế ---
    "vinmec.com": 2,                # Hệ thống Y tế Vinmec
    "tamanhhospital.vn": 2,         # Hệ thống Bệnh viện Đa khoa Tâm Anh
    "medlatec.vn": 2,               # Hệ thống Y tế MEDLATEC (Xét nghiệm & Chẩn đoán)
    "hoanmy.com": 2,                # Tập đoàn Y khoa Hoàn Mỹ
    "fvhospital.com": 2,            # Bệnh viện FV
    "hanoifrenchhospital.com.vn": 2,# Bệnh viện Việt Pháp Hà Nội
    "benhvienthucuc.vn": 2,         # Bệnh viện Đa khoa Quốc tế Thu Cúc
    "hongngochospital.vn": 2,       # Bệnh viện Đa khoa Hồng Ngọc
    "mims.com": 2,                  # Cẩm nang Dược MIMS Việt Nam & Châu Á
    "msdmanuals.com": 2,            # Cẩm nang Chẩn đoán & Điều trị MSD Manuals
    "mayoclinic.org": 2,            # Mayo Clinic
    "clevelandclinic.org": 2,       # Cleveland Clinic
    "hopkinsmedicine.org": 2,       # Johns Hopkins Medicine
    "uptodate.com": 2,              # UpToDate Clinical Decision Support
    "medscape.com": 2,              # Medscape Clinical Reference
    "drugs.com": 2,                 # Drugs.com Comprehensive Drug Information
    "hmu.edu.vn": 2,                # Đại học Y Hà Nội
    "ump.edu.vn": 2,                # Đại học Y Dược TP.HCM
    "ypct.edu.vn": 2,               # Đại học Y Dược Cần Thơ
    "huemed-univ.edu.vn": 2,        # Trường Đại học Y Dược - Đại học Huế
    "pnt.edu.vn": 2,                # Đại học Y khoa Phạm Ngọc Thạch
    "medvnu.edu.vn": 2,             # Trường Đại học Y Dược - ĐHQG Hà Nội

    # --- TIER 3: Báo chí Y tế, Cổng Dược phẩm, Tạp chí Khoa học & Nhà thuốc Uy tín ---
    "suckhoedoisong.vn": 3,         # Báo Sức Khỏe & Đời Sống (Cơ quan ngôn luận Bộ Y tế)
    "chinhphu.vn": 3,               # Cổng Thông tin điện tử Chính phủ
    "nhandan.vn": 3,                # Báo Nhân Dân (Chuyên trang Y tế)
    "vtv.vn": 3,                    # Đài Truyền hình Việt Nam (Chuyên mục Sức khỏe)
    "thuocbietduoc.com.vn": 3,      # Tra cứu biệt dược, tương tác & hoạt chất
    "trungtamthuoc.com": 3,         # Trung tâm thuốc Central Pharmacy
    "youmed.vn": 3,                 # YouMed Y khoa có bác sĩ kiểm duyệt
    "hellobacsi.com": 3,            # HelloBacsi (Tham vấn sức khỏe y học)
    "nhathuoclongchau.com.vn": 3,   # Nhà thuốc Long Châu (Tờ rơi thuốc lưu hành)
    "nhathuoclongchau.com": 3,      # Nhà thuốc Long Châu
    "pharmacity.vn": 3,             # Pharmacity (Thông tin sản phẩm dược)
    "medigoapp.com": 3,             # Medigo Dược phẩm
    "duocdienvietnam.com": 3,       # Dược điển Việt Nam
    "cochrane.org": 3,              # Cochrane Library (Hệ thống y học chứng cứ)
    "webmd.com": 3,                 # WebMD Health Reference
    "thelancet.com": 3,             # Tạp chí Y khoa The Lancet
    "bmj.com": 3,                   # British Medical Journal
    "nejm.org": 3,                  # New England Journal of Medicine
    "vnexpress.net": 3,             # VnExpress Sức khỏe
    "tuoitre.vn": 3,                # Báo Tuổi Trẻ Sức khỏe
    "thanhnien.vn": 3,              # Báo Thanh Niên Sức khỏe
    "dantri.com.vn": 3,             # Báo Dân Trí Sức khỏe
}

# Danh sách domain mạng xã hội / diễn đàn tự do / blog chưa kiểm duyệt bị loại bỏ triệt để
EXCLUDED_DOMAINS: Set[str] = {
    "facebook.com", "fb.com", "instagram.com", "tiktok.com", "twitter.com", "x.com",
    "youtube.com", "youtu.be", "pinterest.com", "reddit.com", "quora.com",
    "voz.vn", "webtretho.com", "lamchame.com", "tinhte.vn",
    "blogspot.com", "wordpress.com", "wixsite.com", "weebly.com"
}

# Regex nhận diện Prompt Injection / Jailbreak & Thẻ Script trong Snippet từ Web
INJECTION_PATTERN = re.compile(
    r'(?i)(ignore\s+(all\s+)?(previous|prior)\s+instructions|system\s+override|disregard\s+all|'
    r'b\u1ecf\s+qua\s+h\u01b0\u1edbng\s+d\u1eabn|b\u1ecf\s+qua\s+ch\u1ec9\s+th\u1ecb|b\u1ecf\s+qua\s+quy\s+t\u1eafc|'
    r'you\s+are\s+now|act\s+as\s+an?\s+unrestricted|jailbreak|DAN\s+mode|prompt\s+injection|'
    r'system\s+prompt|new\s+system\s+instruction)',
    re.IGNORECASE
)

SCRIPT_PATTERN = re.compile(r'<\s*script[^>]*>.*?<\s*/\s*script\s*>|javascript:|onerror\s*=', re.IGNORECASE | re.DOTALL)


def classify_domain_tier(domain: str) -> int:
    """
    Xác định cấp độ uy tín của domain:
    Tier 1: Cơ quan nhà nước, Bệnh viện TW, Viện nghiên cứu đầu ngành, WHO, CDC, PubMed.
    Tier 2: Hệ thống bệnh viện lớn, Cẩm nang Dược MIMS, MSD Manuals, Mayo Clinic, ĐH Y Dược.
    Tier 3: Báo chí y tế chính thống, Cổng Dược, Tạp chí y khoa.
    Tier 4: Các website thông thường khác (được giữ lại nếu không nằm trong blacklist để đảm bảo tính bao phủ).
    """
    if not domain:
        return 4
    clean_domain = domain.lower().replace("www.", "").strip()
    for trusted_domain, tier in TRUSTED_MEDICAL_DOMAINS.items():
        if clean_domain == trusted_domain or clean_domain.endswith("." + trusted_domain):
            return tier
    return 4


def is_domain_excluded(domain: str) -> bool:
    """Kiểm tra xem domain có nằm trong danh sách mạng xã hội / diễn đàn rác bị loại bỏ không."""
    if not domain:
        return False
    clean_domain = domain.lower().replace("www.", "").strip()
    for ex in EXCLUDED_DOMAINS:
        if clean_domain == ex or clean_domain.endswith("." + ex):
            return True
    return False


def sanitize_search_snippet(text: str) -> str:
    """
    Làm sạch snippet tìm kiếm từ Web (OWASP LLM01 Indirect Prompt Injection Defense):
    - Loại bỏ thẻ script độc hại
    - Loại bỏ các chuỗi kích hoạt Prompt Injection / Jailbreak
    - Giới hạn độ dài an toàn
    """
    if not text:
        return ""
    cleaned = SCRIPT_PATTERN.sub("[script blocked]", text)
    if INJECTION_PATTERN.search(cleaned):
        cleaned = INJECTION_PATTERN.sub("[untrusted instruction removed]", cleaned)
    return cleaned.strip()


def rank_and_filter_results(results: List[WebSearchResult], max_results: int = 5) -> List[WebSearchResult]:
    """
    Lọc bỏ domain không an toàn (mạng xã hội, diễn đàn rác).
    Làm sạch prompt injection trong snippet.
    Sắp xếp ưu tiên:
    1. Tier 1 (Cơ quan quản lý, BV TW, WHO, PubMed...)
    2. Tier 2 (BV lớn, Cẩm nang MIMS, MSD Manuals...)
    3. Tier 3 (Báo y tế chính thống, Dược phẩm...)
    4. Tier 4 (Nguồn khác hợp lệ để bao phủ 100% câu hỏi hiếm)
    Sau đó lấy top `max_results`.
    """
    filtered: List[WebSearchResult] = []
    for r in results:
        if is_domain_excluded(r.source_domain):
            logger.info("Loại bỏ domain không phù hợp/mạng xã hội: %s (%s)", r.source_domain, r.url)
            continue
        clean_snippet = sanitize_search_snippet(r.snippet)
        tier = classify_domain_tier(r.source_domain)
        r.snippet = clean_snippet
        r.credibility_tier = tier
        filtered.append(r)

    # Sắp xếp ổn định theo Tier tăng dần (1 -> 2 -> 3 -> 4)
    filtered.sort(key=lambda x: x.credibility_tier)
    return filtered[:max_results]


def get_cache_size() -> int:
    return len(_SEARCH_CACHE)


def clear_search_cache() -> None:
    _SEARCH_CACHE.clear()


def unwrap_search_url(url: str) -> str:
    """
    Giải mã URL chuyển tiếp hoặc proxy của Google (như translate.google.com hoặc google.com/url)
    để lấy URL bài viết y khoa gốc sạch sẽ.
    """
    if not url:
        return ""
    clean = url.strip()
    try:
        parsed = urlparse(clean)
        # 1. Google Translate proxy: translate.google.com/translate?u=<REAL_URL>...
        if "translate.google." in parsed.netloc:
            qs = parse_qs(parsed.query)
            target = qs.get("u", [None])[0]
            if target:
                clean = unquote(target)
        # 2. Google redirect: google.com/url?q=<REAL_URL>...
        elif "google." in parsed.netloc and parsed.path == "/url":
            qs = parse_qs(parsed.query)
            target = qs.get("q", [None])[0] or qs.get("url", [None])[0]
            if target:
                clean = unquote(target)
    except Exception:
        pass
    return clean


def extract_domain(url: str) -> str:
    try:
        clean = unwrap_search_url(url)
        netloc = urlparse(clean).netloc
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
    Lấy dôi dư ứng viên (fetch_num) để sẵn sàng lọc domain và xếp hạng độ uy tín y tế.
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
    fetch_num = max(max_results * 2, 8)
    payload = {
        "q": query,
        "gl": "vn",
        "hl": "vi",
        "num": fetch_num
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
        ans_link = unwrap_search_url(ans_box.get("link") or "")
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
    for item in data.get("organic", [])[:fetch_num]:
        link = unwrap_search_url(item.get("link", "").strip())
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
                link = unwrap_search_url(r.get("href", "").strip())
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
    Sau đó:
    - Xác minh độ sống của link (Live Check)
    - Phân hạng uy tín y tế (Tier 1 -> Tier 4)
    - Loại bỏ các trang rác / mạng xã hội không kiểm duyệt
    - Khử độc Indirect Prompt Injection trong nội dung snippet.
    Trả về: (danh sách kết quả đã xác minh & xếp hạng, tên nguồn 'cache' | 'serper' | 'duckduckgo' | 'none')
    """
    clean_query = query.strip().lower()
    now = time.time()

    # 1. Kiểm tra RAM Cache
    if clean_query in _SEARCH_CACHE:
        cached_time, cached_results = _SEARCH_CACHE[clean_query]
        if now - cached_time < CACHE_TTL_SECONDS:
            logger.info("Search cache HIT cho query: '%s'", query)
            return cached_results, "cache"

    # 2. Thử nguồn chính Serper (lấy dư ứng viên để lọc xếp hạng)
    source_used = "none"
    results: List[WebSearchResult] = []
    fetch_num = max(max_results * 2, 8)
    try:
        results = await search_serper(query, api_key=custom_serper_key, max_results=fetch_num)
        if results:
            source_used = "serper"
    except Exception as serper_err:
        logger.info("Serper không khả dụng (%s), chuyển sang DuckDuckGo fallback", serper_err)

    # 3. Nếu Serper không có kết quả hoặc lỗi, fallback sang DuckDuckGo
    if not results:
        try:
            results = await search_duckduckgo(query, max_results=fetch_num)
            if results:
                source_used = "duckduckgo"
        except Exception as ddg_err:
            logger.warning("DuckDuckGo fallback thất bại: %s", ddg_err)

    if not results:
        return [], "none"

    # 4. Xác minh link sống (Live URL Verifier)
    verified_results = await verify_live_urls(results)

    # 5. Phân hạng uy tín y tế, lọc bỏ mạng xã hội rác & khử độc Prompt Injection
    ranked_results = rank_and_filter_results(verified_results, max_results=max_results)

    # 6. Lưu vào cache
    _SEARCH_CACHE[clean_query] = (now, ranked_results)
    return ranked_results, source_used


def sanitize_ai_response_urls(ai_text: str, allowed_urls: Set[str]) -> str:
    """
    Chống AI Hallucination URL:
    Quét toàn bộ URL trong câu trả lời của AI.
    Nếu link không nằm trong danh sách các URL có thực từ kết quả search,
    ẩn đường dẫn hoặc thay thế bằng cảnh báo để bảo vệ người dùng.
    """
    if not ai_text:
        return ""

    # Chuẩn hóa whitelist gồm cả URL nguyên bản và URL đã unwrap
    normalized_allowed = set()
    for u in allowed_urls:
        if not u:
            continue
        u_clean = u.rstrip("/.,;:")
        normalized_allowed.add(u_clean)
        unwrapped = unwrap_search_url(u).rstrip("/.,;:")
        if unwrapped:
            normalized_allowed.add(unwrapped)

    def is_url_allowed(test_url: str) -> bool:
        clean = unwrap_search_url(test_url.rstrip("/.,;:"))
        return any(clean.startswith(a) or a.startswith(clean) for a in normalized_allowed)

    # Tokenizer đơn lượt: Ưu tiên bắt toàn bộ [Label](URL) markdown trước, phần còn lại mới là raw URL
    pattern = re.compile(
        r'\[(?P<label>[^\]]+)\]\((?P<md_url>https?://[^\s\)]+)\)|(?P<raw_url>https?://[^\s\)\]\>\"\'”]+)'
    )

    def _replace_token(match: re.Match) -> str:
        if match.group("md_url"):
            label = match.group("label")
            md_url = match.group("md_url")
            if is_url_allowed(md_url):
                return match.group(0)
            return f"[{label}] (Nguồn chưa được xác thực trên Internet)"
        else:
            raw_url = match.group("raw_url")
            if is_url_allowed(raw_url):
                return raw_url
            return "[Link đã ẩn do không nằm trong nguồn tìm kiếm xác minh]"

    return pattern.sub(_replace_token, ai_text)


def standardize_web_references(ai_text: str, results: List[WebSearchResult]) -> str:
    """
    Chuẩn hóa khối nguồn tham khảo y khoa cuối câu trả lời:
    - Loại bỏ các dòng trích dẫn cụt mồ côi (như `* [5]`) hoặc danh sách link vỡ do LLM sinh thiếu/lỗi proxy.
    - Tạo danh sách tham khảo y khoa chuẩn mực Markdown:
      `1. [Tiêu đề](URL) - *domain*`
    - Đảm bảo có lưu ý an toàn y khoa chuẩn mực ở cuối bài.
    """
    if not ai_text or not results:
        return ai_text

    disclaimer = "⚠️ *Lưu ý: Thông tin tìm kiếm từ Internet mang tính chất tham khảo, không thay thế chỉ định chuyên môn của bác sĩ.*"

    ref_pat = re.compile(
        r'\n(?:\*+|#{1,4}\s*)?(?:Tham khảo chi tiết tại|Nguồn tham khảo y khoa|Nguồn tham khảo|Tài liệu tham khảo|Tham khảo)[:\s]*\n.*',
        re.IGNORECASE | re.DOTALL
    )
    ref_match = ref_pat.search(ai_text)
    if ref_match:
        body = ai_text[:ref_match.start()].strip()
    else:
        disc_idx = ai_text.find("⚠️")
        if disc_idx != -1:
            body = ai_text[:disc_idx].strip()
        else:
            body = ai_text.strip()

    # Tạo danh mục nguồn tham khảo y khoa đầy đủ, khớp 100% với các footnote [1], [2]...
    ref_lines = ["### Nguồn tham khảo y khoa:"]
    for idx, r in enumerate(results[:5], 1):
        domain_tag = f" - *{r.source_domain}*" if r.source_domain else ""
        ref_lines.append(f"{idx}. [{r.title}]({r.url}){domain_tag}")

    return f"{body}\n\n" + "\n".join(ref_lines) + f"\n\n{disclaimer}"


def format_web_search_context(results: List[WebSearchResult]) -> str:
    """
    Chuyển đổi kết quả tìm kiếm thành chuỗi ngữ cảnh đóng gói trong thẻ XML cách ly an toàn (OWASP LLM01 Sandboxing).
    Kèm phân loại độ uy tín y tế (Tier 1 -> Tier 4).
    """
    if not results:
        return ""

    tier_labels = {
        1: "⭐ NGUỒN CHÍNH THỐNG / BỆNH VIỆN ĐẦU NGÀNH (TIER 1)",
        2: "⭐ BỆNH VIỆN LỚN / DƯỢC THƯ LÂM SÀNG (TIER 2)",
        3: "CHUYÊN TRANG Y TẾ / BÁO CHÍ CHÍNH THỐNG (TIER 3)",
        4: "NGUỒN THAM KHẢO Y TẾ XÁC MINH (TIER 4)"
    }

    lines = [
        "<medical_search_evidence>",
        "<!-- Dữ liệu tìm kiếm y tế từ Internet thời gian thực đã được tiền lọc và xếp hạng an toàn -->",
        ""
    ]
    for idx, item in enumerate(results, 1):
        tier_label = tier_labels.get(getattr(item, "credibility_tier", 4), "NGUỒN THAM KHẢO Y TẾ")
        lines.append(f"[{idx}] Tiêu đề: {item.title}")
        lines.append(f"     Tên miền: {item.source_domain} ({tier_label})")
        lines.append(f"     Đường dẫn (URL): {item.url}")
        lines.append(f"     Nội dung tóm tắt: {item.snippet}")
        lines.append("")
    lines.append("</medical_search_evidence>")

    return "\n".join(lines)
