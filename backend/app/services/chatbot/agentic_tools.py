"""
Agentic Clinical Tools Execution Engine (100% Real Database Grounding)
Truy vấn trực tiếp CSDL SQLite bệnh viện (inventory_batches, equipment_tickets, debt_records, coldchain).
Tuyệt đối không sinh dữ liệu giả lập hay chuỗi gán cứng.
"""

import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.equipment import EquipmentTicket
from app.models.debt import DebtRecord
from app.schemas.copilot import CopilotResponse, CopilotActionCard, CopilotCdssAlert
from app.services.chatbot.agentic_router import IntentExtractionResult

async def execute_dispense_tool(
    db: AsyncSession,
    params: IntentExtractionResult,
    user_name: str,
    user_role: str,
    session=None
) -> CopilotResponse:
    """Xử lý mượn/xuất thuốc khẩn cấp với dữ liệu thật từ bảng inventory_batches."""
    # Retired legacy fallback: catalog/demo batch, stock, location, patient and
    # medication-name heuristics are intentionally not used for operational facts.
    query_str = (params.drug_name or "").strip()
    if not query_str:
        return CopilotResponse(
            intent="BORROW_EMERGENCY_ITEM",
            answer_type="unavailable",
            source_status="drug_identity_missing",
            abstention_reason="Chưa có tên thuốc để tra cứu bản ghi tồn kho.",
            reply_text="Vui lòng cung cấp tên thuốc cần xuất hoặc mượn để tra cứu tồn kho.",
            card=None,
        )

    qty = params.quantity
    if qty < 1:
        return CopilotResponse(
            intent="BORROW_EMERGENCY_ITEM", answer_type="unavailable",
            source_status="invalid_quantity",
            abstention_reason="Số lượng yêu cầu phải là số nguyên dương.",
            reply_text="Chưa thể chuẩn bị yêu cầu vì số lượng cần xuất/mượn không hợp lệ.", card=None,
        )

    from app.domains.pharmacy_inventory.service import PharmacyInventoryService
    inventory = await PharmacyInventoryService().get_stock(db, query=query_str)
    eligible_batches = [row for row in inventory.records if not row.is_quarantined]
    if not eligible_batches:
        return CopilotResponse(
            intent="BORROW_EMERGENCY_ITEM",
            answer_type="unavailable",
            source_status="inventory_record_not_found",
            abstention_reason="Không có bản ghi tồn kho đủ điều kiện để xác nhận xuất/mượn.",
            reply_text="Chưa tìm thấy bản ghi tồn kho phù hợp, chưa có đủ dữ liệu để xác nhận, hoặc các lô tìm thấy đang bị cách ly.",
            card=None,
        )
    real_batch = next((row for row in eligible_batches if row.current_stock is not None and row.current_stock >= qty), None)
    if real_batch is None:
        candidate = eligible_batches[0]
        evidence = [{
            "evidence_id": f"inventory-batch:{candidate.batch_id}",
            "evidence_type": "operational_record",
            "source_id": "inventory_batches",
            "source_name": "Bản ghi lô tồn kho",
            "record_id": candidate.batch_id,
            "content": f"{candidate.item_name}; lô {candidate.batch_number}; tồn {candidate.current_stock} {candidate.unit}.",
        }]
        return CopilotResponse(
            intent="BORROW_EMERGENCY_ITEM", answer_type="unavailable",
            source_status="insufficient_inventory",
            abstention_reason="Không có lô không cách ly nào ghi nhận đủ số lượng được yêu cầu.",
            reply_text=f"Không thể xác nhận yêu cầu {qty}: lô {candidate.batch_number} ghi nhận tồn {candidate.current_stock} {candidate.unit}.",
            card=None, evidence=evidence,
        )

    # Operational values come only from the persisted inventory record.
    med_name = real_batch.item_name
    med_type = real_batch.category
    unit = real_batch.unit
    batch_no = real_batch.batch_number
    location = real_batch.warehouse_location
    current_stock = real_batch.current_stock

    is_narcotic = bool(med_type and "nghiện" in med_type.casefold())

    # Cập nhật session active medication
    if session:
        session.set_active_medication(
            name=med_name,
            ingredient=real_batch.active_ingredient or med_name,
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
    patient_display = params.patient_name
    room_display = params.patient_room

    card = CopilotActionCard(
        card_type="borrow_confirm",
        title="Phiếu Xuất Mượn Khẩn Cấp Cứu (Mẫu TT 22)",
        summary=f"Xuất mượn {qty} {unit} {med_name}" + (f" cho {patient_display}" if patient_display else ""),
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
            "clinical_reason": params.clinical_reason,
            "suggested_borrower": user_name
        },
        primary_action_label="Ký Xác Thực & Xuất Kho",
        primary_action_type="EXECUTE_BORROW",
        target_tab="debts"
    )

    narcotic_warn = "\n> [!WARNING]\n> **Thuốc gây nghiện (TT 20/2017):** Bắt buộc thu hồi vỏ ống đã tiêm." if is_narcotic else ""
    evidence = [{
        "evidence_id": f"inventory-batch:{real_batch.batch_id}",
        "evidence_type": "operational_record",
        "source_id": "inventory_batches",
        "source_name": "Bản ghi lô tồn kho",
        "record_id": real_batch.batch_id,
        "content": f"{med_name}; lô {batch_no}; tồn {current_stock} {unit}; vị trí {location}; phân loại {med_type}.",
    }]
    citations = [{
        "source": evidence[0]["source_name"],
        "source_id": evidence[0]["source_id"],
        "record_id": real_batch.batch_id,
        "excerpt": evidence[0]["content"],
        "evidence_id": evidence[0]["evidence_id"],
    }]
    return CopilotResponse(
        intent="BORROW_EMERGENCY_ITEM",
        reply_text=(
            f"### 💊 Y LỆNH XUẤT MƯỢN THUỐC CẤP CỨU\n\n"
            f"• **Dược phẩm:** **{med_name}** (`Lô: {batch_no}`)\n"
            f"• **Số lượng:** `{qty} {unit}` (Tồn kho thực tế: `{current_stock} {unit}` tại `{location}`)\n"
            + (f"• **Bệnh nhân:** `{patient_display}`{f' ({room_display})' if room_display else ''}\n" if patient_display else "")
            + f"{narcotic_warn}"
        ),
        card=card,
        cdss_alert=cdss_alert,
        answer_type="operational_result",
        source_status="database_record",
        evidence=evidence,
        citations=citations,
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
    # Retired legacy catalog defaults: model, serial and risk class remain empty
    # unless supplied by a verified source; the action card is only a draft.
    device_name = (params.device_name or "").strip()
    issue = (params.issue_description or "").strip()
    if not device_name or not issue:
        return CopilotResponse(
            intent="REPORT_EQUIPMENT_INCIDENT",
            answer_type="unavailable",
            source_status="incident_details_missing",
            abstention_reason="Cần tên thiết bị và mô tả sự cố trước khi lập phiếu.",
            reply_text="Vui lòng cung cấp tên thiết bị và mô tả sự cố để chuẩn bị phiếu báo hỏng.",
            card=None,
        )

    # Device attributes are optional user-provided fields; never substitute catalog examples.
    device_model = None
    device_serial = None
    risk_class = None
    location = params.device_location

    card = CopilotActionCard(
        card_type="incident_confirm",
        title="Phiếu Báo Hỏng Thiết Bị Y Tế (Mẫu NĐ 98/2021)",
        summary=f"Báo hỏng {device_name}" + (f" tại {location}" if location else ""),
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
            f"• **Thiết bị:** **{device_name}**\n"
            + (f"• **Model / S/N:** `{device_model or 'Chưa cung cấp'}` / `{device_serial or 'Chưa cung cấp'}`\n" if device_model or device_serial else "")
            + (f"• **Vị trí:** `{location}`\n" if location else "")
            + (f"• **Mức độ rủi ro:** `Loại {risk_class}`\n" if risk_class else "")
            + f"• **Tình trạng sự cố:** {issue}\n\n"
            + "Thông tin sự cố đã được chuẩn bị để xác nhận gửi phiếu kỹ thuật."
        ),
        card=card,
        legal_basis="Nghị định 98/2021/NĐ-CP về Quản lý Trang thiết bị Y tế",
        suggested_chips=["Xác nhận gửi báo hỏng", "Điều phối máy dự phòng"]
    )

async def execute_fefo_tool(db: AsyncSession, threshold_days: int = 60) -> CopilotResponse:
    """Compatibility adapter; the former inline FEFO builder is retired."""
    from app.domains.pharmacy_inventory.tools import PharmacyInventoryTools
    return await PharmacyInventoryTools().execute_fefo(db, threshold_days)


async def execute_restock_tool(db: AsyncSession) -> CopilotResponse:
    """Compatibility adapter; the former inline restock builder is retired."""
    from app.domains.pharmacy_inventory.tools import PharmacyInventoryTools
    return await PharmacyInventoryTools().execute_restock(db)

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

    from app.domains.cold_chain.repository import ColdChainRepository
    cold_chain_snapshot = await ColdChainRepository.get_current_snapshot(db)
    temp_val = cold_chain_snapshot.current_temp if cold_chain_snapshot is not None else None

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
            + (f"• **Nhiệt độ tủ lạnh bảo quản vắc xin:** `{temp_val}°C`\n" if temp_val is not None else
             "• **Nhiệt độ tủ lạnh bảo quản vắc xin:** Chưa có bản ghi trạng thái trong cơ sở dữ liệu.\n")
            + "\n"
            + f"*Đề nghị Điều dưỡng và Bác sĩ hoàn tất thủ tục thu hồi vỏ thuốc gây nghiện trước khi kết thúc ca.*"
        ),
        card=card,
        legal_basis="Thông tư 22/2011/TT-BYT & Điều 17 Thông tư 20/2017/TT-BYT",
        suggested_chips=["Thu hồi vỏ Morphin", "Xem danh sách nợ"]
    )

async def execute_coldchain_tool(db: AsyncSession, query: str = "") -> CopilotResponse:
    """Compatibility adapter; the former inline cold-chain formatter is retired."""
    from app.domains.cold_chain.tools import ColdChainTools
    return await ColdChainTools().status_response(db)
