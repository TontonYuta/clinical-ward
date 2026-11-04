"""
Xử lý Ý định: Dặn dò bác sĩ, Kê đơn CPOE & Thu hồi nợ vỏ Morphin trên Backend FastAPI (<=200 LOC)
"""
import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.debt import DebtRecord
from app.schemas.copilot import CopilotResponse, CopilotActionCard

async def handle_prescription_advice_intent(query: str, lower_query: str, user_name: str) -> CopilotResponse:
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
        "Dạ hệ thống đã sẵn sàng mở biểu mẫu dặn dò và gửi Email/SMS. Bác sĩ có thể nhập lời dặn, chọn lịch dùng thuốc và gửi trực tiếp tới bệnh nhân bằng nút bên dưới."
        if is_open_advice_form
        else "Để lập lời dặn, hãy mở hồ sơ người bệnh và chọn đơn thuốc đã kê. Trợ lý chỉ chuyển thông tin từ đơn thực tế sang biểu mẫu; không suy ra liều, thời điểm hoặc thời gian dùng từ nội dung chat."
    )

    return CopilotResponse(
        intent="PRESCRIPTION_ADVICE_CLARIFICATION",
        reply_text=reply,
        card=advice_card,
        answer_type="clarification", source_status="missing_selected_order", confidence=1.0,
        suggested_chips=["Mở form gửi email/sms", "Mở hồ sơ người bệnh", "Mở biểu mẫu lời dặn từ đơn đã chọn"]
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
            f"Dạ hệ thống đã sẵn sàng mở biểu mẫu kê đơn CPOE. Để lưu đơn theo Điều 6 Thông tư 26/2025/TT-BYT, bác sĩ vui lòng bổ sung: {', '.join(missing)} trực tiếp trong form hoặc gửi tại đây để em điền sẵn ạ."
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
