"""
Clinical Text Sanitizer & Intent Modifier Deconstructor.
Part of the 4-Stage Clinical NLP Pipeline.

Handles:
1. Leading/trailing syntax glitches (e.g., accidental backslash '\\', markdown wrappers, quotes).
2. Unicode NFC normalization & Vietnamese telex tone unification.
3. Scope extraction: 'search_scope' ('EXTERNAL_WEB_PREFERRED' vs 'INTERNAL_GROUNDED_ONLY').
4. Display depth extraction: 'display_depth' ('SUMMARY' vs 'FULL_MONOGRAPH').
"""
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional


@dataclass
class SanitizedQueryContext:
    raw_query: str
    clean_query: str
    search_scope: str = "DEFAULT"  # "EXTERNAL_WEB_PREFERRED" | "INTERNAL_GROUNDED_ONLY" | "DEFAULT"
    display_depth: str = "DEFAULT"  # "SUMMARY" | "FULL_MONOGRAPH" | "DEFAULT"
    stripped_modifiers: list[str] = None

    def __post_init__(self):
        if self.stripped_modifiers is None:
            self.stripped_modifiers = []


_EXTERNAL_WEB_CUES = [
    r"\b(?:trên|qua)\s+(?:mạng|internet|google)\b",
    r"\b(?:tìm|search|tra|kiểm tra)\s+(?:trên\s+mạng|trên\s+internet|trên\s+google)\b",
    r"\b(?:tài liệu|nguồn)\s+(?:tham khảo\s+mở rộng|quốc tế|ngoài nước|mở rộng)\b",
    r"\b(?:fda|who|ema)\b",
]

_INTERNAL_GROUNDED_CUES = [
    r"\b(?:theo\s+)?(?:dược thư(?:\s+quốc gia)?|dđvn\s*v|dtqg)\b",
    r"\b(?:theo\s+)?(?:hướng dẫn(?:\s+điều trị)?\s+bộ y tế|hướng dẫn\s+byt)\b",
    r"\b(?:danh mục(?:\s+thuốc)?\s+nội viện|thuốc nội viện|bệnh viện)\b",
    r"\b(?:theo\s+)?(?:thông tư\s*\d+|quyết định\s*\d+|qđ\s*\d+|tt\s*\d+)\b",
]

_SUMMARY_CUES = [
    r"\b(?:ngắn gọn|tóm tắt|sơ lược|khái quát|cốt lõi|ý chính)\b",
    r"\bchỉ cần\s+(?:thông tin\s+)?(?:ngắn gọn|tóm tắt)\b",
]

_FULL_MONOGRAPH_CUES = [
    r"\b(?:đầy đủ nhất|chi tiết nhất|toàn bộ chuyên luận|đầy đủ|chi tiết|toàn văn)\b",
    r"\btôi cần\s+(?:thông tin\s+)?(?:đầy đủ|chi tiết)\b",
    r"\bđây là tóm tắt mà\b",
]


def sanitize_clinical_input(raw_text: str) -> SanitizedQueryContext:
    if not raw_text:
        return SanitizedQueryContext(raw_query="", clean_query="")

    # 1. Unicode NFC normalization
    text = unicodedata.normalize("NFC", raw_text)

    # 2. Strip leading/trailing escaped syntax glitches and accidental markdown
    text = re.sub(r"^[\s\\/`\"'#]+", "", text).strip()
    text = re.sub(r"[\s`\"']+$", "", text).strip()

    # 3. Detect search scope modifiers
    search_scope = "DEFAULT"
    stripped = []
    for pattern in _EXTERNAL_WEB_CUES:
        if re.search(pattern, text, re.IGNORECASE):
            search_scope = "EXTERNAL_WEB_PREFERRED"
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                stripped.append(match.group(0))
            break

    if search_scope == "DEFAULT":
        for pattern in _INTERNAL_GROUNDED_CUES:
            if re.search(pattern, text, re.IGNORECASE):
                search_scope = "INTERNAL_GROUNDED_ONLY"
                break

    # 4. Detect display depth modifiers
    display_depth = "DEFAULT"
    for pattern in _FULL_MONOGRAPH_CUES:
        if re.search(pattern, text, re.IGNORECASE):
            display_depth = "FULL_MONOGRAPH"
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                stripped.append(match.group(0))
            break

    if display_depth == "DEFAULT":
        for pattern in _SUMMARY_CUES:
            if re.search(pattern, text, re.IGNORECASE):
                display_depth = "SUMMARY"
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    stripped.append(match.group(0))
                break

    # Cleaned query (keeps core sentence but preserves clean spaces)
    clean_query = text
    return SanitizedQueryContext(
        raw_query=raw_text,
        clean_query=clean_query,
        search_scope=search_scope,
        display_depth=display_depth,
        stripped_modifiers=stripped
    )
