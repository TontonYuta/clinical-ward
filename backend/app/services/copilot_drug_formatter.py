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
    mono_targets = [t for t in [clean_inn, clean_active, first_active] if t and len(t) >= 3]
    conds = []
    if matched.clinical_monograph_id:
        conds.append(ClinicalDrugMonograph.id == matched.clinical_monograph_id)
    for t in mono_targets:
        conds.append(func.lower(ClinicalDrugMonograph.inn).like(f"%{t}%"))
    if conds:
        mono_res = await db.execute(select(ClinicalDrugMonograph).where(or_(*conds)))
        candidates = mono_res.scalars().all()
        if candidates:
            def _score_mono(m: ClinicalDrugMonograph) -> int:
                fields = (m.indications, m.adult_dosage, m.pediatric_dosage, m.precautions,
                          m.adverse_effects, m.drug_interactions, m.overdose_treatment,
                          m.renal_adjustment, m.pregnancy_warning, m.dosage_forms)
                return sum(len(f or "") for f in fields)
            monograph = max(candidates, key=_score_mono)

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

    is_summary_request = any(p in lower_query for p in (
        "tóm tắt", "tom tat", "ngắn gọn", "ngan gon", "vắn tắt", "van tat",
        "sơ lược", "so luoc", "summary", "brief", "ngắn thôi"
    ))
    batches = await get_batches()
    in_stock = sum(b.current_stock for b in batches)
    loc = batches[0].warehouse_location if batches else "Kho Dược Quốc Gia"
    prof_source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "Cục Quản lý Dược (DAV) & Dược Thư Quốc Gia Việt Nam"

    ing = matched.active_ingredient
    conc = matched.concentration
    if ing and conc and re.match(r"^[\d.,\s]+(?:mg|g|mcg|ml|%|iu|ui)\b", ing.strip(), re.IGNORECASE):
        ing, conc = conc, ing

    is_stock_ask = any(w in lower_query for w in ("tồn kho", "ton kho", "trong kho", "còn bao nhiêu", "con bao nhieu", "số lượng", "so luong"))

    if is_summary_request:
        val_ind = value("indications")
        ind_snippet = f"\n• **Chỉ định chính:** {_format_clinical_text(str(val_ind).strip())[:160]}..." if val_ind else ""
        val_contra = value("contraindications")
        contra_snippet = f"\n• **Chống chỉ định:** {_format_clinical_text(str(val_contra).strip())[:160]}..." if val_contra else ""
        stock_snippet = f"\n• **Tồn kho nội viện:** {in_stock} {matched.standard_unit} ({'Có sẵn tại kho' if in_stock > 0 else 'Chưa nhập kho'})" if is_stock_ask else ""
        reply = (
            f"### 📋 TÓM TẮT THÔNG TIN THUỐC: {matched.brand_name}\n\n"
            f"• **Hoạt chất:** **{ing}** | **Hàm lượng:** {conc or 'Theo HS công bố'}\n"
            f"• **Dạng bào chế:** {matched.dosage_form or 'Đạt chuẩn DĐVN V'} | **SĐK:** `{matched.national_code}`\n"
            f"• **Phân loại:** {matched.group} ({'Kiểm soát ĐB TT 20' if matched.is_controlled else 'Thuốc thường'})"
            f"{ind_snippet}{contra_snippet}{stock_snippet}"
        )
        session.set_active_medication(name=matched.brand_name, ingredient=ing, batch=matched.national_code, stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho", location=loc, sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None, legal_basis=prof_source,
            suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
            answer_type="medication_summary", source_status="exact_match", confidence=1.0, citations=[_drug_citation(matched, monograph, prof_source)]
        )

    # Đầy đủ và đúng cấu trúc chuẩn Dược thư Quốc gia & Cục Quản lý Dược
    df_forms = value("dosage_forms") or matched.dosage_form or "Đạt chuẩn DĐVN V"
    header = (
        f"### 💊 HỒ SƠ DƯỢC LÂM SÀNG & CHUYÊN LUẬN ĐỐI CHỨNG: {matched.brand_name}\n"
        f"*(Căn cứ Dược thư Quốc gia Việt Nam DĐVN V & CSDL Cục Quản lý Dược - Bộ Y tế)*\n\n---\n\n"
        f"#### 1. THÔNG TIN ĐỊNH DANH & DẠNG BÀO CHẾ LƯU HÀNH\n"
        f"• **Tên biệt dược:** **{matched.brand_name}** | **Mã SĐK (DAV):** `{matched.national_code}`\n"
        f"• **Hoạt chất chính (INN):** **{ing}**\n"
        f"• **Hàm lượng / Nồng độ:** {conc or 'Theo hồ sơ công bố'}\n"
        f"• **Dạng bào chế lưu hành:** {matched.dosage_form or 'Đạt chuẩn DĐVN V'} | **Đường dùng:** {matched.route or 'Theo chỉ định'}\n"
        f"• **Quy cách đóng gói:** {matched.packaging_spec or 'Theo tiêu chuẩn NSX'} | **Đơn vị:** {matched.standard_unit}\n"
        f"• **Phân loại quản lý:** **{matched.group}** ({'Thuốc kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT)' if matched.is_controlled else 'Thuốc thông thường'})\n"
        f"• **Nhóm dược lý & ATC:** {value('drug_class') or matched.drug_class or 'Đang cập nhật'} | **Mã ATC:** `{value('atc_code') or matched.atc_code or 'DĐVN V'}`\n"
        f"• **Các dạng bào chế chuẩn trong Dược thư:** {_format_clinical_text(str(df_forms).strip())}\n\n"
    )

    body = "".join(
        f"{lbl} {_format_clinical_text(str(value(k) or default).strip())}\n\n"
        for lbl, k, default in [
            ("#### 2. CHỈ ĐỊNH ĐIỀU TRỊ (INDICATIONS)\n🎯", "indications", "Theo hướng dẫn chẩn đoán và điều trị chuyên khoa được Bộ Y tế phê duyệt."),
            ("#### 3. LIỀU LƯỢNG & ĐƯỜNG DÙNG (DOSAGE & ADMINISTRATION)\n🛡️ **Liều người lớn & Đường dùng:**", "adult_dosage", "Tuân thủ liều chỉ định của bác sĩ điều trị và tờ HDSD kèm theo."),
            ("👶 **Liều trẻ em (theo cân nặng mg/kg & lứa tuổi):**", "pediatric_dosage", "Tính liều theo cân nặng (mg/kg) hoặc diện tích da; đối soát kỹ tờ HDSD hoặc chuyên khoa nhi."),
            ("⚙️ **Hiệu chỉnh liều suy thận:**", "renal_adjustment", "Chưa có khuyến cáo hiệu chỉnh đặc thù; theo dõi chức năng thận và Clcr."),
            ("🩺 **Hiệu chỉnh liều suy gan:**", "hepatic_adjustment", "Dùng thận trọng ở bệnh nhân suy giảm chức năng gan; chống chỉ định ở suy gan nặng tiến triển."),
            ("#### 4. CHỐNG CHỈ ĐỊNH (CONTRAINDICATIONS)\n⚠️", "contraindications", "Mẫn cảm hoặc quá mẫn với hoạt chất và bất kỳ tá dược nào của thuốc."),
            ("#### 5. THẬN TRỌNG & CẢNH BÁO ĐẶC BIỆT (PRECAUTIONS & WARNINGS)\n🤰 **Phụ nữ có thai & Cho con bú:**", "pregnancy_warning", "Chỉ sử dụng khi lợi ích điều trị vượt trội nguy cơ tiềm ẩn đối với thai nhi hoặc trẻ bú mẹ."),
            ("🔍 **Thận trọng lâm sàng & Nguy cơ độc tính:**", "precautions", "Đọc kỹ hướng dẫn sử dụng trước khi dùng; tuân thủ theo dõi của nhân viên y tế."),
            ("#### 6. TÁC DỤNG KHÔNG MONG MUỐN (ADR & ADVERSE EFFECTS)\n🚨", "adverse_effects", "Báo ngay cho bác sĩ hoặc dược sĩ lâm sàng nếu gặp phản ứng bất lợi nghi do thuốc."),
            ("#### 7. TƯƠNG TÁC THUỐC (DRUG INTERACTIONS)\n⚡", "drug_interactions", "Rà soát tương tác chống chỉ định hoặc cần lưu ý theo Quyết định 5948/QĐ-BYT."),
            ("#### 8. QUÁ LIỀU & THUỐC GIẢI ĐỘC (OVERDOSE & ANTIDOTE)\n⚠️ **Biểu hiện ngộ độc & Quá liều:**", "overdose_treatment", "Triệu chứng ngộ độc cấp tính hoặc quá liều theo cảnh báo lâm sàng."),
            ("🧪 **Thuốc giải độc đặc hiệu & Xử trí (Antidote):**", "antidote", "Trường hợp quá liều, ngưng thuốc ngay lập tức và điều trị triệu chứng tại cơ sở y tế.")
        ]
    )
    sec_stock = (
        f"#### 9. TÌNH TRẠNG KHO DƯỢC BỆNH VIỆN & TỦ TRỰC\n"
        f"📦 **Tồn kho khả dụng:** **{in_stock} {matched.standard_unit}** ({'Có sẵn tại kho nội viện' if in_stock > 0 else 'Chưa có tồn kho thực tế trong bệnh viện'})\n"
        f"📍 **Vị trí lưu kho:** `{loc}`\n"
    ) if is_stock_ask else ""
    details = header + body + sec_stock

    card = CopilotActionCard(
        card_type="medication_safety", title=f"Dược Quốc Gia: {matched.brand_name}",
        summary=f"SĐK: {matched.national_code} | Hoạt chất: {ing}",
        data={"national_code": matched.national_code, "brand_name": matched.brand_name,
              "active_ingredient": ing, "group": matched.group, "in_stock": in_stock},
        primary_action_label="Xem Chi Tiết Thuốc", primary_action_type="OPEN_MEDICATION_SAFETY"
    )
    session.set_active_medication(
        name=matched.brand_name, ingredient=ing,
        batch=batches[0].batch_number if batches else matched.national_code,
        stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho",
        location=loc, sdk=matched.national_code
    )
    return CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text=details, card=card, legal_basis=prof_source,
        suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
        active_medication_stock=session.active_medication_stock, active_medication_location=session.active_medication_location,
        answer_type="medication_profile", source_status="exact_match", confidence=1.0,
        citations=[_drug_citation(matched, monograph, prof_source)]
    )
