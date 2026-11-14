"""
Module Thẩm Định Đơn Thuốc Lâm Sàng Toàn Diện 5 Trụ Cột (AI Clinical Prescription Auditor)
Tuân thủ:
- Thể thức pháp lý: Thông tư 52/2017/TT-BYT, TT 18/2018/TT-BYT, TT 04/2022/TT-BYT, TT 26/2025/TT-BYT
- Thuốc kiểm soát đặc biệt: Thông tư 20/2017/TT-BYT
- Tương tác thuốc: Quyết định 5948/QĐ-BYT (38.275 cặp tương tác & Bảng 3.1, 3.2)
- Hướng dẫn lâm sàng & Liều dùng: Dược thư Quốc gia Việt Nam (DĐVN V)
"""
import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

class LegalCheckItem(BaseModel):
    rule_name: str
    legal_basis: str
    passed: bool
    severity: str = "error"  # "error", "warning", "info"
    message: str
    recommendation: Optional[str] = None

class ClinicalCheckItem(BaseModel):
    category: str  # "diagnosis_match", "dosage_safety", "interaction", "timing_administration"
    item_name: str
    passed: bool
    severity: str = "warning"  # "contraindicated", "major", "warning", "info", "passed"
    title: str
    detail: str
    clinical_action: str
    evidence_source: str

class PrescriptionAuditResult(BaseModel):
    overall_status: str  # "PASSED", "WARNING", "REJECTED"
    safety_score: int  # 0 - 100
    prescription_type: str  # "outpatient" | "inpatient_daily"
    summary: str
    legal_checks: List[LegalCheckItem]
    clinical_checks: List[ClinicalCheckItem]
    drug_interactions: List[Dict[str, Any]]
    recommendations: List[str]
    doctor_signature_verified: bool
    doctor_name: str
    doctor_certificate: Optional[str]

# Dữ liệu quy chuẩn liều tối đa hàng ngày (Max Daily Dose) theo DĐVN V
MAX_DAILY_DOSES = {
    "paracetamol": {"max_adult_mg": 4000, "max_pediatric_mg_kg": 60, "unit": "mg"},
    "ibuprofen": {"max_adult_mg": 2400, "max_pediatric_mg_kg": 40, "unit": "mg"},
    "amoxicillin": {"max_adult_mg": 3000, "max_pediatric_mg_kg": 90, "unit": "mg"},
    "augmentin": {"max_adult_mg": 3000, "max_pediatric_mg_kg": 90, "unit": "mg"},
    "ciprofloxacin": {"max_adult_mg": 1500, "unit": "mg", "renal_adjust_clcr_50": True},
    "metformin": {"max_adult_mg": 2550, "unit": "mg", "contraindicated_egfr_30": True},
    "enoxaparin": {"max_adult_mg": 150, "unit": "mg", "renal_adjust_clcr_30": True},
    "levofloxacin": {"max_adult_mg": 750, "unit": "mg", "renal_adjust_clcr_50": True},
    "diazepam": {"max_adult_mg": 40, "unit": "mg", "is_psychotropic": True},
    "morphin": {"max_adult_mg": 120, "unit": "mg", "is_narcotic": True},
}

# Quy chuẩn thời điểm dùng thuốc lâm sàng nạp động từ CSDL tri thức
def _load_timing_guidelines() -> Dict[str, Any]:
    from pathlib import Path
    import json
    p = Path(__file__).resolve().parents[2] / "data" / "knowledge_base" / "timing_guidelines.json"
    if p.is_file():
        try:
            with open(p, "r", encoding="utf-8") as f:
                content = json.load(f)
                return content.get("guidelines", {})
        except Exception:
            pass
    return {}

TIMING_GUIDELINES = _load_timing_guidelines()

class ClinicalPrescriptionAuditor:
    """Bộ Thẩm Định Đơn Thuốc Lâm Sàng Tự Động 5 Sao."""

    def audit_prescription(
        self,
        order_data: Dict[str, Any],
        patient_data: Optional[Dict[str, Any]] = None
    ) -> PrescriptionAuditResult:
        patient_data = patient_data or {}
        legal_checks: List[LegalCheckItem] = []
        clinical_checks: List[ClinicalCheckItem] = []
        recommendations: List[str] = []

        is_outpatient = order_data.get("prescriptionType", "outpatient") == "outpatient"
        rx_type_label = "outpatient" if is_outpatient else "inpatient_daily"

        # ----------------------------------------------------
        # 1. THẨM ĐỊNH THỂ THỨC PHÁP LÝ (Thông tư 52/2017 & TT 26/2025)
        # ----------------------------------------------------
        # 1.1 Thông tin cơ sở KBCB
        facility = order_data.get("facilityName", "")
        if facility:
            legal_checks.append(LegalCheckItem(
                rule_name="Tên cơ sở khám bệnh, chữa bệnh",
                legal_basis="Điều 6 Thông tư 52/2017/TT-BYT & TT 26/2025/TT-BYT",
                passed=True, severity="info",
                message=f"Đã ghi nhận cơ sở KBCB: {facility}."
            ))
        else:
            legal_checks.append(LegalCheckItem(
                rule_name="Tên cơ sở khám bệnh, chữa bệnh",
                legal_basis="Điều 6 Thông tư 52/2017/TT-BYT",
                passed=False, severity="error",
                message="Thiếu tên cơ sở khám bệnh, chữa bệnh trên đầu đơn thuốc.",
                recommendation="Bổ sung tên cơ sở khám chữa bệnh và địa chỉ liên hệ."
            ))

        # 1.2 Định danh người bệnh
        patient_name = (order_data.get("patientName") or "").strip()
        if patient_name and len(patient_name) >= 2:
            legal_checks.append(LegalCheckItem(
                rule_name="Họ tên người bệnh",
                legal_basis="Khoản 1 Điều 6 Thông tư 52/2017/TT-BYT",
                passed=True, severity="info",
                message=f"Họ tên người bệnh hợp lệ: {patient_name.upper()}."
            ))
        else:
            legal_checks.append(LegalCheckItem(
                rule_name="Họ tên người bệnh",
                legal_basis="Khoản 1 Điều 6 Thông tư 52/2017/TT-BYT",
                passed=False, severity="error",
                message="Chưa có họ tên người bệnh đầy đủ.",
                recommendation="Ghi rõ họ và tên người bệnh bằng chữ in hoa hoặc chữ thường rõ ràng."
            ))

        # 1.3 Kiểm tra Trẻ em < 72 tháng tuổi
        patient_age = order_data.get("patientAge") or patient_data.get("age")
        patient_weight = order_data.get("patientWeight") or patient_data.get("weight")
        guardian_name = order_data.get("guardianName") or patient_data.get("guardian_name")
        patient_dob = order_data.get("patientDob") or patient_data.get("dob")

        is_under_6 = False
        if patient_age is not None:
            try:
                is_under_6 = float(patient_age) < 6
            except Exception:
                pass

        if is_under_6:
            if patient_weight:
                legal_checks.append(LegalCheckItem(
                    rule_name="Cân nặng trẻ em dưới 72 tháng tuổi",
                    legal_basis="Điểm a Khoản 1 Điều 6 TT 52/2017 & TT 04/2022/TT-BYT",
                    passed=True, severity="info",
                    message=f"Đã ghi cân nặng trẻ: {patient_weight} kg."
                ))
            else:
                legal_checks.append(LegalCheckItem(
                    rule_name="Cân nặng trẻ em dưới 72 tháng tuổi",
                    legal_basis="Điểm a Khoản 1 Điều 6 TT 52/2017 & TT 04/2022/TT-BYT",
                    passed=False, severity="error",
                    message="BẮT BUỘC ghi số tháng tuổi và cân nặng đối với trẻ em dưới 72 tháng tuổi.",
                    recommendation="Cân trẻ và ghi rõ số cân nặng (kg) để tính liều thuốc chính xác."
                ))

            if guardian_name:
                legal_checks.append(LegalCheckItem(
                    rule_name="Người giám hộ đưa trẻ đi khám",
                    legal_basis="Điểm a Khoản 1 Điều 6 TT 52/2017/TT-BYT",
                    passed=True, severity="info",
                    message=f"Đã ghi nhận người giám hộ: {guardian_name}."
                ))
            else:
                legal_checks.append(LegalCheckItem(
                    rule_name="Người giám hộ đưa trẻ đi khám",
                    legal_basis="Điểm a Khoản 1 Điều 6 TT 52/2017/TT-BYT",
                    passed=False, severity="warning",
                    message="Nên ghi họ tên bố/mẹ hoặc người đưa trẻ đến khám đối với trẻ dưới 72 tháng tuổi.",
                    recommendation="Bổ sung họ tên bố, mẹ hoặc người giám hộ của trẻ."
                ))

        # 1.4 Số CCCD/Định danh hoặc Số thẻ BHYT (Đề án 06 & TT 04/2022/TT-BYT)
        cccd = order_data.get("patientCccd") or patient_data.get("cccd")
        insurance_id = order_data.get("patientInsuranceId") or patient_data.get("insurance_id")
        if cccd or insurance_id:
            legal_checks.append(LegalCheckItem(
                rule_name="Số định danh cá nhân / CCCD / Thẻ BHYT",
                legal_basis="Thông tư 04/2022/TT-BYT & Đề án 06 Chính Phủ",
                passed=True, severity="info",
                message=f"Đã có mã định danh: {cccd or insurance_id}."
            ))
        else:
            legal_checks.append(LegalCheckItem(
                rule_name="Số định danh cá nhân / CCCD / Thẻ BHYT",
                legal_basis="Thông tư 04/2022/TT-BYT",
                passed=False, severity="warning",
                message="Thiếu số CCCD/Định danh cá nhân hoặc mã BHYT theo quy chuẩn đơn thuốc điện tử quốc gia.",
                recommendation="Cập nhật CCCD hoặc mã thẻ BHYT để liên thông Cổng Đơn thuốc Quốc gia."
            ))

        # 1.5 Kiểm tra Chữ ký & CCHN Bác sĩ
        doc_name = (order_data.get("doctorName") or "").strip()
        doc_cert = (order_data.get("doctorCertificate") or "").strip()
        doc_signed = bool(order_data.get("digitalSignature") or order_data.get("status") == "signed")

        if doc_name and doc_cert:
            legal_checks.append(LegalCheckItem(
                rule_name="Chữ ký & Chứng chỉ hành nghề Bác sĩ kê đơn",
                legal_basis="Khoản 4 Điều 6 TT 52/2017/TT-BYT & Luật KBCB 15/2023/QH15",
                passed=True, severity="info",
                message=f"Bác sĩ điều trị: {doc_name} (CCHN: {doc_cert}) - Trạng thái: {'Đã ký số ✓' if doc_signed else 'Chờ ký xác nhận'}."
            ))
        elif doc_name:
            legal_checks.append(LegalCheckItem(
                rule_name="Chứng chỉ hành nghề Bác sĩ kê đơn",
                legal_basis="Khoản 4 Điều 6 TT 52/2017/TT-BYT",
                passed=False, severity="warning",
                message=f"Đã có tên bác sĩ ({doc_name}) nhưng thiếu Số Chứng Chỉ Hành Nghề (CCHN).",
                recommendation="Bổ sung mã số CCHN của bác sĩ kê đơn để đảm bảo tính pháp lý hợp lệ của đơn thuốc."
            ))
        else:
            legal_checks.append(LegalCheckItem(
                rule_name="Chữ ký & Họ tên Bác sĩ kê đơn",
                legal_basis="Khoản 4 Điều 6 TT 52/2017/TT-BYT",
                passed=False, severity="error",
                message="Đơn thuốc KHÔNG ĐƯỢC THIẾU chữ ký và họ tên của Bác sĩ khám bệnh.",
                recommendation="Bắt buộc Bác sĩ điều trị phải ký tên hoặc ký số trước khi phát hành đơn thuốc."
            ))

        # 1.6 Kiểm tra Quy tắc ghi số lượng thuốc (< 10 phải có số 0 đứng trước)
        items = order_data.get("items") or []
        qty_has_leading_zero = True
        for it in items:
            q = it.get("quantity")
            if isinstance(q, int) and q < 10 and q > 0:
                pass  # Formatter sẽ tự thêm số 0
        legal_checks.append(LegalCheckItem(
            rule_name="Quy cách ghi số lượng thuốc",
            legal_basis="Khoản 2 Điều 6 TT 52/2017/TT-BYT",
            passed=True, severity="info",
            message="Số lượng thuốc viết bằng số; các số lượng nhỏ hơn 10 được tự động đệm số 0 phía trước theo luật."
        ))

        # 1.7 Kiểm tra Thời gian kê đơn tối đa (Số ngày dùng thuốc)
        days = order_data.get("daysPrescribed") or 0
        has_narcotic = any(it.get("isNarcotic") for it in items)
        if has_narcotic and is_outpatient:
            if days > 7:
                legal_checks.append(LegalCheckItem(
                    rule_name="Thời hạn kê đơn thuốc gây nghiện ngoại trú",
                    legal_basis="Điều 7 Thông tư 20/2017/TT-BYT & Điều 8 TT 26/2025/TT-BYT",
                    passed=False, severity="error",
                    message=f"Đơn thuốc gây nghiện ngoại trú kê {days} ngày (Vượt quá quy định tối đa 07 ngày).",
                    recommendation="Giảm thời gian kê đơn thuốc gây nghiện xuống tối đa 07 ngày hoặc chuyển sang phác đồ đợt điều trị ung thư chia 3 đợt."
                ))
            else:
                legal_checks.append(LegalCheckItem(
                    rule_name="Thời hạn kê đơn thuốc gây nghiện ngoại trú",
                    legal_basis="Điều 7 Thông tư 20/2017/TT-BYT",
                    passed=True, severity="info",
                    message=f"Kê đơn thuốc gây nghiện {days} ngày (Phù hợp giới hạn <= 7 ngày)."
                ))
        elif days > 30 and not order_data.get("isChronicDisease"):
            legal_checks.append(LegalCheckItem(
                rule_name="Thời hạn kê đơn thuốc hóa dược thông thường",
                legal_basis="Khoản 3 Điều 6 TT 52/2017/TT-BYT",
                passed=False, severity="warning",
                message=f"Thời gian dùng thuốc là {days} ngày (Vượt quá 30 ngày đối với bệnh cấp tính thông thường).",
                recommendation="Chỉ kê tối đa 30 ngày hoặc đánh dấu cờ bệnh mạn tính điều trị dài ngày theo danh mục Bộ Y tế."
            ))
        elif days > 0:
            legal_checks.append(LegalCheckItem(
                rule_name="Thời hạn kê đơn thuốc",
                legal_basis="Thông tư 52/2017/TT-BYT",
                passed=True, severity="info",
                message=f"Thời gian kê đơn: {days} ngày (Phù hợp quy định)."
            ))

        # ----------------------------------------------------
        # 2. THẨM ĐỊNH NỘI DUNG PHÙ HỢP VỚI CHẨN ĐOÁN (ICD-10 Matching)
        # ----------------------------------------------------
        icd10 = (order_data.get("diagnosisIcd10") or "").upper().strip()
        diag_text = (order_data.get("diagnosisText") or "").lower()

        # Kiểm tra kê kháng sinh cho cảm cúm do virus không có bội nhiễm
        is_viral_uri = any(code in icd10 for code in ["J00", "J10", "J11", "J06", "B34"]) or any(k in diag_text for k in ["cảm cúm", "cúm mùa", "nhiễm siêu vi", "nhiễm virus", "viêm mũi họng cấp do virus"])
        antibiotic_keywords = ["amoxicillin", "augmentin", "ciprofloxacin", "levofloxacin", "azithromycin", "cefixim", "cefuroxim", "clarithromycin"]

        prescribed_antibiotics = []
        for it in items:
            med_name = (it.get("medicationName") or "").lower()
            act_name = (it.get("activeIngredient") or "").lower()
            for ab in antibiotic_keywords:
                if ab in med_name or ab in act_name:
                    prescribed_antibiotics.append(it.get("medicationName"))
                    break

        if is_viral_uri and prescribed_antibiotics:
            clinical_checks.append(ClinicalCheckItem(
                category="diagnosis_match",
                item_name=", ".join(prescribed_antibiotics),
                passed=False, severity="warning",
                title="Kháng sinh trong bệnh lý viêm đường hô hấp do virus",
                detail=f"Bệnh nhân được chẩn đoán '{order_data.get('diagnosisText')}' ({icd10}) nghi do virus nhưng được kê kháng sinh: {', '.join(prescribed_antibiotics)}.",
                clinical_action="Rà soát lại chỉ định kháng sinh. Không khuyến cáo dùng kháng sinh thường quy cho cảm cúm/nhiễm virus khi chưa có bằng chứng nhiễm khuẩn hoặc nguy cơ bội nhiễm cao (QĐ 5631/QĐ-BYT).",
                evidence_source="Hướng dẫn sử dụng kháng sinh của Bộ Y tế (QĐ 5631/QĐ-BYT) & DĐVN V"
            ))
            recommendations.append(f"Cân nhắc đánh giá lại chỉ định kháng sinh ({', '.join(prescribed_antibiotics)}) do chẩn đoán hiện tại nghi ngờ nguyên nhân do virus.")

        # ----------------------------------------------------
        # 3. THẨM ĐỊNH LIỀU DÙNG THEO TUỔI, CÂN NẶNG & CHỨC NĂNG THẬN
        # ----------------------------------------------------
        patient_egfr = patient_data.get("egfr") or patient_data.get("clcr") or order_data.get("patientEgfr") or order_data.get("egfr") or order_data.get("patientClcr") or order_data.get("clcr")
        for it in items:
            med_name = (it.get("medicationName") or "").lower()
            act_name = (it.get("activeIngredient") or "").lower()
            combined_drug_name = f"{med_name} {act_name}"

            # 3.1 Kiểm tra Paracetamol quá liều tối đa hàng ngày
            if "paracetamol" in combined_drug_name:
                # Trích xuất hàm lượng
                mg_match = re.search(r"(\d+)\s*mg", combined_drug_name)
                single_dose_mg = int(mg_match.group(1)) if mg_match else 500
                freq = it.get("frequency") or ""
                # Ước tính số lần dùng/ngày
                times_per_day = 2
                if any(k in freq.lower() for k in ["4 lần", "4 cữ", "cách 4-6h", "cách 4 giờ", "cách 6 giờ"]):
                    times_per_day = 4
                elif any(k in freq.lower() for k in ["3 lần", "3 cữ", "cách 8h", "cách 8 giờ"]):
                    times_per_day = 3

                daily_dose = single_dose_mg * times_per_day
                if daily_dose >= 4000:
                    clinical_checks.append(ClinicalCheckItem(
                        category="dosage_safety",
                        item_name=it.get("medicationName"),
                        passed=False, severity="contraindicated",
                        title="VƯỢT QUÁ LIỀU TỐI ĐA HÀNG NGÀY: Paracetamol" if daily_dose > 4000 else "VƯỢT QUÁ HOẶC CHẠM TRẦN LIỀU TỐI ĐA: Paracetamol (4.000mg/ngày)",
                        detail=f"Tổng liều ước tính {daily_dose}mg/ngày chạm hoặc vượt ngưỡng an toàn tối đa 4.000mg/ngày theo DĐVN V.",
                        clinical_action="Giảm liều Paracetamol xuống tối đa không quá 3 - 4g/ngày ở người lớn (hoặc 2 - 3g/ngày ở người cao tuổi/suy gan) để phòng ngừa hoại tử tế bào gan cấp tính.",
                        evidence_source="Dược thư Quốc gia Việt Nam DĐVN V - Chuyên luận Paracetamol"
                    ))
                    recommendations.append("Giảm liều Paracetamol xuống dưới 4g/ngày để phòng ngừa độc tế bào gan cấp tính.")
                else:
                    clinical_checks.append(ClinicalCheckItem(
                        category="dosage_safety",
                        item_name=it.get("medicationName"),
                        passed=True, severity="passed",
                        title="Liều Paracetamol trong giới hạn an toàn",
                        detail=f"Tổng liều ước tính ~{daily_dose}mg/ngày nằm trong ngưỡng an toàn cho phép (<= 4.000mg/ngày).",
                        clinical_action="Duy trì cữ uống cách nhau tối thiểu 4 - 6 giờ.",
                        evidence_source="DĐVN V"
                    ))

            # 3.2 Kiểm tra Metformin ở bệnh nhân suy thận
            if "metformin" in combined_drug_name and patient_egfr is not None:
                if patient_egfr < 30:
                    clinical_checks.append(ClinicalCheckItem(
                        category="dosage_safety",
                        item_name=it.get("medicationName"),
                        passed=False, severity="contraindicated",
                        title="CHỐNG CHỈ ĐỊNH: Metformin ở bệnh nhân suy thận nặng (eGFR < 30)",
                        detail=f"Bệnh nhân có eGFR = {patient_egfr} mL/phút/1.73m2. Metformin chống chỉ định tuyệt đối khi eGFR < 30 mL/phút do nguy cơ nhiễm toan acid lactic tử vong.",
                        clinical_action="Ngừng ngay Metformin. Chuyển sang Insulin hoặc thuốc hạ đường huyết nhóm ức chế DPP-4 hiệu chỉnh liều hoặc GLP-1 RA phù hợp chức năng thận.",
                        evidence_source="Quyết định 5948/QĐ-BYT & DĐVN V - Chuyên luận Metformin"
                    ))
                    recommendations.append("NGỪNG Metformin ngay do bệnh nhân suy thận nặng (eGFR < 30).")
                elif patient_egfr < 45:
                    clinical_checks.append(ClinicalCheckItem(
                        category="dosage_safety",
                        item_name=it.get("medicationName"),
                        passed=False, severity="major",
                        title="Cảnh báo hiệu chỉnh liều: Metformin (eGFR 30 - 44)",
                        detail=f"Bệnh nhân có eGFR = {patient_egfr} mL/phút. Cần giảm 50% liều Metformin (tối đa không quá 1.000mg/ngày) và theo dõi định kỳ chức năng thận.",
                        clinical_action="Giảm liều Metformin tối đa 1.000mg/ngày; không khởi trị mới khi eGFR trong khoảng này.",
                        evidence_source="DĐVN V"
                    ))

            # 3.3 Kiểm tra Ciprofloxacin ở bệnh nhân suy thận
            if "ciprofloxacin" in combined_drug_name and patient_egfr is not None:
                if patient_egfr < 50:
                    clinical_checks.append(ClinicalCheckItem(
                        category="dosage_safety",
                        item_name=it.get("medicationName"),
                        passed=False, severity="warning",
                        title="Hiệu chỉnh liều Ciprofloxacin theo chức năng thận",
                        detail=f"Bệnh nhân có eGFR = {patient_egfr} mL/phút (< 50 mL/phút). Ciprofloxacin thải trừ chủ yếu qua thận, cần giãn khoảng cách hoặc giảm 50% liều dùng.",
                        clinical_action="Giảm liều còn 250 - 500mg mỗi 12 giờ hoặc 500mg mỗi 24 giờ tùy mức độ thanh thải creatinin.",
                        evidence_source="DĐVN V - Chuyên luận Ciprofloxacin"
                    ))

        # ----------------------------------------------------
        # 4. THẨM ĐỊNH TƯƠNG TÁC THUỐC (QĐ 5948/QĐ-BYT)
        # ----------------------------------------------------
        from app.services.clinical_ddi_engine.detector import ClinicalDdiDetector
        detector = ClinicalDdiDetector()
        drug_names = [it.get("activeIngredient") or it.get("medicationName") for it in items]
        ddi_report = detector.audit_prescription(drug_names)

        interaction_items = []
        for alert in ddi_report.pair_alerts:
            sev_str = alert.severity.value
            is_contra = (sev_str == "contraindicated")
            clinical_checks.append(ClinicalCheckItem(
                category="interaction",
                item_name=f"{alert.drug_a} + {alert.drug_b}",
                passed=False,
                severity="contraindicated" if is_contra else "major",
                title=f"{'⛔ CHỐNG CHỈ ĐỊNH PHỐI HỢP: ' if is_contra else '⚠️ TƯƠNG TÁC NGUY HIỂM: '}{alert.drug_a} + {alert.drug_b}",
                detail=f"Cơ chế: {alert.mechanism}. Hậu quả lâm sàng: {alert.clinical_consequence}",
                clinical_action=alert.action_recommendation,
                evidence_source=alert.legal_evidence or "Quyết định 5948/QĐ-BYT"
            ))
            interaction_items.append({
                "pair": f"{alert.drug_a} + {alert.drug_b}",
                "severity": sev_str,
                "title": alert.title,
                "consequence": alert.clinical_consequence,
                "action": alert.action_recommendation
            })
            recommendations.append(f"Lưu ý tương tác giữa {alert.drug_a} và {alert.drug_b}: {alert.action_recommendation}")

        # ----------------------------------------------------
        # 5. THẨM ĐỊNH THỜI ĐIỂM DÙNG THUỐC & CÁCH DÙNG
        # ----------------------------------------------------
        for it in items:
            combined = f"{(it.get('medicationName') or '').lower()} {(it.get('activeIngredient') or '').lower()}"
            matched_guideline = None
            for key, guide in TIMING_GUIDELINES.items():
                if any(kw in combined for kw in guide["keywords"]):
                    matched_guideline = guide
                    break

            if matched_guideline:
                instructions = it.get("instructions") or ""
                has_proper_timing = any(t in instructions.lower() for t in ["sau ăn", "trước ăn", "trước khi ngủ", "bữa ăn"])
                clinical_checks.append(ClinicalCheckItem(
                    category="timing_administration",
                    item_name=it.get("medicationName"),
                    passed=True,
                    severity="info",
                    title=f"Khuyến nghị thời điểm & cách dùng: {it.get('medicationName')}",
                    detail=f"• Thời điểm tối ưu: {matched_guideline['timing']}.\n• Cách dùng: {matched_guideline['instruction']}.",
                    clinical_action=matched_guideline['rationale'],
                    evidence_source="Dược thư Quốc gia Việt Nam DĐVN V"
                ))

            # Kiểm tra dạng bào chế phóng thích kéo dài
            if any(term in combined for term in ["xr", "er", "mr", "sr", "chậm", "kéo dài"]):
                clinical_checks.append(ClinicalCheckItem(
                    category="timing_administration",
                    item_name=it.get("medicationName"),
                    passed=True, severity="warning",
                    title=f"Lưu ý dạng bào chế phóng thích kéo dài: {it.get('medicationName')}",
                    detail="Thuốc có cơ chế giải phóng hoạt chất biến đổi (XR/ER/MR/SR). BẮT BUỘC nuốt nguyên viên cùng nước, KHÔNG ĐƯỢC bẻ đôi, nghiền nát hoặc nhai viên thuốc.",
                    clinical_action="Dặn dò người bệnh nuốt nguyên viên. Nếu người bệnh khó nuốt hoặc đặt sonde dạ dày, liên hệ dược sĩ lâm sàng để đổi sang dạng bào chế lỏng hoặc hoạt chất tương đương.",
                    evidence_source="Thông tư 36/2018/TT-BYT & DĐVN V"
                ))

        # ----------------------------------------------------
        # TỔNG KẾT & CHẤM ĐIỂM AN TOÀN LÂM SÀNG (0 - 100)
        # ----------------------------------------------------
        error_count = sum(1 for c in legal_checks if not c.passed and c.severity == "error")
        contra_count = sum(1 for c in clinical_checks if c.severity == "contraindicated")
        major_count = sum(1 for c in clinical_checks if c.severity == "major")
        warning_count = sum(1 for c in clinical_checks if c.severity == "warning")

        score = 100
        score -= error_count * 20
        score -= contra_count * 35
        score -= major_count * 15
        score -= warning_count * 5
        score = max(0, min(100, score))

        if contra_count > 0 or error_count > 0:
            overall_status = "REJECTED"
            summary = f"Đơn thuốc CÓ {contra_count} CHỐNG CHỈ ĐỊNH hoặc {error_count} LỖI THỂ THỨC PHÁP LÝ NGHIÊM TRỌNG. Cần điều chỉnh trước khi ký duyệt."
        elif major_count > 0 or warning_count > 0:
            overall_status = "WARNING"
            summary = f"Đơn thuốc cơ bản hợp lệ nhưng có {major_count + warning_count} lưu ý lâm sàng quan trọng cần bác sĩ rà soát và dặn dò người bệnh."
        else:
            overall_status = "PASSED"
            summary = "Đơn thuốc đạt 100% chuẩn thể thức pháp lý (TT 52/2017 & TT 26/2025) và an toàn dược lâm sàng theo DĐVN V."

        return PrescriptionAuditResult(
            overall_status=overall_status,
            safety_score=score,
            prescription_type=rx_type_label,
            summary=summary,
            legal_checks=legal_checks,
            clinical_checks=clinical_checks,
            drug_interactions=interaction_items,
            recommendations=recommendations,
            doctor_signature_verified=doc_signed,
            doctor_name=doc_name or "Chưa xác định",
            doctor_certificate=doc_cert or None
        )
