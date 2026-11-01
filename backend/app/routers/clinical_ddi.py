"""
Clinical DDI & Prescription Audit Router (<=195 LOC)
Căn cứ pháp lý: QĐ 5948/QĐ-BYT, QĐ 2033/QĐ-BYT (Dược thư Quốc gia lần xuất bản II, 2015)
"""
from typing import Optional
import secrets
from fastapi import APIRouter, Query, HTTPException, status, Header
from app.config import settings
from pydantic import BaseModel, Field
from app.services.clinical_ddi_engine import (
    evaluate_prescription, evaluate_pair, normalize_drug_entity,
    PatientClinicalContext
)
from app.services.clinical_ddi_engine.full_catalog import register_custom_ddi, get_official_catalog_stats

router = APIRouter(prefix="/clinical-ddi", tags=["Tương Tác Thuốc & CDSS Lâm Sàng (QĐ 5948/QĐ-BYT)"])

class PatientContextIn(BaseModel):
    egfr: Optional[float] = Field(None, description="Độ lọc cầu thận ước tính (mL/min/1.73m2)")
    has_hepatic_impairment: bool = Field(False, description="Có suy giảm chức năng gan hay không")
    serum_potassium: Optional[float] = Field(None, description="Nồng độ kali máu (mEq/L)")
    baseline_qtc: Optional[int] = Field(None, description="Khoảng QTc nền (ms)")
    is_pregnant: bool = Field(False, description="Phụ nữ mang thai")
    age: Optional[int] = Field(None, description="Tuổi bệnh nhân")

class AuditPrescriptionRequest(BaseModel):
    drugs: list[str] = Field(..., min_length=1, description="Danh sách tên thuốc hoặc biệt dược trong đơn")
    patient_context: Optional[PatientContextIn] = Field(None, description="Thông tin lâm sàng bệnh nhân")

class CheckPairRequest(BaseModel):
    drug_a: str = Field(..., description="Tên thuốc thứ nhất (Brand hoặc INN)")
    drug_b: str = Field(..., description="Tên thuốc thứ hai (Brand hoặc INN)")
    patient_context: Optional[PatientContextIn] = Field(None, description="Thông tin lâm sàng bệnh nhân")

@router.post("/audit")
def audit_prescription_endpoint(req: AuditPrescriptionRequest):
    ctx = None
    if req.patient_context:
        ctx = PatientClinicalContext(
            egfr=req.patient_context.egfr,
            has_hepatic_impairment=req.patient_context.has_hepatic_impairment,
            serum_potassium=req.patient_context.serum_potassium,
            baseline_qtc=req.patient_context.baseline_qtc,
            is_pregnant=req.patient_context.is_pregnant,
            age=req.patient_context.age
        )
    report = evaluate_prescription(req.drugs, ctx)
    return {
        "total_drugs": report.total_drugs,
        "analyzed_pairs_count": report.analyzed_pairs_count,
        "has_contraindication": report.has_contraindication,
        "contraindicated_count": report.contraindicated_count,
        "major_count": report.major_count,
        "moderate_count": report.moderate_count,
        "synergy_count": report.synergy_count,
        "pair_alerts": [
            {
                "rule_id": a.rule_id,
                "severity": a.severity.value,
                "title": a.title,
                "drug_a": a.drug_a,
                "drug_b": a.drug_b,
                "inn_a": a.inn_a,
                "inn_b": a.inn_b,
                "mechanism": a.mechanism,
                "consequence": a.clinical_consequence,
                "action": a.action_recommendation,
                "source": a.legal_evidence,
                "escalated": a.escalated_by_patient_context,
                "escalation_reason": a.escalation_reason
            } for a in report.pair_alerts
        ],
        "polypharmacy_alerts": [
            {
                "syndrome_id": p.syndrome_id,
                "severity": p.severity.value,
                "title": p.title,
                "involved_drugs": p.involved_drugs,
                "mechanism": p.mechanism,
                "consequence": p.clinical_consequence,
                "action": p.action_recommendation,
                "source": p.legal_evidence
            } for p in report.polypharmacy_alerts
        ],
        "normalized_drugs": [
            {
                "raw": e.raw_name,
                "inn": e.canonical_inn,
                "display": e.display_name,
                "brand": e.brand_matched,
                "classes": e.atc_classes,
                "risk_flags": e.risk_flags
            } for e in report.normalized_entities
        ]
    }

@router.post("/check-pair")
def check_pair_endpoint(req: CheckPairRequest):
    if not req.drug_a.strip() or not req.drug_b.strip():
        return {
            "has_interaction": None,
            "alert": None,
            "source_status": "insufficient_data",
            "source": "QĐ 5948/QĐ-BYT: Bảng 3.1 và Bảng 3.2",
            "coverage_note": "Cần tên hoặc hoạt chất của cả hai thuốc để thực hiện kiểm tra.",
        }
    ctx = None
    if req.patient_context:
        ctx = PatientClinicalContext(
            egfr=req.patient_context.egfr,
            has_hepatic_impairment=req.patient_context.has_hepatic_impairment,
            serum_potassium=req.patient_context.serum_potassium,
            baseline_qtc=req.patient_context.baseline_qtc,
            is_pregnant=req.patient_context.is_pregnant,
            age=req.patient_context.age
        )
    alert = evaluate_pair(req.drug_a, req.drug_b, ctx)
    if not alert:
        return {
            "has_interaction": False,
            "alert": None,
            "source_status": "none_found_in_checked_source",
            "source": "QĐ 5948/QĐ-BYT: Bảng 3.1 và Bảng 3.2",
            "coverage_note": "Chưa tìm thấy trong chỉ mục hiện có; kết quả không khẳng định phối hợp an toàn.",
        }
    return {
        "has_interaction": True,
        "source_status": "indexed_match",
        "source": "QĐ 5948/QĐ-BYT: Bảng 3.1 và Bảng 3.2",
        "alert": {
            "rule_id": alert.rule_id,
            "severity": alert.severity.value,
            "title": alert.title,
            "drug_a": alert.drug_a,
            "drug_b": alert.drug_b,
            "mechanism": alert.mechanism,
            "consequence": alert.clinical_consequence,
            "action": alert.action_recommendation,
            "source": alert.legal_evidence,
            "escalated": alert.escalated_by_patient_context,
            "escalation_reason": alert.escalation_reason
        }
    }

@router.get("/normalize")
def normalize_endpoint(name: str = Query(..., description="Tên thuốc hoặc biệt dược")):
    e = normalize_drug_entity(name)
    return {
        "raw": e.raw_name,
        "inn": e.canonical_inn,
        "display": e.display_name,
        "brand_matched": e.brand_matched,
        "classes": e.atc_classes,
        "risk_flags": e.risk_flags,
        "cyp_inhibitors": e.cyp_inhibitors,
        "cyp_substrates": e.cyp_substrates,
        "is_p_gp_inhibitor": e.is_p_gp_inhibitor,
        "is_p_gp_substrate": e.is_p_gp_substrate
    }

class RegisterCustomRuleRequest(BaseModel):
    drug_a: str = Field(..., description="Tên thuốc / hoạt chất 1")
    drug_b: str = Field(..., description="Tên thuốc / hoạt chất 2")
    mechanism: str = Field(..., description="Cơ chế tương tác")
    consequence: str = Field(..., description="Hậu quả lâm sàng")
    action: str = Field(..., description="Khuyến cáo xử trí")
    evidence_source: str = Field(..., description="Nguồn căn cứ y văn")

@router.post("/register-rule")
def register_rule_endpoint(req: RegisterCustomRuleRequest, admin_token: Optional[str] = Header(None, alias="X-DDI-Admin-Token")):
    # Catalog mutation is an administrative operation. Never accept it when
    # no server-side token is configured, and compare tokens in constant time.
    if not settings.DDI_ADMIN_TOKEN or not admin_token or not secrets.compare_digest(admin_token, settings.DDI_ADMIN_TOKEN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="DDI catalog mutation is not authorized")
    entry = register_custom_ddi(
        drug_a=req.drug_a, drug_b=req.drug_b,
        mechanism=req.mechanism, consequence=req.consequence,
        action=req.action, evidence_source=req.evidence_source
    )
    return {"status": "success", "registered_rule": entry}

@router.get("/catalog-stats")
def catalog_stats_endpoint():
    return get_official_catalog_stats()
