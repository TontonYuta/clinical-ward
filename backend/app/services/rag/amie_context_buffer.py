"""
Google AMIE Conversational Context Buffer & Dynamic Clinical State Tracker.
Paper: Google AMIE (Tu et al., 2024 - "Towards Conversational Diagnostic AI", Nature / arXiv:2401.05654)
Quản lý bộ nhớ đệm hội thoại đa lượt, tự động trích xuất thực thể hoạt động không hardcode danh sách thuốc.
"""
import re
from typing import Optional, List, Dict, Any

CLINICAL_STOPWORDS = {
    "bác sĩ", "bác", "sĩ", "trợ lý", "trợ", "lý", "chào", "xin chào", "thông tin", "liều dùng", "tác dụng",
    "bệnh nhân", "người bệnh", "khoa", "phòng", "viện", "dược", "điều trị", "chuyên luận", "dưới đây",
    "chống chỉ định", "tương tác", "quản lý", "hướng dẫn", "ngày", "phối hợp", "kết hợp", "chỉ định",
    "người lớn", "trẻ em", "giảm đau", "hạ sốt", "kháng sinh", "chống viêm", "an toàn", "cặp", "đơn"
}

DEICTIC_CONTINUATION_MARKERS = (
    "nữa", "tiếp", "còn", "thêm", "nó", "thuốc này", "thuốc đó", "vừa rồi",
    "thì sao", "thế nào", "được không", "trẻ em", "cho bé", "cho con bú",
    "phụ nữ có thai", "suy thận", "suy gan", "kỵ", "kỵ nhau", "uống cùng", "dùng cùng", "mấy cặp"
)

class AMIEContextBuffer:
    """Bộ đệm ngữ cảnh hội thoại Google AMIE (Zero Hardcoded Drug List)."""

    @staticmethod
    def extract_recent_active_drug(history: str) -> Optional[str]:
        """Trích xuất thực thể thuốc hoạt động gần nhất từ dòng hội thoại dựa trên phân tích ngôn ngữ."""
        if not history or not history.strip():
            return None

        lines = history.strip().split("\n")
        # Quét ngược từ lượt gần nhất
        for line in reversed(lines):
            clean_line = line.strip()
            if not clean_line:
                continue

            # 1. Nhận diện cụm từ có tiền tố chỉ dẫn dược lý
            m_prefix = re.search(
                r"(?i:thuốc|hoạt chất|biệt dược|chuyên luận|thẩm định cho thuốc|về thuốc)\s+[*]{0,2}([A-Za-z0-9à-ỹÀ-ỸĐđ'\-]+)[*]{0,2}",
                clean_line
            )
            if m_prefix:
                cand = m_prefix.group(1).strip()
                if cand.lower() not in CLINICAL_STOPWORDS and len(cand) >= 3 and cand[0].isupper():
                    return cand

            # 2. Nhận diện danh từ riêng y dược viết hoa (Brand / INN candidates)
            tokens = re.findall(r"\b\w+\b", clean_line)
            for tok in tokens:
                if len(tok) >= 3 and tok[0].isupper() and tok.lower() not in CLINICAL_STOPWORDS:
                    return tok

        return None

    @staticmethod
    def is_deictic_continuation(query: str, history: str) -> bool:
        """Nhận diện câu hỏi có phụ thuộc ngữ cảnh hội thoại trước đó hay không."""
        clean_q = query.strip()
        lower_q = clean_q.lower()

        # Bỏ qua nếu là lệnh nghiệp vụ độc lập
        if any(op in lower_q for op in ("mở form", "kê đơn", "tạo đơn", "báo hỏng", "tủ trực", "giao ban", "kiểm kê")):
            return False

        # Nếu câu hỏi đã nêu rõ ca bệnh độc lập
        if any(p in lower_q for p in ("bệnh nhân", "người bệnh", "bn ")) and not any(term in lower_q for term in ("nó", "thuốc đó", "thuốc này")):
            return False

        if history.strip():
            if any(marker in lower_q for marker in DEICTIC_CONTINUATION_MARKERS):
                return True
            if len(clean_q.split()) <= 4:
                return True

        if any(term in lower_q for term in ("nó có", "thuốc đó", "thuốc này", "vừa hỏi", "vừa nói", "cặp nữa")):
            return True

        return False
