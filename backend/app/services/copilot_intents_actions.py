import re
from datetime import datetime
# Legacy inventory handlers are retained below only as compatibility adapters.
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.equipment import EquipmentTicket
from app.services.copilot_catalog import find_matched_med, find_matched_eq, MEDICATION_CATALOG
from app.schemas.copilot import CopilotResponse, CopilotActionCard

async def handle_borrow_intent(query: str, lower_query: str, user_name: str) -> CopilotResponse:
    matched_med = find_matched_med(lower_query) or MEDICATION_CATALOG[0]
    is_narcotic = matched_med["type"] == "Thuốc gây nghiện"
    qty_match = re.search(r"(\d+)\s*(?:lọ|ống|bộ|cái|hộp|liều|chai|viên)?", lower_query)
    qty = int(qty_match.group(1)) if qty_match else 2

    room = "Buồng Cấp Cứu 3 - Giường 02"
    if "phòng mổ" in lower_query or "mổ" in lower_query:
        room = "Phòng mổ 1 - Khu Phẫu thuật"
    elif "icu" in lower_query:
        room = "Hồi sức tích cực ICU - Giường 05"

    patient = "Nguyễn Văn An (BN-8820)"
    if "lan" in lower_query:
        patient = "Đặng Thị Lan (BN-8825)"
    elif "đăng" in lower_query:
        patient = "Nguyễn Hải Đăng (BN-8791)"

    card = CopilotActionCard(
        card_type="borrow_confirm",
        title="Phiếu Xuất Mượn Khẩn Cấp Cứu (Mẫu TT 22)",
        summary=f"Xuất mượn {qty} {matched_med['unit']} {matched_med['name']} cho {patient}",
        data={
            "item_name": matched_med["name"],
            "item_type": matched_med["type"],
            "quantity": qty,
            "quantity_str": f"{qty} {matched_med['unit']}",
            "unit": matched_med["unit"],
            "patient_name": patient,
            "patient_room": room,
            "is_narcotic": is_narcotic,
            "clinical_reason": "Cấp cứu cơn đau cấp / hồi sức khẩn cấp",
            "suggested_borrower": user_name
        },
        primary_action_label="Ký Xác Thực & Xuất Kho",
        primary_action_type="EXECUTE_BORROW",
        target_tab="debts"
    )
    narcotic_warn = "\n> [!WARNING]\n> **Thuốc gây nghiện (TT 20/2017):** Bắt buộc thu hồi vỏ ống đã tiêm." if is_narcotic else ""
    return CopilotResponse(
        intent="BORROW_EMERGENCY_ITEM",
        reply_text=f"### 💊 Y LỆNH XUẤT MƯỢN THUỐC CẤP CỨU\n\n• **Dược phẩm:** **{matched_med['name']}**\n• **Số lượng:** `{qty} {matched_med['unit']}`\n• **Bệnh nhân:** `{patient}` ({room})\n{narcotic_warn}",
        card=card,
        legal_basis="Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT",
        suggested_chips=["Xác nhận xuất mượn", "Hủy yêu cầu"]
    )

async def handle_equipment_intent(query: str, lower_query: str, user_name: str, db: AsyncSession) -> CopilotResponse:
    matched_eq = find_matched_eq(lower_query)
    eq_name = matched_eq["name"] if matched_eq else "Máy thở Puritan Bennett 840"
    eq_model = matched_eq["model"] if matched_eq else "PB840 Ventilator - Medtronic"
    eq_risk = matched_eq["risk"] if matched_eq else "D"

    urgency = "urgent" if any(w in lower_query for w in ["khẩn", "gấp", "mổ", "ngay", "ngừng", "chập", "cháy", "xì khí"]) else "standard"
    loc = "Phòng Mổ 2 - Tầng 3 Nhà Ngoại Khoa"
    if "buồng" in lower_query or "phòng" in lower_query:
        m = re.search(r"(phòng|buồng|khoa)\s+([A-Za-z0-9\s\-]+?)(?=\s+(?:bị|hỏng|lỗi|$))", lower_query)
        if m:
            loc = f"{m.group(1).title()} {m.group(2).strip().upper()}"

    issue = "Báo hỏng bất thường khi đang vận hành lâm sàng"
    if "xì khí" in lower_query or "bẫy nước" in lower_query:
        issue = "Xì khí đường thở áp lực cao, nứt bẫy nước bẫy ẩm"
    elif "pin" in lower_query:
        issue = "Lỗi mạch sạc dự phòng, chai pin không tích đủ năng lượng sốc"
    elif "ecg" in lower_query or "mất tín hiệu" in lower_query:
        issue = "Đứt cáp dẫn tín hiệu 5 đầu đạo trình ECG, nhiễu sóng cao tần"
    elif "kẹt" in lower_query or "pít-tông" in lower_query:
        issue = "Kẹt ngàm kẹp cơ khí pít-tông bơm tiêm điện"

    card = CopilotActionCard(
        card_type="incident_confirm",
        title="Phiếu Báo Hỏng Thiết Bị Y Tế Khẩn (NĐ 98/2021)",
        summary=f"Sự cố kỹ thuật: {eq_name}",
        data={
            "device_name": eq_name,
            "model": eq_model,
            "risk_class": eq_risk,
            "location": loc,
            "urgency": urgency,
            "accessory_issue": issue,
            "reported_by": user_name
        },
        primary_action_label="Gửi Lệnh Báo Hỏng Kỹ Sư BME",
        primary_action_type="EXECUTE_INCIDENT",
        target_tab="equipment"
    )
    return CopilotResponse(
        intent="REPORT_EQUIPMENT_INCIDENT",
        reply_text=f"### ⚠️ TIẾP NHẬN BÁO HỎNG TRANG THIẾT BỊ Y TẾ\n\n• **Thiết bị:** **{eq_name}** (Phân loại rủi ro: Loại {eq_risk})\n• **Vị trí:** `{loc}`\n• **Hiện tượng lỗi:** `{issue}`",
        card=card,
        legal_basis="Điều 34 Nghị định 98/2021/NĐ-CP về Quản lý Trang thiết bị Y tế",
        suggested_chips=["Gửi phiếu báo hỏng", "Điều phối thiết bị thay thế"]
    )

async def handle_fefo_intent(db: AsyncSession) -> CopilotResponse:
    """Compatibility adapter; the former inline FEFO handler is retired."""
    from app.domains.pharmacy_inventory.tools import PharmacyInventoryTools
    return await PharmacyInventoryTools().execute_fefo(db)


async def handle_restock_intent(db: AsyncSession) -> CopilotResponse:
    """Compatibility adapter; the former inline restock handler is retired."""
    from app.domains.pharmacy_inventory.tools import PharmacyInventoryTools
    return await PharmacyInventoryTools().execute_restock(db)
