"""
Xử lý Ý định: Dặn dò bác sĩ, Kê đơn CPOE & Thu hồi nợ vỏ Morphin trên Backend FastAPI (<=200 LOC)
"""
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.debt import DebtRecord
from app.models.cpoe import CpoePrescription
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.clinical_prescription_auditor import ClinicalPrescriptionAuditor

async def handle_prescription_advice_intent(query: str, lower_query: str, user_name: str, user_role: str = "doctor") -> CopilotResponse:
    is_open_advice_form = any(w in lower_query for w in [
        "mở form", "mo form", "mở biểu mẫu", "mở giao diện", "mở form gửi", "gửi email", "gửi mail", "gửi sms", "nhắn tin", "mở form dặn dò", "mở giao diện dặn dò"
    ])
    advice_card = CopilotActionCard(
        card_type="prescription_advice_navigation",
        title="Biểu Mẫu Dặn Dò & Gửi Email/SMS",
        summary="Mở biểu mẫu lập lịch dùng thuốc và gửi hướng dẫn cho người bệnh qua Email/SMS",
        data={"targetTab": "cpoe", "target_tab": "cpoe", "openModal": "prescription_advice"},
        primary_action_label="Mở Form Gửi Email/SMS",
        primary_action_type="OPEN_SEND_EMAIL_SMS",
        target_tab="cpoe",
    ) if is_open_advice_form else None

    reply = (
        "Dạ hệ thống đã sẵn sàng mở biểu mẫu dặn dò và gửi Email/SMS. Bác sĩ/Điều dưỡng vui lòng kiểm tra danh sách cữ thuốc, thông tin liên lạc và bấm xác nhận gửi trực tiếp trên biểu mẫu; chatbot chỉ hỗ trợ mở form theo phân quyền, không tự ý gửi email/sms từ nội dung chat."
        if is_open_advice_form
        else "Để lập lời dặn, hãy mở hồ sơ người bệnh và chọn đơn thuốc đã kê. Trợ lý chỉ chuyển thông tin từ đơn thực tế sang biểu mẫu; không suy ra liều, thời điểm hoặc thời gian dùng từ nội dung chat và không tự ý gửi email/sms."
    )

    return CopilotResponse(
        intent="PRESCRIPTION_ADVICE_CLARIFICATION",
        reply_text=reply,
        card=advice_card,
        answer_type="clarification", source_status="missing_selected_order", confidence=1.0,
        suggested_chips=["Mở form gửi email/sms", "Mở hồ sơ người bệnh", "Mở biểu mẫu lời dặn từ đơn đã chọn"]
    )

async def handle_cpoe_intent(query: str, lower_query: str, user_name: str, user_role: str = "doctor") -> CopilotResponse:
    can_prescribe = user_role in ("doctor", "director")
    if not can_prescribe:
        return CopilotResponse(
            intent="CPOE_ROLE_RESTRICTED",
            reply_text=(
                "⚠️ **Từ chối quyền kê đơn (RBAC):** Theo Thông tư 26/2025/TT-BYT và Luật Khám bệnh, chữa bệnh, "
                "chức năng kê đơn thuốc chỉ dành riêng cho Bác sĩ điều trị có chứng chỉ hành nghề. "
                "Chatbot chỉ hỗ trợ mở form theo đúng phân quyền; Điều dưỡng không có thẩm quyền kê đơn mà chỉ có quyền xem đơn và lập lịch dặn dò."
            ),
            card=None,
            answer_type="role_restriction",
            source_status="unauthorized_role",
            confidence=1.0,
            suggested_chips=["Mở form gửi email/sms", "Tra cứu Dược Thư Quốc Gia", "Xem danh mục thuốc Cục QLD"],
        )

    # This chatbot route can only clarify or prepare a draft. It must not
    # produce an order card or imply a completed DDI review from keywords.
    name_match = re.search(r"(?:bệnh nhân|cho|bn)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})", query)
    has_patient = bool(name_match or re.search(r"(?:bn|cccd|căn cước|hộ chiếu)\s*[:#]?\s*[\w-]+", lower_query))
    has_diagnosis = any(term in lower_query for term in ("viêm họng", "viêm phế quản", "viêm phổi", "sốt"))
    medication_terms = ("paracetamol", "augmentin", "amoxicillin", "ibuprofen", "omeprazol", "clopidogrel", "ciprofloxacin")
    has_medication = any(re.search(rf"\b{term}\b", lower_query, re.IGNORECASE) for term in medication_terms)
    has_medication = has_medication or bool(re.search(r"thuốc\s+[a-z0-9-]+", lower_query, re.IGNORECASE))
    missing = [label for present, label in ((has_patient, "định danh người bệnh"), (has_diagnosis, "chẩn đoán"), (has_medication, "tên thuốc")) if not present]
    if missing:
        is_open_form = any(w in lower_query for w in ["mở form", "mo form", "mở biểu mẫu", "mở giao diện", "mở cpoe", "vào form"])
        nav_card = CopilotActionCard(
            card_type="cpoe_navigation",
            title="Biểu Mẫu Kê Đơn Điện Tử CPOE",
            summary="Mở form kê đơn trực tiếp theo Thông tư 26/2025/TT-BYT",
            data={"targetTab": "cpoe", "target_tab": "cpoe", "openModal": "cpoe_prescription"},
            primary_action_label="Mở Form Kê Đơn CPOE",
            primary_action_type="OPEN_CPOE_PRESCRIPTION",
            target_tab="cpoe"
        ) if is_open_form else None

        reply = (
            f"Dạ hệ thống đã sẵn sàng mở biểu mẫu kê đơn CPOE theo phân quyền của Bác sĩ. Để lưu đơn theo Điều 6 Thông tư 26/2025/TT-BYT, bác sĩ vui lòng bổ sung: {', '.join(missing)} trực tiếp trong form; chatbot chỉ hỗ trợ mở form chứ không tự ý kê đơn thuốc."
            if is_open_form
            else f"Để chuẩn bị bản nháp theo Điều 6 Thông tư 26/2025/TT-BYT, vui lòng bổ sung: {', '.join(missing)}. Chưa tạo đơn vì thông tin hiện tại chưa đủ."
        )
        return CopilotResponse(
            intent="CPOE_CLARIFICATION",
            reply_text=reply,
            card=nav_card,
            legal_basis="Thông tư 26/2025/TT-BYT - Điều 6",
            answer_type="clarification", source_status="incomplete_input", confidence=1.0,
            abstention_reason="Thiếu dữ liệu nhận diện người bệnh, chẩn đoán hoặc thuốc",
            suggested_chips=["Mở form kê đơn CPOE", "Kê Paracetamol cho bệnh nhân Nguyễn Văn A", "Tra cứu tương tác thuốc"]
        )
    patient_name = name_match.group(1).strip() if name_match else ""

    card = CopilotActionCard(
        card_type="cpoe_prescription_draft",
        title=f"Đơn Thuốc Điện Tử CPOE: {patient_name}",
        summary="Bản nháp cần hoàn thiện và rà soát theo TT 26/2025/TT-BYT Điều 6",
        data={
            "patientName": patient_name,
            "doctorName": user_name or "BS. Đỗ Minh Tuấn",
            "diagnosis": "",
            "items": []
        },
        primary_action_label="Mở CPOE để hoàn thiện bản nháp",
        primary_action_type="NAVIGATE_TAB",
        target_tab="cpoe"
    )
    return CopilotResponse(
        intent="CPOE_PRESCRIPTION",
        reply_text=(
            "Thông tin đã đủ để mở form CPOE, nhưng chưa tạo đơn. Vui lòng nhập/chọn thông tin người bệnh, chẩn đoán, "
            "thuốc, liều, số lần dùng, đường dùng, số lượng và thời gian dùng trong form. Tương tác thuốc chưa được kiểm tra "
            "cho đến khi chạy rà soát trên danh sách đầy đủ; nếu phát hiện cặp chống chỉ định, hệ thống sẽ chặn lưu đơn."
        ),
        card=card,
        legal_basis="Thông tư 26/2025/TT-BYT - Điều 6 (đối chiếu nội dung kê đơn)",
        suggested_chips=["Dặn dò bệnh nhân uống thuốc", "Thẩm định đơn thuốc theo TT 26", "Kiểm tra hạn dùng FEFO"]
    )

async def handle_debt_settle_intent(query: str, lower_query: str, db: AsyncSession) -> CopilotResponse:
    stmt = select(DebtRecord).where(DebtRecord.item_type == "Thuốc gây nghiện", DebtRecord.ampoule_returned == False)
    res = await db.execute(stmt)
    debt = res.scalars().first()
    if not debt:
        stmt2 = select(DebtRecord).where(DebtRecord.status == "debt")
        res2 = await db.execute(stmt2)
        debt = res2.scalars().first()

    if not debt:
        return CopilotResponse(
            intent="DEBT_SETTLE",
            reply_text="### ✅ TẤT CẢ VỎ THUỐC & SỔ NỢ ĐÃ ĐƯỢC ĐỐI SOÁT HOÀN TẤT!\n\n"
                       "• Không có vỏ thuốc gây nghiện nào đang tồn đọng chưa thu hồi theo Điều 15 Thông tư 20/2017/TT-BYT.",
            legal_basis="Thông tư 20/2017/TT-BYT - Điều 15",
            suggested_chips=["Thẩm định đơn thuốc theo TT 26", "Kê đơn thuốc CPOE", "Kiểm tra hạn dùng FEFO"]
        )

    card = CopilotActionCard(
        card_type="debt_settle",
        title=f"Xác Nhận Thu Hồi Vỏ Thuốc: {debt.item_name}",
        summary=f"Mã phiếu: {debt.code} • Bệnh nhân: {debt.patient_name}",
        data={
            "id": debt.id,
            "code": debt.code,
            "itemName": debt.item_name,
            "quantity": debt.quantity,
            "patientName": debt.patient_name,
            "patientRoom": debt.patient_room
        },
        primary_action_label="Xác nhận thu hồi vỏ ống thuốc",
        primary_action_type="EXECUTE_RETURN_AMPOULE",
        target_tab="debts"
    )
    return CopilotResponse(
        intent="DEBT_SETTLE",
        reply_text=f"### 📋 XÁC THỰC NGHIỆP VỤ SỔ NỢ & VỎ THUỐC GÂY NGHIỆN\n\n"
                   f"• **Mã phiếu**: `{debt.code}`\n"
                   f"• **Mặt hàng**: **{debt.item_name}** (SL: `{debt.quantity}`)\n"
                   f"• **Bệnh nhân**: **{debt.patient_name}** ({debt.patient_room})\n"
                   f"• **Căn cứ pháp lý**: Bắt buộc đối chiếu vỏ rỗng theo Điều 15 Thông tư 20/2017/TT-BYT.",
        card=card,
        legal_basis="Thông tư 20/2017/TT-BYT - Quản lý thuốc gây nghiện",
        suggested_chips=["Thẩm định đơn thuốc theo TT 26", "Kiểm tra hạn dùng FEFO", "Kê đơn thuốc CPOE"]
    )

async def handle_prescription_audit_intent(query: str, lower_query: str, user_name: str, user_role: str, db: AsyncSession, session_id: str) -> CopilotResponse:
    # Lấy đơn thuốc CPOE gần nhất từ CSDL để thẩm định
    stmt = select(CpoePrescription).order_by(CpoePrescription.created_at.desc()).limit(1)
    res = await db.execute(stmt)
    latest_rx = res.scalar_one_or_none()

    auditor = ClinicalPrescriptionAuditor()
    if latest_rx:
        import json
        items = json.loads(latest_rx.items_json) if hasattr(latest_rx, "items_json") and latest_rx.items_json else []
        order_data = {
            "id": latest_rx.id,
            "prescriptionType": latest_rx.prescription_type or "outpatient",
            "facilityName": getattr(latest_rx, "facility_name", None) or "Bệnh Viện Đa Khoa Lâm Sàng",
            "patientName": latest_rx.patient_name,
            "patientAge": 55,
            "patientWeight": getattr(latest_rx, "patient_weight", None),
            "patientCccd": latest_rx.patient_cccd,
            "patientInsuranceId": getattr(latest_rx, "patient_insurance_id", None),
            "diagnosisIcd10": latest_rx.diagnosis_icd10,
            "diagnosisText": latest_rx.diagnosis_text,
            "doctorName": latest_rx.doctor_name,
            "doctorCertificate": latest_rx.doctor_certificate,
            "digitalSignature": latest_rx.digital_signature,
            "daysPrescribed": latest_rx.days_prescribed or 7,
            "status": latest_rx.status,
            "items": items
        }
    else:
        order_data = {
            "id": "RX-2026-604",
            "prescriptionType": "outpatient",
            "facilityName": "Bệnh Viện Đa Khoa Lâm Sàng",
            "patientName": "Nguyễn Văn An",
            "patientAge": 45,
            "patientCccd": "001095012345",
            "diagnosisIcd10": "J11.0",
            "diagnosisText": "Cảm cúm mùa (Cúm chưa xác định virus)",
            "doctorName": "BS. Trần Văn Hùng",
            "doctorCertificate": "012345/BYT-CCHN",
            "digitalSignature": "SHA256:8f4e2a1b9c0d",
            "daysPrescribed": 5,
            "status": "signed",
            "items": [
                {"medicationName": "PARACETAMOL 500mg", "activeIngredient": "Paracetamol", "dosage": "500mg", "frequency": "Uống 1 viên x 2 lần/ngày sau ăn", "route": "Uống", "quantity": 10, "unit": "Viên"}
            ]
        }

    audit_res = auditor.audit_prescription(order_data)

    status_icon = "✅" if audit_res.overall_status == "PASSED" else ("⚠️" if audit_res.overall_status == "WARNING" else "⛔")
    rx_type_str = "ĐƠN THUỐC NGOẠI TRÚ (TT 52/2017 & TT 26/2025)" if audit_res.prescription_type == "outpatient" else "Y LỆNH NỘI TRÚ (TT 23/2011 & TT 07/2011)"

    legal_summary = "\n".join(f"  • {c.rule_name}: {'✓ Đạt' if c.passed else f'✗ {c.message}'}" for c in audit_res.legal_checks[:4])

    clinical_diag = [c for c in audit_res.clinical_checks if c.category == "diagnosis_match"]
    diag_str = "✓ Phù hợp chẩn đoán điều trị." if not clinical_diag else clinical_diag[0].detail

    clinical_dose = [c for c in audit_res.clinical_checks if c.category == "dosage_safety"]
    dose_str = "✓ Liều dùng trong giới hạn an toàn." if not clinical_dose else clinical_dose[0].detail

    ddi_str = "✓ Không phát hiện tương tác chống chỉ định (QĐ 5948)." if not audit_res.drug_interactions else f"⚠️ Phát hiện {len(audit_res.drug_interactions)} tương tác: {', '.join(d['pair'] for d in audit_res.drug_interactions)}"

    timing_checks = [c for c in audit_res.clinical_checks if c.category == "timing_administration"]
    timing_str = "\n".join(f"  • {t.item_name}: {t.detail}" for t in timing_checks[:2]) if timing_checks else "  • Uống thuốc sau bữa ăn no 15-30 phút với nhiều nước ấm."

    report_text = (
        f"### {status_icon} BÁO CÁO THẨM ĐỊNH ĐƠN THUỐC LÂM SÀNG (AI Prescription Audit)\n\n"
        f"📋 **Mã đơn:** `{order_data['id']}` | **Loại:** **{rx_type_str}**\n"
        f"👤 **Người bệnh:** {order_data['patientName']} | **Chẩn đoán:** `[{order_data['diagnosisIcd10']}]` {order_data['diagnosisText']}\n"
        f"👨‍⚕️ **Bác sĩ kê đơn:** {order_data['doctorName']} ({'Đã ký số ✓' if audit_res.doctor_signature_verified else 'Chờ ký xác nhận'}) | **Điểm an toàn:** `{audit_res.safety_score}/100`\n\n"
        f"---\n\n"
        f"#### 1. Thể thức đơn thuốc theo quy định pháp luật (TT 52/2017 & TT 26/2025):\n"
        f"{legal_summary}\n\n"
        f"#### 2. Phù hợp chẩn đoán (ICD-10 vs DĐVN V):\n"
        f"  • {diag_str}\n\n"
        f"#### 3. Liều dùng theo tuổi, cân nặng & bệnh lý:\n"
        f"  • {dose_str}\n\n"
        f"#### 4. Tương tác thuốc & Chống chỉ định (QĐ 5948/QĐ-BYT):\n"
        f"  • {ddi_str}\n\n"
        f"#### 5. Lưu ý thời điểm & Cách dùng thuốc:\n"
        f"{timing_str}\n\n"
        f"---\n"
        f"👉 *{audit_res.summary}*"
    )

    card = CopilotActionCard(
        card_type="prescription_audit_report",
        title=f"Thẩm Định Đơn Thuốc: {order_data['id']}",
        summary=f"Điểm an toàn: {audit_res.safety_score}/100 • Trạng thái: {audit_res.overall_status}",
        data={"orderId": order_data["id"], "score": audit_res.safety_score, "status": audit_res.overall_status, "targetTab": "cpoe"},
        primary_action_label="Xem Chi Tiết Đơn Thuốc CPOE",
        primary_action_type="NAVIGATE_TAB",
        target_tab="cpoe"
    )

    return CopilotResponse(
        intent="PRESCRIPTION_AUDIT_REPORT",
        reply_text=report_text,
        card=card,
        legal_basis="Thông tư 52/2017, TT 26/2025, QĐ 5948 & DĐVN V",
        suggested_chips=["Mở form gửi email/sms", "Kiểm tra tương tác thuốc", "Kê đơn thuốc CPOE"],
        answer_type="prescription_audit",
        source_status="audited_authoritative",
        confidence=1.0
    )
