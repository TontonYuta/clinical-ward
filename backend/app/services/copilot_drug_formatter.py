"""
Module định dạng hồ sơ Dược thẩm định và thẻ thông tin thuốc (<=120 LOC)
"""

import re
import json
from pathlib import Path
from typing import List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.session_context import SessionState

def _format_clinical_text(text: str) -> str:
    """Join PDF line wraps while preserving blank line paragraphs and list items."""
    lines = [line.rstrip() for line in text.splitlines()]
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        if re.match(r"^(?:[-•*]|[0-9]+[.)])", stripped):
            if current:
                paragraphs.append(" ".join(current))
                current = []
            paragraphs.append(stripped)
        else:
            current.append(stripped)
    if current:
        paragraphs.append(" ".join(current))
    return "\n\n".join(paragraphs)

def _drug_citation(matched: DavNationalDrug, monograph: object | None, source: str) -> dict:
    page_match = re.search(r"Trang\s*(\d+)", source, re.IGNORECASE)
    page = int(page_match.group(1)) if page_match else None
    manifest_path = Path(__file__).resolve().parents[2] / "data" / "knowledge_base" / "clinical_source_manifest.json"
    try:
        sources = json.loads(manifest_path.read_text(encoding="utf-8")).get("sources", [])
    except (OSError, ValueError, TypeError):
        sources = []
    dtqg = next((item for item in sources if item.get("id") == "dtqg-v2-2015"), None)
    has_dtqg_provenance = bool(source and "dược thư" in source.casefold() and dtqg)
    title = "Dược thư Quốc gia Việt Nam, lần xuất bản II" if has_dtqg_provenance else "Cơ sở dữ liệu đăng ký thuốc Cục Quản lý Dược"
    url = f"/{dtqg['public_path'].removeprefix('public/')}" if has_dtqg_provenance else "https://dichvucong.dav.gov.vn/congbothuoc/index"
    document_id = "dtqg-v2-2015" if has_dtqg_provenance else "dav-registry"
    if has_dtqg_provenance and page:
        url += f"#page={page}"
    excerpt = ""
    if monograph is not None:
        for field in ("indications", "contraindications", "adult_dosage", "adverse_effects", "composition", "description"):
            value = getattr(monograph, field, None)
            if value and str(value).strip():
                excerpt = _format_clinical_text(str(value)).strip()
                break
    if not excerpt:
        excerpt = str(getattr(matched, "indications", "") or "").strip()
    if len(excerpt) > 240:
        excerpt = excerpt[:239].rstrip() + "…"
    return {
        "source": title, "legal_basis": source or "Cục Quản lý Dược (DAV)",
        "section": getattr(monograph, "title", None) or matched.active_ingredient,
        "excerpt": excerpt, "document_id": document_id, "url": url, "page": page if has_dtqg_provenance else None,
    }

async def build_drug_profile_response(
    drugs: List[DavNationalDrug],
    db: AsyncSession,
    session: SessionState,
    query: str = ""
) -> CopilotResponse:
    matched = drugs[0]
    first_active = matched.active_ingredient.split(";")[0].split("+")[0].strip().lower()

    from app.models.registry import ClinicalDrugMonograph
    monograph = None
    if matched.clinical_monograph_id:
        mono_result = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == matched.clinical_monograph_id))
        monograph = mono_result.scalar_one_or_none()
    if monograph is None:
        normalize = lambda val: re.sub(r"[^a-z0-9]+", "", val.casefold())
        active_key = normalize(first_active)
        mono_result = await db.execute(select(ClinicalDrugMonograph).where(func.lower(ClinicalDrugMonograph.inn).like(f"%{first_active}%")))
        candidates = [c for c in mono_result.scalars().all() if normalize(c.inn) == active_key]
        monograph = candidates[0] if len(candidates) == 1 else None
    if monograph is None and matched.clinical_source:
        mono_result = await db.execute(select(ClinicalDrugMonograph))
        source_key = re.sub(r"[^a-z0-9]+", "", matched.clinical_source.casefold())
        source_matches = [m for m in mono_result.scalars().all() if m.source and re.sub(r"[^a-z0-9]+", "", m.source.casefold()) in source_key]
        monograph = source_matches[0] if len(source_matches) == 1 else None

    def value(field: str) -> Optional[str]:
        return getattr(matched, field, None) or (getattr(monograph, field, None) if monograph else None)

    lower_query = query.casefold()
    field_specs = [
        ("interaction", ("tương tác", "tương kỵ"), "drug_interactions", "Tương tác thuốc"),
        ("adverse_effects", ("tác dụng phụ", "tác dụng không mong muốn", "adr"), "adverse_effects", "Tác dụng không mong muốn"),
        ("contraindications", ("chống chỉ định", "cấm dùng"), "contraindications", "Chống chỉ định"),
        ("adult_dosage", ("liều dùng", "liều lượng", "liều tối đa", "cách dùng"), "adult_dosage", "Liều dùng người lớn"),
        ("indications", ("chỉ định", "công dụng", "dùng để làm gì", "dùng cho bệnh gì"), "indications", "Chỉ định"),
        ("ingredient", ("thành phần", "hoạt chất"), "active_ingredient", "Hoạt chất"),
        ("stock", ("tồn kho", "còn bao nhiêu", "trong kho", "vị trí kho"), "", "Tồn kho"),
    ]
    requested_fields = [spec for spec in field_specs if any(term in lower_query for term in spec[1])]
    contextual_chips = [
        f"Tác dụng phụ của {matched.active_ingredient.split(';')[0]}?",
        f"Chống chỉ định của {matched.active_ingredient.split(';')[0]}?",
        f"Kiểm tra tương tác của {matched.active_ingredient.split(';')[0]} với thuốc khác",
    ]

    if requested_fields:
        key, _, field, label = requested_fields[0]
        if len(requested_fields) > 1:
            labels = []
            details = []
            for field_key, _, requested_field, requested_label in requested_fields:
                requested_value = value(requested_field) if field_key != "stock" else None
                if not requested_value:
                    requested_value = f"Chưa có dữ liệu {requested_label.lower()} được xác thực trong nguồn đang lập chỉ mục."
                labels.append(requested_label)
                details.append(f"- **{requested_label}:** {_format_clinical_text(str(requested_value).strip())}")
            source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "CSDL đăng ký thuốc Cục Quản lý Dược"
            citation = _drug_citation(matched, monograph, source)
            reply = "### " + ", ".join(labels) + ": " + matched.brand_name + chr(10) * 2 + chr(10).join(details)
            session.set_active_medication(name=matched.brand_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
            return CopilotResponse(
                intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None,
                legal_basis=source, suggested_chips=contextual_chips, session_id=session.session_id,
                active_medication_name=session.active_medication_name,
                answer_type="medication_fields", source_status="exact_match", confidence=1.0,
                citations=[citation],
            )
        if key == "stock":
            stock_stmt = select(InventoryBatch).where(or_(
                func.lower(InventoryBatch.item_name).like(f"%{matched.brand_name.lower()}%"),
                func.lower(InventoryBatch.item_name).like(f"%{first_active}%")
            ))
            stock_res = await db.execute(stock_stmt)
            stock_batches = stock_res.scalars().all()
            total_stock = sum(batch.current_stock for batch in stock_batches)
            detail = f"{total_stock} {matched.standard_unit}"
            if stock_batches:
                detail += f"; vị trí: {stock_batches[0].warehouse_location}"
        else:
            detail = value(field)
        if not detail:
            detail = f"Chưa có dữ liệu {label.lower()} được xác thực cho {matched.brand_name} trong nguồn đang lập chỉ mục. Hãy đối chiếu tờ hướng dẫn sử dụng hoặc hỏi dược sĩ lâm sàng."
        else:
            detail = _format_clinical_text(str(detail).strip())
        source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "CSDL đăng ký thuốc Cục Quản lý Dược"
        citation = _drug_citation(matched, monograph, source)
        reply = f"### {label}: {matched.brand_name}\n\n{detail}"
        session.set_active_medication(name=matched.brand_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None,
            legal_basis=source, suggested_chips=contextual_chips, session_id=session.session_id,
            active_medication_name=session.active_medication_name,
            answer_type="medication_field", source_status="exact_match", confidence=1.0,
            citations=[citation],
        )

    if query.strip():
        source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "CSDL đăng ký thuốc Cục Quản lý Dược"
        citation = _drug_citation(matched, monograph, source)
        reply = (
            f"### Thuốc: {matched.brand_name}\n\n"
            f"- **Hoạt chất:** {matched.active_ingredient}\n"
            f"- **Hàm lượng:** {matched.concentration or 'Chưa ghi nhận'}\n"
            f"- **Dạng bào chế:** {matched.dosage_form or 'Chưa ghi nhận'}\n"
            f"- **SĐK:** {matched.national_code}"
        )
        session.set_active_medication(name=matched.brand_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None,
            legal_basis=source, suggested_chips=contextual_chips, session_id=session.session_id,
            active_medication_name=session.active_medication_name,
            answer_type="medication_summary", source_status="exact_match", confidence=1.0,
            citations=[citation],
        )

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
