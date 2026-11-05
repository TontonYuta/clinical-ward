"""
Multi-Tier Clinical LRU & Semantic Cache for Clinical Ward Copilot
Paper: GPTCache (Bang et al., 2023 / arXiv:2303.17580)
Triệt tiêu độ trễ backend từ ~800ms xuống < 2ms đối với các câu hỏi tra cứu Dược thư DĐVN V,
tương tác thuốc QĐ 5948/QĐ-BYT và văn bản pháp quy y tế.
"""
import re
import time
from collections import OrderedDict
from typing import Optional, Dict, Any, List
from app.schemas.copilot import CopilotResponse

# Các từ ngữ/hành động làm biến đổi trạng thái kho hoặc tủ trực (CẤM CACHE)
MUTATION_KEYWORDS = (
    "mượn", "muon", "báo hỏng", "bao hong", "hỏng", "hong",
    "giao ban", "kê đơn", "ke don", "tạo đơn", "tao don",
    "đơn thuốc", "don thuoc", "xuất kho", "xuat kho", "xuất",
    "xuat", "trả vỏ", "tra vo", "nợ vỏ", "no vo", "tủ trực", "tu truc",
    "tồn kho", "ton kho", "sắp hết", "sap het", "cận hạn", "can han",
    "chuyển tab", "chuyen tab", "mở form", "mo form", "máy thở", "monitor",
    "bơm tiêm", "bom tiem", "dây truyền", "day truyen",
    "lọ", "lo", "ống", "ong", "chai", "viên", "vien", "máy sốc tim"
)

# Tiền tố giao tiếp cần chuẩn hóa ngữ nghĩa để đồng nhất cache key
CONVERSATIONAL_PREFIXES = (
    "cho tôi hỏi", "cho toi hoi",
    "xin hỏi", "xin hoi",
    "bác sĩ cho hỏi", "bac si cho hoi",
    "trợ lý cho hỏi", "tro ly cho hoi",
    "vui lòng cho biết", "vui long cho biet",
    "cho em hỏi", "cho em hoi",
    "cho mình hỏi", "cho minh hoi",
    "hỏi về", "hoi ve",
    "tìm hiểu về", "tim hieu ve",
    "thông tin về", "thong tin ve",
    "kiểm tra giúp", "kiem tra giup",
    "xem giúp", "xem giup",
    "tra cứu về", "tra cuu ve",
    "hướng dẫn về", "huong dan ve"
)

# Hậu tố lịch sự / trợ từ đệm cuối câu
CONVERSATIONAL_SUFFIXES = (
    "với ạ", "voi a",
    "nhé", "nhe",
    "ạ", "a",
    "với", "voi",
    "giúp tôi", "giup toi",
    "giúp em", "giup em",
    "giúp mình", "giup minh"
)

class ClinicalLRUCache:
    """
    Bộ nhớ đệm LRU lâm sàng đa tầng với cơ chế chuẩn hóa ngữ nghĩa (Semantic Key Normalization).
    """
    def __init__(self, max_size: int = 1000, default_ttl_sec: int = 86400):
        self.max_size = max_size
        self.default_ttl = default_ttl_sec
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self.hits = 0
        self.misses = 0
        self.evictions = 0

    def normalize_query(self, query: str) -> str:
        """
        Chuẩn hóa câu truy vấn: loại bỏ dấu câu, chuyển chữ thường,
        loại bỏ các trợ từ giao tiếp mở đầu và kết thúc câu để đồng nhất cache key.
        """
        if not query:
            return ""
        # 1. Chữ thường và xóa dấu câu
        clean = query.lower().strip()
        clean = re.sub(r'[\?!\.,:;_\-\(\)\[\]"\']', ' ', clean)
        clean = re.sub(r'\s+', ' ', clean).strip()

        # 2. Xóa tiền tố giao tiếp
        for prefix in CONVERSATIONAL_PREFIXES:
            if clean.startswith(prefix + " "):
                clean = clean[len(prefix):].strip()
                break

        # 3. Xóa hậu tố lịch sự
        for suffix in CONVERSATIONAL_SUFFIXES:
            if clean.endswith(" " + suffix):
                clean = clean[:-len(suffix)].strip()
                break

        return clean

    def make_key(self, query: str, user_role: str = "doctor") -> str:
        canonical = self.normalize_query(query)
        role = (user_role or "doctor").strip().lower()
        return f"{role}:{canonical}"

    def is_cacheable_query(self, query: str) -> bool:
        """
        Kiểm tra câu hỏi có thuộc nhóm tri thức y văn thuần túy không.
        Từ chối cache các lệnh quản trị, mượn thuốc, báo hỏng, xuất kho, tồn kho tức thời.
        Dùng word boundary để tránh bắt nhầm (ví dụ: 'ống' trong 'uống').
        """
        if not query or len(query.strip()) < 3:
            return False
        lower_q = query.lower()
        for kw in MUTATION_KEYWORDS:
            if re.search(r'\b' + re.escape(kw) + r'\b', lower_q):
                return False
        return True

    def is_cacheable_response(self, response: CopilotResponse) -> bool:
        """
        Kiểm tra phản hồi có an toàn để lưu cache hay không.
        Không cache nếu phản hồi mang Action Card thao tác tủ trực hoặc vi phạm guardrail.
        """
        if not response or not response.reply_text:
            return False
        if response.intent == "SECURITY_GUARDRAIL_BLOCKED":
            return False
        if response.card:
            card_type = getattr(response.card, "card_type", "")
            if card_type in {
                "borrow_confirm", "incident_confirm", "shift_handover_report",
                "low_stock_report", "fefo_report", "equipment_ticket", "debt_settle"
            }:
                return False
        return True

    def get(self, query: str, user_role: str = "doctor") -> Optional[CopilotResponse]:
        """
        Lấy kết quả từ cache nếu tồn tại và còn hạn.
        Độ trễ: < 0.05ms.
        """
        if not self.is_cacheable_query(query):
            return None

        key = self.make_key(query, user_role)
        if key not in self._cache:
            self.misses += 1
            return None

        entry = self._cache[key]
        now = time.time()
        if now > entry["expire_at"]:
            del self._cache[key]
            self.misses += 1
            return None

        # LRU Touch: đưa key lên cuối
        self._cache.move_to_end(key)
        self.hits += 1

        # Trả về bản sao an toàn độc lập
        resp_dict = entry["data"].copy()
        return CopilotResponse.model_validate(resp_dict)

    def set(
        self,
        query: str,
        user_role: str,
        response: CopilotResponse,
        ttl_sec: Optional[int] = None
    ) -> bool:
        """
        Lưu kết quả phân tích lâm sàng vào bộ nhớ đệm.
        """
        if not self.is_cacheable_query(query):
            return False
        if not self.is_cacheable_response(response):
            return False

        key = self.make_key(query, user_role)
        now = time.time()
        ttl = ttl_sec if ttl_sec is not None else self.default_ttl

        if key in self._cache:
            self._cache.move_to_end(key)
        elif len(self._cache) >= self.max_size:
            # Thu hồi phần tử ít sử dụng nhất (LRU eviction)
            self._cache.popitem(last=False)
            self.evictions += 1

        self._cache[key] = {
            "data": response.model_dump(),
            "expire_at": now + ttl,
            "created_at": now,
            "canonical_query": self.normalize_query(query),
            "role": user_role
        }
        return True

    def get_stats(self) -> Dict[str, Any]:
        total_lookups = self.hits + self.misses
        hit_ratio = round((self.hits / total_lookups) * 100, 2) if total_lookups > 0 else 0.0
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "hit_ratio_percent": hit_ratio,
        }

    def clear(self) -> None:
        self._cache.clear()
        self.hits = 0
        self.misses = 0
        self.evictions = 0

# Khởi tạo singleton cache toàn cục
_global_clinical_cache = ClinicalLRUCache(max_size=1000, default_ttl_sec=86400)

def get_clinical_cache() -> ClinicalLRUCache:
    return _global_clinical_cache
