"""
Dynamic Schema & Registry-Driven Drug Keyword Extractor.
Eliminates static dictionaries and hardcoded regex arrays.
Uses Structured Extraction (Pydantic V2), In-Memory Trie and Drug Registry.
"""
import re
from typing import Optional
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic

_INTENT_STOPWORDS = {
    "dùng", "dung", "uống", "uong", "tiêm", "tiem", "truyền", "truyen",
    "sao", "thế", "the", "nào", "nao", "là", "la", "gì", "gi", "cho",
    "khi", "có", "co", "được", "duoc", "không", "khong", "mấy", "may",
    "bao", "nhiêu", "nhieu", "viên", "vien", "liều", "lieu", "cách", "cach",
    "đó", "do", "này", "nay", "kia", "nó", "no", "thông", "tin", "tra", "cứu",
    "hỏi", "bác", "sĩ", "dược", "bệnh", "nhân", "cần", "xin", "vui", "lòng",
    "với", "và", "cùng", "về", "trị", "tri", "chữa", "chua",
    "tôi", "toi", "em", "anh", "chị", "chi", "mình", "minh", "thuốc", "thuoc"
}


_DISEASE_TERMS = {
    "ung thư", "ung thu", "ung bướu", "ung buou", "khối u", "khoi u",
    "đột quỵ", "dot quy", "tai biến", "tai bien", "sốt", "sot",
    "đau đầu", "dau dau", "đau bụng", "dau bung", "tiêu chảy", "tieu chay"
}


def extract_drug_keywords(query: str) -> str:
    """
    Trích xuất tên hoạt chất, biệt dược hoặc số đăng ký một cách động
    dựa trên Trie Matcher, Pydantic Schema Extractor và Drug Registry.
    """
    cleaned = (query or "").strip()
    if not cleaned:
        return ""

    matcher = get_drug_lexical_matcher()

    # 1. Trích xuất Số đăng ký (SĐK) Cục QLD (VD: VD-24757-16)
    sdk = matcher.extract_sdk(cleaned)
    if sdk:
        return sdk.upper()

    # 2. Schema-Driven extraction (Deterministic Trie / Pydantic fallback)
    schema_res = extract_clinical_query_schema_deterministic(cleaned)
    if schema_res.medications:
        med_names = []
        for m in schema_res.medications:
            name = m.canonical_id or m.surface_form
            # Bỏ thông tin hàm lượng (ví dụ: 1g, 500mg, 100ml)
            name = re.sub(
                r"\s+[0-9]+(?:[.,][0-9]+)?\s*(?:mg|mcg|g|ml|iu|unit|u|%|kg)?\b",
                "",
                name,
                flags=re.IGNORECASE,
            ).strip()
            if name:
                med_names.append(name.lower())
        if med_names:
            return " ".join(dict.fromkeys(med_names))

    # 3. Explicit candidate pattern: "thuốc/hoạt chất/biệt dược <Tên>"
    explicit_match = re.search(
        r"(?:thuốc|hoạt chất|biệt dược|thuoc|hoat chat|biet duoc)\s+([a-zA-Z0-9À-ỹ.-]+(?:\s+[a-zA-Z0-9À-ỹ.-]+){0,2})",
        cleaned,
        re.IGNORECASE,
    )
    if explicit_match:
        cand_raw = explicit_match.group(1).strip(" .")
        cand_raw = re.split(r"[.?!,;:]\s+", cand_raw)[0]
        cand_raw = re.sub(
            r"\s+[0-9]+(?:[.,][0-9]+)?\s*(?:mg|mcg|g|ml|iu|unit|u|%|kg)?\b",
            "",
            cand_raw,
            flags=re.IGNORECASE,
        ).strip()
        cand_words = [w for w in cand_raw.split() if w.lower() not in _INTENT_STOPWORDS]
        if cand_words:
            cand_clean = " ".join(cand_words)
            if cand_clean.lower() not in _DISEASE_TERMS:
                res = resolve_registered_medications(cand_clean)
                if res:
                    return " ".join(res)
                return cand_clean.lower()

    # 4. Direct In-Memory Trie Matcher
    meds = matcher.extract_medications(cleaned)
    if meds:
        clean_meds = [
            re.sub(
                r"\s+[0-9]+(?:[.,][0-9]+)?\s*(?:mg|mcg|g|ml|iu|unit|u|%|kg)?\b",
                "",
                m,
                flags=re.IGNORECASE,
            ).strip().lower()
            for m in meds
            if m
        ]
        clean_meds = [m for m in clean_meds if m]
        if clean_meds:
            return " ".join(dict.fromkeys(clean_meds))

    # 5. Canonical Drug Registry Resolution
    resolved = resolve_registered_medications(cleaned)
    if resolved:
        return " ".join(resolved)

    # 6. Fallback token extraction for typo & unknown drug CRAG verification
    tokens = [w.strip(" .,?!:;\"'") for w in cleaned.split() if len(w.strip(" .,?!:;\"'")) >= 2]
    clean_tokens = [w for w in tokens if w.lower() not in _INTENT_STOPWORDS]
    if clean_tokens:
        candidate_str = " ".join(clean_tokens).lower()
        if candidate_str not in _DISEASE_TERMS:
            return candidate_str

    return ""
