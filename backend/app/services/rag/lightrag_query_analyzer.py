"""
LightRAG Dual-Level Query Analyzer (Chuẩn LightRAG: Section 3.2).
Paper: LightRAG: Simple and Fast Retrieval-Augmented Generation (Guo et al., 2024 / arXiv:2410.05779).
Phân tách truy vấn lâm sàng thành 2 tầng từ khóa độc lập:
1. Low-Level Keywords: Thực thể vi mô (Tên thuốc INN, biệt dược, liều lượng, số đăng ký, dạng dùng).
2. High-Level Keywords: Khái niệm vĩ mô (Nhóm dược lý ATC, con đường chuyển hóa CYP, cơ chế bệnh sinh, rủi ro cơ quan).
"""
import re
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Any
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
from app.services.chatbot.lexical_trie_matcher import get_drug_lexical_matcher
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.rag.lightrag_data import (
    PHARMACOLOGICAL_CLASS_TAXONOMY,
    ORGAN_CONDITION_HIERARCHY,
    THERAPEUTIC_ALTERNATIVE_MAP
)

@dataclass
class DualLevelKeywords:
    query: str
    low_level_keywords: List[str] = field(default_factory=list)
    high_level_keywords: List[str] = field(default_factory=list)
    identified_drugs: List[str] = field(default_factory=list)
    identified_classes: List[str] = field(default_factory=list)
    clinical_domains: List[str] = field(default_factory=list)
    patient_metrics: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "low_level_keywords": self.low_level_keywords,
            "high_level_keywords": self.high_level_keywords,
            "identified_drugs": self.identified_drugs,
            "identified_classes": self.identified_classes,
            "clinical_domains": self.clinical_domains,
            "patient_metrics": self.patient_metrics,
        }

def analyze_dual_level_query(query: str, patient_info: Optional[Dict[str, Any]] = None) -> DualLevelKeywords:
    """
    Phân tích và bóc tách câu truy vấn thành 2 tầng từ khóa chuẩn LightRAG.
    Zero-hardcode: Dựa vào từ điển dược lý ATC, trie matcher, và biểu thức quy chuẩn lâm sàng.
    """
    clean_query = query.strip()
    lower_q = clean_query.casefold()

    low_kws: Set[str] = set()
    high_kws: Set[str] = set()
    identified_drugs: List[str] = []
    identified_classes: List[str] = []
    clinical_domains: Set[str] = set()
    metrics: Dict[str, Any] = {}

    # =========================================================================
    # 1. BÓC TÁCH THÔNG SỐ BỆNH NHÂN (Patient Metrics)
    # =========================================================================
    # Cân nặng
    weight_match = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:kg|cân nặng|kí)", lower_q)
    if weight_match:
        metrics["weight_kg"] = float(weight_match.group(1).replace(",", "."))
        low_kws.add(f"{metrics['weight_kg']}kg")

    # Tuổi
    age_match = re.search(r"(\d+)\s*(?:tuổi|tháng tuổi|tháng)", lower_q)
    if age_match:
        metrics["age"] = int(age_match.group(1))
        low_kws.add(f"{metrics['age']} tuổi")

    # Chức năng thận eGFR / ClCr
    gfr_match = re.search(r"(?:clcr|egfr|gfr)\s*(?:dưới|<|<=|=)?\s*(\d+(?:[.,]\d+)?)", lower_q)
    if gfr_match:
        metrics["egfr"] = float(gfr_match.group(1).replace(",", "."))
        low_kws.add(f"eGFR {metrics['egfr']}")
        high_kws.add("suy thận")
        high_kws.add("chức năng thận")
        clinical_domains.add("renal_impairment")

    if patient_info:
        for k, v in patient_info.items():
            if v is not None and k not in metrics:
                metrics[k] = v

    # =========================================================================
    # 2. LOW-LEVEL KEYWORDS: Thực thể thuốc cụ thể & Liều dùng
    # =========================================================================
    # A. Nhận diện thuốc qua Trie & Entity Resolution
    trie_drugs = get_drug_lexical_matcher().extract_medications(clean_query)
    resolved_drugs = resolve_registered_medications(clean_query)
    all_drug_tokens = list(dict.fromkeys(trie_drugs + resolved_drugs))

    for d in all_drug_tokens:
        clean_d = d.strip()
        if len(clean_d) >= 2:
            identified_drugs.append(clean_d)
            low_kws.add(clean_d)

    # B. Số đăng ký thuốc (SĐK)
    sdk_match = re.findall(r"\b((?:vn|vd|gc|qlsp|vs)-[0-9]+-[0-9]+)\b", lower_q)
    for sdk in sdk_match:
        low_kws.add(sdk.upper())

    # C. Hàm lượng & Dạng dùng vi mô (mg, g, ml, viên, tiêm)
    strength_matches = re.findall(r"\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|iu|đv)\b", lower_q)
    for s in strength_matches:
        low_kws.add(s)

    # D. Tiểu mục lâm sàng cụ thể
    if any(k in lower_q for k in ("liều", "uống", "tiêm", "truyền", "cách dùng", "liều lượng")):
        clinical_domains.add("dosage")
        low_kws.add("liều lượng")
    if any(k in lower_q for k in ("chống chỉ định", "không được dùng", "kiêng cữ", "dị ứng")):
        clinical_domains.add("contraindication")
        low_kws.add("chống chỉ định")
    if any(k in lower_q for k in ("tác dụng phụ", "tác dụng không mong muốn", "adr", "tác dụng bất lợi")):
        clinical_domains.add("adverse_effect")
        low_kws.add("tác dụng không mong muốn")

    # =========================================================================
    # 3. HIGH-LEVEL KEYWORDS: Nhóm Dược lý ATC, Con đường chuyển hóa & Bệnh học
    # =========================================================================
    # A. Nhận diện nhóm ATC từ câu hỏi hoặc từ các thuốc đã nhận diện
    for class_key, class_info in PHARMACOLOGICAL_CLASS_TAXONOMY.items():
        name_vi = class_info.get("name_vi", "")
        keywords = class_info.get("keywords", [])
        members = class_info.get("members", [])

        # Kiểm tra nếu câu hỏi nhắc trực tiếp nhóm hoặc thuốc thuộc nhóm
        class_hit = any(kw in lower_q for kw in keywords)
        member_hit = any(d.lower() in members for d in identified_drugs)

        if class_hit or member_hit:
            identified_classes.append(class_key)
            high_kws.add(class_key)
            if name_vi:
                high_kws.add(name_vi)
            # Bổ sung cơ chế chuyển hóa men gan vĩ mô nếu có
            if "primary_metabolism" in class_info:
                high_kws.add(class_info["primary_metabolism"])
            if "cyp_inhibition" in class_info:
                high_kws.add(class_info["cyp_inhibition"])

    # B. Nhận diện miền tương tác thuốc vĩ mô
    if any(k in lower_q for k in ("tương tác", "phối hợp", "dùng cùng", "uống chung", "kết hợp", "cặp thuốc")):
        clinical_domains.add("ddi")
        high_kws.add("tương tác thuốc")
        high_kws.add("tương tác dược động học")

    # C. Nhận diện rủi ro cơ quan & Bệnh nền
    for cond_key, cond_info in ORGAN_CONDITION_HIERARCHY.items():
        if any(kw in lower_q for kw in cond_info.get("keywords", [])):
            clinical_domains.add(cond_key.lower())
            high_kws.add(cond_info["title"])
            for rule in cond_info.get("critical_rules", []):
                high_kws.add(rule[:40])

    # D. Nhận diện khuyến cáo thay thế điều trị (Therapeutic Substitutions)
    for alt_key, alt_info in THERAPEUTIC_ALTERNATIVE_MAP.items():
        triggers = alt_info.get("trigger", [])
        is_triggered = False
        for trig in triggers:
            if isinstance(trig, str) and trig in lower_q:
                is_triggered = True
                break
            elif isinstance(trig, (list, tuple)) and all(t in lower_q for t in trig):
                is_triggered = True
                break

        if is_triggered:
            clinical_domains.add("therapeutic_substitution")
            high_kws.add(f"Lựa chọn thay thế {alt_info.get('target_class', '')}")
            high_kws.add(alt_info.get("alternative_class", ""))

    return DualLevelKeywords(
        query=clean_query,
        low_level_keywords=sorted(list(low_kws)),
        high_level_keywords=sorted(list(high_kws)),
        identified_drugs=sorted(list(dict.fromkeys(identified_drugs))),
        identified_classes=sorted(list(dict.fromkeys(identified_classes))),
        clinical_domains=sorted(list(clinical_domains)),
        patient_metrics=metrics,
    )
