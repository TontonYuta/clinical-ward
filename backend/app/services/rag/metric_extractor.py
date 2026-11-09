"""
Structured Lab Metric & Demographic Extractor (Kỹ thuật 9).
Bóc tách định lượng chỉ số xét nghiệm lâm sàng (ClCr, eGFR, Creatinine, AST, ALT, Kali, INR) và tuổi/thể trọng.
"""
import re
from typing import Optional, Tuple, List
from pydantic import BaseModel, Field

class LabMetrics(BaseModel):
    clcr: Optional[float] = Field(default=None, description="Hệ số thanh thải Creatinine (ml/phút)")
    egfr: Optional[float] = Field(default=None, description="Mức lọc cầu thận ước tính (ml/phút/1.73m2)")
    creatinine: Optional[float] = Field(default=None, description="Creatinine huyết thanh (micromol/L)")
    potassium: Optional[float] = Field(default=None, description="Kali máu (mmol/L)")
    ast: Optional[float] = Field(default=None, description="Men gan AST/GOT (U/L)")
    alt: Optional[float] = Field(default=None, description="Men gan ALT/GPT (U/L)")
    inr: Optional[float] = Field(default=None, description="Chỉ số đông máu INR")

def extract_clcr_or_egfr(text: str) -> Optional[float]:
    """Trích xuất giá trị định lượng ClCr hoặc eGFR từ văn bản ca bệnh (trực tiếp hoặc tính toán từ Cockcroft-Gault)."""
    m = re.search(r"\b(?:clcr|egfr|crcl)\s*(?:dưới|<|<=|=|là|khoảng|:)?\s*([0-9]+(?:\.[0-9]+)?)\b", text, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    if any(term in text.casefold() for term in ("clcr dưới 30", "clcr < 30", "egfr < 30", "suy thận nặng")):
        return 25.0

    # Tính toán chính xác theo công thức Cockcroft-Gault nếu có đủ thông số tuổi, cân nặng, creatinin
    try:
        from app.services.clinical_reasoning.patient_dose_reasoner import extract_patient_clinical_slots
        from app.services.clinical_reasoning.clinical_math_engine import calculate_cockcroft_gault
        slots = extract_patient_clinical_slots(text)
        if slots.get("age") is not None and slots.get("weight_kg") is not None and slots.get("creatinine_val") is not None:
            assessment = calculate_cockcroft_gault(
                age=slots["age"],
                weight_kg=slots["weight_kg"],
                serum_creatinine=slots["creatinine_val"],
                is_female=slots.get("is_female", False),
                creatinine_unit=slots.get("creatinine_unit", "umol/L")
            )
            return assessment.crcr_ml_min if hasattr(assessment, "crcr_ml_min") else assessment.crcl_ml_min
    except Exception:
        pass

    return None

def extract_clinical_metrics(text: str) -> LabMetrics:
    """Trích xuất đa chỉ số cận lâm sàng từ lời kể ca bệnh."""
    clcr_val = extract_clcr_or_egfr(text)

    # Trích xuất Kali (K+)
    k_match = re.search(r"\b(?:k\+|kali)\s*(?:=|là|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:mmol/l|meq/l)?\b", text, re.IGNORECASE)
    potassium_val = float(k_match.group(1)) if k_match else None

    # Trích xuất INR
    inr_match = re.search(r"\binr\s*(?:=|là|:)?\s*([0-9]+(?:\.[0-9]+)?)\b", text, re.IGNORECASE)
    inr_val = float(inr_match.group(1)) if inr_match else None

    # Trích xuất Creatinine
    cr_match = re.search(r"\bcreatinin(?:e)?\s*(?:=|là|:)?\s*([0-9]+(?:\.[0-9]+)?)\b", text, re.IGNORECASE)
    cr_val = float(cr_match.group(1)) if cr_match else None

    return LabMetrics(
        clcr=clcr_val,
        egfr=clcr_val,
        potassium=potassium_val,
        inr=inr_val,
        creatinine=cr_val
    )

def _canonicalize_meds(med_list: List[str]) -> List[str]:
    """Ánh xạ biệt dược sang hoạt chất quốc tế INN chuẩn hóa từ DRUG_REGISTRY."""
    from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
    from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
    canonical: List[str] = []
    for item in med_list:
        resolved = resolve_registered_medications(item)
        if resolved:
            canonical.extend(resolved)
        else:
            for k, v in DRUG_REGISTRY.items():
                if k in item or any(a in item for a in v.get("aliases", [])):
                    canonical.append(k)
                    break
    return list(dict.fromkeys(canonical))

def partition_current_and_proposed_meds(query: str) -> Tuple[List[str], List[str]]:
    """Phân tách danh mục thuốc đang dùng và thuốc mới dự định kê thêm."""
    q_low = query.lower()
    split_markers = ["kê thêm", "cho thêm", "định cho", "định kê", "thêm", "bổ sung", "kết hợp thêm"]

    current_text = q_low
    proposed_text = ""

    for marker in split_markers:
        if marker in q_low:
            parts = q_low.split(marker, 1)
            current_text = parts[0]
            proposed_text = parts[1]
            break

    from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
    from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
    matcher = get_drug_lexical_matcher()

    raw_curr = resolve_registered_medications(current_text) + [m.lower() for m in matcher.extract_medications(current_text)]
    current_meds = _canonicalize_meds(raw_curr)

    if proposed_text:
        raw_prop = resolve_registered_medications(proposed_text) + [m.lower() for m in matcher.extract_medications(proposed_text)]
        proposed_meds = _canonicalize_meds(raw_prop)
    else:
        proposed_meds = []

    # Clean duplicates across lists
    current_meds = [m for m in current_meds if m not in proposed_meds]
    return current_meds, proposed_meds
