from typing import Optional
from app.services.clinical_ddi_engine.schemas import (
    DdiSeverity, DrugEntity, PatientClinicalContext, PolypharmacyCumulativeAlert
)

def evaluate_polypharmacy(drugs: list[DrugEntity], patient: Optional[PatientClinicalContext] = None) -> list[PolypharmacyCumulativeAlert]:
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
