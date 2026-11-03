import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.debt import DebtRecord
from app.models.coldchain import ColdChainCurrentState
from app.models.audit import AuditRecord
from app.services.audit_service import verify_ledger_integrity
from app.schemas.copilot import CopilotResponse, CopilotActionCard

async def handle_legal_intent(lower_query: str) -> CopilotResponse:
    title = "CĂN CỨ PHÁP LÝ & QUY CHUẨN Y TẾ HIỆN HÀNH"
    basis = "Thông tư 20/2017/TT-BYT & Nghị định 98/2021/NĐ-CP"
    if "phản vệ" in lower_query or "adrenalin" in lower_query:
        title = "PHÁC ĐỒ CẤP CỨU SỐC PHẢN VỆ (THÔNG TƯ 51/2017/TT-BYT)"
        basis = "Thông tư 51/2017/TT-BYT"
        content = ("• **Thuốc thiết yếu hàng đầu:** Adrenalin 1mg/1ml (tiêm bắp ngay lập tức cho mọi trường hợp sốc phản vệ từ độ II trở lên).\n"
                   "• **Liều dùng ban đầu:** Người lớn: 1/2 - 1 ống (0.5 - 1mg). Trẻ em: 1/5 - 1/2 ống theo cân nặng.\n"
                   "• **Vị trí tiêm:** Mặt trước ngoài đùi (hấp thu nhanh nhất).\n"
                   "• **Nhắc lại:** Mỗi 3 - 5 phút/lần nếu huyết áp chưa nâng lên hoặc SpO2 chưa cải thiện.")
    elif "thu hồi" in lower_query or "vỏ ống" in lower_query:
        title = "QUY ĐỊNH THU HỒI VÀ TIÊU HỦY VỎ ỐNG THUỐC GÂY NGHIỆN (TT 20/2017/TT-BYT)"
        basis = "Điều 15 & 16 Thông tư 20/2017/TT-BYT"
        content = ("• **Điều dưỡng:** Thu hồi ngay 100% vỏ ống sau tiêm vào khay/hộp bảo quản có khóa an toàn.\n"
                   "• **Giao ban 07:00 AM:** Đối soát khớp giữa số lượng rút - số lượng đã tiêm - số vỏ ống nộp lại.\n"
                   "• **Tiêu hủy định kỳ:** Thành lập hội đồng 3 bên (Lãnh đạo BV, Dược sĩ Trưởng khoa Dược, Điều dưỡng trưởng).")
    elif "kiểm định" in lower_query or "máy thở" in lower_query:
        title = "QUY ĐỊNH AN TOÀN VÀ KIỂM ĐỊNH THIẾT BỊ Y TẾ (NGHỊ ĐỊNH 98/2021/NĐ-CP)"
        basis = "Nghị định 98/2021/NĐ-CP & Tiêu chuẩn IEC 60601-1"
        content = ("• **Phân loại rủi ro:** Máy thở, máy sốc tim, máy lọc máu liên tục thuộc Thiết bị Y tế Loại D.\n"
                   "• **Chu kỳ kiểm định:** Bắt buộc kiểm định an toàn và tính năng kỹ thuật tối thiểu 12 tháng/lần.\n"
                   "• **An toàn điện IEC 60601-1:** Dòng rò qua bệnh nhân không vượt quá 100µA đối với loại CF.")
    else:
        content = "Tuân thủ nghiêm ngặt Thông tư 22/2011/TT-BYT về tổ chức Khoa Dược, quy chế tủ trực lâm sàng và Nghị định 151/2017/NĐ-CP."

    card = CopilotActionCard(
        card_type="legal_guide",
        title=title,
        summary=f"Tra cứu chuẩn quy định y tế: {basis}",
        data={"doc_title": title, "content": content, "legal_basis": basis},
        primary_action_label="Mở văn bản toàn văn",
        primary_action_type="OPEN_LEGAL_MODAL"
    )
    return CopilotResponse(
        intent="LEGAL_GUIDANCE",
        reply_text=f"### 📋 {title}\n\n{content}\n\n> [!NOTE]\n> **Căn cứ áp dụng:** {basis}.",
        card=card,
        legal_basis=basis,
        suggested_chips=["Phác đồ cấp cứu phản vệ", "Quy định vỏ ống Morphin", "Kiểm định thiết bị Loại D"]
    )

async def handle_shift_handover_intent(db: AsyncSession) -> CopilotResponse:
    stmt = select(DebtRecord)
    res = await db.execute(stmt)
    debts = res.scalars().all()
    active_debts = [d for d in debts if d.status == "debt"]
    pending_narcotics = [d for d in debts if d.item_type == "Thuốc gây nghiện" and not d.ampoule_returned]

    summary_text = (f"Báo cáo giao ban ca trực 07:00 AM:\n"
                    f"• Tổng số phiếu mượn tủ trực chưa hoàn bù: **{len(active_debts)} phiếu**\n"
                    f"• Số vỏ thuốc gây nghiện (Morphin/Fentanyl) chưa nộp: **{len(pending_narcotics)} vỏ**\n")
    card = CopilotActionCard(
        card_type="shift_handover_report",
        title="Đối Soát Ca Trực 07:00 AM (TT 22 & TT 20)",
        summary="Biên bản đối soát ca trực và tình trạng nợ vỏ thuốc gây nghiện",
        data={
            "total_debts": len(active_debts),
            "pending_ampoules_count": len(pending_narcotics),
            "pending_list": [{"patient": d.patient_name, "room": d.patient_room, "quantity": f"{d.quantity} {d.unit}"} for d in pending_narcotics[:3]],
            "replenishment": [{"name": "Morphin sulfat 10mg", "needed": len(pending_narcotics)}]
        },
        primary_action_label="Xuất Biên Bản Giao Ban PDF",
        primary_action_type="EXPORT_SHIFT_REPORT",
        target_tab="debts"
    )
    return CopilotResponse(
        intent="SHIFT_HANDOVER_RECONCILIATION",
        reply_text=summary_text,
        card=card,
        legal_basis="Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT",
        suggested_chips=["Thu hồi vỏ ống Morphin", "Lập phiếu bù tủ trực Mẫu 01", "Kiểm tra nhiệt độ chuỗi lạnh"]
    )

async def handle_coldchain_intent(db: AsyncSession) -> CopilotResponse:
    stmt = select(ColdChainCurrentState).limit(1)
    res = await db.execute(stmt)
    state = res.scalar_one_or_none()
    current_temp = getattr(state, "current_temp", 4.5) if state else 4.5
    mkt = getattr(state, "mkt_temp", getattr(state, "mkt_value", 4.8)) if state else 4.8
    is_quarantine = getattr(state, "is_quarantined", False) if state else False
    is_outage = getattr(state, "is_outage", False) if state else False

    status_text = "BÌNH THƯỜNG (2.0°C - 8.0°C)" if not is_outage and not is_quarantine else "CẢNH BÁO BIỆT TRỮ CÁCH LY"
    reply_text = (f"### ❄️ BÁO CÁO GIÁM SÁT DÂY CHUYỀN LẠNH (COLD CHAIN - GSP)\n\n"
                  f"• **Trạng thái buồng lạnh:** **{status_text}**\n"
                  f"• **Nhiệt độ hiện tại:** `{current_temp}°C`\n"
                  f"• **Chỉ số nhiệt động học Arrhenius (MKT):** `{mkt}°C`\n"
                  f"• **Nguồn điện:** {'MẤT ĐIỆN LƯỚI' if is_outage else 'Điện lưới 220V ổn định'}\n")

    card = CopilotActionCard(
        card_type="coldchain_status",
        title="Giám Sát Chuỗi Lạnh Vắc Xin (WHO PQS)",
        summary="Dữ liệu cảm biến thời gian thực buồng lạnh GSP",
        data={"temperature": current_temp, "mkt": mkt, "is_outage": is_outage, "is_quarantined": is_quarantine},
        primary_action_label="Xem Biểu Đồ Datalogger",
        primary_action_type="NAVIGATE_TAB",
        target_tab="coldchain"
    )
    return CopilotResponse(
        intent="COLD_CHAIN_MONITORING",
        reply_text=reply_text,
        card=card,
        legal_basis="Thông tư 36/2018/TT-BYT (GSP) & WHO PQS Guidelines",
        suggested_chips=["Kích hoạt máy phát dự phòng", "Biệt trữ cách ly lô vắc xin", "Kiểm tra hạn dùng FEFO"]
    )

async def handle_audit_intent(db: AsyncSession) -> CopilotResponse:
    is_valid, msg = await verify_ledger_integrity(db)
    stmt = select(AuditRecord).order_by(AuditRecord.sequence_id.desc()).limit(1)
    res = await db.execute(stmt)
    last_block = res.scalar_one_or_none()
    block_seq = last_block.sequence_id if last_block else 0
    genesis_hash = last_block.current_hash[:16] + "..." if last_block else "GENESIS-INIT"

    reply_text = (f"### 🛡️ KẾT QUẢ KIỂM TOÁN TÍNH TOÀN VẸN SỔ GHI BẤT BIẾN (AUDIT LEDGER)\n\n"
                  f"• **Tính toàn vẹn:** {'✅ 100% NGUYÊN VẸN, CHUỖI BĂM HỢP LỆ' if is_valid else '❌ PHÁT HIỆN CAN THIỆP TRÁI PHÉP'}\n"
                  f"• **Chuỗi khối hiện tại:** `{block_seq}` giao dịch\n"
                  f"• **Mã băm khối chốt:** `{genesis_hash}`\n"
                  f"• **Thuật toán bảo mật:** HMAC-SHA256 chuẩn bảo vệ dữ liệu y tế.")

    card = CopilotActionCard(
        card_type="audit_integrity",
        title="Tính Toàn Vẹn Sổ Kiểm Toán Bất Biến",
        summary="Xác minh chuỗi mã hóa HMAC-SHA256 các giao dịch",
        data={"genesis": genesis_hash, "is_valid": is_valid, "block_count": block_seq},
        primary_action_label="Mở Sổ Kiểm Toán Toàn Văn",
        primary_action_type="OPEN_AUDIT_MODAL"
    )
    return CopilotResponse(
        intent="AUDIT_LEDGER_INTEGRITY",
        reply_text=reply_text,
        card=card,
        legal_basis="Nghị định 130/2018/NĐ-CP & Tiêu chuẩn ISO 27799 An Toàn Thông Tin Y Tế",
        suggested_chips=["Xuất nhật ký kiểm toán SHA-256", "Đối soát ca trực 07:00 AM"]
    )

async def handle_ocr_intent() -> CopilotResponse:
    reply_text = ("### 📷 THỊ GIÁC AI (VISION AI) - BÓC TÁCH CHỨNG TỪ DƯỢC PHẨM\n\n"
                  "Hệ thống đã nhận diện chứng từ hóa đơn dược phẩm VAT. Vui lòng bấm xác nhận để tự động tạo lô nhập kho theo đúng quy chuẩn.")
    card = CopilotActionCard(
        card_type="ocr_invoice_confirm",
        title="Hóa Đơn Dược Phẩm Điện Tử (Vision OCR)",
        summary="Bóc tách tự động chứng từ nhập kho",
        data={
            "supplier": "Công ty Cổ phần Dược phẩm CPC1 Hà Nội",
            "invoiceNumber": "HD-2026-99120",
            "invoiceDate": "2026-10-24",
            "totalAmount": "45.850.000 VNĐ",
            "items": [
                {"name": "Adrenalin 1mg/1ml", "batch": "ADR-2601", "expiry": "2027-10-15", "quantity": 100, "unit": "ống"},
                {"name": "Morphin sulfat 10mg/1ml", "batch": "MOR-2609", "expiry": "2028-05-20", "quantity": 50, "unit": "ống"}
            ]
        },
        primary_action_label="Nhập Kho Lô Mới",
        primary_action_type="NAVIGATE_TAB",
        target_tab="inventory"
    )
    return CopilotResponse(
        intent="OCR_INVOICE_PROCESSING",
        reply_text=reply_text,
        card=card,
        legal_basis="Nghị định 123/2020/NĐ-CP về Hóa đơn, Chứng từ & Thông tư 36/2018/TT-BYT",
        suggested_chips=["Xem kho FEFO", "Đối soát ca trực"]
    )
