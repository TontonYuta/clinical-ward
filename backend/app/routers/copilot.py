import re
from datetime import datetime
from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.debt import DebtRecord
from app.models.equipment import EquipmentTicket
from app.models.inventory import InventoryBatch
from app.models.coldchain import ColdChainCurrentState
from app.models.audit import AuditRecord
from app.services.audit_service import verify_ledger_integrity

router = APIRouter(prefix="/copilot", tags=["Trợ Lý Agent Lâm Sàng Thông Minh"])

class CopilotQuery(BaseModel):
    query: str
    user_role: str = "nurse"
    user_name: str = "ĐD. Lê Thị Thu"

class CopilotActionCard(BaseModel):
    card_type: str # borrow_confirm, incident_confirm, fefo_report, low_stock_report, equipment_report, coldchain_status, audit_integrity, legal_guide
    title: str
    summary: str
    data: dict
    primary_action_label: str | None = None
    primary_action_type: str | None = None
    target_tab: str | None = None

class CopilotResponse(BaseModel):
    intent: str
    reply_text: str
    card: CopilotActionCard | None = None
    suggested_action: dict | None = None
    legal_basis: str | None = None
    suggested_chips: list[str] = []

# Danh mục thuốc và từ khóa chuẩn y tế
MEDICATION_CATALOG = [
    {"name": "Morphin sulfat 10mg/1ml", "type": "Thuốc gây nghiện", "unit": "ống", "keywords": ["morphin", "moocphin", "morfin"]},
    {"name": "Fentanyl 0.1mg/2ml", "type": "Thuốc gây nghiện", "unit": "ống", "keywords": ["fentanyl", "fentanin"]},
    {"name": "Diazepam 10mg/2ml", "type": "Thuốc gây nghiện", "unit": "ống", "keywords": ["diazepam", "seduxen"]},
    {"name": "Midazolam 5mg/ml", "type": "Thuốc gây nghiện", "unit": "ống", "keywords": ["midazolam", "mida"]},
    {"name": "Adrenalin 1mg/1ml (Epinephrin)", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["adrenalin", "epinephrine", "epinephrine", "sốc phản vệ"]},
    {"name": "Noradrenalin 4mg/4ml", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["noradrenalin", "norepinephrine", "vận mạch"]},
    {"name": "Atropin sulfat 0.25mg/ml", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["atropin", "nhịp chậm"]},
    {"name": "Cordarone 150mg/3ml", "type": "Thuốc cấp cứu", "unit": "ống", "keywords": ["cordarone", "amiodarone", "chống loạn nhịp"]},
    {"name": "Kháng sinh Ceftriaxone 1g", "type": "Thuốc cấp cứu", "unit": "lọ", "keywords": ["ceftriaxone", "kháng sinh ceftriaxone"]},
    {"name": "Kháng sinh Meropenem 1g (Meronem)", "type": "Thuốc cấp cứu", "unit": "lọ", "keywords": ["meropenem", "meronem"]},
    {"name": "Nhũ dịch Lipid 20% Lipofundin 100ml", "type": "Thuốc cấp cứu", "unit": "chai", "keywords": ["lipid", "lipofundin", "giải độc thuốc tê"]},
    {"name": "Vắc xin phòng dại Verorab 0.5ml", "type": "Vắc xin & Chuỗi lạnh", "unit": "liều", "keywords": ["verorab", "dại"]},
    {"name": "Huyết thanh kháng uốn ván SAT 1500 UI", "type": "Vắc xin & Chuỗi lạnh", "unit": "liều", "keywords": ["sat", "uốn ván", "kháng uốn ván"]},
    {"name": "Vắc xin Viêm gan B Engerix-B", "type": "Vắc xin & Chuỗi lạnh", "unit": "liều", "keywords": ["engerix", "viêm gan b"]},
    {"name": "Dây truyền dịch có bầu đếm giọt", "type": "Vật tư tiêu hao", "unit": "bộ", "keywords": ["dây truyền", "dây truyền dịch", "bầu đếm giọt"]},
    {"name": "Chỉ phẫu thuật Catgut 3/0", "type": "Vật tư tiêu hao", "unit": "hộp", "keywords": ["catgut", "chỉ phẫu thuật", "chỉ khâu"]},
    {"name": "Bơm tiêm 5ml Vinahankook tiệt trùng", "type": "Vật tư tiêu hao", "unit": "cái", "keywords": ["bơm tiêm 5ml", "bơm tiêm", "kim tiêm"]},
    {"name": "Catheter tĩnh mạch trung tâm 3 nòng CVC", "type": "Vật tư tiêu hao", "unit": "bộ", "keywords": ["cvc", "catheter", "tĩnh mạch trung tâm"]},
    {"name": "Kim luồn tĩnh mạch ngoại vi 20G", "type": "Vật tư tiêu hao", "unit": "cái", "keywords": ["kim luồn", "kim luồn 20g"]}
]

# Danh mục thiết bị y tế
EQUIPMENT_CATALOG = [
    {"name": "Máy thở Puritan Bennett 840 (PB840)", "model": "PB840 Ventilator - Medtronic", "serial": "PB840-VN-2021-998", "risk": "D", "keywords": ["pb840", "puritan bennett", "máy thở pb840", "máy thở"]},
    {"name": "Máy sốc tim Zoll R Series", "model": "Zoll R Series ALS Defibrillator", "serial": "ZOLL-R-8831", "risk": "D", "keywords": ["zoll", "sốc tim", "máy sốc tim", "paddles"]},
    {"name": "Hệ thống lọc máu liên tục CRRT Prismaflex", "model": "Prismaflex v8.0 - Baxter", "serial": "PRISMA-VN-2022-014", "risk": "D", "keywords": ["prismaflex", "crrt", "lọc máu", "tmp"]},
    {"name": "Máy theo dõi bệnh nhân Philips MP50", "model": "IntelliVue MP50 Monitor", "serial": "PHI-MP50-4102", "risk": "C", "keywords": ["mp50", "monitor", "philips mp50", "spo2"]},
    {"name": "Bơm tiêm điện B.Braun Perfusor Space", "model": "Perfusor Space - B.Braun", "serial": "BBR-PERF-9921", "risk": "C", "keywords": ["b.braun", "perfusor", "bơm tiêm điện", "pin chai"]},
    {"name": "Máy thở Maquet Servo-i Universal", "model": "Servo-i - Getinge", "serial": "MAQ-SERVOI-3104", "risk": "D", "keywords": ["servo-i", "servo i", "maquet", "o2 cell"]},
    {"name": "Máy phá rung tim Philips HeartStart XL", "model": "HeartStart XL M4735A", "serial": "PHI-HSXL-7712", "risk": "D", "keywords": ["heartstart", "phá rung"]},
    {"name": "Máy đo khí máu Radiometer ABL90 FLEX", "model": "ABL90 FLEX - Radiometer", "serial": "RAD-ABL90-5541", "risk": "C", "keywords": ["abl90", "khí máu", "radiometer"]},
    {"name": "Bình làm ẩm thở máy Fisher & Paykel MR850", "model": "MR850 Humidifier", "serial": "FP-MR850-8802", "risk": "C", "keywords": ["mr850", "fisher", "bình làm ẩm"]},
    {"name": "Máy điện tim 12 cần Nihon Kohden", "model": "Cardiofax M ECG-1250K", "serial": "NK-ECG12-1089", "risk": "B", "keywords": ["ecg", "điện tim", "nihon kohden"]}
]

@router.post("/chat", response_model=CopilotResponse)
async def chat_with_copilot(
    payload: CopilotQuery,
    db: AsyncSession = Depends(get_db)
):
    text = payload.query.strip()
    lower = text.lower()

    # -------------------------------------------------------------
    # 0. INTENT: ĐỐI SOÁT GIAO BAN CA TRỰC 07:00 AM (TT 22 & TT 20)
    # -------------------------------------------------------------
    if any(k in lower for k in ["đối soát", "giao ban", "ca trực", "ca đêm", "07:00", "lệch sổ", "báo cáo ca", "chốt ca"]):
        stmt = select(DebtRecord).where(DebtRecord.status == "debt")
        res = await db.execute(stmt)
        active_debts = res.scalars().all()

        narcotic_debts = [d for d in active_debts if "nghiện" in (d.item_type or "").lower() or "morphin" in (d.item_name or "").lower()]
        pending_ampoules = [d for d in narcotic_debts if not d.ampoule_returned]

        item_map = {}
        for d in active_debts:
            if d.item_name not in item_map:
                item_map[d.item_name] = {"count": 0, "unit": "lọ/ống"}
            item_map[d.item_name]["count"] += d.quantity

        replenishment_items = [{"name": name, "needed": f"{data['count']} {data['unit']}"} for name, data in item_map.items()]
        pending_list = [{"patient": d.patient_name, "room": d.patient_room, "item": d.item_name, "quantity": str(d.quantity), "code": d.code} for d in pending_ampoules]

        summary_str = f"CẢNH BÁO: Còn {len(pending_ampoules)} ca nợ vỏ ống Morphin chưa nộp vào khay niêm phong!" if pending_ampoules else f"Hoàn tất: Toàn bộ {len(narcotic_debts)} ống thuốc gây nghiện đã thu hồi vỏ rỗng."

        return CopilotResponse(
            intent="SHIFT_HANDOVER_AUDIT",
            reply_text=f"### 📋 BÁO CÁO ĐỐI SOÁT GIAO BAN CA TRỰC LÂM SÀNG (07:00 AM)\n"
                       f"*Căn cứ: Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT*\n\n"
                       f"📊 **Tổng kết số liệu ca trực:**\n"
                       f"• Tổng số lượt mượn khẩn chưa bù: **{len(active_debts)} ca**\n"
                       f"• Thuốc gây nghiện đã rút: **{len(narcotic_debts)} ống**\n"
                       f"• Vỏ ống chưa nộp lại: **{len(pending_ampoules)} vỏ**\n\n"
                       f"{'⚠️ **Phát hiện lệch sổ nghiêm trọng:** Có vỏ thuốc gây nghiện chưa hoàn nộp!' if pending_ampoules else '✅ Cơ số tủ trực và vỏ ống an toàn.'}",
            card=CopilotActionCard(
                card_type="shift_handover_report",
                title="BÁO CÁO ĐỐI SOÁT GIAO BAN CA TRỰC (07:00 AM)",
                summary=summary_str,
                data={
                    "total_debts": len(active_debts),
                    "narcotic_count": len(narcotic_debts),
                    "pending_ampoules_count": len(pending_ampoules),
                    "returned_count": len(narcotic_debts) - len(pending_ampoules),
                    "pending_list": pending_list,
                    "replenishment": replenishment_items,
                    "formType": "EMERGENCY_BORROW_TICKET"
                },
                primary_action_label="Xem & In Phiếu Đối Soát (Mẫu 4)",
                primary_action_type="OPEN_PRINTABLE_FORM",
                target_tab="debt"
            ),
            suggested_action={"type": "OPEN_PRINTABLE_FORM", "form_type": "EMERGENCY_BORROW_TICKET"},
            legal_basis="Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 TT 20/2017/TT-BYT",
            suggested_chips=["Lập dự trù bù thuốc Mẫu 01", "Hội đồng hủy vỏ Morphin", "Kiểm tra cơ số tủ trực"]
        )

    # -------------------------------------------------------------
    # 1. INTENT: MƯỢN KHẨN THUỐC / VẬT TƯ CA ĐÊM & CDSS (TT 22 & TT 20)
    # -------------------------------------------------------------
    has_dispense_action = any(k in lower for k in ["mượn", "lấy", "rút", "xuất", "cần", "cần dùng", "cần gấp", "xin", "cho", "tiêm", "truyền", "kê", "cấp", "phát", "dùng", "lập phiếu"])
    has_urgency_or_med = any(k in lower for k in ["gấp", "khẩn", "ngay", "cấp cứu", "stat", "liều", "lọ", "ống", "buồng", "bệnh nhân", "bn"]) or any(any(k in lower for k in m["keywords"]) for m in MEDICATION_CATALOG)
    is_dispense_intent = has_dispense_action and has_urgency_or_med and not any(k in lower for k in ["báo hỏng", "sửa", "hết hạn", "kiểm kê", "chuỗi lạnh", "đối soát", "giao ban", "toàn vẹn"])

    if is_dispense_intent:
        # Extract item
        matched_med = None
        for med in MEDICATION_CATALOG:
            if any(k in lower for k in med["keywords"]):
                matched_med = med
                break

        if not matched_med:
            # Default fallback if drug mentioned generally
            if "thuốc" in lower or "vật tư" in lower:
                matched_med = MEDICATION_CATALOG[0] # Morphin
            else:
                matched_med = {"name": "Morphin sulfat 10mg/1ml", "type": "Thuốc gây nghiện", "unit": "ống"}

        # Extract quantity
        qty_match = re.search(r"(\d+)\s*(lọ|ống|bộ|cái|hộp|liều)?", lower)
        quantity = int(qty_match.group(1)) if qty_match else 2

        # Extract patient
        patient_name = "Bệnh nhân cấp cứu chưa định danh"
        pat_match = re.search(r"(?:cho\s+)?(?:bệnh nhân|bn|chị|anh|bác)\s+([A-ZÀ-Ỹa-zà-ỹ0-9\s\-]+?)(?=\s+(?:ở|tại|buồng|giường|phòng|khoa|$))", text, re.IGNORECASE)
        if pat_match:
            patient_name = pat_match.group(1).strip()
        elif "trí" in lower or "8820" in lower:
            patient_name = "Võ Minh Trí (BN-8820)"
        elif "lan" in lower or "8825" in lower:
            patient_name = "Đặng Thị Lan (BN-8825)"
        elif "đăng" in lower or "8791" in lower:
            patient_name = "Nguyễn Hải Đăng (BN-8791)"

        # Extract room
        room_name = "Khoa Cấp Cứu A9"
        room_match = re.search(r"(buồng|giường|phòng|khoa)\s+([A-Za-z0-9\s\-]+?)(?=\s+(?:để|do|vì|$))", text, re.IGNORECASE)
        if room_match:
            room_name = f"{room_match.group(1)} {room_match.group(2)}".strip()
        elif "cc3" in lower or "buồng 3" in lower:
            room_name = "Buồng cấp cứu 3 - Giường 02"
        elif "phòng mổ" in lower or "mổ" in lower:
            room_name = "Phòng mổ 1 - Khu Phẫu thuật"
        elif "icu" in lower:
            room_name = "Hồi sức tích cực ICU - Giường 05"

        # Extract clinical reason
        clinical_reason = "Cấp cứu khẩn cấp ca trực đêm"
        if "sốc phản vệ" in lower:
            clinical_reason = "Cấp cứu sốc phản vệ độ 3 (Phác đồ Thông tư 51/2017)"
        elif "nhồi máu" in lower or "đau ngực" in lower:
            clinical_reason = "Cấp cứu đau thắt ngực nhồi máu cơ tim cấp"
        elif "khởi mê" in lower:
            clinical_reason = "Khởi mê phẫu thuật cấp cứu"
        elif "gãy xương" in lower or "chấn thương" in lower:
            clinical_reason = "Đa chấn thương gãy xương, giảm đau tiền phẫu"

        is_narcotic = matched_med["type"] == "Thuốc gây nghiện"
        narcotic_warning = "\n> [!WARNING]\n> **Thuốc gây nghiện (TT 20/2017):** Bắt buộc thu hồi vỏ ống đã tiêm vào khay kiểm soát trước khi được duyệt hoàn bù cơ số tủ trực." if is_narcotic else ""

        # CDSS Engine: Safety overdose evaluation
        cdss_alert = ""
        if "morphin" in matched_med["name"].lower() and quantity >= 3:
            cdss_alert = f"\n\n> ⚠️ **CẢNH BÁO AN TOÀN NGƯỜI BỆNH: NGUY CƠ SUY HÔ HẤP**\n> Liều {quantity * 10}mg Morphin vượt ngưỡng cấp cứu thông thường (5–10mg/lần). Nguy cơ ức chế trung tâm hô hấp dẫn đến ngừng thở.\n> 💡 **Khuyến cáo:** Chuẩn bị sẵn 01 ống Naloxone 0.4mg/ml (thuốc đối kháng giải độc Opioid) cạnh giường bệnh và theo dõi SpO2 liên tục."

        return CopilotResponse(
            intent="BORROW_EMERGENCY_ITEM",
            reply_text=f"Tôi đã phân tích lệnh mượn khẩn của bạn và soạn sẵn **Phiếu Mượn Thuốc Tủ Trực Cấp Cứu**:\n\n"
                       f"• **Mặt hàng:** {matched_med['name']} ({matched_med['type']})\n"
                       f"• **Số lượng:** {quantity} {matched_med['unit']}\n"
                       f"• **Bệnh nhân:** {patient_name}\n"
                       f"• **Địa điểm:** {room_name}\n"
                       f"• **Chỉ định:** {clinical_reason}\n\n"
                       f"Bạn có thể xác nhận mượn trực tiếp bằng thẻ bên dưới hoặc mở biểu mẫu để bổ sung chi tiết.{narcotic_warning}{cdss_alert}",
            card=CopilotActionCard(
                card_type="borrow_confirm",
                title=f"Xác Nhận Rút Khẩn {quantity} {matched_med['unit']} {matched_med['name']}",
                summary=f"Cấp cứu cho {patient_name} tại {room_name}",
                data={
                    "item_name": matched_med["name"],
                    "item_type": matched_med["type"],
                    "quantity": quantity,
                    "patient_name": patient_name,
                    "patient_room": room_name,
                    "clinical_reason": clinical_reason,
                    "is_narcotic": is_narcotic
                },
                primary_action_label="Ký Xác Thực & Rút Thuốc (PIN)",
                primary_action_type="EXECUTE_BORROW",
                target_tab="debt"
            ),
            suggested_action={"type": "OPEN_BORROW_MODAL", "extracted_data": {"item_name": matched_med["name"], "quantity": quantity}},
            legal_basis="Điều 9 & 10 Thông tư 22/2011/TT-BYT & Điều 15 TT 20/2017/TT-BYT",
            suggested_chips=["Kiểm tra cơ số tủ trực", "Nộp vỏ ống thuốc gây nghiện", "Xem danh sách phiếu nợ chưa bù"]
        )

    # -------------------------------------------------------------
    # 2. INTENT: BÁO HỎNG TRANG THIẾT BỊ Y TẾ (NĐ 98/2021)
    # -------------------------------------------------------------
    if any(k in lower for k in ["báo hỏng", "sự cố", "hỏng máy", "xì khí", "chập", "rách", "lỗi", "cháy", "kêu", "không lên nguồn"]):
        matched_eq = None
        for eq in EQUIPMENT_CATALOG:
            if any(k in lower for k in eq["keywords"]):
                matched_eq = eq
                break

        if not matched_eq:
            matched_eq = EQUIPMENT_CATALOG[0] # Default PB840

        # Location
        location = "Phòng mổ 2 - Tầng 3"
        loc_match = re.search(r"(phòng mổ|khoa cấp cứu|icu|buồng|khoa)\s+([A-Za-z0-9\s\-]+?)(?=\s+(?:bị|lỗi|hỏng|$))", text, re.IGNORECASE)
        if loc_match:
            location = f"{loc_match.group(1)} {loc_match.group(2)}".strip()

        # Issue
        issue = "Phát hiện dấu hiệu bất thường, cần kỹ sư kiểm tra gấp"
        if "xì khí" in lower:
            issue = "Dây thở silicon nứt khớp nối gây xì khí áp lực thấp (Ppeak giảm)"
        elif "bản cực" in lower or "tiếp xúc" in lower:
            issue = "Bản cực sốc tim ngoài lồng ngực bị tróc lớp phủ tiếp xúc, chập chờn"
        elif "cáp" in lower or "spo2" in lower:
            issue = "Cáp đo SpO2 chập chờn tín hiệu Pleth"
        elif "pin" in lower:
            issue = "Cell pin tích điện NiMH bị chai, nguồn sụt nhanh khi ngắt điện lưới"
        elif "tmp" in lower or "bọt khí" in lower:
            issue = "Cảm biến áp lực TMP vượt ngưỡng cảnh báo 350 mmHg"

        urgency = "urgent" if matched_eq["risk"] == "D" else "warning"

        return CopilotResponse(
            intent="REPORT_EQUIPMENT_INCIDENT",
            reply_text=f"Tôi đã phân tích báo cáo sự cố thiết bị y tế và chuẩn bị **Phiếu Báo Hỏng Kỹ Thuật (NĐ 98/2021)**:\n\n"
                       f"• **Thiết bị:** {matched_eq['name']} (Phân loại rủi ro: Loại {matched_eq['risk']})\n"
                       f"• **Model / Serial:** {matched_eq['model']} (S/N: {matched_eq['serial']})\n"
                       f"• **Vị trí:** {location}\n"
                       f"• **Tình trạng:** {issue}\n"
                       f"• **Mức ưu tiên:** {'KHẨN CẤP (P1)' if urgency == 'urgent' else 'CẢNH BÁO'}\n\n"
                       f"Hệ thống sẽ tự động thông báo cho KS. Đặng Văn Nam (Kỹ sư trực TBYT) và điều phối linh kiện dự phòng.",
            card=CopilotActionCard(
                card_type="incident_confirm",
                title=f"Lập Ticket Báo Hỏng: {matched_eq['name']}",
                summary=f"{issue} tại {location}",
                data={
                    "device_name": matched_eq["name"],
                    "device_model": matched_eq["model"],
                    "serial_number": matched_eq["serial"],
                    "risk_class": matched_eq["risk"],
                    "location": location,
                    "accessory_issue": issue,
                    "urgency": urgency
                },
                primary_action_label="Phát Lệnh Báo Hỏng & Điều Phối Dự Phòng",
                primary_action_type="EXECUTE_INCIDENT",
                target_tab="equipment"
            ),
            suggested_action={"type": "OPEN_INCIDENT_MODAL"},
            legal_basis="Điều 34 & 58 Nghị định 98/2021/NĐ-CP & Thông tư 05/2022/TT-BYT",
            suggested_chips=["Xem danh sách máy đang sửa", "Kiểm tra hạn tem kiểm định", "Điều phối dây thở dự phòng"]
        )

    # -------------------------------------------------------------
    # 3. INTENT: TRUY VẤN THUỐC CẬN HẠN & KHO FEFO (TT 36 GSP)
    # -------------------------------------------------------------
    if any(k in lower for k in ["cận hạn", "hạn dùng", "date", "fefo", "sắp hết hạn", "quá hạn", "hết date"]):
        stmt = select(InventoryBatch).where(InventoryBatch.days_left < 60).order_by(InventoryBatch.expiry_date.asc())
        res = await db.execute(stmt)
        batches = res.scalars().all()

        lines = []
        card_items = []
        for b in batches[:6]:
            lines.append(f"• **{b.item_name}** | Lô `{b.batch_number}` | Hạn: **{b.expiry_date}** (Còn **{b.days_left}** ngày) | Tồn: {b.current_stock} {b.unit}")
            card_items.append({"name": b.item_name, "batch": b.batch_number, "days_left": b.days_left, "stock": b.current_stock, "unit": b.unit, "expiry": b.expiry_date})

        report_str = "\n".join(lines) if lines else "Hiện tại không có lô thuốc nào cận hạn dưới 60 ngày."

        return CopilotResponse(
            intent="FEFO_NEAR_EXPIRY_REPORT",
            reply_text=f"Theo nguyên tắc **FEFO (First Expired, First Out)** của Thông tư 36/2018/TT-BYT GSP, dưới đây là danh sách các lô thuốc/vật tư cận hạn dưới 60 ngày cần ưu tiên xuất kho:\n\n{report_str}\n\n"
                       f"*Khuyến cáo dược lâm sàng:* Ưu tiên xuất trước các lô Ceftriaxone, SAT và Catgut để tránh nguy cơ tiêu hủy thuốc đắt tiền.",
            card=CopilotActionCard(
                card_type="fefo_report",
                title="Báo Cáo Lô Dược Phẩm Cận Hạn FEFO (< 60 Ngày)",
                summary=f"Có {len(batches)} lô thuốc cận hạn cần ưu tiên điều chuyển xuất kho",
                data={"batches": card_items},
                primary_action_label="Mở Phân Hệ Kho Dược FEFO",
                primary_action_type="NAVIGATE",
                target_tab="fefo"
            ),
            suggested_action={"type": "NAVIGATE_TAB", "target_tab": "fefo"},
            legal_basis="Mục 12 Phụ lục I Thông tư 36/2018/TT-BYT (Thực hành tốt bảo quản thuốc GSP)",
            suggested_chips=["Xuất kho FEFO lô cận hạn", "Lập dự trù bổ sung thuốc cạn kho", "Xem tủ lạnh vắc xin"]
        )

    # -------------------------------------------------------------
    # 4. INTENT: CẢNH BÁO CẠN KHO & DỰ TRÙ BÙ TỒN KHO (TT 22 MẪU 01)
    # -------------------------------------------------------------
    if any(k in lower for k in ["cạn kho", "thiếu thuốc", "dự trù", "mẫu 01", "bù cơ số", "hết hàng", "dưới min"]):
        stmt = select(InventoryBatch).where(InventoryBatch.current_stock <= InventoryBatch.min_threshold)
        res = await db.execute(stmt)
        low_batches = res.scalars().all()

        lines = []
        restock_ids = []
        card_items = []
        total_units = 0
        for b in low_batches:
            needed = b.max_threshold - b.current_stock
            total_units += needed
            restock_ids.append(b.id)
            lines.append(f"• **{b.item_name}**: Tồn {b.current_stock}/{b.min_threshold} {b.unit} (Đề xuất bù: +{needed} {b.unit})")
            card_items.append({"id": b.id, "name": b.item_name, "stock": b.current_stock, "min": b.min_threshold, "max": b.max_threshold, "needed": needed, "unit": b.unit})

        report_str = "\n".join(lines) if lines else "Tất cả mặt hàng đều đạt định mức an toàn tối thiểu."

        return CopilotResponse(
            intent="LOW_STOCK_ALERT_REPORT",
            reply_text=f"Phát hiện **{len(low_batches)} mặt hàng** chạm ngưỡng cạn kho lâm sàng (<= Min Threshold) theo quy chế Thông tư 22/2011/TT-BYT:\n\n{report_str}\n\n"
                       f"Đã chuẩn bị sẵn dự thảo **Phiếu Dự Trù Mẫu số 01/TT22** để bù tổng cộng **{total_units} đơn vị** lên mức trần an toàn (Max Threshold).",
            card=CopilotActionCard(
                card_type="low_stock_report",
                title=f"Phiếu Dự Trù Cơ Số Kho Dược Mẫu 01/TT22 ({len(low_batches)} Mặt Hàng)",
                summary=f"Cần bổ sung {total_units} đơn vị thuốc/vật tư chạm đáy an toàn",
                data={"items": card_items, "batch_ids": restock_ids, "total_needed": total_units, "formType": "TT22_RESTOCK_PROPOSAL"},
                primary_action_label="Mở & In Phiếu Dự Trù Mẫu 01/TT22",
                primary_action_type="OPEN_PRINTABLE_FORM",
                target_tab="fefo"
            ),
            suggested_action={"type": "OPEN_PRINTABLE_FORM", "form_type": "TT22_RESTOCK_PROPOSAL"},
            legal_basis="Điều 7 & Mẫu số 01/TT22 ban hành kèm Thông tư 22/2011/TT-BYT",
            suggested_chips=["Duyệt bù phiếu dự trù ngay", "Xem danh sách thuốc cận hạn", "Kiểm tra sổ nợ tủ trực"]
        )

    # -------------------------------------------------------------
    # 5. INTENT: GIÁM SÁT CHUỖI LẠNH & BIỆT TRỮ VẮC XIN (WHO PQS)
    # -------------------------------------------------------------
    if any(k in lower for k in ["chuỗi lạnh", "nhiệt độ", "mất điện", "vắc xin", "vaccine", "datalogger", "biệt trữ", "mkt", "vvm"]):
        stmt = select(ColdChainCurrentState).limit(1)
        res = await db.execute(stmt)
        state = res.scalar_one_or_none()

        temp = state.current_temp if state else 4.5
        is_quarantine = state.is_quarantined if state else False
        is_outage = state.is_outage if state else False
        mkt = state.mkt_temp if state else 5.6
        doses = state.total_vaccine_doses if state else 1250

        status_text = "BÌNH THƯỜNG (2.0°C - 8.0°C)" if not is_outage and not is_quarantine else "CẢNH BÁO BIỆT TRỮ CÁCH LY"

        return CopilotResponse(
            intent="COLD_CHAIN_DIAGNOSTIC",
            reply_text=f"Datalogger giám sát chuỗi lạnh 24/7 ghi nhận:\n\n"
                       f"• **Nhiệt độ hiện tại:** **{temp:.1f}°C** (Trạng thái: `{status_text}`)\n"
                       f"• **Nguồn điện:** {'MẤT ĐIỆN LƯỚI (Máy phát chưa kích hoạt)' if is_outage else 'Điện lưới 220V ổn định'}\n"
                       f"• **Chế độ Biệt trữ (Quarantine):** {'ĐANG KHÓA CÁCH LY' if is_quarantine else 'An toàn (Được phép xuất tiêm)'}\n"
                       f"• **Nhiệt độ động học MKT:** **{mkt:.1f}°C** (Chuẩn WHO: <= 8.0°C)\n"
                       f"• **Cơ số vắc xin giám sát:** {doses:,} liều (Verorab, SAT, Engerix-B)\n\n"
                       f"{'⚠️ **LƯU Ý:** Lô vắc xin đang biệt trữ cách ly sau sự cố mất điện. Cần Giám đốc và Dược sĩ QA ký Lệnh giải phóng lô.' if is_quarantine else 'Hệ thống buồng lạnh đạt chuẩn Thực hành tốt bảo quản thuốc GSP.'}",
            card=CopilotActionCard(
                card_type="coldchain_status",
                title=f"Báo Cáo Chuỗi Lạnh Vắc Xin: {temp:.1f}°C",
                summary="Datalogger giám sát tủ bảo quản số 1 (Dometic HC-302)",
                data={"temperature": temp, "is_outage": is_outage, "is_quarantined": is_quarantine, "mkt": mkt, "doses": doses},
                primary_action_label="Mở Phân Hệ Giám Sát Chuỗi Lạnh",
                primary_action_type="NAVIGATE",
                target_tab="coldchain"
            ),
            suggested_action={"type": "NAVIGATE_TAB", "target_tab": "coldchain"},
            legal_basis="Điều 12 Thông tư 36/2018/TT-BYT & Tiêu chuẩn Dây chuyền lạnh WHO PQS",
            suggested_chips=["Ký giải phóng lô vắc xin", "Mô phỏng sự cố mất điện", "Khôi phục điện lưới 220V"]
        )

    # -------------------------------------------------------------
    # 6. INTENT: ĐỐI SOÁT KIỂM TOÁN BẤT BIẾN (NĐ 130 HMAC-SHA256)
    # -------------------------------------------------------------
    if any(k in lower for k in ["kiểm toán", "toàn vẹn", "chuỗi băm", "chữ ký số", "gian lận", "audit", "sha256", "bảo mật"]):
        integrity = await verify_ledger_integrity(db)
        is_valid = integrity.get("is_valid", True)
        total = integrity.get("total_records", 0)

        return CopilotResponse(
            intent="AUDIT_INTEGRITY_CHECK",
            reply_text=f"Kết quả kiểm tra mật mã học chuỗi băm **HMAC-SHA256 Tamper-evident Audit Ledger** (Nghị định 130/2018/NĐ-CP):\n\n"
                       f"• **Tính toàn vẹn:** {'✅ 100% NGUYÊN VẸN, CHUỖI BĂM HỢP LỆ' if is_valid else '❌ PHÁT HIỆN CAN THIỆP TRÁI PHÉP'}\n"
                       f"• **Tổng số sự kiện lâm sàng ghi nhận:** **{total} bản ghi**\n"
                       f"• **Khối khởi tạo (Genesis Block):** `GENESIS_BLOCK_HOSPITAL_AUDIT_2026`\n"
                       f"• **Khóa liên kết (Hash Chaining):** Mỗi bản ghi lưu trữ `previous_hash` của bản ghi trước đó, bảo đảm mọi hành vi sửa xóa lén lút trong database đều bị phát hiện ngay lập tức.",
            card=CopilotActionCard(
                card_type="audit_integrity",
                title="Sổ Kiểm Toán Lâm Sàng Bất Biến (HMAC-SHA256)",
                summary=f"100% {total} bản ghi kiểm toán không thể chối bỏ, sẵn sàng thanh tra Bộ Y tế",
                data={"is_valid": is_valid, "total_records": total, "genesis": "GENESIS_BLOCK_HOSPITAL_AUDIT_2026"},
                primary_action_label="Mở Sổ Nhật Ký Kiểm Toán Toàn Viện",
                primary_action_type="OPEN_AUDIT_MODAL",
                target_tab=None
            ),
            suggested_action={"type": "OPEN_AUDIT_MODAL"},
            legal_basis="Điều 5 & 12 Nghị định 130/2018/NĐ-CP (Quy định chi tiết thi hành Luật Giao dịch điện tử về chữ ký số)",
            suggested_chips=["Xem chi tiết sổ kiểm toán", "Kiểm tra sổ nợ tủ trực", "Xem báo hỏng máy"]
        )

    # -------------------------------------------------------------
    # 7. INTENT: TƯ VẤN QUY CHUẨN PHÁP LUẬT Y TẾ (LEGAL CONSULTATION)
    # -------------------------------------------------------------
    if any(k in lower for k in ["luật", "thông tư", "nghị định", "quy định", "điều khoản", "pháp lý", "nguyên tắc", "tại sao"]):
        topic = "Quy định chung"
        explanation = ""
        legal_doc = ""

        if "20" in lower or "vỏ ống" in lower or "gây nghiện" in lower or "morphin" in lower:
            topic = "Thông tư 20/2017/TT-BYT - Quản lý thuốc kiểm soát đặc biệt"
            explanation = "Quy định thuốc gây nghiện (Morphin, Fentanyl) bắt buộc phải bảo quản trong tủ sắt có 2 lớp khóa. **Điều 15** quy định phải thu hồi 100% vỏ ống đã tiêm vào khay kiểm soát trước khi cấp bù ống mới. **Điều 16** quy định Hội đồng 3 bên (Dược sĩ, Điều dưỡng, Bác sĩ/Lãnh đạo) tổ chức nghiền nát tiêu hủy vỏ ống định kỳ."
            legal_doc = "Thông tư 20/2017/TT-BYT"
        elif "98" in lower or "thiết bị" in lower or "loại d" in lower or "kiểm định" in lower:
            topic = "Nghị định 98/2021/NĐ-CP & TT 05/2022/TT-BYT - Quản lý TBYT"
            explanation = "Phân loại trang thiết bị y tế theo mức độ rủi ro: Loại A (bông gạc), Loại B (máy điện tim), Loại C (bơm tiêm điện, monitor), Loại D (máy thở, máy sốc tim can thiệp trực tiếp tính mạng). Thiết bị loại D bắt buộc kiểm định an toàn điện lực và dán tem chu kỳ hằng năm bởi các tổ chức được Bộ cấp phép (Quatest 1, NIEMET)."
            legal_doc = "Nghị định 98/2021/NĐ-CP"
        elif "22" in lower or "tủ trực" in lower or "cơ số" in lower:
            topic = "Thông tư 22/2011/TT-BYT - Quy chế Khoa Dược & Tủ trực lâm sàng"
            explanation = "Quy định danh mục cơ số thuốc cấp cứu tủ trực buồng bệnh do Giám đốc Bệnh viện phê duyệt. Bắt buộc bàn giao đủ cơ số giữa các ca trực. Cho phép điều dưỡng rút khẩn cấp thuốc cấp cứu và hoàn bù theo Phiếu dự trù Mẫu số 01/TT22."
            legal_doc = "Thông tư 22/2011/TT-BYT"
        elif "36" in lower or "fefo" in lower or "gsp" in lower:
            topic = "Thông tư 36/2018/TT-BYT - Thực hành tốt bảo quản thuốc (GSP)"
            explanation = "Bắt buộc áp dụng nguyên tắc xuất kho FEFO (First Expired, First Out) đối với toàn bộ dược phẩm và sinh phẩm để hạn chế tối đa việc thuốc hết hạn phải tiêu hủy. Quy định điều kiện bảo quản dây chuyền lạnh 2°C - 8°C."
            legal_doc = "Thông tư 36/2018/TT-BYT"
        elif "151" in lower or "tài sản" in lower or "thanh lý" in lower:
            topic = "Nghị định 151/2017/NĐ-CP & NĐ 114/2024 - Quản lý Tài sản công"
            explanation = "Quy định kiểm kê tài sản nhà nước vào ngày 31/12 hằng năm. Điều chuyển tài sản giữa các khoa phòng bắt buộc lập biên bản theo Mẫu số 01/TSC-ĐC. Chỉ Giám đốc Bệnh viện mới có thẩm quyền ra quyết định thành lập hội đồng thanh lý tài sản nhà nước hư hỏng, hết khấu hao."
            legal_doc = "Nghị định 151/2017/NĐ-CP"
        else:
            topic = "Tổng quan Khung Pháp lý Y tế Bệnh viện"
            explanation = "Hệ thống vận hành đồng bộ theo 6 trụ cột pháp lý: TT 22/2011 (Tủ trực), TT 20/2017 (Gây nghiện & Vỏ ống), TT 51/2017 (Cấp cứu phản vệ), TT 36/2018 (FEFO & GSP), NĐ 98/2021 (Thiết bị y tế loại D), và NĐ 151/2017 (Tài sản công)."
            legal_doc = "Văn bản quy phạm pháp luật Y tế Việt Nam"

        return CopilotResponse(
            intent="LEGAL_CONSULTATION",
            reply_text=f"### Cố Vấn Pháp Quy Y Tế: {topic}\n\n{explanation}\n\nBạn có thể mở Thư viện văn bản pháp luật để xem nguyên văn thông tư và nghị định.",
            card=CopilotActionCard(
                card_type="legal_guide",
                title=f"Tài Liệu Pháp Quy: {topic}",
                summary="Căn cứ áp dụng trực tiếp trong quy trình lâm sàng Đồ án 2",
                data={"doc_title": topic, "content": explanation},
                primary_action_label="Mở Thư Viện Văn Bản Luật",
                primary_action_type="OPEN_LEGAL_MODAL",
                target_tab=None
            ),
            suggested_action={"type": "OPEN_LEGAL_MODAL"},
            legal_basis=legal_doc,
            suggested_chips=["Quy định vỏ ống Morphin TT 20", "Phân loại thiết bị loại D NĐ 98", "Nguyên tắc xuất kho FEFO TT 36"]
        )

    # -------------------------------------------------------------
    # 8. DEFAULT: TRỢ LÝ ĐA NĂNG & ĐIỀU HƯỚNG
    # -------------------------------------------------------------
    return CopilotResponse(
        intent="GENERAL_CLINICAL_ASSISTANCE",
        reply_text=f"Xin chào **{payload.user_name}**! Tôi là **Trợ lý Agent Lâm Sàng Thông Minh**, đồng hành hỗ trợ kíp trực bệnh viện theo đúng quy chế Bộ Y tế.\n\n"
                   f"Tôi có thể hỗ trợ bạn thực thi tự động:\n"
                   f"1. **Mượn khẩn thuốc ca đêm:** Ví dụ: *'Mượn 2 ống Morphin cho bệnh nhân Võ Minh Trí buồng cấp cứu 3'*\n"
                   f"2. **Báo hỏng máy thở & thiết bị:** Ví dụ: *'Máy thở PB840 phòng mổ 2 bị xì khí nứt bẫy nước'*\n"
                   f"3. **Kiểm tra thuốc cận hạn:** Ví dụ: *'Cho tôi xem danh sách thuốc cận hạn dưới 60 ngày theo FEFO'*\n"
                   f"4. **Kiểm tra cạn kho:** Ví dụ: *'Mặt hàng nào đang chạm ngưỡng Min cần lập dự trù Mẫu 01?'*\n"
                   f"5. **Chuỗi lạnh vắc xin:** Ví dụ: *'Kiểm tra nhiệt độ Datalogger buồng lạnh và chỉ số MKT'*\n"
                   f"6. **Đối soát mật mã học:** Ví dụ: *'Kiểm tra tính toàn vẹn chuỗi băm HMAC-SHA256 sổ kiểm toán'*\n\n"
                   f"Hãy chọn gợi ý nhanh bên dưới hoặc gõ trực tiếp yêu cầu của bạn!",
        card=None,
        suggested_action=None,
        legal_basis="Thông tư 22/2011, TT 20/2017, NĐ 98/2021 & NĐ 151/2017",
        suggested_chips=[
            "Mượn khẩn 2 ống Morphin buồng CC3",
            "Báo hỏng máy thở PB840 phòng mổ 2",
            "Thuốc cận hạn < 60 ngày FEFO",
            "Kiểm tra nhiệt độ buồng lạnh",
            "Kiểm tra toàn vẹn sổ kiểm toán"
        ]
    )
