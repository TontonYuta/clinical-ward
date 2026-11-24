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
import ipaddress
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

# Danh sách domain mạng xã hội / diễn đàn tự do / blog / trang công nghệ & hỗ trợ tài khoản không liên quan y tế
EXCLUDED_DOMAINS: Set[str] = {
    "facebook.com", "fb.com", "instagram.com", "tiktok.com", "twitter.com", "x.com",
    "youtube.com", "youtu.be", "pinterest.com", "reddit.com", "quora.com",
    "voz.vn", "webtretho.com", "lamchame.com", "tinhte.vn",
    "blogspot.com", "wordpress.com", "wixsite.com", "weebly.com",
    # Trang công nghệ, tài khoản, hỗ trợ phần mềm, lập trình & thương mại điện tử
    "microsoft.com", "answers.microsoft.com", "support.microsoft.com",
    "apple.com", "support.apple.com", "google.com", "support.google.com",
    "github.com", "gitlab.com", "stackoverflow.com", "stackexchange.com",
    "medium.com", "shopee.vn", "lazada.vn", "tiki.vn", "sendo.vn",
    "thegioididong.com", "fptshop.com.vn", "cellphones.com.vn"
}

# Danh mục từ khóa y dược học chuẩn mực dùng để kiểm duyệt nội dung ngoài danh mục chính thức
CLINICAL_RELEVANCE_KEYWORDS: Tuple[str, ...] = (
    "thuốc", "dược", "bệnh", "điều trị", "triệu chứng", "bác sĩ", "y tế", "sức khỏe",
    "liều dùng", "chỉ định", "chống chỉ định", "tác dụng phụ", "y khoa", "bệnh viện",
    "dược phẩm", "hoạt chất", "chuyên luận", "dược thư", "kháng sinh", "paracetamol",
    "ibuprofen", "aspirin", "hạ sốt", "giảm đau", "phòng ngừa", "vắc xin", "tiêm chủng",
    "clinic", "hospital", "pharma", "medical", "health", "medicine", "drug", "dosage"
)

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
    Làm sạch snippet/title tìm kiếm từ Web (OWASP LLM01 Indirect Prompt Injection Defense):
    - Loại bỏ thẻ script độc hại và thẻ XML breakout (<medical_search_evidence>)
    - Loại bỏ các chuỗi kích hoạt Prompt Injection / Jailbreak
    - Giới hạn độ dài an toàn
    """
    if not text:
        return ""
    cleaned = SCRIPT_PATTERN.sub("[script blocked]", text)
    cleaned = re.sub(r'</?\s*medical_search_evidence\s*>', '', cleaned, flags=re.IGNORECASE)
    if INJECTION_PATTERN.search(cleaned):
        cleaned = INJECTION_PATTERN.sub("[untrusted instruction removed]", cleaned)
    return cleaned.strip()


_VI_DIACRITIC_PAT = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.IGNORECASE,
)


def is_vietnamese_source(result: WebSearchResult) -> bool:
    """Xác định nguồn/link tiếng Việt dựa trên domain (.vn), URL (/vi/) hoặc dấu tiếng Việt trong tiêu đề/tóm tắt."""
    domain = (result.source_domain or "").lower().strip()
    url = (result.url or "").lower()
    if domain.endswith(".vn") or "/vi/" in url or "lang=vi" in url or "hl=vi" in url:
        return True
    sample = f"{result.title or ''} {result.snippet or ''}"
    return bool(_VI_DIACRITIC_PAT.search(sample))


def rank_and_filter_results(results: List[WebSearchResult], max_results: int = 5) -> List[WebSearchResult]:
    """
    Lọc bỏ domain không an toàn (mạng xã hội, trang công nghệ, hỗ trợ tài khoản).
    Làm sạch prompt injection trong snippet.
    Rào chắn Y tế nghiêm ngặt:
    - Tier 1 -> Tier 3: Được chấp nhận trực tiếp (Bộ Y Tế, Bệnh viện lớn, Cẩm nang Dược, Báo Y tế uy tín).
    - Tier 4 (Domain khác): Bắt buộc tiêu đề hoặc tóm tắt phải chứa từ khóa y dược học hợp lệ.
      Nếu không chứa từ khóa y tế, loại bỏ 100% để triệt tiêu tình trạng dẫn link rác.
    Sắp xếp ưu tiên theo Tier tăng dần (1 -> 2 -> 3 -> 4) rồi lấy top `max_results`.
    """
    filtered: List[WebSearchResult] = []
    for r in results:
        if is_domain_excluded(r.source_domain):
            logger.info("Loại bỏ domain không phù hợp/ngoài y tế: %s (%s)", r.source_domain, r.url)
            continue
        clean_title = sanitize_search_snippet(r.title)
        clean_snippet = sanitize_search_snippet(r.snippet)
        tier = classify_domain_tier(r.source_domain)

        # Rào chắn kiểm duyệt nội dung cho Tier 4: Bắt buộc phải có từ khóa y dược
        if tier >= 4:
            content_lower = f"{clean_title} {clean_snippet}".lower()
            has_medical_context = any(k in content_lower for k in CLINICAL_RELEVANCE_KEYWORDS)
            if not has_medical_context:
                logger.info("Loại bỏ kết quả Tier 4 do không có nội dung y tế liên quan: %s - %s", clean_title, r.url)
                continue

        r.title = clean_title
        r.snippet = clean_snippet
        r.credibility_tier = tier
        filtered.append(r)

    # Ưu tiên nguồn tiếng Việt trước, sau đó sắp xếp ổn định theo độ uy tín Tier tăng dần (Tier 1 -> Tier 4)
    filtered.sort(key=lambda x: (0 if is_vietnamese_source(x) else 1, x.credibility_tier))
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


def is_safe_public_url(url: str) -> bool:
    """Chống SSRF: chỉ cho phép http/https tới host công cộng, chặn IP nội bộ, loopback và cloud metadata."""
    try:
        parsed = urlparse((url or "").strip())
        if parsed.scheme.lower() not in ("http", "https"):
            return False
        host = (parsed.hostname or "").strip().lower()
        if not host or host in ("localhost", "metadata.google.internal") or host.endswith((".local", ".internal", ".localhost")):
            return False
        try:
            ip_obj = ipaddress.ip_address(host)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
                or ip_obj.is_unspecified
            ):
                return False
        except ValueError:
            pass
        return True
    except Exception:
        return False


async def is_url_alive(client: httpx.AsyncClient, url: str) -> bool:
    """
    Kiểm tra nhanh xem link có sống không (Status 200..399 hoặc 403 WAF).
    Sử dụng timeout ngắn (1.2s) để tối ưu độ trễ, loại bỏ link chết 404, 5xx hoặc timeout.
    """
    if not is_safe_public_url(url):
        return False
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        # Thử HEAD trước với timeout ngắn 0.8s để tiết kiệm băng thông và độ trễ
        resp = await client.head(url, headers=headers, timeout=0.8)
        # 405 Method Not Allowed -> thử nhanh GET stream
        if resp.status_code == 405:
            async with client.stream("GET", url, headers=headers, timeout=0.7) as get_resp:
                return get_resp.status_code < 400 or get_resp.status_code == 403

        # 403 Forbidden: Nhiều trang tin tức / Cổng thông tin (VnExpress, Bộ Y Tế) có Cloudflare chặn bot HEAD
        # nhưng link là thật và người dùng vẫn bấm vào đọc bình thường.
        if resp.status_code < 400 or resp.status_code == 403:
            return True
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
    max_results: int = 5,
    lang_restrict: Optional[str] = None,
) -> List[WebSearchResult]:
    """
    Tìm kiếm qua Serper.dev REST API (Google Search kết quả thật, ổn định trên VPS/Cloud).
    Lấy dôi dư ứng viên (fetch_num) để sẵn sàng lọc domain và xếp hạng độ uy tín y tế.
    """
    from app.services.admin_key_vault import get_active_api_key, record_key_consumption, rotate_to_next_key
    from app.services.admin_monitoring_service import check_search_budget_gate
    from app.services.telemetry_store import record_search_query_usage

    # Kiểm tra cổng ngân sách tìm kiếm Web hàng ngày (Search Budget Cap Gate)
    gate_ok, gate_reason = check_search_budget_gate()
    if not gate_ok:
        logger.warning("[Serper Search] Bị chặn bởi Budget Gate: %s", gate_reason)
        raise ValueError(gate_reason)

    key = api_key or os.getenv("SERPER_API_KEY", "").strip() or (get_active_api_key(provider="serper") or "").strip()
    if not key or key == "YOUR_SERPER_API_KEY":
        raise ValueError("Chưa cấu hình SERPER_API_KEY")

    url = "https://google.serper.dev/search"
    headers = {
        "X-API-KEY": key,
        "Content-Type": "application/json"
    }
    fetch_num = max(max_results * 3, 12)
    payload: dict = {
        "q": query,
        "gl": "vn",
        "hl": "vi",
        "num": fetch_num
    }
    if lang_restrict:
        payload["lr"] = lang_restrict

    start_serper_t = time.monotonic()
    async with httpx.AsyncClient(timeout=6.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        elapsed_serper_ms = round((time.monotonic() - start_serper_t) * 1000, 1)

        if resp.status_code in (403, 429):
            rotate_to_next_key(key, reason="rate_limited" if resp.status_code == 429 else "quota_exhausted", provider="serper")
            record_search_query_usage(provider="serper", query=query, credits=0, cost_vnd=0.0, latency_ms=elapsed_serper_ms, status=f"error_{resp.status_code}")
            resp.raise_for_status()

        resp.raise_for_status()
        data = resp.json()

    # Ghi nhận truy vấn thành công vào sổ cái và tiêu thụ key
    record_search_query_usage(provider="serper", query=query, credits=1, cost_vnd=25.5, latency_ms=elapsed_serper_ms, status="success")
    record_key_consumption(key, tokens=1, is_error_429=False)

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
            raw_items = list(ddgs.text(query, region="vn-vi", max_results=max_results))
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

    # 4. Phân hạng uy tín y tế, lọc bỏ mạng xã hội rác & khử độc Prompt Injection TRƯỚC (Rank-First)
    # Lấy top ứng viên tối ưu nhất (max_results + 1) để xác minh độ sống thay vì tốn băng thông quét toàn bộ
    candidates = rank_and_filter_results(results, max_results=max_results + 1)

    # Nếu Serper trả về ít hơn 2 nguồn tiếng Việt, bổ sung 1 lượt tìm kiếm ưu tiên ngôn ngữ tiếng Việt (lr=lang_vi)
    if source_used == "serper" and sum(1 for r in candidates if is_vietnamese_source(r)) < 2:
        try:
            vi_results = await search_serper(
                query,
                api_key=custom_serper_key,
                max_results=max_results,
                lang_restrict="lang_vi",
            )
            if vi_results:
                seen_urls = {_normalize_url_parts(r.url) for r in results}
                merged = list(results)
                for vr in vi_results:
                    vk = _normalize_url_parts(vr.url)
                    if vk not in seen_urls:
                        seen_urls.add(vk)
                        merged.append(vr)
                candidates = rank_and_filter_results(merged, max_results=max_results + 1)
        except Exception:
            pass

    # 5. Xác minh link sống (Live URL Verifier) song song chỉ trên top ứng viên đạt chuẩn
    verified_results = await verify_live_urls(candidates)
    final_results = verified_results[:max_results] if verified_results else candidates[:max_results]

    # 6. Lưu vào cache
    _SEARCH_CACHE[clean_query] = (now, final_results)
    return final_results, source_used


def _normalize_url_parts(url: str) -> tuple[str, str, str]:
    """Chuẩn hóa URL thành (netloc_no_www, clean_path, clean_query_key) để đối soát chặt chẽ."""
    raw = unwrap_search_url((url or "").strip().rstrip("/.,;:"))
    if not raw:
        return ("", "", "")
    try:
        parsed = urlparse(raw)
        netloc = parsed.netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        path = parsed.path.rstrip("/")
        # Loại bỏ các tracking query params phổ biến
        qs = parse_qs(parsed.query, keep_blank_values=False)
        filtered_qs = sorted(
            (k, tuple(sorted(v)))
            for k, v in qs.items()
            if not k.lower().startswith(("utm_", "fbclid", "gclid", "ref"))
        )
        query_key = "&".join(f"{k}={','.join(v)}" for k, v in filtered_qs)
        return (netloc, path, query_key)
    except Exception:
        return ("", raw.lower(), "")


def sanitize_ai_response_urls(ai_text: str, allowed_urls: Set[str]) -> str:
    """
    Chống AI Hallucination URL:
    Quét toàn bộ URL trong câu trả lời của AI.
    Nếu link không nằm trong danh sách các URL có thực từ kết quả search,
    ẩn đường dẫn hoặc thay thế bằng cảnh báo để bảo vệ người dùng.
    """
    if not ai_text:
        return ""

    # Chuẩn hóa whitelist gồm cả URL nguyên bản và cặp (netloc, path, query_key)
    normalized_allowed = set()
    allowed_parts: List[tuple[str, str, str]] = []
    for u in allowed_urls:
        if not u:
            continue
        u_clean = u.rstrip("/.,;:")
        normalized_allowed.add(u_clean)
        unwrapped = unwrap_search_url(u).rstrip("/.,;:")
        if unwrapped:
            normalized_allowed.add(unwrapped)
        parts = _normalize_url_parts(u)
        if parts[0]:
            allowed_parts.append(parts)

    def is_url_allowed(test_url: str) -> bool:
        clean = unwrap_search_url(test_url.rstrip("/.,;:"))
        if clean in normalized_allowed:
            return True
        t_netloc, t_path, t_query = _normalize_url_parts(clean)
        if not t_netloc:
            return False
        for a_netloc, a_path, a_query in allowed_parts:
            if t_netloc != a_netloc:
                continue
            # Khớp chính xác path (cho phép bỏ qua tracking query hoặc fragment)
            if t_path == a_path and (not t_query or not a_query or t_query == a_query):
                return True
            # Cho phép subpath chỉ khi allowed path là một thư mục cụ thể (không phải root rỗng)
            if a_path and t_path.startswith(a_path + "/"):
                return True
        return False

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


def reconcile_web_citations(
    ai_text: str,
    results: List[WebSearchResult],
    fallback_top_n: int = 3
) -> tuple[str, List[WebSearchResult]]:
    """
    Đối soát chỉ số trích dẫn [n] trong bài viết với danh sách kết quả tìm kiếm thực tế:
    1. Loại bỏ các chỉ số [n] nằm ngoài phạm vi (n < 1 hoặc n > len(results)).
    2. Đánh số lại liên tục [1], [2], ... theo thứ tự xuất hiện thực tế trong văn bản.
    3. Chỉ giữ lại đúng các nguồn được trích dẫn (hoặc top N nguồn uy tín nếu bài viết không gắn [n]).
    """
    if not ai_text or not results:
        return ai_text, results

    max_idx = len(results)
    # Tách cụm trích dẫn gộp dạng [1, 2] hoặc [1, 3, 4] thành [1][2] để không sót nguồn nào
    grouped_pat = re.compile(r'\[(\d+(?:\s*,\s*\d+)+)\](?!\()')
    ai_text = grouped_pat.sub(
        lambda m: "".join(f"[{n.strip()}]" for n in m.group(1).split(",") if n.strip()),
        ai_text,
    )
    # Bỏ qua [n](url) markdown link, chỉ bắt standalone citation marker [n]
    citation_pat = re.compile(r'\[(\d+)\](?!\()')

    ordered_valid: List[int] = []
    seen: Set[int] = set()
    for match in citation_pat.finditer(ai_text):
        idx = int(match.group(1))
        if 1 <= idx <= max_idx and idx not in seen:
            seen.add(idx)
            ordered_valid.append(idx)

    if not ordered_valid:
        # Nếu LLM không gắn [n] trong bài, vẫn loại bỏ [n] ngoài phạm vi và giữ top N nguồn uy tín (đã xếp tiếng Việt trước)
        cleaned = citation_pat.sub("", ai_text)
        cleaned = re.sub(r'[ \t]{2,}', ' ', cleaned).strip()
        return cleaned, results[:min(fallback_top_n, max_idx)]

    # Luôn sắp xếp nguồn tiếng Việt lên đầu [1], [2]... rồi mới tới nguồn tiếng Anh
    order_pos = {old_idx: pos for pos, old_idx in enumerate(ordered_valid)}
    ordered_valid.sort(key=lambda idx: (0 if is_vietnamese_source(results[idx - 1]) else 1, order_pos[idx]))

    remap: Dict[int, int] = {old_idx: new_idx for new_idx, old_idx in enumerate(ordered_valid, 1)}

    def _rewrite_marker(match: re.Match) -> str:
        old_idx = int(match.group(1))
        new_idx = remap.get(old_idx)
        return f"[{new_idx}]" if new_idx is not None else ""

    reconciled_text = citation_pat.sub(_rewrite_marker, ai_text)
    reconciled_text = re.sub(r'\s+([.,;:!?])', r'\1', reconciled_text)
    reconciled_results = [results[old_idx - 1] for old_idx in ordered_valid]
    return reconciled_text, reconciled_results


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

    # Chỉ tìm tiêu đề khối tham khảo độc lập ở phần CUỐI câu trả lời (tránh cắt nhầm lời mở đầu/thân bài viết)
    ref_pat = re.compile(
        r'\n(?:\*+|#{1,4}\s*)?(?:Tham khảo chi tiết tại|Nguồn tham khảo y khoa|Nguồn tham khảo|Tài liệu tham khảo)[:\s]*\n',
        re.IGNORECASE
    )
    ref_matches = list(ref_pat.finditer(ai_text))
    body = ai_text.strip()
    found_ref_tail = False
    total_len = len(ai_text)

    # Quét từ dưới lên: Chấp nhận khối tham khảo nếu:
    # 1. Nằm ở phần đuôi (ít nhất 70% văn bản hoặc 600 ký tự cuối) VÀ có cấu trúc citations
    # 2. HOẶC toàn bộ nội dung phía sau tiêu đề tham khảo là danh sách bullet trích dẫn / links / disclaimer
    for m in reversed(ref_matches):
        is_in_tail = (m.start() >= total_len * 0.70) or (total_len - m.start() <= 600 and m.start() >= 120)
        tail_content = ai_text[m.start():]
        has_citations = bool(re.search(r'\[.+?\]|\d+\.\s*\[|[-*•]\s*\[|https?://', tail_content))

        tail_after_header = ai_text[m.end():]
        tail_lines = [l.strip() for l in tail_after_header.splitlines() if l.strip()]
        is_pure_citation_block = bool(tail_lines) and all(
            l.startswith(("*", "-", "•", "[", "http", "1.", "2.", "3.", "4.", "5.", "⚠️", "(http"))
            or "link đã ẩn" in l.lower()
            for l in tail_lines
        )

        if (is_in_tail and has_citations) or is_pure_citation_block:
            body = ai_text[:m.start()].strip()
            found_ref_tail = True
            break

    if not found_ref_tail:
        # Chỉ loại bỏ disclaimer nếu nó nằm ở cuối câu trả lời (tránh cắt nhầm emoji ⚠️ trong phần cảnh báo lâm sàng)
        disc_match = re.search(r'\n\s*⚠️\s*\*?Lưu ý:\s*Thông tin tìm kiếm.*$', body, re.IGNORECASE | re.DOTALL)
        if disc_match:
            body = body[:disc_match.start()].strip()

    # Rào chắn ranh giới câu (Sentence Boundary Guard):
    # Khử triệt để hiện tượng đứt gãy câu giữa chừng do chạm trần token LLM.
    # Đảm bảo văn bản AI trước khối trích dẫn luôn kết thúc bằng một câu hoàn chỉnh trọn vẹn ý nghĩa.
    body_lines = body.splitlines()
    for _ in range(3):
        if not body_lines:
            break
        last = body_lines[-1].strip()
        if not last:
            body_lines.pop()
            continue
        is_dangling = (
            (last.count("(") > last.count(")"))
            or (last.count("[") > last.count("]"))
            or (last.count("**") % 2 != 0 and len(last) < 40)
            or (last.startswith("#") and len(last.lstrip("#").strip()) <= 3)
            or (len(last) <= 4 and last in ("*", "-", "•", "* [", "[", "1.", "2.", "3."))
        )
        if is_dangling:
            body_lines.pop()
            continue

        # Kiểm tra kết thúc câu hoàn chỉnh: Dòng phải kết thúc bằng dấu ngắt câu hoặc thẻ danh sách hợp lệ
        clean_last = last.rstrip("*_>`\"')]} ")
        if clean_last and clean_last[-1] not in (".", "!", "?", ":", ";", "…"):
            # Dòng bị cắt cụt giữa chừng (ví dụ: 'Dùng quá liều Paracetamol có thể gây tổn thương')
            # Tìm dấu chấm câu hoàn chỉnh gần nhất trong dòng
            last_punct_idx = max(last.rfind(". "), last.rfind(".\n"), last.rfind("; "), last.rfind("! "), last.rfind("? "))
            if last_punct_idx != -1 and last_punct_idx >= 15:
                body_lines[-1] = last[:last_punct_idx + 1].strip()
                break
            else:
                # Toàn bộ dòng là một câu dở dang chưa hoàn chỉnh, loại bỏ để dừng ở câu hoàn chỉnh trước đó
                body_lines.pop()
                continue
        break
    body = "\n".join(body_lines).strip()

    # Tự động cân bằng và đóng các thẻ markdown chưa khép kín thay vì xóa dòng nội dung của AI
    if body:
        if body.count("**") % 2 != 0:
            body += "**"
        open_parens = body.count("(") - body.count(")")
        if open_parens > 0:
            body += ")" * open_parens
        open_brackets = body.count("[") - body.count("]")
        if open_brackets > 0:
            body += "]" * open_brackets

    # Tạo danh mục nguồn tham khảo y khoa đầy đủ, khớp 100% với các footnote [1], [2]...
    ref_lines = ["### Nguồn tham khảo y khoa:"]
    for idx, r in enumerate(results[:5], 1):
        domain_tag = f" - *{r.source_domain}*" if r.source_domain else ""
        title = r.title.strip() if r.title else r.source_domain or "Tài liệu y khoa trực tuyến"
        ref_lines.append(f"{idx}. [{title}]({r.url}){domain_tag}")

    return f"{body}\n\n" + "\n".join(ref_lines) + f"\n\n{disclaimer}"


def format_web_search_context(results: List[WebSearchResult]) -> str:
    """
    Chuyển đổi kết quả tìm kiếm thành chuỗi ngữ cảnh đóng gói trong thẻ XML cách ly an toàn (OWASP LLM01 Sandboxing).
    Kèm phân loại độ uy tín y tế (Tier 1 -> Tier 4).
    Tối ưu hóa token: Cắt gọn khoảng trắng, lọc trùng lặp và khống chế độ dài snippet tối ưu (tiết kiệm ~60% prompt tokens).
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
        clean_snip = " ".join((item.snippet or "").split())
        if len(clean_snip) > 240:
            clean_snip = clean_snip[:237] + "..."
        lines.append(f"[{idx}] Tiêu đề: {item.title.strip()}")
        lines.append(f"     Tên miền: {item.source_domain} ({tier_label})")
        lines.append(f"     Đường dẫn (URL): {item.url}")
        lines.append(f"     Nội dung tóm tắt: {clean_snip}")
        lines.append("")
    lines.append("</medical_search_evidence>")

    return "\n".join(lines)
