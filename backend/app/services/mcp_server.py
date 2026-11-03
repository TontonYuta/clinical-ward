"""
MCP Server Execution Engine (<=195 LOC)
Điều phối và thực thi các công cụ Model Context Protocol cho Dược lâm sàng
"""
from typing import Any
from sqlalchemy import select, or_, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.schemas.mcp import McpToolCallResponse, McpContentItem
from app.models.registry import DavNationalDrug
from app.models.inventory import InventoryBatch
from app.services.clinical_ddi_engine import evaluate_pair, PatientClinicalContext

async def handle_lookup_dav_drug(args: dict[str, Any], db: AsyncSession) -> tuple[str, dict[str, Any]]:
    query = str(args.get("query", "")).strip()
    if not query:
        raise ValueError("Tham số 'query' không được để trống")
    limit = min(max(int(args.get("limit", 5)), 1), 20)
    q = f"%{query.lower()}%"
    stmt = (
        select(DavNationalDrug)
        .where(or_(
            func.lower(DavNationalDrug.brand_name).like(q),
            func.lower(DavNationalDrug.active_ingredient).like(q),
            func.lower(DavNationalDrug.national_code).like(q),
        ))
        .order_by(
            (func.lower(DavNationalDrug.national_code) == query.lower()).desc(),
            (func.lower(DavNationalDrug.brand_name) == query.lower()).desc(),
            DavNationalDrug.brand_name.asc()
        ).limit(limit)
    )
    drugs = (await db.execute(stmt)).scalars().all()
    if not drugs:
        return f"Không tìm thấy thuốc nào khớp với '{query}' trong CSDL 54.885 thuốc DAV.", {"drugs": [], "total": 0}
    items = [{
        "id": d.id, "national_code": d.national_code, "brand_name": d.brand_name,
        "active_ingredient": d.active_ingredient, "concentration": d.concentration,
        "dosage_form": d.dosage_form, "route": d.route, "group": d.group,
        "is_high_alert": d.is_high_alert, "manufacturer": d.manufacturer,
        "indications": d.indications, "contraindications": d.contraindications,
        "renal_adjustment": d.renal_adjustment
    } for d in drugs]
    lines = [f"### 📋 Tra cứu Dược thư DAV (Tìm thấy {len(drugs)} kết quả cho '{query}'):\n"]
    for d in drugs:
        lines.append(f"- **{d.brand_name}** (`{d.national_code}`) | *{d.active_ingredient}* {d.concentration} | Dạng: {d.dosage_form} | Nhóm: {d.group}")
    return "\n".join(lines), {"drugs": items, "total": len(items)}

async def handle_check_ddi(args: dict[str, Any], db: AsyncSession) -> tuple[str, dict[str, Any]]:
    drug_a = str(args.get("drug_a", "")).strip()
    drug_b = str(args.get("drug_b", "")).strip()
    if not drug_a or not drug_b:
        raise ValueError("Cần cung cấp đầy đủ 'drug_a' và 'drug_b'")
    ctx = None
    egfr, is_preg, has_hepa = args.get("egfr"), args.get("is_pregnant", False), args.get("has_hepatic_impairment", False)
    if egfr is not None or is_preg or has_hepa:
        ctx = PatientClinicalContext(
            egfr=float(egfr) if egfr is not None else None,
            is_pregnant=bool(is_preg), has_hepatic_impairment=bool(has_hepa)
        )
    alert = evaluate_pair(drug_a, drug_b, ctx)
    if not alert:
        return f"✅ **Không phát hiện tương tác chống chỉ định hoặc nghiêm trọng** giữa **{drug_a}** và **{drug_b}** theo QĐ 5948/QĐ-BYT.", {"has_interaction": False, "pair": [drug_a, drug_b]}
    text = (
        f"### ⚠️ CẢNH BÁO TƯƠNG TÁC THUỐC ({alert.severity.value})\n"
        f"- **Cặp thuốc:** {alert.drug_a} + {alert.drug_b}\n"
        f"- **Cơ chế:** {alert.mechanism}\n"
        f"- **Hậu quả lâm sàng:** {alert.clinical_consequence}\n"
        f"- **Khuyến cáo xử trí:** {alert.action_recommendation}\n"
        f"- **Căn cứ pháp lý:** {alert.legal_evidence}"
    )
    if alert.escalated_by_patient_context:
        text += f"\n- **Bệnh nền cảnh báo:** {alert.escalation_reason}"
    return text, {
        "has_interaction": True, "severity": alert.severity.value, "rule_id": alert.rule_id,
        "mechanism": alert.mechanism, "clinical_consequence": alert.clinical_consequence,
        "action_recommendation": alert.action_recommendation, "legal_evidence": alert.legal_evidence,
        "escalated_by_patient_context": alert.escalated_by_patient_context
    }

async def handle_get_inventory(args: dict[str, Any], db: AsyncSession) -> tuple[str, dict[str, Any]]:
    med_name = str(args.get("medication_name", "")).strip()
    if not med_name:
        raise ValueError("Tham số 'medication_name' không được để trống")
    loc, near_exp = args.get("location"), bool(args.get("near_expiry_only", False))
    q = f"%{med_name.lower()}%"
    conds = [or_(func.lower(InventoryBatch.item_name).like(q), func.lower(InventoryBatch.active_ingredient).like(q), func.lower(InventoryBatch.national_code).like(q))]
    if loc:
        conds.append(func.lower(InventoryBatch.warehouse_location).like(f"%{loc.lower()}%"))
    if near_exp:
        conds.append(InventoryBatch.is_near_expiry == True)
    batches = (await db.execute(select(InventoryBatch).where(and_(*conds)).order_by(InventoryBatch.expiry_date.asc()))).scalars().all()
    if not batches:
        return f"Không tìm thấy lô thuốc nào cho '{med_name}' tại kho/tủ trực yêu cầu.", {"batches": [], "total_stock": 0}
    total_stock = sum(b.current_stock for b in batches)
    unit = batches[0].unit if batches else "Đơn vị"
    lines = [f"### 📦 BÁO CÁO TỒN KHO FEFO: {batches[0].item_name} (Tổng: {total_stock} {unit})\n"]
    b_data = []
    for b in batches:
        warn = " ⚠️ CẬN HẠN" if b.is_near_expiry else ""
        lines.append(f"- Lô **{b.batch_number}**: SL **{b.current_stock} {b.unit}** | HSD: **{b.expiry_date}** (Còn {b.days_left} ngày) | Kho: {b.warehouse_location}{warn}")
        b_data.append({"batch_number": b.batch_number, "current_stock": b.current_stock, "unit": b.unit, "expiry_date": b.expiry_date, "days_left": b.days_left, "warehouse_location": b.warehouse_location, "is_near_expiry": b.is_near_expiry})
    return "\n".join(lines), {"item_name": batches[0].item_name, "total_stock": total_stock, "batches": b_data}

async def handle_calculate_renal_dose(args: dict[str, Any], db: AsyncSession) -> tuple[str, dict[str, Any]]:
    drug_name = str(args.get("drug_name", "")).strip()
    if not drug_name:
        raise ValueError("Tham số 'drug_name' không được để trống")
    try:
        egfr = float(args.get("egfr"))
    except (TypeError, ValueError):
        raise ValueError("Tham số 'egfr' phải là số thực (mL/min/1.73m2)")
    stages = [(90, "G1", "Bình thường/Tăng lọc"), (60, "G2", "Suy giảm nhẹ"), (45, "G3a", "Suy giảm nhẹ-vừa"), (30, "G3b", "Suy giảm vừa-nặng"), (15, "G4", "Suy thận nặng"), (0, "G5", "Suy thận mạn gđ cuối")]
    st_code, st_desc = next((code, desc) for cut, code, desc in stages if egfr >= cut)
    dn_lower = drug_name.lower()
    is_contra, rec, mon = False, "", "Theo dõi Creatinine & eGFR định kỳ."
    if any(k in dn_lower for k in ["metformin", "panfor", "glucophage"]):
        if egfr < 30:
            is_contra, rec = True, "CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI do nguy cơ nhiễm toan acid lactic gây tử vong. Chuyển sang Insulin."
        elif egfr < 45:
            rec = "Giảm liều tối đa 1000 mg/ngày. Không khởi đầu cho bệnh nhân mới. Theo dõi eGFR mỗi 3 tháng."
        else:
            rec = "Duy trì liều bình thường (tối đa 2000 mg/ngày). Theo dõi eGFR định kỳ."
        mon = "Theo dõi triệu chứng nhiễm toan lactic máu và khí máu nếu có biểu hiện."
    elif any(k in dn_lower for k in ["ciprofloxacin", "cipro"]):
        rec = "Giảm liều: Dùng 250 - 500 mg mỗi 18 - 24 giờ." if egfr < 30 else ("Dùng 250 - 500 mg mỗi 12 giờ." if egfr <= 50 else "Không cần hiệu chỉnh liều chuẩn.")
    elif any(k in dn_lower for k in ["enoxaparin", "lovenox"]):
        rec, mon = ("Dự phòng: 20 mg/ngày; Điều trị: 1 mg/kg/ngày.", "Theo dõi sát hoạt tính Anti-Xa.") if egfr < 30 else ("Không cần hiệu chỉnh liều chuẩn.", mon)
    else:
        q = f"%{dn_lower}%"
        drug = (await db.execute(select(DavNationalDrug).where(or_(func.lower(DavNationalDrug.brand_name).like(q), func.lower(DavNationalDrug.active_ingredient).like(q))).limit(1))).scalars().first()
        rec = f"Trích lục Dược Thư: {drug.renal_adjustment}" if (drug and drug.renal_adjustment) else f"Chưa có khuyến cáo chuyên biệt cho '{drug_name}' tại mức {egfr} mL/min. Tham khảo ý kiến Dược sĩ lâm sàng."
    text = (
        f"### 🧮 ĐÁNH GIÁ LIỀU SUY THẬN (KDIGO & DƯỢC THƯ QG)\n"
        f"- **Thuốc:** {drug_name} | **eGFR:** {egfr} mL/min/1.73m2 ({st_code}: {st_desc})\n"
        f"- **Trạng thái:** {'⛔ CHỐNG CHỈ ĐỊNH' if is_contra else '⚠️ CẦN HIỆU CHỈNH' if egfr < 60 else '✅ AN TOÀN'}\n"
        f"- **Khuyến cáo liều:** {rec}\n- **Giám sát:** {mon}\n- **Căn cứ:** KDIGO 2024 & Dược Thư Quốc Gia Việt Nam 2015"
    )
    return text, {"drug_name": drug_name, "egfr": egfr, "kdigo_stage": st_code, "stage_description": st_desc, "is_contraindicated": is_contra, "recommendation": rec, "monitoring": mon}

HANDLERS = {
    "mcp_lookup_dav_drug": handle_lookup_dav_drug,
    "mcp_check_ddi": handle_check_ddi,
    "mcp_get_inventory": handle_get_inventory,
    "mcp_calculate_renal_dose": handle_calculate_renal_dose,
}

async def execute_mcp_tool(name: str, arguments: dict[str, Any], db: AsyncSession) -> McpToolCallResponse:
    handler = HANDLERS.get(name)
    if not handler:
        return McpToolCallResponse(content=[McpContentItem(type="text", text=f"Lỗi: Không tìm thấy công cụ MCP '{name}'.")], isError=True)
    try:
        text, data = await handler(arguments, db)
        return McpToolCallResponse(content=[McpContentItem(type="text", text=text)], data=data, isError=False)
    except Exception as exc:
        return McpToolCallResponse(content=[McpContentItem(type="text", text=f"Lỗi thực thi công cụ '{name}': {str(exc)}")], isError=True)
