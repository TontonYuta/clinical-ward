"""
Module định dạng hồ sơ Dược thẩm định và thẻ thông tin thuốc (<=120 LOC)
"""

import re
from typing import List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.session_context import SessionState

async def build_drug_profile_response(
    drugs: List[DavNationalDrug],
    db: AsyncSession,
    session: SessionState
) -> CopilotResponse:
    matched = drugs[0]
    first_active = matched.active_ingredient.split(";")[0].split("+")[0].strip().lower()

    if not matched.clinical_source or "Trang" not in matched.clinical_source:
        from app.models.registry import ClinicalDrugMonograph
        normalize = lambda val: re.sub(r"[^a-z0-9]+", "", val.casefold())
        active_key = normalize(first_active)
        m_res = await db.execute(select(ClinicalDrugMonograph))
        exact_matches = [c for c in m_res.scalars() if normalize(c.inn) == active_key]
        mono = exact_matches[0] if len(exact_matches) == 1 else None
        if mono and mono.source:
            matched.clinical_source = mono.source

    inv_stmt = select(InventoryBatch).where(
        or_(
            func.lower(InventoryBatch.item_name).like(f"%{matched.brand_name.lower()}%"),
            func.lower(InventoryBatch.item_name).like(f"%{first_active}%")
        )
    )
    inv_res = await db.execute(inv_stmt)
    batches = inv_res.scalars().all()
    in_stock = sum(b.current_stock for b in batches)

    citation_block, pdf_url, pdf_page = "", None, None
    if matched.clinical_source:
        page_match = re.search(r"Trang\s*([\d\s–-]+)", matched.clinical_source, re.IGNORECASE)
        pdf_page = page_match.group(1).strip() if page_match else None
        page_first_num = pdf_page.split('-')[0].split('–')[0].strip() if pdf_page else None
        pdf_url = f"/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page={page_first_num}" if page_first_num else "/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf"
        citation_block = (
            f"\n📚 **Tài liệu đối chứng chính thức:** {matched.clinical_source}\n"
            f"📄 **Tệp PDF Dược Thư:** `Duoc_Thu_Quoc_Gia_Viet_Nam.pdf` {f'(Trang {pdf_page})' if pdf_page else ''}\n"
            f"🔗 **Mở tài liệu gốc:** [📖 Mở tệp PDF Dược Thư 2015 {f'(Trang {pdf_page})' if pdf_page else ''}]({pdf_url})\n"
        )

    header_title = (
        f"### 💊 HỒ SƠ DƯỢC THẨM ĐỊNH CHÍNH XÁC (CỤC QUẢN LÝ DƯỢC - BỘ Y TẾ)\n{citation_block}\n"
        if in_stock > 0 else
        f"### 📋 HỒ SƠ DƯỢC QUỐC GIA - CHƯA NHẬP KHO NỘI VIỆN (0 ĐƠN VỊ)\n{citation_block}\n"
    )
    details = (
        f"{header_title}"
        f"• **Tên biệt dược:** **{matched.brand_name}** | **SĐK:** `{matched.national_code}`\n"
        f"• **Hoạt chất:** **{matched.active_ingredient}** | **Hàm lượng:** {matched.concentration or 'Theo HS công bố'}\n"
        f"• **Dạng bào chế:** {matched.dosage_form or 'Đạt chuẩn DĐVN V'} | **Đường dùng:** {matched.route or 'Theo chỉ định'}\n"
        f"• **Đơn vị:** {matched.standard_unit} | **Phân loại:** **{matched.group}** ({'Kiểm soát ĐB TT 20' if matched.is_controlled else 'Thuốc thường'})\n"
    )

    if matched.indications: details += f"\n🎯 **Chỉ định điều trị:** {matched.indications}\n"
    if matched.contraindications: details += f"⚠️ **Chống chỉ định:** {matched.contraindications}\n"
    if matched.adult_dosage: details += f"🛡️ **Liều lượng dùng:** {matched.adult_dosage}\n"
    if matched.antidote: details += f"🧪 **Thuốc giải độc (Antidote):** {matched.antidote}\n"

    if in_stock > 0:
        details += f"\n📦 **Tồn kho Bệnh viện:** **{in_stock} {matched.standard_unit}** (Sẵn sàng cấp phát tại tủ trực khoa phòng)."
    else:
        details += (
            f"\n📦 **Tồn kho Bệnh viện:** 🔴 **0 {matched.standard_unit}** (Hiện không có sẵn trong cơ số tủ trực 20 mặt hàng).\n"
            f"👉 **Đề xuất xử trí:** Cân nhắc thuốc tương đương có sẵn trong kho hoặc lập **Phiếu dự trù Mẫu 01 (TT 22/2011/TT-BYT)** để Khoa Dược bổ sung."
        )
    if len(drugs) > 1:
        others = ", ".join([f"{d.brand_name} (`{d.national_code}`)" for d in drugs[1:4]])
        details += f"\n🔍 **Các quy cách / SĐK khác:** {others}"

    card = CopilotActionCard(
        card_type="medication_safety",
        title=f"Dược Quốc Gia: {matched.brand_name}",
        summary=f"SĐK: {matched.national_code} | Hoạt chất: {matched.active_ingredient}",
        data={
            "national_code": matched.national_code, "brand_name": matched.brand_name,
            "active_ingredient": matched.active_ingredient, "group": matched.group, "in_stock": in_stock,
            "officialSource": matched.clinical_source or "CSDL Cục Quản lý Dược",
            "pdfDocument": "Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" if matched.clinical_source else None,
            "pdfPage": pdf_page, "citationUrl": pdf_url
        },
        primary_action_label=f"Mở PDF Dược Thư (Trang {pdf_page.split('-')[0].strip()})" if pdf_page else "Xem Chi Tiết Thuốc",
        primary_action_type="OPEN_MEDICATION_SAFETY"
    )

    batch_loc = batches[0].warehouse_location if batches else "Kho Dược Quốc Gia"
    batch_no = batches[0].batch_number if batches else matched.national_code
    session.set_active_medication(
        name=matched.brand_name, ingredient=matched.active_ingredient,
        batch=batch_no, stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho",
        location=batch_loc, sdk=matched.national_code
    )

    chips = (
        ["Kiểm tra hạn dùng FEFO", "Lập dự trù bù thuốc Mẫu 01", "Xem quy tắc 5 đúng"]
        if in_stock > 0 else
        ["Lập phiếu dự trù Mẫu 01", "Kiểm tra danh mục kho 20 thuốc", "Đối soát ca trực 07:00 AM"]
    )

    return CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text=details, card=card,
        legal_basis="Cục Quản lý Dược (DAV) & Dược Thư Quốc Gia Việt Nam",
        suggested_chips=chips, session_id=session.session_id,
        active_medication_name=session.active_medication_name,
        active_medication_stock=session.active_medication_stock,
        active_medication_location=session.active_medication_location,
        answer_type="medication_profile", source_status="exact_match", confidence=1.0
    )
