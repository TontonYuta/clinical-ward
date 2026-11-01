"""
Xử lý Ý định: Dặn dò bác sĩ, Kê đơn CPOE & Thu hồi nợ vỏ Morphin trên Backend FastAPI (<=200 LOC)
"""
import re
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.debt import DebtRecord
from app.schemas.copilot import CopilotResponse, CopilotActionCard

async def handle_prescription_advice_intent(query: str, lower_query: str, user_name: str) -> CopilotResponse:
    name_match = re.search(r"(?:bệnh nhân|cho|dặn dò|nhắc)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})", query)
    if not name_match:
        return CopilotResponse(intent="PRESCRIPTION_ADVICE", reply_text="Bạn muốn lập lời dặn cho người bệnh nào? Vui lòng chọn hồ sơ người bệnh trước.", answer_type="clarification", source_status="incomplete_input", confidence=1.0)
    patient_name = name_match.group(1).strip()

    email_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", query)
    patient_email = email_match.group(1) if email_match else None

    meds = []
    if any(k in lower_query for k in ["paracetamol", "panadol", "hạ sốt", "giảm đau"]):
        meds.append({"name": "Paracetamol 500mg", "inn": "Paracetamol", "dosage": "500mg"})
    if any(k in lower_query for k in ["augmentin", "amoxicillin", "kháng sinh"]):
        meds.append({"name": "Augmentin 1g", "inn": "Amoxicillin + Clavulanic", "dosage": "1g"})
    if any(k in lower_query for k in ["cipro", "ciprofloxacin"]):
        meds.append({"name": "Ciprofloxacin 500mg", "inn": "Ciprofloxacin", "dosage": "500mg"})
    if not meds:
        return CopilotResponse(intent="PRESCRIPTION_ADVICE", reply_text="Vui lòng nêu tên thuốc hoặc chọn đơn thuốc cần lập lời dặn.", answer_type="clarification", source_status="incomplete_input", confidence=1.0)

    card = CopilotActionCard(
        card_type="medication_schedule",
        title=f"Lịch Dặn Dò & Nhắc Uống Thuốc: {patient_name}",
        summary="Kê đơn & dặn dò cữ thuốc hàng ngày • Gửi mail qua Google Apps Script",
        data={
            "id": f"ADV-{int(datetime.now(timezone.utc).timestamp()) % 1000000}",
            "patientName": patient_name,
            "patientEmail": patient_email or "",
            "doctorName": user_name or "BS.CKII Trần Văn Hùng",
            "medications": meds,
            "diagnosis": "",
            "status": "pending"
        },
        primary_action_label="Gửi Email qua Google Script",
        primary_action_type="SEND_ADVICE_EMAIL",
        target_tab="debts"
    )

    reply_text = (
        f"### 📋 ĐÃ THIẾT LẬP LỊCH DẶN DÒ UỐNG THUỐC CHO BỆNH NHÂN\n\n"
        f"• **Bệnh nhân:** **{patient_name}**\n"
        f"• **Email nhận lịch:** `{patient_email or 'Chưa có - cần bổ sung trước khi gửi'}`\n"
        f"• **Số loại thuốc:** {len(meds)} mặt hàng ({', '.join(m['name'] for m in meds)})\n"
        f"• Lịch này là bản nháp, chưa gửi thông báo.\n\n"
        f"Vui lòng rà soát thông tin trước khi gửi."
    )

    return CopilotResponse(
        intent="PRESCRIPTION_ADVICE",
        reply_text=reply_text,
        card=card,
        legal_basis="Thông tư 52/2017/TT-BYT & QĐ 2147/QĐ-BYT - Điều 7",
        suggested_chips=[f"Gửi email nhắc thuốc cho {patient_name}", "In phiếu dặn dò uống thuốc", "Đối soát ca trực 07:00 AM"]
    )

async def handle_cpoe_intent(query: str, lower_query: str, user_name: str) -> CopilotResponse:
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
        return CopilotResponse(
            intent="CPOE_CLARIFICATION",
            reply_text=f"Để chuẩn bị bản nháp theo Điều 6 Thông tư 26/2025/TT-BYT, vui lòng bổ sung: {', '.join(missing)}. Chưa tạo đơn vì thông tin hiện tại chưa đủ.",
            legal_basis="Thông tư 26/2025/TT-BYT - Điều 6",
            answer_type="clarification", source_status="incomplete_input", confidence=1.0,
            abstention_reason="Thiếu dữ liệu nhận diện người bệnh, chẩn đoán hoặc thuốc"
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
        suggested_chips=["Dặn dò bệnh nhân uống thuốc", "Đối soát ca trực 07:00 AM", "Kiểm tra hạn dùng FEFO"]
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
            suggested_chips=["Đối soát ca trực 07:00 AM", "Kê đơn thuốc CPOE", "Kiểm tra hạn dùng FEFO"]
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
        suggested_chips=["Đối soát ca trực 07:00 AM", "Lập dự trù bù thuốc Mẫu 01", "Kê đơn thuốc CPOE"]
    )
