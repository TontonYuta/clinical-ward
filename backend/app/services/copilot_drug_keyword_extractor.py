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
    "thuốc", "về", "sđk", "mã", "html", "code", "website", "trị", "chữa", "uống", "còn liều", "liều"
]

QUESTION_TERMS = {
    "tác", "dụng", "phụ", "không", "mong", "muốn", "tương", "thành", "phần",
    "của", "thuốc", "này", "đó", "là", "gì", "thế", "nào", "bao", "nhiêu", "hoạt", "chất",
    "thời", "gian", "bán", "thải", "tối", "đa", "huyết", "tương", "còn",
    "có", "hay", "hoặc", "bị", "cho", "đang", "được", "những", "các", "loại", "nhóm", "khác", "chi",
    "chống", "chỉ", "định", "cách", "dùng", "liều", "lượng", "và", "với", "cùng", "trong", "khi",
    "tôi", "em", "anh", "chị", "mình", "bạn", "hỏi", "cần", "xin", "giúp", "biết", "xem", "làm", "ơn"
}


def extract_drug_keywords(query: str) -> str:
    cleaned = (query or "").strip()
    sdk_match = re.search(r"((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)", cleaned, re.IGNORECASE)
    if sdk_match:
        return sdk_match.group(1).upper()

    q_lower = cleaned.lower()
    q_lower = re.sub(
        r"\b(?:thông tin|tra cứu|thuốc|gồm|bao gồm|liều dùng|liều lượng|liều tối đa|còn liều|cách dùng|tác dụng phụ|tác dụng không mong muốn|chống chỉ định|chỉ định|công dụng|thành phần|hoạt chất|tương tác|dùng|cho|bệnh|nào|và|với|cùng|kết hợp|phối hợp|uống|thế|như|nhiêu|nào|của|về|là|gì|thì|còn|liều)\b",
        " ", q_lower,
    )
    q_lower = re.sub(r"[0-9]+(?:[.,][0-9]+)?\s*(?:mg|mcg|g|ml|iu|unit|u|%)?", " ", q_lower, flags=re.IGNORECASE)
    q_lower = re.sub(
        r"(?:nếu|suy thận|suy gan|egfr|crcl|creatinin|chỉnh|hiệu chỉnh|liều|mỗi ngày|mỗi tuần|theo dõi|xét nghiệm|nào|hạ kali|nổi ban|phát ban|đau đầu|buồn nôn|sao|thì|ra sao|thế nào)",
        " ", q_lower,
    )
    q_lower = re.sub(
        r"\b(?:xử trí|nguy cơ|bệnh nhân|người bệnh|có|không|thì|thế nào|ra sao|nếu|theo dõi|xét nghiệm)\b",
        " ", q_lower, flags=re.IGNORECASE,
    )

    aliases = [alias for med in MEDICATION_CATALOG for alias in med["keywords"]]
    aliases.extend(alias for entry in DRUG_REGISTRY.values() for alias in entry.get("aliases", []))
    aliases = sorted(set(aliases), key=len, reverse=True)
    found = [alias for alias in aliases if alias in q_lower]
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
    return " ".join(words).strip()
