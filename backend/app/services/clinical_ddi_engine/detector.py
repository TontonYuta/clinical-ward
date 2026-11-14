from typing import Optional
from itertools import combinations
from app.services.clinical_ddi_engine.schemas import (
    DdiSeverity, DrugEntity, PatientClinicalContext, DdiAlert,
    PolypharmacyCumulativeAlert, PrescriptionAuditReport
)
from app.services.clinical_ddi_engine.normalizer import normalize_drug_entity
from app.services.clinical_ddi_engine.rules_data import CLASS_DDI_RULES, SAFE_SYNERGIES
from app.services.clinical_ddi_engine.full_catalog import lookup_official_ddi, lookup_official_group_ddi
from app.services.clinical_ddi_engine.polypharmacy import evaluate_polypharmacy

def _catalog_severity(action: str) -> DdiSeverity:
    text = action.lower()
    if "chống chỉ định" in text:
        return DdiSeverity.CONTRAINDICATED
    if any(term in text for term in ("tránh sử dụng", "không khuyến cáo", "không nên phối hợp", "không sử dụng đồng thời")):
        return DdiSeverity.MAJOR
    if any(term in text for term in ("theo dõi", "giám sát", "cân nhắc", "cách nhau", "điều chỉnh liều", "định kỳ")):
        return DdiSeverity.MODERATE
    return DdiSeverity.MAJOR

class ClinicalDdiDetector:
    def __init__(self):
        self.rules = CLASS_DDI_RULES
        self.synergies = SAFE_SYNERGIES

    def evaluate_pair(self, drug_a: DrugEntity, drug_b: DrugEntity, patient: Optional[PatientClinicalContext] = None) -> Optional[DdiAlert]:
        inn_a, inn_b = drug_a.canonical_inn, drug_b.canonical_inn
        if inn_a == inn_b:
            return None

        # 1. Phối hợp Hiệp đồng An toàn (Safe Synergy)
        for syn in self.synergies:
            if (inn_a == syn["drug_a"] and inn_b == syn["drug_b"]) or (inn_a == syn["drug_b"] and inn_b == syn["drug_a"]):
                return DdiAlert(
                    rule_id="SYNERGY_" + syn["drug_a"].upper() + "_" + syn["drug_b"].upper(),
                    severity=DdiSeverity.SAFE_SYNERGY,
                    title=syn["title"], drug_a=drug_a.display_name, drug_b=drug_b.display_name,
                    inn_a=inn_a, inn_b=inn_b, mechanism=syn["mechanism"],
                    clinical_consequence=syn["consequence"], action_recommendation=syn["action"],
                    legal_evidence=syn["source"]
                )

        # 2. Luật Tương tác Nhóm Dược lý (Tier 2 Class-to-Class)
        for r in self.rules:
            ca, cb = r["class_a"], r["class_b"]
            match_direct = (ca in drug_a.atc_classes and cb in drug_b.atc_classes)
            match_reverse = (cb in drug_a.atc_classes and ca in drug_b.atc_classes)
            if match_direct or match_reverse:
                sev = DdiSeverity(r["severity"])
                escalated = False
                reason = None

                if patient:
                    if r["id"] == "RULE_AMIODARONE_COLCHICINE" and ((patient.egfr and patient.egfr < 60) or patient.has_hepatic_impairment):
                        sev = DdiSeverity.CONTRAINDICATED
                        escalated = True
                        reason = f"Leo thang lên CHỐNG CHỈ ĐỊNH do bệnh nhân có suy giảm chức năng thận (eGFR={patient.egfr}) hoặc gan (QĐ 5948)."
                    elif r["id"] == "RULE_METFORMIN_CONTRAST" and (patient.egfr and patient.egfr < 45):
                        sev = DdiSeverity.CONTRAINDICATED
                        escalated = True
                        reason = f"Leo thang lên CHỐNG CHỈ ĐỊNH do eGFR={patient.egfr} < 45 mL/phút (Nguy cơ nhiễm toan acid lactic tử vong)."
                    elif r["id"] == "RULE_RAAS_POTASSIUM_SPARING" and ((patient.egfr and patient.egfr < 30) or (patient.serum_potassium and patient.serum_potassium >= 5.0)):
                        sev = DdiSeverity.CONTRAINDICATED
                        escalated = True
                        reason = f"Leo thang lên CHỐNG CHỈ ĐỊNH do Kali máu={patient.serum_potassium} hoặc suy thận nặng (Nguy cơ ngừng tim)."

                return DdiAlert(
                    rule_id=r["id"], severity=sev, title=r["title"],
                    drug_a=drug_a.display_name, drug_b=drug_b.display_name,
                    inn_a=inn_a, inn_b=inn_b, mechanism=r["mech"],
                    clinical_consequence=r["conseq"], action_recommendation=r["action"],
                    legal_evidence=r["source"], escalated_by_patient_context=escalated,
                    escalation_reason=reason
                )

        # 3. Tra cứu trực tiếp Danh mục 633 cặp Hoạt chất QĐ 5948 (Bảng 3.1)
        direct = lookup_official_ddi(inn_a, inn_b)
        if direct:
            action = direct.get("action") or direct.get("management") or ""
            return DdiAlert(
                rule_id=f"QD_5948_TABLE_3_1_STT_{direct['stt']}",
                severity=_catalog_severity(action),
                title=f"{direct['drug_1'].upper()} + {direct['drug_2'].upper()}: CẢNH BÁO TƯƠNG TÁC (QĐ 5948)",
                drug_a=drug_a.display_name, drug_b=drug_b.display_name,
                inn_a=inn_a, inn_b=inn_b, mechanism=direct["mechanism"] or "Chống chỉ định phối hợp theo QĐ 5948/QĐ-BYT",
                clinical_consequence=direct["consequence"] or "Tăng nguy cơ biến cố bất lợi nghiêm trọng đe dọa tính mạng.",
                action_recommendation=action or "Tham khảo khuyến cáo trong nguồn chính thức.",
                legal_evidence=direct["legal_source"]
            )

        # Bảng 3.2: Tương tác theo nhóm
        group_match = lookup_official_group_ddi(inn_a, inn_b)
        if group_match:
            action = group_match.get("action", "")
            return DdiAlert(
                rule_id=f"QD_5948_TABLE_3_2_STT_{group_match['stt']}",
                severity=_catalog_severity(action),
                title=f"TƯƠNG TÁC THEO NHÓM: {group_match['drug_1']} + {group_match['drug_2']}",
                drug_a=drug_a.display_name, drug_b=drug_b.display_name,
                inn_a=inn_a, inn_b=inn_b, mechanism=group_match["mechanism"],
                clinical_consequence=group_match["consequence"],
                action_recommendation=action, legal_evidence=group_match["legal_source"]
            )

        return None

    def evaluate_polypharmacy(self, drugs: list[DrugEntity], patient: Optional[PatientClinicalContext] = None) -> list[PolypharmacyCumulativeAlert]:
        return evaluate_polypharmacy(drugs, patient)

    def audit_prescription(self, raw_drug_list: list[str], patient: Optional[PatientClinicalContext] = None) -> PrescriptionAuditReport:
        entities = [normalize_drug_entity(item) for item in raw_drug_list if item and item.strip()]
        unresolved_entities = [
            entity.raw_name for entity in entities
            if not entity.atc_classes and entity.brand_matched is None
        ]
        unique_entities: list[DrugEntity] = []
        seen_inns = set()
        for e in entities:
            if e.canonical_inn not in seen_inns:
                seen_inns.add(e.canonical_inn)
                unique_entities.append(e)

        pair_alerts: list[DdiAlert] = []
        analyzed_count = 0
        for d1, d2 in combinations(unique_entities, 2):
            analyzed_count += 1
            alert = self.evaluate_pair(d1, d2, patient)
            if alert:
                pair_alerts.append(alert)

        poly_alerts = self.evaluate_polypharmacy(unique_entities, patient)

        c_count = sum(1 for a in pair_alerts if a.severity == DdiSeverity.CONTRAINDICATED) + sum(1 for a in poly_alerts if a.severity == DdiSeverity.CONTRAINDICATED)
        maj_count = sum(1 for a in pair_alerts if a.severity == DdiSeverity.MAJOR) + sum(1 for a in poly_alerts if a.severity == DdiSeverity.MAJOR)
        mod_count = sum(1 for a in pair_alerts if a.severity == DdiSeverity.MODERATE)
        syn_count = sum(1 for a in pair_alerts if a.severity == DdiSeverity.SAFE_SYNERGY)

        return PrescriptionAuditReport(
            total_drugs=len(unique_entities),
            analyzed_pairs_count=analyzed_count,
            contraindicated_count=c_count,
            major_count=maj_count,
            moderate_count=mod_count,
            synergy_count=syn_count,
            has_contraindication=(c_count > 0),
            pair_alerts=pair_alerts,
            polypharmacy_alerts=poly_alerts,
            normalized_entities=unique_entities,
            unresolved_entities=unresolved_entities,
        )
