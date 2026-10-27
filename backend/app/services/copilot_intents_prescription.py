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
    patient_name = "Nguyễn Văn An"
    name_match = re.search(r"(?:bệnh nhân|cho|dặn dò|nhắc)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})", query)
    if name_match:
        patient_name = name_match.group(1).strip()
    elif "trí" in lower_query or "8820" in lower_query:
        patient_name = "Võ Minh Trí (BN-8820)"
    elif "mai" in lower_query:
        patient_name = "Trần Thị Mai"

    email_match = re.search(r"([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", query)
    patient_email = email_match.group(1) if email_match else ("tri.vm@hospital.vn" if "trí" in lower_query or "Trí" in patient_name else "an.nv@gmail.com")

    meds = []
    if any(k in lower_query for k in ["paracetamol", "panadol", "hạ sốt", "giảm đau"]):
        meds.append({"name": "Paracetamol 500mg", "inn": "Paracetamol", "dosage": "500mg"})
    if any(k in lower_query for k in ["augmentin", "amoxicillin", "kháng sinh"]):
        meds.append({"name": "Augmentin 1g", "inn": "Amoxicillin + Clavulanic", "dosage": "1g"})
    if any(k in lower_query for k in ["cipro", "ciprofloxacin"]):
        meds.append({"name": "Ciprofloxacin 500mg", "inn": "Ciprofloxacin", "dosage": "500mg"})
    if not meds:
        meds = [
            {"name": "Paracetamol 500mg", "inn": "Paracetamol", "dosage": "500mg"},
            {"name": "Augmentin 1g", "inn": "Amoxicillin + Clavulanic", "dosage": "1g"}
        ]

    card = CopilotActionCard(
        card_type="medication_schedule",
        title=f"Lịch Dặn Dò & Nhắc Uống Thuốc: {patient_name}",
        summary="Kê đơn & dặn dò cữ thuốc hàng ngày • Gửi mail qua Google Apps Script",
        data={
            "id": f"ADV-{int(datetime.now(timezone.utc).timestamp()) % 1000000}",
            "patientName": patient_name,
            "patientEmail": patient_email,
            "doctorName": user_name or "BS.CKII Trần Văn Hùng",
            "medications": meds,
            "diagnosis": "Nhiễm khuẩn hô hấp trên & Điều trị ngoại trú",
            "status": "pending"
        },
        primary_action_label="Gửi Email qua Google Script",
        primary_action_type="SEND_ADVICE_EMAIL",
        target_tab="debts"
    )

    reply_text = (
        f"### 📋 ĐÃ THIẾT LẬP LỊCH DẶN DÒ UỐNG THUỐC CHO BỆNH NHÂN\n\n"
        f"• **Bệnh nhân:** **{patient_name}**\n"
        f"• **Email nhận lịch:** `{patient_email}`\n"
        f"• **Số loại thuốc:** {len(meds)} mặt hàng ({', '.join(m['name'] for m in meds)})\n"
        f"• **Phương thức thông báo:** Tự động hóa qua Google Apps Script Webhook & Gmail API.\n\n"
        f"👉 Bác sĩ có thể bấm **[Gửi Email qua Google Script]** trên thẻ để gửi lịch uống thuốc trực tiếp tới bệnh nhân!"
    )

    return CopilotResponse(
        intent="PRESCRIPTION_ADVICE",
        reply_text=reply_text,
        card=card,
        legal_basis="Thông tư 52/2017/TT-BYT & QĐ 2147/QĐ-BYT - Điều 7",
        suggested_chips=[f"Gửi email nhắc thuốc cho {patient_name}", "In phiếu dặn dò uống thuốc", "Đối soát ca trực 07:00 AM"]
    )

async def handle_cpoe_intent(query: str, lower_query: str, user_name: str) -> CopilotResponse:
    patient_name = "Nguyễn Văn An"
    name_match = re.search(r"(?:bệnh nhân|cho|bn)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})", query)
    if name_match:
        patient_name = name_match.group(1).strip()
    elif "mai" in lower_query:
        patient_name = "Trần Thị Mai"

    card = CopilotActionCard(
        card_type="cpoe_prescription",
        title=f"Đơn Thuốc Điện Tử CPOE: {patient_name}",
        summary="Kê đơn điều trị ngoại trú • Căn cứ TT 52/2017/TT-BYT",
        data={
            "patientName": patient_name,
            "doctorName": user_name or "BS. Đỗ Minh Tuấn",
            "diagnosis": "Viêm đường hô hấp trên",
            "items": [
                {"name": "Augmentin 1g", "dosage": "1 viên", "frequency": "Ngày 2 lần sau ăn", "quantity": 14, "unit": "viên"},
                {"name": "Paracetamol 500mg", "dosage": "1 viên", "frequency": "Uống khi sốt >=38.5C", "quantity": 10, "unit": "viên"}
            ]
        },
        primary_action_label="Ký Duyệt Đơn Thuốc CPOE",
        primary_action_type="SIGN_CPOE_PRESCRIPTION",
        target_tab="debts"
    )
    return CopilotResponse(
        intent="CPOE_PRESCRIPTION",
        reply_text=f"### 📋 DỰ THẢO ĐƠN THUỐC ĐIỆN TỬ CPOE CHO BỆNH NHÂN **{patient_name}**\n\n"
                   f"• **Chẩn đoán:** Viêm đường hô hấp trên\n"
                   f"• **Thuốc kê:** Augmentin 1g (14 viên), Paracetamol 500mg (10 viên)\n"
                   f"• **Quy chế:** Theo Điều 6 & 7 Thông tư 52/2017/TT-BYT về đơn thuốc điện tử bệnh viện.",
        card=card,
        legal_basis="Thông tư 52/2017/TT-BYT - Quy chế kê đơn thuốc",
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
