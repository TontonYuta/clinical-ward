"""Keyword and token extraction for clinical drug lookup (<=75 LOC)."""
import re
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.copilot_catalog import MEDICATION_CATALOG
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications

STOP_PHRASES = [
    "tôi muốn tra cứu thông tin về thuốc", "tôi muốn tra cứu thông tin thuốc", "tôi muốn tra cứu về thuốc", "tôi muốn tra cứu thuốc",
    "tôi muốn tìm thông tin về thuốc", "tôi muốn tìm thuốc", "tôi muốn hỏi thông tin về thuốc", "tôi muốn hỏi về thuốc",
    "làm ơn cho tôi biết thông tin về thuốc", "cho tôi biết thông tin về thuốc", "cho tôi hỏi thông tin về thuốc", "cho tôi hỏi về thuốc",
    "tìm giúp tôi thuốc", "kiểm tra giúp tôi thuốc", "tra cứu giúp tôi thuốc", "tra cứu thông tin về thuốc", "tra cứu thông tin thuốc",
    "thông tin về thuốc", "thông tin thuốc", "hỏi thông tin về thuốc", "hỏi về thuốc", "trong kho còn thuốc", "bệnh viện có thuốc",
    "danh mục thuốc", "danh sách thuốc", "có những loại thuốc nào", "dùng để làm gì", "có tác dụng gì", "dùng thế nào",
    "liều lượng", "liều dùng", "số đăng ký", "thuốc gì", "là thuốc gì", "cách dùng", "chỉ định", "tác dụng", "công dụng", "thành phần",
    "cho tôi", "cho em", "cho anh", "cho mình", "tôi cần", "em cần", "mình cần", "hãy cho", "lấy cho", "cần", "muốn", "lấy", "tìm",
    "bác sĩ", "dược sĩ", "điều dưỡng", "y tá", "hỏi chút", "hỏi thăm", "cho hỏi", "xin hỏi",
    "điều trị", "chữa trị", "trị bệnh", "chữa bệnh",
    "tuong tac thuoc", "tuong tac", "thong tin thuoc", "thong tin", "chong chi dinh", "tac dung phu", "lieu dung", "thanh phan", "chi dinh", "dieu tri",
    "thuốc", "về", "sđk", "mã", "html", "code", "website", "trị", "chữa", "uống", "còn liều", "liều",
    "dược thư quốc gia", "dược thư", "tra cứu dược thư", "tra cứu", "kiểm tra tương tác hai thuốc", "kiểm tra tương tác", "tương tác hai thuốc", "hai thuốc", "các thuốc",
    "kháng sinh", "khang sinh", "thuốc kháng sinh", "thuoc khang sinh",
    "thông tin chi tiết đầy đủ", "thông tin chi tiết", "thông tin đầy đủ",
    "thong tin chi tiet day du", "thong tin chi tiet", "thong tin day du",
    "chi tiết đầy đủ", "chi tiet day du", "toàn bộ thông tin", "toan bo thong tin",
    "tóm tắt thông tin thuốc đó", "tóm tắt thông tin thuốc này", "tóm tắt thông tin thuốc",
    "tóm tắt thông tin", "tóm tắt thuốc đó", "tóm tắt thuốc này", "tóm tắt thuốc", "tóm tắt",
    "tom tat thong tin thuoc do", "tom tat thong tin thuoc nay", "tom tat thong tin thuoc",
    "tom tat thong tin", "tom tat thuoc", "tom tat",
    "hồ sơ đầy đủ", "ho so day du", "hồ sơ chi tiết", "ho so chi tiet", "toàn bộ hồ sơ", "toan bo ho so",
    "thuốc cản quang", "tiêm thuốc cản quang", "cản quang", "chụp ct", "chụp mri", "chụp x-quang", "nồng độ đáy", "nồng độ đỉnh", "trough level", "trough", "peak", "định lượng"
]

QUESTION_TERMS = {
    "tác", "dụng", "phụ", "không", "mong", "muốn", "tương", "thành", "phần",
    "của", "thuốc", "này", "đó", "là", "gì", "thế", "nào", "bao", "nhiêu", "hoạt", "chất",
    "thời", "gian", "bán", "thải", "tối", "đa", "huyết", "tương", "còn",
    "có", "hay", "hoặc", "bị", "cho", "đang", "được", "những", "các", "loại", "nhóm", "khác", "chi",
    "chống", "chỉ", "định", "cách", "dùng", "liều", "lượng", "và", "với", "cùng", "trong", "khi",
    "tôi", "em", "anh", "chị", "mình", "bạn", "hỏi", "cần", "xin", "giúp", "biết", "xem", "làm", "ơn",
    "bác", "sĩ", "dược", "chút", "nhé", "ạ", "ơi", "nha", "với", "à",
    "điều", "trị", "chữa", "bệnh", "sao",
    "kỵ", "kị", "ky", "ki", "kỵ thuốc",
    "sáng", "trưa", "chiều", "tối", "đêm", "ngày", "tuần", "tháng", "năm", "lần", "giờ", "phút",
    "gây", "nghiện", "lệ", "thuộc", "đó", "này", "kia", "ấy", "nó",
    "kiểm", "tra", "nhân", "người", "an", "toàn", "dị", "ứng", "đơn", "theo", "dõi", "xét", "nghiệm",
    "inj", "tab", "caps", "cap", "cream", "gel", "susp", "sol", "drops", "injection", "tablet", "infusion",
    "tac", "dung", "phu", "chong", "chi", "dinh", "lieu", "luong", "tuong", "thanh", "phan", "hoat", "chat", "toi", "da", "thong", "tin", "thuoc",
    "tại", "tai", "ở", "từ", "đến", "vào", "ra", "lên", "xuống", "về", "qua", "theo", "do", "bởi", "giữa",
    "tăng", "tang", "giảm", "giam", "hạ", "ha", "cao", "thấp",
    "huyết", "áp", "tim", "mạch", "thận", "gan", "phổi", "phế", "quản", "dạ", "dày", "não", "máu", "đường",
    "hen", "sốt", "đau", "loét", "viêm", "khuẩn", "nhiễm", "sốc", "phản", "vệ", "đột", "quỵ", "ung", "thư", "hạch", "co", "thắt", "giãn",
    "thai", "phụ", "nữ", "trẻ", "sơ", "sinh", "lớn", "già", "bé",
    "quy", "chế", "quản", "lý", "tủ", "trực", "kho", "ca", "viện",
    "uống", "tiêm", "truyền", "bôi", "nhỏ", "đặt", "uong", "tiem", "truyen", "thông", "tin",
    "quốc", "quoc", "gia", "hai", "thư", "thu", "cản", "quang", "ct", "mri", "ăn", "an", "no", "đói", "doi", "trước", "truoc", "sau", "bữa", "bua", "kháng", "khang",
    "tóm", "tắt", "tom", "tat", "tiết", "tiet", "đầy", "đủ", "day", "du", "hồ", "sơ", "ho", "so", "toàn", "bộ", "toan", "bo"
}


def extract_drug_keywords(query: str) -> str:
    cleaned = (query or "").strip()
    cleaned = re.sub(r"\s*\([^)]*\)", " ", cleaned)
    sdk_match = re.search(r"((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)", cleaned, re.IGNORECASE)
    if sdk_match:
        return sdk_match.group(1).upper()

    # Direct pattern: "thuốc/hoạt chất/biệt dược <TênThuốc>"
    if re.search(r"^(?:thuốc|thuoc)\s+(?:đó|này|kia|ấy|nó|vừa nói|vừa hỏi)\b", cleaned, re.IGNORECASE):
        explicit_med_pattern = None
    else:
        explicit_med_pattern = re.search(r"(?:thuốc|hoạt chất|biệt dược|thuoc|hoat chat|biet duoc)\s+([a-zA-Z0-9À-ỹ.-]+(?:\s+[a-zA-Z0-9À-ỹ.-]+){0,2})", cleaned, re.IGNORECASE)
    if explicit_med_pattern:
        cand_name = explicit_med_pattern.group(1).strip(" .")
        cand_name = re.split(r"[.?!,;:]\s+", cand_name)[0]
        cand_name = re.sub(r"[0-9]+(?:[.,][0-9]+)?\s*(?:mg|mcg|g|ml|iu|unit|u|%|kg)?", " ", cand_name, flags=re.IGNORECASE).strip()
        cand_words = [w.lower() for w in cand_name.split() if w.lower() not in QUESTION_TERMS and len(w) >= 2]
        if cand_words:
            return " ".join(cand_words).lower()

    q_lower = cleaned.lower()
    q_lower = re.sub(
        r"\b(?:thông tin|tra cứu|thuốc|gồm|bao gồm|liều dùng|liều lượng|liều tối đa|còn liều|cách dùng|tác dụng phụ|tác dụng không mong muốn|chống chỉ định|chỉ định|công dụng|thành phần|hoạt chất|tương tác|dùng|cho|bệnh|nào|và|với|cùng|kết hợp|phối hợp|uống|thế|như|nhiêu|nào|của|về|là|gì|thì|còn|liều|điều trị|chữa trị|điều|trị|chữa|thong tin|tra cuu|thuoc|lieu dung|lieu luong|lieu toi da|con lieu|cach dung|tac dung phu|tac dung khong mong muon|chong chi dinh|chi dinh|cong dung|thanh phan|hoat chat|tuong tac|dieu tri|chua tri|tóm tắt|tom tat|tóm|tắt|chi tiết|chi tiet|đầy đủ|day du|hồ sơ|ho so|toàn bộ|toan bo)\b",
        " ", q_lower,
    )
    q_lower = re.sub(r"[0-9]+(?:[.,][0-9]+)?\s*(?:mg|mcg|g|ml|iu|unit|u|%|kg)?", " ", q_lower, flags=re.IGNORECASE)
    q_lower = re.sub(
        r"(?:nếu|suy thận|suy gan|egfr|crcl|creatinin|chỉnh|hiệu chỉnh|liều|mỗi ngày|mỗi tuần|theo dõi|xét nghiệm|nào|hạ kali|nổi ban|phát ban|đau đầu|buồn nôn|sao|thì|ra sao|thế nào)",
        " ", q_lower,
    )
    q_lower = re.sub(
        r"\b(?:xử trí|nguy cơ|bệnh nhân|người bệnh|có|không|thì|thế nào|ra sao|nếu|theo dõi|xét nghiệm|kỵ|kị|ky|ki|inj|tab|caps|cap|cream|gel|susp|sol|drops|injection|tablet|infusion)\b",
        " ", q_lower, flags=re.IGNORECASE,
    )

    aliases = [alias for med in MEDICATION_CATALOG for alias in med["keywords"]]
    aliases.extend(alias for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", []))
    aliases = sorted(set(aliases), key=len, reverse=True)
    found = [alias for alias in aliases if len(alias) >= 2 and bool(re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", q_lower))]
    unique_found = [alias for alias in found if not any(alias != other and alias in other for other in found)]

    named_tail = re.search(r"(?:thuốc|hoạt chất)\s+([\wÀ-ỹ-]+(?:\s+[\wÀ-ỹ-]+){0,2})\s*$", q_lower)
    if named_tail:
        tail_entities = resolve_registered_medications(named_tail.group(1))
        if tail_entities:
            return " ".join(tail_entities)
    if unique_found:
        return " ".join(dict.fromkeys(unique_found))
    resolved = resolve_registered_medications(q_lower)
    if resolved:
        return " ".join(resolved)

    for phrase in sorted(STOP_PHRASES, key=len, reverse=True):
        q_lower = q_lower.replace(phrase, " ")
    words = [w.strip(" .,?!:;\"'") for w in q_lower.split() if len(w.strip(" .,?!:;\"'")) >= 2]
    words = [word for word in words if word not in QUESTION_TERMS]
    return " ".join(words).strip().lower()
