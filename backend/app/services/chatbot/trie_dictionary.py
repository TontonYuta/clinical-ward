"""
Trie Dictionary & Lexical Exclusion Vocabulary for Hospital Drug Matching.
Hỗ trợ loại bỏ dấu tiếng Việt và lọc từ dừng không phải dược phẩm.
"""
import unicodedata
from typing import Dict, Optional, Set

def strip_accents(s: str) -> str:
    """Loại bỏ dấu tiếng Việt và chuẩn hóa chữ đ/Đ."""
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).lower()

class TrieNode:
    """Nút cây tiền tố Trie đa ký tự."""
    __slots__ = ("children", "is_end", "canonical", "entity_type")
    def __init__(self):
        self.children: Dict[str, "TrieNode"] = {}
        self.is_end: bool = False
        self.canonical: Optional[str] = None
        self.entity_type: Optional[str] = None

COMMON_EXCLUSIONS: Set[str] = {
    "tôi", "toi", "em", "anh", "chị", "chi", "mình", "minh", "bác", "bac", "sĩ", "si", "dược", "duoc",
    "muốn", "muon", "cần", "can", "xin", "cho", "hỏi", "hoi", "biết", "biet", "xem", "tra", "cứu", "cuu",
    "liều", "lieu", "viên", "vien", "an", "ăn", "va", "và", "với", "voi", "uống", "uong",
    "ngày", "ngay", "đau", "dau", "sốt", "sot", "bé", "be", "trẻ", "tre", "kho", "ca",
    "viện", "vien", "bệnh", "benh", "thuốc", "thuoc", "chống", "chong", "chỉ", "chi", "định", "dinh",
    "tác", "tac", "dụng", "dung", "phụ", "phu", "tương", "tuong", "một", "mot", "hai", "ba", "bốn", "năm",
    "khi", "no", "đói", "doi", "sáng", "sang", "tối", "toi", "trưa", "trua", "nước", "nuoc",
    "pha", "tiêm", "tiem", "truyền", "truyen", "nhỏ", "nho", "bôi", "boi", "dán", "dan", "đặt", "dat",
    "cách", "cach", "dùng", "dung", "thông", "tin", "thong", "tỏi", "nghệ", "cao", "lá", "củ",
    "nhất", "nhat", "nhát", "nhiều", "nhieu", "ít", "it", "nguy", "hiểm", "hiem", "tốt", "tot", "xấu", "xau",
    "tóm", "tom", "tắt", "tat", "tiết", "tiet", "đầy", "day", "đủ", "du", "hồ", "ho", "sơ", "so", "bản", "ban", "ghi", "toàn", "toan", "bộ", "bo",
    "ma", "mà", "đây", "day", "đó", "do", "kia", "co", "cơ", "la", "là", "nhung", "nhưng", "roi", "rồi", "the", "thế", "nao", "nào", "sao", "ay", "ấy", "nhi", "nhỉ", "ha", "hả", "chua", "chưa", "có", "khong", "không", "gi", "gì", "dau", "đâu", "lai", "lại", "qua", "quá", "bạn", "ban", "kém", "kem", "tệ", "te", "dở", "chán", "chan", "thật", "that",
    "trong", "ngoai", "ngoài", "tren", "trên", "duoi", "dưới", "giua", "giữa", "truoc", "trước", "sau", "hoac", "hoặc", "vi", "vì", "neu", "nếu", "thi", "thì", "nhu", "như", "rat", "rất", "lam", "lắm", "cung", "cùng", "kem", "kèm", "theo", "de", "để", "dang", "đang", "da", "đã", "se", "sẽ", "vua", "vừa", "moi", "mới", "tung", "từng", "hieu", "hiểu", "noi", "nói", "viet", "viết", "doc", "đọc", "gui", "gửi", "tra loi", "trả lời", "cau", "câu", "nut", "nút", "bam", "bấm",
    "nang", "năng", "gói", "goi", "ống", "ong", "chai", "lọ", "lo", "tuýp", "tuyp", "vỉ", "vi", "hộp", "hop", "chức", "chuc", "thận", "than", "gan", "tim",
    "gồm", "gom", "bao gồm", "bao gom", "đơn", "don", "đơn thuốc", "don thuoc", "kê", "ke",
    "huyết", "huyet", "áp", "ap", "đường", "duong", "khuẩn", "khuan", "thanh", "tinh", "chế", "che", "an thần", "an than", "kinh", "thần kinh", "than kinh", "thần",
    "đồng", "dong", "nghiệp", "nghiep", "kính", "kinh", "hỗ", "ho", "trợ", "tro", "chuyên", "chuyen", "môn", "mon", "hướng", "huong", "dẫn", "dan", "phác", "phac", "đồ", "do",
    "chuẩn", "chuan", "chi", "nhân", "nhan", "đối", "doi", "quy", "định", "dinh", "thông", "tư", "tu", "nghị", "nghi", "điều", "dieu", "khoa", "phòng", "phong", "toàn", "văn", "van",
    "mang", "gửi", "gui", "giảm", "giam", "loét", "loet", "nấm", "nam", "miệng", "mieng", "tai", "mũi", "họng", "hong", "khớp", "khop", "trĩ", "tri", "ngủ", "ngu",
    "đồng nghiệp", "dong nghiep", "kính gửi", "kinh gui", "tư vấn", "tu van", "chuyên môn", "chuyen mon", "hỗ trợ", "ho tro",
    "khan", "ho", "ho khan", "nhom", "nhóm", "đặc", "dac", "loãng", "loang", "bột", "bot", "tinh thể", "dung dịch", "hỗn dịch", "nhũ tương",
    "cứng", "cung", "cứng nhắc", "cung nhac", "mỗi", "moi", "mọi", "mai", "tương tác", "tuong tac", "tóm tắt", "tom tat",
    "thuốc đó", "thuoc do", "thuốc này", "thuoc nay", "thuốc kia", "thuoc kia", "thuốc trên", "thuoc tren",
    "thuốc ấy", "thuoc ay", "thuốc đấy", "thuoc day", "thuốc vừa nói", "thuoc vua noi", "thuốc vừa rồi", "thuoc vua roi", "thuốc nọ", "thuoc no"
}
