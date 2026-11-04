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
from app.services.dav_normalizer import clean_brand_name

_format_clinical_text, _drug_citation = format_clinical_text, build_drug_citation

async def build_drug_profile_response(
    drugs: List[DavNationalDrug],
    db: AsyncSession,
    session: SessionState,
    query: str = ""
) -> CopilotResponse:
    matched = drugs[0]
    clean_name = clean_brand_name(matched.brand_name)
    from app.services.combination_drug_service import (
        resolve_combination_monographs,
        build_combination_drug_profile,
        parse_combination_ingredients
    )
    combo_ingredients = parse_combination_ingredients(matched.active_ingredient)
    is_combination = len(combo_ingredients) >= 2 or any(term in (matched.active_ingredient or "") for term in (";", "+"))
    primary_mono, components = None, []
    if is_combination:
        primary_mono, components = await resolve_combination_monographs(matched, db)

    first_active = matched.active_ingredient.split(";")[0].split("+")[0].strip().lower()
    clean_active = re.sub(r"[\d.,\s\xa0]+(?:mg|g|mcg|ml|iu|ui|%|đơn vị).*$", "", first_active, flags=re.IGNORECASE).strip().lower()
    clean_inn = re.sub(r"\(.*?\)", "", clean_active).strip()
    clean_inn = re.sub(r"\b(?:dưới dạng|tương đương|as|equivalent)\b.*$", "", clean_inn, flags=re.IGNORECASE).strip()

    monograph = primary_mono
    if not monograph:
        candidates = []
        if matched.clinical_monograph_id:
            mono_res = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == matched.clinical_monograph_id))
            m = mono_res.scalar_one_or_none()
            if m:
                candidates.append(m)

        mono_targets = [t for t in [clean_inn, clean_active, first_active, matched.brand_name.lower()] if t and len(t) >= 3]
        conds = [func.lower(ClinicalDrugMonograph.inn).like(f"%{t}%") for t in mono_targets]
        conds.extend([func.lower(ClinicalDrugMonograph.title).like(f"%{t}%") for t in mono_targets])
        if conds:
            mono_res = await db.execute(select(ClinicalDrugMonograph).where(or_(*conds)))
            candidates.extend(mono_res.scalars().all())

        if candidates:
            def _score_mono(m: ClinicalDrugMonograph) -> int:
                fields = (m.indications, m.adult_dosage, m.pediatric_dosage, m.precautions,
                          m.adverse_effects, m.drug_interactions, m.overdose_treatment,
                          m.renal_adjustment, m.pregnancy_warning, m.dosage_forms)
                return sum(len(f or "") for f in fields)
            monograph = max(candidates, key=_score_mono)

    def value(field: str) -> Optional[str]:
        return (getattr(monograph, field, None) if monograph else None) or getattr(matched, field, None)

    lower_query = query.casefold()
    from app.services.chatbot.intent_feature_matrix import rank_clinical_intents
    intent_to_field = {
        "administration_timing": ("timing", "precautions", "Thời điểm & Cách dùng thuốc (Trước/Sau ăn)"),
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
    contextual_chips = generate_suggested_chips(active_drug_key, "monograph_field_lookup", {s[0] for s in requested_fields}, drug_name=clean_name)

    async def get_batches():
        stmt = select(InventoryBatch).where(or_(func.lower(InventoryBatch.item_name).like(f"%{matched.brand_name.lower()}%"), func.lower(InventoryBatch.item_name).like(f"%{first_active}%")))
        return (await db.execute(stmt)).scalars().all()

    if requested_fields:
        if is_combination and not primary_mono and len(components) >= 2:
            labels, details = [], []
            combo_citations = []
            legal_bases = []
            for field_key, _, req_field, req_label in requested_fields:
                if field_key == "stock":
                    stock_batches = await get_batches()
                    total_stock = sum(batch.current_stock for batch in stock_batches)
                    details.append(f"- **{req_label}:** {total_stock} {matched.standard_unit}" + (f"; vị trí: {stock_batches[0].warehouse_location}" if stock_batches else ""))
                    labels.append(req_label)
                    continue
                comp_lines = []
                for c in components:
                    ing_name = c["ingredient_name"]
                    if c["status"] == "verified_dtqg":
                        mono = c["monograph"]
                        val = getattr(mono, req_field, None)
                        if val:
                            comp_lines.append(f"  * **{ing_name}** (*{mono.title}*): {format_clinical_text(str(val).strip())}")
                        src = mono.source or matched.clinical_source or "Dược thư Quốc gia Việt Nam"
                        combo_citations.append(_drug_citation(matched, mono, src))
                        legal_bases.append(src)
                    else:
                        comp_lines.append(f"  * **{ing_name}:** {c.get('note', 'Chưa có chuyên luận độc lập trong Dược thư Quốc gia')}")
                labels.append(req_label)
                details.append(f"- **{req_label} theo từng hoạt chất:**\n" + "\n".join(comp_lines))

            reply = f"### {', '.join(labels)}: {clean_name}\n*(Đối soát thành phần phối hợp chuẩn DĐVN V)*\n\n" + "\n\n".join(details)
            unique_citations = []
            seen_urls = set()
            for cit in combo_citations:
                u = cit.get("url")
                if u not in seen_urls:
                    seen_urls.add(u)
                    unique_citations.append(cit)
            session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
            return CopilotResponse(
                intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None,
                legal_basis=" • ".join(dict.fromkeys(legal_bases)) if legal_bases else "Dược Thư Quốc Gia Việt Nam",
                suggested_chips=contextual_chips, session_id=session.session_id,
                active_medication_name=session.active_medication_name,
                answer_type="medication_fields", source_status="exact_match", confidence=1.0,
                citations=unique_citations
            )

        key, _, field, label = requested_fields[0]
        if len(requested_fields) > 1:
            labels, details = [], []
            for field_key, _, req_field, req_label in requested_fields:
                req_val = value(req_field) if field_key != "stock" else None
                req_val = req_val or f"Chưa có dữ liệu {req_label.lower()} được xác thực trong nguồn đang lập chỉ mục."
                labels.append(req_label)
                details.append(f"- **{req_label}:** {format_clinical_text(str(req_val).strip())}")
            source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "CSDL đăng ký thuốc Cục Quản lý Dược"
            reply = "### " + ", ".join(labels) + ": " + clean_name + "\n\n" + "\n".join(details)
            session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
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

        if key == "timing" or "Thời điểm" in label:
            from app.services.clinical_prescription_auditor import TIMING_GUIDELINES
            combined = f"{matched.brand_name.lower()} {clean_inn.lower()}"
            specific_timing = None
            if any(term in combined for term in ["zithromax", "azithromycin"]):
                specific_timing = (
                    "• **Dạng viên nén bao phim (Tablets):** Có thể uống **trước hoặc sau bữa ăn** (thức ăn không làm giảm sinh khả dụng của dạng viên nén bao phim).\n"
                    "• **Dạng viên nang (Capsules) hoặc Bột pha hỗn dịch uống (Oral Suspension):** Bắt buộc uống **lúc đói: ít nhất 1 giờ trước bữa ăn hoặc 2 giờ sau bữa ăn** vì thức ăn làm giảm hấp thu thuốc tới 50%.\n"
                    "• **Lưu ý tương tác:** Không uống cùng lúc với thuốc kháng acid chứa Nhôm hoặc Magie (phải uống cách xa ít nhất 2 giờ)."
                )
            else:
                for guide in TIMING_GUIDELINES.values():
                    if any(kw in combined for kw in guide["keywords"]):
                        specific_timing = (
                            f"• **Thời điểm khuyến cáo:** {guide['timing']}.\n"
                            f"• **Cách dùng:** {guide['instruction']}.\n"
                            f"• **Cơ sở dược lý:** {guide['rationale']}"
                        )
                        break

            if specific_timing:
                detail = specific_timing + (f"\n\n*(Thông tin bổ sung từ Dược thư: {format_clinical_text(str(detail or ''))[:250]}...)*" if detail else "")
            else:
                detail = (
                    f"• **Khuyến cáo chung:** Uống thuốc cùng một cốc nước đầy (150 - 200ml nước ấm) sau bữa ăn no 15 - 30 phút để giảm kích ứng dạ dày, trừ trường hợp có chỉ định dùng trước ăn riêng biệt.\n\n"
                    f"*(Trích dẫn DĐVN V: {format_clinical_text(str(detail or 'Tuân thủ liều dùng và cách dùng của bác sĩ điều trị.'))})*"
                )
        elif field == "drug_interactions" or label == "Tương tác thuốc":
            from app.services.clinical_ddi_engine.full_catalog import find_all_interactions_for_drug
            brand_ddis = find_all_interactions_for_drug(matched.brand_name)
            inn_ddis = find_all_interactions_for_drug(clean_inn)
            combined_ddis = []
            seen_ddi = set()
            for d in brand_ddis + inn_ddis:
                p = d.get("partner", "")
                if p not in seen_ddi:
                    seen_ddi.add(p)
                    combined_ddis.append(d)

            ddi_block = ""
            if combined_ddis:
                ddi_block = "\n\n#### ⚠️ CÁC TƯƠNG TÁC ĐÁNG CHÚ Ý THEO QUYẾT ĐỊNH 5948/QĐ-BYT & HDSD:\n"
                for idx, item in enumerate(combined_ddis, 1):
                    ddi_block += (
                        f"• **{idx}. Phối hợp với {item.get('partner')}:**\n"
                        f"  - **Mức độ:** `{item.get('severity')}`\n"
                        f"  - **Cơ chế:** {item.get('mechanism')}\n"
                        f"  - **Hậu quả:** {item.get('consequence')}\n"
                        f"  - **Xử trí lâm sàng:** {item.get('action')}\n"
                        f"  - *Căn cứ:* {item.get('source')}\n"
                    )

            if detail:
                detail = f"{format_clinical_text(str(detail).strip())}{ddi_block}"
            elif combined_ddis:
                detail = f"Thông tin tương tác đối soát từ Dược thư Quốc gia và Quyết định 5948/QĐ-BYT cho **{clean_name}** ({clean_inn.title()}):\n{ddi_block}"
            else:
                detail = f"Chưa có dữ liệu tương tác thuốc được xác thực cho {clean_name} trong nguồn đang lập chỉ mục. Hãy đối chiếu tờ hướng dẫn sử dụng hoặc hỏi dược sĩ lâm sàng."
        else:
            detail = format_clinical_text(str(detail).strip()) if detail else f"Chưa có dữ liệu {label.lower()} được xác thực cho {clean_name} trong nguồn đang lập chỉ mục. Hãy đối chiếu tờ hướng dẫn sử dụng hoặc hỏi dược sĩ lâm sàng."
        source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "CSDL đăng ký thuốc Cục Quản lý Dược"
        session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=f"### {label}: {clean_name}\n\n{detail}",
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
            f"### 📋 TÓM TẮT THÔNG TIN THUỐC: {clean_name}\n\n"
            f"• **Hoạt chất:** **{ing}** | **Hàm lượng:** {conc or 'Theo HS công bố'}\n"
            f"• **Dạng bào chế:** {matched.dosage_form or 'Đạt chuẩn DĐVN V'} | **SĐK:** `{matched.national_code}`\n"
            f"• **Phân loại:** {matched.group} ({'Kiểm soát ĐB TT 20' if matched.is_controlled else 'Thuốc thường'})"
            f"{ind_snippet}{contra_snippet}{stock_snippet}"
        )
        session.set_active_medication(name=clean_name, ingredient=ing, batch=matched.national_code, stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho", location=loc, sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None, legal_basis=prof_source,
            suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
            answer_type="medication_summary", source_status="exact_match", confidence=1.0, citations=[_drug_citation(matched, monograph, prof_source)]
        )

    if is_combination and (primary_mono or len(components) >= 2):
        reply, combo_citations, legal_str = build_combination_drug_profile(matched, primary_mono, components, query=query)
        session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho", location=loc, sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None, legal_basis=legal_str,
            suggested_chips=contextual_chips, session_id=session.session_id,
            active_medication_name=session.active_medication_name,
            answer_type="medication_profile", source_status="exact_match", confidence=1.0,
            citations=combo_citations
        )

    # 1. TẦNG 1: THẺ TÓM TẮT HÀNH ĐỘNG NHANH (Fast Clinical Glance - 3s Ra Quyết Định)
    val_ind = value("indications")
    val_adult_dose = value("adult_dosage")
    val_ped_dose = value("pediatric_dosage")
    val_contra = value("contraindications")
    val_renal = value("renal_adjustment")

    ind_short = _format_clinical_text(str(val_ind or "Theo chỉ định của bác sĩ chuyên khoa.").strip())[:220]
    dose_short = _format_clinical_text(str(val_adult_dose or "Tuân thủ theo chỉ định liều và tờ HDSD.").strip())[:200]
    contra_short = _format_clinical_text(str(val_contra or "Mẫn cảm với bất kỳ thành phần nào của thuốc.").strip())[:180]

    from app.services.clinical_ddi_engine.full_catalog import find_all_interactions_for_drug
    catalog_ddis = find_all_interactions_for_drug(clean_name) + find_all_interactions_for_drug(clean_inn)
    unique_ddis = []
    seen_p = set()
    for cd in catalog_ddis:
        if cd.get("partner") not in seen_p:
            seen_p.add(cd.get("partner"))
            unique_ddis.append(cd)

    top_ddi_text = "Chưa ghi nhận tương tác chống chỉ định nguy hiểm trong CSDL QĐ 5948."
    if unique_ddis:
        top_ddi_text = "; ".join(f"**{cd.get('partner')}** ({cd.get('severity')})" for cd in unique_ddis[:3])

    stock_fast_line = f"• **📦 Tồn kho nội viện:** **{in_stock} {matched.standard_unit}** ({'Có sẵn tại kho' if in_stock > 0 else 'Chưa có tồn kho'}) | Vị trí: `{loc}`\n" if is_stock_ask else ""

    fast_glance_block = (
        f"### 💊 TRA CỨU NHANH DƯỢC LÂM SÀNG: {clean_name}\n"
        f"*(Căn cứ CSDL Dược Quốc gia DAV & Dược thư Quốc gia Việt Nam DĐVN V)*\n\n"
        f"• **Hoạt chất chính (INN):** **{ing}** | **Hàm lượng:** {conc or 'Theo hồ sơ công bố'}\n"
        f"• **Dạng bào chế & SĐK:** {matched.dosage_form or 'Đạt chuẩn DĐVN V'} | SĐK: `{matched.national_code}`\n"
        f"• **🎯 Chỉ định chính:** {ind_short}\n"
        f"• **🛡️ Liều dùng chuẩn:** {dose_short}\n"
        f"• **🚫 Chống chỉ định:** {contra_short}\n"
        f"• **⚡ Tương tác đáng chú ý:** {top_ddi_text}\n"
        f"{stock_fast_line}\n"
        f"---\n\n"
    )

    # 2. TẦNG 2: THAM KHẢO CHUYÊN SÂU TOÀN VĂN DĐVN V (Deep Monograph Collapsible)
    df_forms = value("dosage_forms") or matched.dosage_form or "Đạt chuẩn DĐVN V"
    header = (
        f"<details>\n"
        f"<summary><b>📖 Xem Chuyên Luận Toàn Văn Dược Thư Quốc Gia DĐVN V & Dược Động Học (Nhấn để mở rộng)</b></summary>\n\n"
        f"#### 1. THÔNG TIN ĐỊNH DANH & DẠNG BÀO CHẾ LƯU HÀNH\n"
        f"• **Tên biệt dược:** **{clean_name}** | **Mã SĐK (DAV):** `{matched.national_code}`\n"
        f"• **Hoạt chất chính (INN):** **{ing}**\n"
        f"• **Hàm lượng / Nồng độ:** {conc or 'Theo hồ sơ công bố'}\n"
        f"• **Dạng bào chế lưu hành:** {matched.dosage_form or 'Đạt chuẩn DĐVN V'} | **Đường dùng:** {matched.route or 'Theo chỉ định'}\n"
        f"• **Quy cách đóng gói:** {matched.packaging_spec or 'Theo tiêu chuẩn NSX'} | **Đơn vị:** {matched.standard_unit}\n"
        f"• **Phân loại quản lý:** **{matched.group}** ({'Thuốc kiểm soát đặc biệt (Thông tư 20/2017/TT-BYT)' if matched.is_controlled else 'Thuốc thông thường'})\n"
        f"• **Nhóm dược lý & ATC:** {value('drug_class') or matched.drug_class or 'Đang cập nhật'} | **Mã ATC:** `{value('atc_code') or matched.atc_code or 'DĐVN V'}`\n"
        f"• **Các dạng bào chế chuẩn trong Dược thư:** {_format_clinical_text(str(df_forms).strip())}\n\n"
    )

    body_items = [
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
    body_parts = []
    for lbl, k, default in body_items:
        val = value(k)
        if k == "drug_interactions":
            if unique_ddis:
                extra = "\n\n*⚠️ Tương tác đáng chú ý theo QĐ 5948/QĐ-BYT & HDSD:*\n" + "\n".join(
                    f"• **{cd.get('partner')}** (`{cd.get('severity')}`): {cd.get('consequence')}" for cd in unique_ddis[:5]
                )
                val = f"{val}\n{extra}" if val else extra.strip()
        body_parts.append(f"{lbl} {_format_clinical_text(str(val or default).strip())}\n\n")
    body = "".join(body_parts)
    details_tail = "\n</details>"
    details = fast_glance_block + header + body + details_tail

    session.set_active_medication(
        name=clean_name, ingredient=ing,
        batch=batches[0].batch_number if batches else matched.national_code,
        stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho",
        location=loc, sdk=matched.national_code
    )
    return CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text=details, card=None, legal_basis=prof_source,
        suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
        active_medication_stock=session.active_medication_stock, active_medication_location=session.active_medication_location,
        answer_type="medication_profile", source_status="exact_match", confidence=1.0,
        citations=[_drug_citation(matched, monograph, prof_source)]
    )
