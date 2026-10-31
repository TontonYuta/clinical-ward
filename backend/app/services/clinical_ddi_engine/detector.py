"""
Clinical DDI Detector & Polypharmacy Triage Engine (<=195 LOC)
Thuật toán 5 giai đoạn: Normalization -> Multi-tier Matching -> Dynamic Escalation -> Polypharmacy Aggregation -> Grounding
"""
from typing import Optional
from itertools import combinations
from app.services.clinical_ddi_engine.schemas import (
    DdiSeverity, DrugEntity, PatientClinicalContext, DdiAlert,
    PolypharmacyCumulativeAlert, PrescriptionAuditReport
)
from app.services.clinical_ddi_engine.normalizer import normalize_drug_entity
from app.services.clinical_ddi_engine.rules_data import CLASS_DDI_RULES, SAFE_SYNERGIES
from app.services.clinical_ddi_engine.full_catalog import lookup_official_ddi, lookup_official_group_ddi
import re

def _catalog_severity(action: str) -> DdiSeverity:
    """Derive a conservative display tier from the official management text.

    This is a triage label only; preserve the full source recommendation in the
    alert and do not infer a contraindication from table membership alone.
    """
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

        # 1. Kiểm tra Phối hợp Hiệp đồng An toàn (Safe Synergy)
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

        # 2. Kiểm tra Luật Tương tác Nhóm Dược lý (Tier 2 Class-to-Class)
        for r in self.rules:
            ca, cb = r["class_a"], r["class_b"]
            match_direct = (ca in drug_a.atc_classes and cb in drug_b.atc_classes)
            match_reverse = (cb in drug_a.atc_classes and ca in drug_b.atc_classes)
            if match_direct or match_reverse:
                sev = DdiSeverity(r["severity"])
                escalated = False
                reason = None

                # 3. Dynamic Patient Context Escalation (Tầng hiệu chỉnh cơ địa bệnh nhân)
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

        # Bảng 3.2: only explicit names present in the source groups are
        # matched. Class membership is never inferred from a partial phrase.
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
        alerts: list[PolypharmacyCumulativeAlert] = []

        # A. Nguy cơ kéo dài khoảng QT cộng dồn (Cumulative QTc / Tisdale Score)
        qt_drugs = [d for d in drugs if "qt_prolonging" in d.risk_flags]
        if len(qt_drugs) >= 2:
            is_critical = len(qt_drugs) >= 3 or (patient and patient.baseline_qtc and patient.baseline_qtc >= 480)
            alerts.append(PolypharmacyCumulativeAlert(
                syndrome_id="POLY_QT_PROLONGATION",
                severity=DdiSeverity.CONTRAINDICATED if is_critical else DdiSeverity.MAJOR,
                title=f"CẢNH BÁO TÍCH LŨY QT ({len(qt_drugs)} THUỐC): NGUY CƠ XOẮN ĐỈNH TỬ VONG",
                involved_drugs=[d.display_name for d in qt_drugs],
                mechanism="Cộng dồn ức chế dòng kali IKr qua kênh HERG tại cơ tâm thất, kéo dài điện thế hoạt động cơ tim.",
                clinical_consequence="Kéo dài khoảng QTc kịch phát, khởi phát Xoắn đỉnh (Torsades de Pointes), rung thất và ngừng tim đột ngột.",
                action_recommendation="Đo ECG 12 chuyển đạo trước và trong khi dùng. Giữ Kali máu >= 4.0 mEq/L, Magnesi >= 2.0 mg/dL. Cân nhắc thay thế.",
                legal_evidence="Thang điểm Tisdale (Circulation 2013); cần đối chiếu hướng dẫn QT hiện hành"
            ))

        # B. Nguy cơ tăng Kali máu đa thuốc (Cumulative Hyperkalemia)
        k_drugs = [d for d in drugs if "hyperkalemia" in d.risk_flags]
        if len(k_drugs) >= 2:
            crit_k = (patient and patient.serum_potassium and patient.serum_potassium >= 5.0) or (patient and patient.egfr and patient.egfr < 30)
            alerts.append(PolypharmacyCumulativeAlert(
                syndrome_id="POLY_HYPERKALEMIA",
                severity=DdiSeverity.CONTRAINDICATED if crit_k else DdiSeverity.MAJOR,
                title=f"CẢNH BÁO CỘNG DỒN TĂNG KALI MÁU ({len(k_drugs)} THUỐC)",
                involved_drugs=[d.display_name for d in k_drugs],
                mechanism="Hiệp đồng ức chế bài tiết Kali qua thận tại trục Renin-Angiotensin-Aldosterone và ống góp.",
                clinical_consequence="Tăng Kali máu ác tính (> 6.5 mEq/L), rối loạn dẫn truyền tim, sóng T nhọn đối xứng, vô tâm thu.",
                action_recommendation="Kiểm tra điện giải đồ định kỳ. Tuyệt đối không bổ sung kali ngoại sinh.",
                legal_evidence="QĐ 5948/QĐ-BYT & Hướng dẫn KDIGO"
            ))

        # C. Hội chứng Triple Whammy trên thận (RAAS + Lợi tiểu + NSAID)
        has_raas = any("RAAS_INHIBITOR" in d.atc_classes for d in drugs)
        has_diuretic = any("LOOP_DIURETIC" in d.atc_classes or "POTASSIUM_SPARING" in d.atc_classes for d in drugs)
        has_nsaid = any("NSAID" in d.atc_classes for d in drugs)
        if has_raas and has_diuretic and has_nsaid:
            sev = DdiSeverity.CONTRAINDICATED if (patient and patient.egfr and patient.egfr < 60) else DdiSeverity.MAJOR
            tw_drugs = [d.display_name for d in drugs if any(c in d.atc_classes for c in ["RAAS_INHIBITOR", "LOOP_DIURETIC", "POTASSIUM_SPARING", "NSAID"])]
            alerts.append(PolypharmacyCumulativeAlert(
                syndrome_id="POLY_TRIPLE_WHAMMY", severity=sev,
                title="HỘI CHỨNG 'TRIPLE WHAMMY': SUY THẬN CẤP DO BỘ BA THUỐC",
                involved_drugs=tw_drugs,
                mechanism="NSAID co tiểu động mạch vào (giảm PG) + RAAS giãn tiểu động mạch ra + Lợi tiểu giảm thể tích tuần hoàn hiệu dụng.",
                clinical_consequence="Sụt giảm nghiêm trọng áp lực lọc cầu thận, gây suy thận cấp trước thận và hoại tử ống thận cấp tính.",
                action_recommendation="Chống chỉ định phối hợp tam giác này. Thay thế NSAID bằng Paracetamol hoặc giảm đau thần kinh khác.",
                legal_evidence="Cảnh báo Cảnh giác Dược Quốc Gia & QĐ 5948/QĐ-BYT"
            ))

        return alerts

    def audit_prescription(self, raw_drug_list: list[str], patient: Optional[PatientClinicalContext] = None) -> PrescriptionAuditReport:
        entities = [normalize_drug_entity(item) for item in raw_drug_list if item and item.strip()]
        # Khử trùng lặp thực thể theo canonical_inn
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
            normalized_entities=unique_entities
        )
