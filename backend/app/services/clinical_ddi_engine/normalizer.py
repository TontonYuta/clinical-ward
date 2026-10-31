"""
Hierarchical Drug Normalizer & Entity Resolution (<=195 LOC)
Chuyển đổi Biệt dược / Tên thương mại -> Canonical INN -> Phân loại Dược lý & Nguy cơ
"""
import re
import unicodedata
from typing import Optional
from app.services.clinical_ddi_engine.schemas import DrugEntity
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY

_STRIP_REGEX = re.compile(
    r"\b(\d+(\.\d+)?\s*(mg|g|ml|mcg|iu|ui|%|viên|ống|lọ|chai|túi|vỉ|tab|amp|vial))\b|"
    r"\b(uống|tiêm|truyền|tĩnh mạch|tiêm bắp|dưới da|đặt|iv|im|sc|po)\b",
    re.IGNORECASE
)

def _remove_vietnamese_accents(text: str) -> str:
    nfkd = unicodedata.normalize('NFKD', text)
    return ''.join([c for c in nfkd if not unicodedata.combining(c)]).replace('đ', 'd').replace('Đ', 'D')

def clean_drug_token(raw_name: str) -> str:
    cleaned = _STRIP_REGEX.sub(" ", raw_name.lower())
    cleaned = re.sub(r"[^\w\s-]", " ", cleaned)
    cleaned = " ".join(cleaned.split())
    return cleaned.strip()

def normalize_drug_entity(raw_name: str) -> DrugEntity:
    cleaned = clean_drug_token(raw_name)
    cleaned_no_accents = _remove_vietnamese_accents(cleaned)

    # 1. Tra cứu trực tiếp theo Canonical INN
    if cleaned in DRUG_REGISTRY:
        meta = DRUG_REGISTRY[cleaned]
        return _build_entity(raw_name, cleaned, meta)
    if cleaned_no_accents in DRUG_REGISTRY:
        meta = DRUG_REGISTRY[cleaned_no_accents]
        return _build_entity(raw_name, cleaned_no_accents, meta)

    # 2. Tra cứu theo Alias / Brand Name (Khớp chính xác từng token hoặc chuỗi)
    for inn, meta in DRUG_REGISTRY.items():
        for alias in meta.get("aliases", []):
            alias_no_accents = _remove_vietnamese_accents(alias.lower())
            if cleaned == alias.lower() or cleaned_no_accents == alias_no_accents:
                return _build_entity(raw_name, inn, meta, brand_matched=alias)

    # 3. Tra cứu theo Token/Substring trong trường hợp đơn kê ghép tên
    words = cleaned.split()
    words_no_accents = cleaned_no_accents.split()
    for inn, meta in DRUG_REGISTRY.items():
        for alias in meta.get("aliases", []):
            alias_clean = _remove_vietnamese_accents(alias.lower())
            if any(w == alias_clean for w in words_no_accents) or (len(alias_clean) >= 4 and alias_clean in cleaned_no_accents):
                return _build_entity(raw_name, inn, meta, brand_matched=alias)

    # Fallback cho hoạt chất chưa có trong từ điển
    return DrugEntity(
        raw_name=raw_name,
        canonical_inn=cleaned_no_accents or cleaned or raw_name.lower().strip(),
        display_name=raw_name.strip().title(),
        brand_matched=None,
        atc_classes=[],
        cyp_inhibitors=[],
        cyp_substrates=[],
        is_p_gp_inhibitor=False,
        is_p_gp_substrate=False,
        risk_flags=[]
    )

def _build_entity(raw_name: str, inn: str, meta: dict, brand_matched: Optional[str] = None) -> DrugEntity:
    return DrugEntity(
        raw_name=raw_name,
        canonical_inn=inn,
        display_name=meta.get("display", inn.capitalize()),
        brand_matched=brand_matched,
        atc_classes=list(meta.get("classes", [])),
        cyp_inhibitors=list(meta.get("cyp_inh", [])),
        cyp_substrates=list(meta.get("cyp_sub", [])),
        is_p_gp_inhibitor=bool(meta.get("p_gp_inh", False)),
        is_p_gp_substrate=bool(meta.get("p_gp_sub", False)),
        risk_flags=list(meta.get("risk", []))
    )
