"""
Dynamic INN Bridge & Deep Fragment Grounding.
Kết nối động 55.000 biệt dược Cục QLD (DAV) với Chuyên luận Dược Thư Quốc Gia Việt Nam (DĐVN V),
đồng thời phân giải số trang cấp tiểu mục và sinh URL W3C Text Fragment.
Không sử dụng hardcode tĩnh; hoạt động 100% dựa trên schema và giải thuật chuẩn hóa INN.
"""
from __future__ import annotations

import re
import json
import urllib.parse
from typing import Any, Dict, Optional, Tuple
from app.services.active_ingredient_normalizer import extract_candidate_inns, clean_key
from app.services.rag.source_resolver import load_source_documents, BRAND_TO_INN, _strip_accents

FIELD_SECTION_MAPPING: dict[str, list[str]] = {
    "renal_adjustment": ["renal", "suy thận", "thận", "clcr", "egfr", "creatinin", "lọc máu", "chạy thận"],
    "adverse_effects": ["adverse", "adr", "tác dụng phụ", "tác dụng không mong muốn", "tai biến", "dị ứng"],
    "dosage": ["dosage", "liều", "cách dùng", "uống", "tiêm", "truyền", "adult", "pediatric", "trẻ em", "người lớn"],
    "drug_interactions": ["interaction", "tương tác", "phối hợp", "uống cùng", "kỵ"],
    "contraindications": ["contraindication", "chống chỉ định", "không dùng", "cấm dùng"],
    "indications": ["indication", "chỉ định", "điều trị", "công dụng", "chữa"],
    "precautions": ["precaution", "thận trọng", "lưu ý", "cảnh báo"],
    "overdose_treatment": ["overdose", "quá liều", "ngộ độc", "xử trí quá liều", "giải độc", "antidote"],
}


def resolve_drug_to_monograph(
    drug_or_name: Any,
    active_ingredient: str = ""
) -> Optional[Dict[str, Any]]:
    """
    Ánh xạ động từ thực thể thuốc DAV (hoặc tên biệt dược/hoạt chất) sang chuyên luận DĐVN V.
    1. Tra cứu trực tiếp từ Brand to INN mapping.
    2. Chuẩn hóa hoạt chất qua thuật toán bóc tách muối/hàm lượng (extract_candidate_inns).
    3. Tra cứu theo chỉ mục by_inn và token_map.
    """
    sources, by_inn, token_map = load_source_documents()
    if not by_inn:
        return None

    brand = ""
    active = active_ingredient

    if hasattr(drug_or_name, "brand_name"):
        brand = getattr(drug_or_name, "brand_name") or ""
        if not active and hasattr(drug_or_name, "active_ingredient"):
            active = getattr(drug_or_name, "active_ingredient") or ""
    elif isinstance(drug_or_name, dict):
        brand = drug_or_name.get("brand_name") or drug_or_name.get("title") or ""
        if not active:
            active = drug_or_name.get("active_ingredient") or drug_or_name.get("inn") or ""
    elif isinstance(drug_or_name, str):
        if not active:
            active = drug_or_name
        brand = drug_or_name

    # 1. Khớp theo Brand Name nếu có trong BRAND_TO_INN
    if brand:
        b_clean = brand.strip().lower().split()[0]
        if b_clean in BRAND_TO_INN:
            mapped_inn = BRAND_TO_INN[b_clean]
            mono = by_inn.get(mapped_inn) or by_inn.get(_strip_accents(mapped_inn))
            if mono:
                return mono

    # 2. Khớp trực tiếp active_ingredient
    if active:
        clean_act = active.strip().casefold()
        unacc_act = _strip_accents(clean_act)
        if clean_act in by_inn:
            return by_inn[clean_act]
        if unacc_act in by_inn:
            return by_inn[unacc_act]

        # 3. Bóc tách muối, hàm lượng, dạng phối hợp
        candidates = extract_candidate_inns(active)
        for cand in candidates:
            c_low = cand.strip().casefold()
            c_unacc = _strip_accents(c_low)
            if c_low in by_inn:
                return by_inn[c_low]
            if c_unacc in by_inn:
                return by_inn[c_unacc]
            if c_low in token_map:
                return token_map[c_low]

    return None


def get_monograph_section_page(
    monograph: Any,
    requested_field: Optional[str] = None,
    query: str = ""
) -> Tuple[Optional[int], Optional[str]]:
    """
    Xác định số trang chính xác cho một tiểu mục cụ thể trong chuyên luận Dược Thư.
    Returns: (page_number, resolved_section_name)
    """
    if not monograph:
        return None, None

    sec_pages: dict[str, int] = {}
    if hasattr(monograph, "section_pages"):
        val = getattr(monograph, "section_pages")
        if isinstance(val, dict):
            sec_pages = val
        elif isinstance(val, str) and val.strip():
            try:
                sec_pages = json.loads(val)
            except Exception:
                sec_pages = {}
    elif isinstance(monograph, dict):
        val = monograph.get("section_pages")
        if isinstance(val, dict):
            sec_pages = val
        elif isinstance(val, str) and val.strip():
            try:
                sec_pages = json.loads(val)
            except Exception:
                sec_pages = {}

    start_page = getattr(monograph, "start_page", None) if hasattr(monograph, "start_page") else (monograph.get("start_page") if isinstance(monograph, dict) else None)
    if start_page is not None:
        try:
            start_page = int(start_page)
        except (ValueError, TypeError):
            start_page = None

    if not sec_pages:
        return start_page, None

    # Tìm tiểu mục phù hợp nhất dựa trên requested_field hoặc query
    context_pool = f"{requested_field or ''} {query or ''}".casefold()
    target_section: Optional[str] = None

    for sec_name, keywords in FIELD_SECTION_MAPPING.items():
        if any(kw in context_pool for kw in keywords):
            target_section = sec_name
            break

    if target_section and target_section in sec_pages:
        return sec_pages[target_section], target_section

    # Nếu hỏi liều người lớn / nhi khoa nhưng không có mục riêng -> fallback về dosage
    if target_section in ("adult_dosage", "pediatric_dosage") and "dosage" in sec_pages:
        return sec_pages["dosage"], "dosage"

    return start_page, None


def build_w3c_text_fragment_url(
    base_url: str,
    page: Optional[int],
    excerpt: Optional[str]
) -> str:
    """
    Tạo URL W3C Text Fragment trỏ thẳng đến câu văn bằng chứng trên PDF Viewer.
    Định dạng: /pdf/Duoc_Thu.pdf#page=1120:~:text=prefix,suffix
    """
    if not base_url:
        return ""

    url_no_hash = base_url.split("#")[0]
    hash_parts = []
    if page:
        hash_parts.append(f"page={page}")

    if excerpt and len(excerpt.strip()) >= 10:
        clean = re.sub(r"[^\w\s\d,.-]", "", excerpt).strip()
        words = clean.split()
        if len(words) >= 6:
            prefix = " ".join(words[:3])
            suffix = " ".join(words[-3:])
            frag = f":~:text={urllib.parse.quote(prefix)},{urllib.parse.quote(suffix)}"
            hash_parts.append(frag)
        elif words:
            phrase = " ".join(words)
            frag = f":~:text={urllib.parse.quote(phrase)}"
            hash_parts.append(frag)

    if not hash_parts:
        return url_no_hash

    # Nếu có cả page và text fragment, cú pháp W3C hợp lệ là: #page=1120:~:text=...
    if len(hash_parts) == 2 and hash_parts[1].startswith(":~:"):
        return f"{url_no_hash}#{hash_parts[0]}{hash_parts[1]}"
    elif len(hash_parts) == 1:
        prefix_char = "" if hash_parts[0].startswith("page=") or hash_parts[0].startswith(":~:") else ""
        return f"{url_no_hash}#{hash_parts[0]}"
    return f"{url_no_hash}#{'&'.join(hash_parts)}"
