"""
Clinical Drug-Drug Interaction (CDDI) Data Schemas (<=195 LOC)
Căn cứ: QĐ 5948/QĐ-BYT, QĐ 2033/QĐ-BYT (Dược thư Quốc gia lần xuất bản II, 2015) & Chuẩn HL7 FHIR
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

class DdiSeverity(str, Enum):
    CONTRAINDICATED = "CONTRAINDICATED"  # Chống chỉ định tuyệt đối (Đỏ - CẤM DÙNG)
    MAJOR = "MAJOR"                      # Tương tác nghiêm trọng (Cam - Cân nhắc lợi ích/nguy cơ)
    MODERATE = "MODERATE"                # Thận trọng/Tương tác hấp thu (Vàng - Cách ly thời gian)
    SAFE_SYNERGY = "SAFE_SYNERGY"        # Hiệp đồng điều trị an toàn (Xanh lục - Khuyến khích)

@dataclass
class DrugEntity:
    raw_name: str
    canonical_inn: str
    display_name: str
    brand_matched: Optional[str] = None
    atc_classes: list[str] = field(default_factory=list)
    cyp_inhibitors: list[str] = field(default_factory=list)
    cyp_substrates: list[str] = field(default_factory=list)
    is_p_gp_inhibitor: bool = False
    is_p_gp_substrate: bool = False
    risk_flags: list[str] = field(default_factory=list)  # qt_prolonging, hyperkalemia, cns_depressant, nephrotoxic, bleeding

@dataclass
class PatientClinicalContext:
    egfr: Optional[float] = None                       # mL/min/1.73m2
    has_hepatic_impairment: bool = False               # Suy giảm chức năng gan
    serum_potassium: Optional[float] = None            # mEq/L
    baseline_qtc: Optional[int] = None                 # ms
    is_pregnant: bool = False                          # Phụ nữ mang thai
    age: Optional[int] = None                          # Tuổi

@dataclass
class DdiAlert:
    rule_id: str
    severity: DdiSeverity
    title: str
    drug_a: str
    drug_b: str
    inn_a: str
    inn_b: str
    mechanism: str
    clinical_consequence: str
    action_recommendation: str
    legal_evidence: str
    escalated_by_patient_context: bool = False
    escalation_reason: Optional[str] = None

@dataclass
class PolypharmacyCumulativeAlert:
    syndrome_id: str
    severity: DdiSeverity
    title: str
    involved_drugs: list[str]
    mechanism: str
    clinical_consequence: str
    action_recommendation: str
    legal_evidence: str

@dataclass
class PrescriptionAuditReport:
    total_drugs: int
    analyzed_pairs_count: int
    contraindicated_count: int
    major_count: int
    moderate_count: int
    synergy_count: int
    has_contraindication: bool
    pair_alerts: list[DdiAlert] = field(default_factory=list)
    polypharmacy_alerts: list[PolypharmacyCumulativeAlert] = field(default_factory=list)
    normalized_entities: list[DrugEntity] = field(default_factory=list)
    unresolved_entities: list[str] = field(default_factory=list)
