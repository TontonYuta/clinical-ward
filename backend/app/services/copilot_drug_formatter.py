"""Module định dạng hồ sơ Dược thẩm định và thẻ thông tin thuốc (<=185 LOC)."""
import re
import unicodedata
from typing import List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.models.inventory import InventoryBatch
from app.schemas.copilot import CopilotResponse, CopilotActionCard
from app.services.session_context import SessionState
from app.services.copilot_drug_citation_helper import format_clinical_text, build_drug_citation
from app.services.chatbot.chip_generator import generate_suggested_chips

_format_clinical_text, _drug_citation = format_clinical_text, build_drug_citation

async def build_drug_profile_response(
    drugs: List[DavNationalDrug],
    db: AsyncSession,
    session: SessionState,
    query: str = ""
) -> CopilotResponse:
    matched = drugs[0]
    first_active = matched.active_ingredient.split(";")[0].split("+")[0].strip().lower()
    clean_active = re.sub(r"[\d.,\s\xa0]+(?:mg|g|mcg|ml|iu|ui|%|đơn vị).*$", "", first_active, flags=re.IGNORECASE).strip().lower()
    clean_inn = re.sub(r"\(.*?\)", "", clean_active).strip()
    clean_inn = re.sub(r"\b(?:dưới dạng|tương đương|as|equivalent)\b.*$", "", clean_inn, flags=re.IGNORECASE).strip()

    monograph = None
    if matched.clinical_monograph_id:
        mono_res = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == matched.clinical_monograph_id))
        monograph = mono_res.scalar_one_or_none()
    if monograph is None:
        for target in [clean_inn, clean_active, first_active]:
            if not target or len(target) < 3:
                continue
            mono_res = await db.execute(select(ClinicalDrugMonograph).where(func.lower(ClinicalDrugMonograph.inn).like(f"%{target}%")))
            candidates = mono_res.scalars().all()
            if candidates:
                normalize = lambda val: re.sub(r"[^a-z0-9]+", "", val.casefold())
                norm_target = normalize(target)
                monograph = next((c for c in candidates if norm_target in normalize(c.inn)), candidates[0])
                break

    def value(field: str) -> Optional[str]:
        return getattr(matched, field, None) or (getattr(monograph, field, None) if monograph else None)

    lower_query = query.casefold()
    from app.services.chatbot.intent_feature_matrix import rank_clinical_intents
    intent_to_field = {
        "pediatric_dosage": ("pediatric_dosage", "pediatric_dosage", "Liều dùng trẻ em"),
        "adult_dosage": ("adult_dosage", "adult_dosage", "Liều dùng người lớn"),
        "contraindications": ("contraindications", "contraindications", "Chống chỉ định"),
        "adverse_effects": ("adverse_effects", "adverse_effects", "Tác dụng không mong muốn"),
        "drug_interactions": ("interaction", "drug_interactions", "Tương tác thuốc"),
        "indications": ("indications", "indications", "Chỉ định"),
        "ingredient": ("ingredient", "active_ingredient", "Hoạt chất"),
        "pregnancy_warning": ("pregnancy", "pregnancy_warning", "Cảnh báo phụ nữ mang thai & cho con bú"),
        "renal_adjustment": ("renal_adjustment", "renal_adjustment", "Hiệu chỉnh liều suy thận"),
        "stock_inquiry": ("stock", "", "Tồn kho"),
    }
    ranked = rank_clinical_intents(query, min_score=1.5)
    requested_fields = [
        (intent_to_field[k][0], (), intent_to_field[k][1], intent_to_field[k][2])
        for k, _ in ranked if k in intent_to_field
    ]
    if any(term in lower_query for term in ("theo dõi", "xét nghiệm", "giám sát")):
        requested_fields.append(("monitoring", (), "description", "Theo dõi / xét nghiệm"))
    if any(s[0] == "pediatric_dosage" for s in requested_fields):
        requested_fields = [s for s in requested_fields if s[0] != "adult_dosage"]
    from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
    resolved_keys = resolve_registered_medications(first_active)
    active_drug_key = resolved_keys[0] if resolved_keys else None
    contextual_chips = generate_suggested_chips(active_drug_key, "monograph_field_lookup", {s[0] for s in requested_fields}, drug_name=matched.brand_name)

    async def get_batches():
        stmt = select(InventoryBatch).where(or_(func.lower(InventoryBatch.item_name).like(f"%{matched.brand_name.lower()}%"), func.lower(InventoryBatch.item_name).like(f"%{first_active}%")))
        return (await db.execute(stmt)).scalars().all()

    if requested_fields:
        key, _, field, label = requested_fields[0]
        if len(requested_fields) > 1:
            labels, details = [], []
            for field_key, _, req_field, req_label in requested_fields:
                req_val = value(req_field) if field_key != "stock" else None
                req_val = req_val or f"Chưa có dữ liệu {req_label.lower()} được xác thực trong nguồn đang lập chỉ mục."
                labels.append(req_label)
                details.append(f"- **{req_label}:** {format_clinical_text(str(req_val).strip())}")
            source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "CSDL đăng ký thuốc Cục Quản lý Dược"
            reply = "### " + ", ".join(labels) + ": " + matched.brand_name + "\n\n" + "\n".join(details)
            session.set_active_medication(name=matched.brand_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
            return CopilotResponse(
                intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None, legal_basis=source,
                suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
                answer_type="medication_fields", source_status="exact_match", confidence=1.0, citations=[build_drug_citation(matched, monograph, source)]
            )
        if key == "stock":
            stock_batches = await get_batches()
            total_stock = sum(batch.current_stock for batch in stock_batches)
            detail = f"{total_stock} {matched.standard_unit}" + (f"; vị trí: {stock_batches[0].warehouse_location}" if stock_batches else "")
        else:
            detail = value(field)
        detail = format_clinical_text(str(detail).strip()) if detail else f"Chưa có dữ liệu {label.lower()} được xác thực cho {matched.brand_name} trong nguồn đang lập chỉ mục. Hãy đối chiếu tờ hướng dẫn sử dụng hoặc hỏi dược sĩ lâm sàng."
        source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "CSDL đăng ký thuốc Cục Quản lý Dược"
        session.set_active_medication(name=matched.brand_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=f"### {label}: {matched.brand_name}\n\n{detail}",
            card=None, legal_basis=source, suggested_chips=contextual_chips, session_id=session.session_id,
            active_medication_name=session.active_medication_name, answer_type="medication_field",
            source_status="exact_match", confidence=1.0, citations=[build_drug_citation(matched, monograph, source)]
        )

    is_full_profile = any(p in lower_query for p in (
        "thông tin đầy đủ", "thong tin day du", "hồ sơ đầy đủ", "ho so day du",
        "toàn bộ thông tin", "toan bo thong tin", "chi tiết đầy đủ", "full thông tin",
        "thông tin chi tiết", "thong tin chi tiet", "hồ sơ chi tiết", "ho so chi tiet"
    ))
    if query.strip() and not is_full_profile:
        source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "CSDL đăng ký thuốc Cục Quản lý Dược"
        reply = (f"### Thuốc: {matched.brand_name}\n\n- **Hoạt chất:** {matched.active_ingredient}\n"
                 f"- **Hàm lượng:** {matched.concentration or 'Chưa ghi nhận'}\n- **Dạng bào chế:** {matched.dosage_form or 'Chưa ghi nhận'}\n"
                 f"- **SĐK:** {matched.national_code}")
        session.set_active_medication(name=matched.brand_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None, legal_basis=source,
            suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
            answer_type="medication_summary", source_status="exact_match", confidence=1.0, citations=[build_drug_citation(matched, monograph, source)]
        )

    batches = await get_batches()
    in_stock = sum(b.current_stock for b in batches)
    header_title = f"### 💊 HỒ SƠ DƯỢC THẨM ĐỊNH CHÍNH XÁC (CỤC QUẢN LÝ DƯỢC - BỘ Y TẾ)\n" if in_stock > 0 else f"### 📋 HỒ SƠ DƯỢC QUỐC GIA - CHƯA NHẬP KHO NỘI VIỆN (0 ĐƠN VỊ)\n"
    details = (
        f"{header_title}"
        f"• **Tên biệt dược:** **{matched.brand_name}** | **SĐK:** `{matched.national_code}`\n"
        f"• **Hoạt chất:** **{matched.active_ingredient}** | **Hàm lượng:** {matched.concentration or 'Theo HS công bố'}\n"
        f"• **Dạng bào chế:** {matched.dosage_form or 'Đạt chuẩn DĐVN V'} | **Đường dùng:** {matched.route or 'Theo chỉ định'}\n"
        f"• **Đơn vị:** {matched.standard_unit} | **Phân loại:** **{matched.group}** ({'Kiểm soát ĐB TT 20' if matched.is_controlled else 'Thuốc thường'})\n"
    )
    for k, icon, lbl in [("indications", "🎯", "Chỉ định điều trị"), ("contraindications", "⚠️", "Chống chỉ định"), ("adult_dosage", "🛡️", "Liều lượng dùng"), ("adverse_effects", "🚨", "Tác dụng không mong muốn"), ("antidote", "🧪", "Thuốc giải độc (Antidote)")]:
        val = value(k)
        if val: details += f"{icon} **{lbl}:** {format_clinical_text(str(val).strip())}\n"

    card = CopilotActionCard(
        card_type="medication_safety", title=f"Dược Quốc Gia: {matched.brand_name}",
        summary=f"SĐK: {matched.national_code} | Hoạt chất: {matched.active_ingredient}",
        data={"national_code": matched.national_code, "brand_name": matched.brand_name,
              "active_ingredient": matched.active_ingredient, "group": matched.group, "in_stock": in_stock},
        primary_action_label="Xem Chi Tiết Thuốc", primary_action_type="OPEN_MEDICATION_SAFETY"
    )
    session.set_active_medication(
        name=matched.brand_name, ingredient=matched.active_ingredient,
        batch=batches[0].batch_number if batches else matched.national_code,
        stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho",
        location=batches[0].warehouse_location if batches else "Kho Dược Quốc Gia", sdk=matched.national_code
    )
    prof_source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "Cục Quản lý Dược (DAV) & Dược Thư Quốc Gia Việt Nam"
    return CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text=details, card=card, legal_basis=prof_source,
        suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
        active_medication_stock=session.active_medication_stock, active_medication_location=session.active_medication_location,
        answer_type="medication_profile", source_status="exact_match", confidence=1.0,
        citations=[build_drug_citation(matched, monograph, prof_source)]
    )
