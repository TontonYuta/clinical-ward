"""
Clinical DDI Engine Module Entry (<=195 LOC)
"""
from typing import Optional
from app.services.clinical_ddi_engine.schemas import (
    DdiSeverity, DrugEntity, PatientClinicalContext, DdiAlert,
    PolypharmacyCumulativeAlert, PrescriptionAuditReport
)
from app.services.clinical_ddi_engine.normalizer import normalize_drug_entity
from app.services.clinical_ddi_engine.detector import ClinicalDdiDetector

_default_detector = ClinicalDdiDetector()

def evaluate_prescription(raw_drug_list: list[str], patient: Optional[PatientClinicalContext] = None) -> PrescriptionAuditReport:
    return _default_detector.audit_prescription(raw_drug_list, patient)

def evaluate_pair(drug_a_raw: str, drug_b_raw: str, patient: Optional[PatientClinicalContext] = None) -> Optional[DdiAlert]:
    e_a = normalize_drug_entity(drug_a_raw)
    e_b = normalize_drug_entity(drug_b_raw)
    return _default_detector.evaluate_pair(e_a, e_b, patient)

__all__ = [
    "DdiSeverity", "DrugEntity", "PatientClinicalContext", "DdiAlert",
    "PolypharmacyCumulativeAlert", "PrescriptionAuditReport",
    "normalize_drug_entity", "ClinicalDdiDetector",
    "evaluate_prescription", "evaluate_pair"
]
