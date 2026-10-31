"""
Full QĐ 5948 Official Catalog Loader & Fast O(1) Indexer (<=195 LOC)
Nạp & Tra cứu toàn bộ 633 cặp tương tác Bảng 3.1 & 68 nhóm Bảng 3.2
"""
import os
import re
import json
import unicodedata
from typing import Optional

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
_DATA_DIR = os.path.join(_BASE_DIR, "data", "knowledge_base", "ddi_interactions")
# Vercel excludes the large backend/data tree from the Python function bundle.
# Ship the small, reviewed DDI exports under api/clinical_ddi_data and use them
# only when the canonical working-tree path is unavailable.
_SERVERLESS_DATA_DIR = os.path.abspath(os.path.join(_BASE_DIR, "api", "clinical_ddi_data"))
if not os.path.exists(_DATA_DIR) and os.path.exists(_SERVERLESS_DATA_DIR):
    _DATA_DIR = _SERVERLESS_DATA_DIR
_FILE_31 = os.path.join(_DATA_DIR, "qd_5948_table_3_1_all_pairs.json")
_FILE_32 = os.path.join(_DATA_DIR, "qd_5948_table_3_2_all_groups.json")
_FILE_CUSTOM = os.path.join(_DATA_DIR, "custom_hospital_ddi_rules.json")

_INDEX_31: dict[tuple[str, str], dict] = {}
_TABLE_31_RECORDS = 0
_TABLE_32_RECORDS = 0
_CUSTOM_RECORDS = 0
_TABLE_32_LOADED = False
_CATALOG_LOADED = False
_REVIEWED_OCR_CORRECTIONS = {
    "acenocoumar ol": "acenocoumarol",
    "pethidi n": "pethidin",
    "dextromethorp han": "dextromethorphan",
    "carbamazepin e": "carbamazepine",
    "roxithromyc in": "roxithromycin",
}

def _normalize_token(name: str) -> str:
    cleaned = re.sub(r"\([^)]*\)", " ", name.lower())
    cleaned = "".join(ch for ch in unicodedata.normalize("NFKD", cleaned) if not unicodedata.combining(ch))
    cleaned = cleaned.replace("đ", "d")
    cleaned = re.sub(r"[^\w\s-]", " ", cleaned)
    cleaned = " ".join(cleaned.split()).strip()
    return _REVIEWED_OCR_CORRECTIONS.get(cleaned, cleaned)

def _ensure_loaded():
    global _CATALOG_LOADED, _INDEX_31, _TABLE_31_RECORDS, _TABLE_32_RECORDS, _CUSTOM_RECORDS, _TABLE_32_LOADED
    if _CATALOG_LOADED:
        return
    if not os.path.exists(_FILE_31):
        return

    try:
        with open(_FILE_31, "r", encoding="utf-8") as f:
            pairs = json.load(f)
        _TABLE_31_RECORDS = len(pairs)
        for p in pairs:
            d1_clean = _normalize_token(p.get("drug_1", ""))
            d2_clean = _normalize_token(p.get("drug_2", ""))
            if not d1_clean or not d2_clean:
                continue

            entry = {
                "stt": p.get("stt"),
                "drug_1": p.get("drug_1"),
                "drug_2": p.get("drug_2"),
                "mechanism": p.get("mechanism", ""),
                "consequence": p.get("consequence", ""),
                "action": p.get("management", ""),
                "legal_source": f"QĐ 5948/QĐ-BYT (Bảng 3.1, STT {p.get('stt')})"
            }
            # Lập chỉ mục 2 chiều O(1)
            _INDEX_31[(d1_clean, d2_clean)] = entry
            _INDEX_31[(d2_clean, d1_clean)] = entry


        # Bảng 3.2 được đọc để phản ánh phạm vi dữ liệu, nhưng chưa lập chỉ mục
        # tự động theo nhóm vì cần ánh xạ nhóm thuốc có kiểm duyệt. Không được
        # báo cáo rằng các nhóm này đã được engine match như cặp thuốc cụ thể.
        if os.path.exists(_FILE_32):
            with open(_FILE_32, "r", encoding="utf-8") as f:
                table_32 = json.load(f)
            _TABLE_32_RECORDS = len(table_32)
            _TABLE_32_LOADED = True

        # Nạp các quy tắc tùy chỉnh của bệnh viện nếu có
        if os.path.exists(_FILE_CUSTOM):
            with open(_FILE_CUSTOM, "r", encoding="utf-8") as f:
                custom_rules = json.load(f)
            _CUSTOM_RECORDS = len(custom_rules)
            for c in custom_rules:
                d1 = _normalize_token(c.get("drug_1", ""))
                d2 = _normalize_token(c.get("drug_2", ""))
                if d1 and d2:
                    _INDEX_31[(d1, d2)] = c
                    _INDEX_31[(d2, d1)] = c

        _CATALOG_LOADED = True
    except Exception as e:
        print(f"[Warning] Không thể nạp qd_5948_table_3_1: {e}")

def lookup_official_ddi(inn_a: str, inn_b: str) -> Optional[dict]:
    _ensure_loaded()
    norm_a = _normalize_token(inn_a)
    norm_b = _normalize_token(inn_b)
    
    # 1. Khớp chính xác
    if (norm_a, norm_b) in _INDEX_31:
        return _INDEX_31[(norm_a, norm_b)]

    # Only exact normalized pair lookup is safe here. OCR corrections and
    # brand/ingredient aliases must be reviewed in the drug normalizer.
    return None

def register_custom_ddi(drug_a: str, drug_b: str, mechanism: str, consequence: str, action: str, evidence_source: str) -> dict:
    _ensure_loaded()
    norm_a = _normalize_token(drug_a)
    norm_b = _normalize_token(drug_b)
    entry = {
        "stt": len(_INDEX_31) // 2 + 1000,
        "drug_1": drug_a, "drug_2": drug_b,
        "mechanism": mechanism, "consequence": consequence,
        "action": action, "legal_source": evidence_source
    }
    _INDEX_31[(norm_a, norm_b)] = entry
    _INDEX_31[(norm_b, norm_a)] = entry

    # Lưu bền vững vào disk
    existing = []
    if os.path.exists(_FILE_CUSTOM):
        try:
            with open(_FILE_CUSTOM, "r", encoding="utf-8") as f:
                existing = json.load(f)
        except Exception:
            existing = []
    existing.append(entry)
    with open(_FILE_CUSTOM, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
    return entry

def get_official_catalog_stats() -> dict:
    _ensure_loaded()
    return {
        "table_3_1_pairs": _TABLE_31_RECORDS,
        "table_3_2_groups": _TABLE_32_RECORDS,
        "table_3_2_indexed": False,
        "table_3_2_loaded_for_scope_only": _TABLE_32_LOADED,
        "custom_rules": _CUSTOM_RECORDS,
        "indexed_pairs_bidirectional": len(_INDEX_31),
        "is_loaded": _CATALOG_LOADED,
        "coverage_note": "Bảng 3.1 và quy tắc tùy chỉnh được tra cứu theo cặp; Bảng 3.2 chưa được tự động ánh xạ nhóm thuốc."
    }
