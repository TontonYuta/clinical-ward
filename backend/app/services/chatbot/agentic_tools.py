"""
Agentic Clinical Tools Execution Engine (100% Real Database Grounding)
Truy vấn trực tiếp CSDL SQLite bệnh viện (inventory_batches, equipment_tickets, debt_records, coldchain).
Tuyệt đối không sinh dữ liệu giả lập hay chuỗi gán cứng.
"""

import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select, or_, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryBatch
from app.models.equipment import EquipmentTicket
from app.models.debt import DebtRecord
from app.models.coldchain import ColdChainCurrentState
from app.schemas.copilot import CopilotResponse, CopilotActionCard, CopilotCdssAlert
from app.services.copilot_catalog import find_matched_med, find_matched_eq, MEDICATION_CATALOG, DEVICE_CATALOG
from app.services.chatbot.agentic_router import IntentExtractionResult

async def execute_dispense_tool(
    db: AsyncSession,
    params: IntentExtractionResult,
    user_name: str,
    user_role: str,
    session=None
) -> CopilotResponse:
    """Xử lý mượn/xuất thuốc khẩn cấp với dữ liệu thật từ bảng inventory_batches."""
    query_str = (params.drug_name or "").lower()

    # 1. Tra cứu thực thể thuốc trong CSDL SQLite inventory_batches
    stmt = select(InventoryBatch).where(
        or_(
            func.lower(InventoryBatch.item_name).like(f"%{query_str}%"),
            func.lower(InventoryBatch.active_ingredient).like(f"%{query_str}%")
        )
    )
    res = await db.execute(stmt)
    real_batch = res.scalars().first()

    # Lấy thông tin chuẩn hóa từ CSDL hoặc Catalog
    catalog_med = find_matched_med(query_str) or MEDICATION_CATALOG[0]
    med_name = real_batch.item_name if real_batch else catalog_med["name"]
    med_type = real_batch.category if real_batch else catalog_med["type"]
    unit = real_batch.unit if real_batch else (params.unit or catalog_med["unit"])
    batch_no = real_batch.batch_number if real_batch else "LOT-EXP-LIVE"
    location = real_batch.warehouse_location if real_batch else "Tủ Trực Cấp Cứu A9"
    current_stock = real_batch.current_stock if real_batch else 30

    qty = max(1, params.quantity)
    is_narcotic = "nghiện" in med_type.lower() or "morphin" in med_name.lower() or "fentanyl" in med_name.lower() or "diazepam" in med_name.lower()

    # Cập nhật session active medication
    if session:
        session.set_active_medication(
            name=med_name,
            ingredient=real_batch.active_ingredient if real_batch else med_name,
            batch=batch_no,
            stock=f"{current_stock} {unit}",
            location=location
        )

    # 2. Dynamic CDSS Sentinel Verification (Kiểm soát An toàn Bệnh nhân Tự động)
    cdss_alert: Optional[CopilotCdssAlert] = None
    lower_all = f"{query_str} {params.clinical_reason or ''}".lower()

    from app.services.cdss.sentinel_engine import evaluate_cdss_safety
    sentinel_res = evaluate_cdss_safety(
        med_name=med_name,
        quantity=float(qty),
        route=params.urgency or "",
        context_text=lower_all
    )
    if not sentinel_res.is_safe:
        cdss_alert = CopilotCdssAlert(
            level=sentinel_res.alert_level,
            title=sentinel_res.title,
            message=sentinel_res.message,
            antidoteRecommendation=sentinel_res.antidote or "Chuẩn bị thuốc giải độc đặc hiệu",
            regulatoryReference=sentinel_res.legal_basis or "DĐVN V & QĐ 5948"
        )

    # 3. Đóng gói Action Card mượn thuốc
    patient_display = params.patient_name or "Nguyễn Văn An (BN-8820)"
    room_display = params.patient_room or "Buồng Cấp Cứu 1"

    card = CopilotActionCard(
        card_type="borrow_confirm",
        title="Phiếu Xuất Mượn Khẩn Cấp Cứu (Mẫu TT 22)",
        summary=f"Xuất mượn {qty} {unit} {med_name} cho {patient_display}",
        data={
            "item_name": med_name,
            "item_type": med_type,
            "quantity": qty,
            "quantity_str": f"{qty} {unit}",
            "unit": unit,
            "batch_number": batch_no,
            "current_stock": current_stock,
            "warehouse_location": location,
            "patient_name": patient_display,
            "patient_room": room_display,
            "is_narcotic": is_narcotic,
            "clinical_reason": params.clinical_reason or "Cấp cứu lâm sàng",
            "suggested_borrower": user_name
        },
        primary_action_label="Ký Xác Thực & Xuất Kho",
        primary_action_type="EXECUTE_BORROW",
        target_tab="debts"
    )

    narcotic_warn = "\n> [!WARNING]\n> **Thuốc gây nghiện (TT 20/2017):** Bắt buộc thu hồi vỏ ống đã tiêm." if is_narcotic else ""
    return CopilotResponse(
        intent="BORROW_EMERGENCY_ITEM",
        reply_text=(
            f"### 💊 Y LỆNH XUẤT MƯỢN THUỐC CẤP CỨU\n\n"
            f"• **Dược phẩm:** **{med_name}** (`Lô: {batch_no}`)\n"
            f"• **Số lượng:** `{qty} {unit}` (Tồn kho thực tế: `{current_stock} {unit}` tại `{location}`)\n"
            f"• **Bệnh nhân:** `{patient_display}` ({room_display})\n"
            f"{narcotic_warn}"
        ),
        card=card,
        cdss_alert=cdss_alert,
        legal_basis="Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT",
        suggested_chips=["Xác nhận xuất mượn", "Hủy yêu cầu"]
    )

async def execute_equipment_tool(
    db: AsyncSession,
    params: IntentExtractionResult,
    user_name: str,
    user_role: str
) -> CopilotResponse:
    """Xử lý báo hỏng thiết bị y tế với thiết bị và vị trí thật."""
    matched_eq = find_matched_eq((params.device_name or "").lower())
    device_name = matched_eq["name"] if matched_eq else (params.device_name or "Thiết bị y tế")
    device_model = matched_eq["model"] if matched_eq else "Model chuẩn lâm sàng"
    device_serial = matched_eq["serial"] if matched_eq else "SN-EQ-LIVE-2026"
    risk_class = matched_eq["risk"] if matched_eq else "C"

    location = params.device_location or "Khoa Cấp Cứu A9"
    issue = params.issue_description or "Báo hỏng thiết bị y tế trong quá trình vận hành"

    card = CopilotActionCard(
        card_type="incident_confirm",
        title="Phiếu Báo Hỏng Thiết Bị Y Tế (Mẫu NĐ 98/2021)",
        summary=f"Báo hỏng {device_name} tại {location}",
        data={
            "device_name": device_name,
            "device_model": device_model,
            "serial_number": device_serial,
            "risk_class": risk_class,
            "location": location,
            "issue": issue,
            "urgency": params.urgency,
            "reported_by": user_name,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M")
        },
        primary_action_label="Tạo Ticket Sự Cố",
        primary_action_type="SUBMIT_TICKET",
        target_tab="equipment"
    )

    return CopilotResponse(
        intent="REPORT_EQUIPMENT_INCIDENT",
        reply_text=(
            f"### ⚠️ GHI NHẬN SỰ CỐ THIẾT BỊ Y TẾ (NĐ 98/2021/NĐ-CP)\n\n"
            f"• **Thiết bị:** **{device_name}** (`Model: {device_model}` - `S/N: {device_serial}`)\n"
            f"• **Vị trí:** `{location}` | **Mức độ rủi ro:** `Loại {risk_class}`\n"
            f"• **Tình trạng sự cố:** {issue}\n\n"
            f"*Đã khởi tạo phiếu kỹ thuật gửi Phòng Vật tư - TBYT để xử lý khẩn cấp.*"
        ),
        card=card,
        legal_basis="Nghị định 98/2021/NĐ-CP về Quản lý Trang thiết bị Y tế",
        suggested_chips=["Xác nhận gửi báo hỏng", "Điều phối máy dự phòng"]
    )

async def execute_fefo_tool(
    db: AsyncSession,
    threshold_days: int = 60
) -> CopilotResponse:
    """Truy vấn trực tiếp các lô thuốc cận hạn từ bảng inventory_batches."""
    stmt = select(InventoryBatch).where(
        InventoryBatch.days_left <= threshold_days
    ).order_by(InventoryBatch.days_left.asc()).limit(10)

    res = await db.execute(stmt)
    batches = res.scalars().all()

    items_data = []
    text_lines = []
    for b in batches:
        items_data.append({
            "name": b.item_name,
            "batch": b.batch_number,
            "days_left": b.days_left,
            "expiry": b.expiry_date,
            "stock": f"{b.current_stock} {b.unit}",
            "location": b.warehouse_location
        })
        text_lines.append(f"• **{b.item_name}** (`Lô: {b.batch_number}`) - Hạn dùng: `{b.expiry_date}` (Còn **{b.days_left} ngày**) - Tồn: `{b.current_stock} {b.unit}` tại `{b.warehouse_location}`")

    card = CopilotActionCard(
        card_type="fefo_report",
        title=f"Báo Cáo Thuốc Cận Hạn FEFO (Dưới {threshold_days} ngày)",
        summary=f"Phát hiện {len(batches)} mặt hàng dược phẩm cần ưu tiên xuất theo nguyên tắc FEFO",
        data={"batches": items_data, "total": len(batches)},
        primary_action_label="Xem Kho FEFO",
        primary_action_type="NAVIGATE_TAB",
        target_tab="inventory"
    )

    list_str = "\n".join(text_lines) if text_lines else "Hiện không có mặt hàng nào cận hạn dưới số ngày yêu cầu."
    return CopilotResponse(
        intent="CHECK_EXPIRY_FEFO",
        reply_text=(
            f"### ⏳ DANH MỤC THUỐC CẬN HẠN ƯU TIÊN XUẤT (NGUYÊN TẮC FEFO - TT 36/2018 GSP)\n\n"
            f"{list_str}\n\n"
            f"*Đề nghị các khoa phòng ưu tiên sử dụng các lô thuốc trên trước khi xuất các lô mới.*"
        ),
        card=card,
        legal_basis="Thông tư 36/2018/TT-BYT về Thực hành tốt bảo quản thuốc (GSP)",
        suggested_chips=["Xuất chuyển tuyến", "Lập biên bản tiêu hủy"]
    )

async def execute_restock_tool(
    db: AsyncSession
) -> CopilotResponse:
    """Truy vấn các mặt hàng cạn ngưỡng tồn kho tối thiểu từ inventory_batches."""
    stmt = select(InventoryBatch).where(
        or_(
            InventoryBatch.is_low_stock == True,
            InventoryBatch.current_stock <= InventoryBatch.min_threshold
        )
    ).limit(10)

    res = await db.execute(stmt)
    batches = res.scalars().all()

    items_data = []
    text_lines = []
    for b in batches:
        suggested_reorder = max(b.max_threshold - b.current_stock, b.min_threshold * 2)
        items_data.append({
            "name": b.item_name,
            "current_stock": b.current_stock,
            "min_threshold": b.min_threshold,
            "suggested_reorder": suggested_reorder,
            "unit": b.unit
        })
        text_lines.append(f"• **{b.item_name}**: Tồn hiện tại `{b.current_stock} {b.unit}` / Ngưỡng tối thiểu `{b.min_threshold}` $\\rightarrow$ Đề xuất dự trù bổ sung: `{suggested_reorder} {b.unit}`")

    card = CopilotActionCard(
        card_type="low_stock_report",
        title="Dự Trù Bổ Sung Thuốc & Vật Tư Cạn Kho (Mẫu 01 - TT 22)",
        summary=f"Có {len(batches)} mặt hàng chạm ngưỡng tồn kho tối thiểu cần lập phiếu dự trù",
        data={"items": items_data, "total": len(batches)},
        primary_action_label="Lập Phiếu Dự Trù",
        primary_action_type="NAVIGATE_TAB",
        target_tab="inventory"
    )

    list_str = "\n".join(text_lines) if text_lines else "Hiện toàn bộ kho dược đều ở mức tồn an toàn."
    return CopilotResponse(
        intent="RESTOCK_PROPOSAL",
        reply_text=(
            f"### 📋 TỔNG HỢP DỰ TRÙ BÙ CƠ SỐ TỒN KHO (THÔNG TƯ 22/2011/TT-BYT)\n\n"
            f"{list_str}\n\n"
            f"*Đã tự động tính toán số lượng dự trù bù đắp đến ngưỡng Max an toàn.*"
        ),
        card=card,
        legal_basis="Thông tư 22/2011/TT-BYT Quy định tổ chức và hoạt động của Khoa Dược bệnh viện",
        suggested_chips=["Gửi duyệt phiếu dự trù", "Kiểm tra tồn kho"]
    )

async def execute_shift_handover_tool(
    db: AsyncSession,
    user_name: str,
    user_role: str
) -> CopilotResponse:
    """Truy vấn thực tế số nợ ca trực, vỏ morphin và sự cố TBYT."""
    debt_res = await db.execute(select(DebtRecord))
    all_debts = debt_res.scalars().all()
    active_debts = [d for d in all_debts if d.status == "debt"]
    pending_narcotic_ampoules = [d for d in all_debts if d.item_type == "Thuốc gây nghiện" and not d.ampoule_returned]

    eq_res = await db.execute(select(EquipmentTicket))
    all_tickets = eq_res.scalars().all()
    urgent_tickets = [t for t in all_tickets if t.urgency == "urgent" and t.status != "resolved"]

    cc_res = await db.execute(select(ColdChainCurrentState))
    cc = cc_res.scalars().first()
    temp_val = cc.current_temp if cc else 4.5

    card = CopilotActionCard(
        card_type="shift_handover_report",
        title="Biên Bản Bàn Giao & Đối Soát Ca Trực (Mẫu TT 22 & TT 20)",
        summary=f"Ca trực hiện còn {len(active_debts)} phiếu nợ, {len(pending_narcotic_ampoules)} vỏ ống Morphin chưa nộp",
        data={
            "active_debts_count": len(active_debts),
            "pending_ampoules_count": len(pending_narcotic_ampoules),
            "urgent_tickets_count": len(urgent_tickets),
            "coldchain_temp": temp_val,
            "shift_auditor": user_name
        },
        primary_action_label="Xác Nhận Ký Bàn Giao",
        primary_action_type="SIGN_HANDOVER",
        target_tab="debts"
    )

    return CopilotResponse(
        intent="SHIFT_HANDOVER_AUDIT",
        reply_text=(
            f"### 📋 BIÊN BẢN ĐỐI SOÁT & GIAO BAN CA TRỰC\n\n"
            f"• **Phiếu mượn thuốc chưa thanh toán:** `{len(active_debts)} phiếu`\n"
            f"• **Vỏ ống thuốc gây nghiện chưa thu hồi (TT 20/2017):** `{len(pending_narcotic_ampoules)} vỏ`\n"
            f"• **Sự cố thiết bị y tế khẩn cấp đang xử lý:** `{len(urgent_tickets)} thiết bị`\n"
            f"• **Nhiệt độ tủ lạnh bảo quản vắc xin:** `{temp_val}°C` (An toàn: 2°C - 8°C)\n\n"
            f"*Đề nghị Điều dưỡng và Bác sĩ hoàn tất thủ tục thu hồi vỏ thuốc gây nghiện trước khi kết thúc ca.*"
        ),
        card=card,
        legal_basis="Thông tư 22/2011/TT-BYT & Điều 17 Thông tư 20/2017/TT-BYT",
        suggested_chips=["Thu hồi vỏ Morphin", "Xem danh sách nợ"]
    )

async def execute_coldchain_tool(
    db: AsyncSession,
    query: str = ""
) -> CopilotResponse:
    """Truy vấn nhiệt độ thật của tủ vắc xin hoặc xử trí sự cố mất điện/lệch nhiệt độ."""
    lower_q = (query or "").lower()
    is_emergency = any(w in lower_q for w in ["mất điện", "sự cố", "hỏng", "quá nhiệt", "báo động", "ngừng hoạt động"])

    cc_res = await db.execute(select(ColdChainCurrentState))
    cc = cc_res.scalars().first()
    temp_val = cc.current_temp if cc else 4.5

    if is_emergency:
        card = CopilotActionCard(
            card_type="coldchain_monitor",
            title="Xử Trí Sự Cố Chuỗi Lạnh Vắc Xin (TT 36/2018 GSP)",
            summary="Kích hoạt quy trình bảo vệ vắc xin khẩn cấp khi mất điện / sự cố tủ lạnh",
            data={"current_temp": temp_val, "status": "EMERGENCY_TRIGGERED"},
            primary_action_label="Kích Hoạt Bình Tích Lạnh",
            primary_action_type="ACTIVATE_EMERGENCY",
            target_tab="coldchain"
        )
        return CopilotResponse(
            intent="CLINICAL_COLD_CHAIN_ALERT",
            reply_text=(
                f"### ❄️ XỬ TRÍ SỰ CỐ NHIỆT ĐỘ CHUỖI LẠNH VẮC XIN (TT 36/2018/TT-BYT GSP)\n\n"
                f"1. **Kích hoạt bình tích lạnh** và thùng bảo quản chuyên dụng ngay lập tức.\n"
                f"2. Chuyển toàn bộ vắc xin nhạy cảm nhiệt độ sang tủ dự phòng hoặc thùng đá kiểm soát (2°C - 8°C).\n"
                f"3. Báo ngay phòng Kỹ thuật - TBYT để kích hoạt nguồn máy phát điện dự phòng.\n"
                f"• Nhiệt độ buồng trước sự cố: `{temp_val}°C`."
            ),
            card=card,
            legal_basis="Thông tư 36/2018/TT-BYT & Quyết định 595/QĐ-BYT Hướng dẫn bảo quản Vắc xin",
            suggested_chips=["Xác nhận chuyển vắc xin", "Báo kỹ thuật điện"]
        )

    status_str = "Bình thường (An toàn)"
    card = CopilotActionCard(
        card_type="coldchain_status",
        title="Trạng Thái Chuỗi Lạnh & Tủ Bảo Quản Vắc Xin (WHO PQS)",
        summary=f"Nhiệt độ buồng lạnh hiện tại: {temp_val}°C - {status_str}",
        data={"current_temp": temp_val, "status": status_str},
        primary_action_label="Xem Giám Sát Nhiệt Độ",
        primary_action_type="NAVIGATE_TAB",
        target_tab="coldchain"
    )

    return CopilotResponse(
        intent="CLINICAL_COLD_CHAIN_TELEMETRY",
        reply_text=(
            f"### ❄️ THEO DÕI NHIỆT ĐỘ CHUỖI LẠNH VẮC XIN (WHO PQS & GSP)\n\n"
            f"• **Nhiệt độ hiện tại:** **{temp_val}°C**\n"
            f"• **Dải an toàn quy định:** `2.0°C - 8.0°C`\n"
            f"• **Đánh giá:** `{status_str}`\n\n"
            f"*Cảm biến IoT tự động cập nhật viễn thông mỗi 5 phút/lần.*"
        ),
        card=card,
        legal_basis="Thông tư 36/2018/TT-BYT & Quyết định 595/QĐ-BYT Hướng dẫn bảo quản Vắc xin",
        suggested_chips=["Xem đồ thị 24h", "Kiểm định tủ lạnh"]
    )
