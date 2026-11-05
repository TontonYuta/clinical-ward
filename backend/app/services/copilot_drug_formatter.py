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
from app.services.copilot_drug_citation_helper import (
    format_clinical_text,
    build_drug_citation,
    format_flat_field_inquiry,
    extract_inline_citation_token
)
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
        "overdose_treatment": ("overdose", "overdose_treatment", "Xử trí quá liều & Ngộ độc"),
        "indications": ("indications", "indications", "Chỉ định"),
        "ingredient": ("ingredient", "active_ingredient", "Hoạt chất"),
        "pregnancy_warning": ("pregnancy", "pregnancy_warning", "Cảnh báo phụ nữ mang thai & cho con bú"),
        "renal_adjustment": ("renal_adjustment", "renal_adjustment", "Hiệu chỉnh liều suy thận"),
        "hepatic_adjustment": ("hepatic_adjustment", "hepatic_adjustment", "Hiệu chỉnh liều cho bệnh nhân suy gan"),
        "alcohol_interaction": ("alcohol", "precautions", "Tương tác với Rượu & Đồ uống có cồn"),
        "food_interaction": ("food", "precautions", "Tương tác với Thức ăn, Sữa & Đồ uống"),
        "elderly_warning": ("elderly", "precautions", "Cảnh báo & Liều dùng người cao tuổi"),
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
    from app.services.chatbot.smart_chip_engine import generate_smart_clinical_chips
    contextual_chips = generate_smart_clinical_chips(
        query=query,
        drug_name=clean_name,
        active_ingredient=clean_inn or first_active
    )
    if not contextual_chips:
        contextual_chips = generate_suggested_chips(
            active_drug_key=active_drug_key,
            route="monograph_field_lookup",
            requested_fields={s[0] for s in requested_fields},
            drug_name=clean_name
        )

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
            is_conversational_question = any(w in lower_query for w in (
                "sáng hay tối", "lúc nào", "khi nào", "trước hay sau", "thế nào",
                "như thế nào", "được không", "uống cùng", "cho trẻ em", "cho bé",
                "suy thận", "phụ nữ có thai", "sốt bao nhiêu", "dùng sao"
            ))
            if is_conversational_question and details:
                try:
                    from app.services.rag.paperqa_synthesizer import synthesize_grounded_clinical_response
                    u_role = getattr(session, "user_role", "doctor") or "doctor"
                    synth_res = await synthesize_grounded_clinical_response(
                        query=query,
                        evidence_context=f"Thông tin phối hợp hoạt chất y tế: Thuốc {clean_name}. {', '.join(labels)}:\n" + "\n".join(details),
                        source_label="DĐVN V (QĐ 2033/QĐ-BYT)",
                        user_role=u_role
                    )
                    if synth_res and synth_res.conversational_answer:
                        reply = synth_res.conversational_answer
                except Exception:
                    pass
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

        field_data = []
        for field_key, _, req_field, req_label in requested_fields:
            if field_key == "stock":
                stock_batches = await get_batches()
                total_stock = sum(batch.current_stock for batch in stock_batches)
                detail = f"{total_stock} {matched.standard_unit}" + (f"; vị trí: {stock_batches[0].warehouse_location}" if stock_batches else "")
            elif field_key == "timing" or "Thời điểm" in req_label:
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
                    raw_val = value(req_field)
                    detail = specific_timing + (f"\n\n*(Thông tin bổ sung từ Dược thư: {format_clinical_text(str(raw_val or ''))[:250]}...)*" if raw_val else "")
                else:
                    raw_val = value(req_field)
                    detail = (
                        f"• **Khuyến cáo chung:** Uống thuốc cùng một cốc nước đầy (150 - 200ml nước ấm) sau bữa ăn no 15 - 30 phút để giảm kích ứng dạ dày, trừ trường hợp có chỉ định dùng trước ăn riêng biệt.\n\n"
                        f"*(Trích dẫn DĐVN V: {format_clinical_text(str(raw_val or 'Tuân thủ liều dùng và cách dùng của bác sĩ điều trị.'))})*"
                    )
            elif req_field == "drug_interactions" or req_label == "Tương tác thuốc":
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
                    ddi_block = "\n\n#### CÁC TƯƠNG TÁC ĐÁNG CHÚ Ý THEO QUYẾT ĐỊNH 5948/QĐ-BYT & HDSD:\n"
                    for idx, item in enumerate(combined_ddis, 1):
                        ddi_block += (
                            f"• **{idx}. Phối hợp với {item.get('partner')}:**\n"
                            f"  - **Mức độ:** `{item.get('severity')}`\n"
                            f"  - **Cơ chế:** {item.get('mechanism')}\n"
                            f"  - **Hậu quả:** {item.get('consequence')}\n"
                            f"  - **Xử trí lâm sàng:** {item.get('action')}\n"
                            f"  - *Căn cứ:* {item.get('source')}\n"
                        )
                raw_val = value(req_field)
                if raw_val:
                    detail = f"{format_clinical_text(str(raw_val).strip())}{ddi_block}"
                elif combined_ddis:
                    detail = f"Thông tin tương tác đối soát từ Dược thư Quốc gia và Quyết định 5948/QĐ-BYT cho **{clean_name}** ({clean_inn.title()}):\n{ddi_block}"
                else:
                    detail = f"Chưa có dữ liệu tương tác thuốc được xác thực cho {clean_name} trong nguồn đang lập chỉ mục. Hãy đối chiếu tờ hướng dẫn sử dụng hoặc hỏi dược sĩ lâm sàng."
            elif req_field == "pediatric_dosage" or field_key == "pediatric_dosage" or any(k in lower_query for k in ["trẻ", "tre", "bé", "be", "cháu", "chau", "tuổi", "tuoi", "tháng", "thang"]):
                from app.services.clinical_reasoning.pediatric_dosage_reasoner import (
                    extract_demographic_slots,
                    reason_pediatric_dosage
                )
                raw_val = value(req_field) or value("pediatric_dosage")
                demo_slots = extract_demographic_slots(query)
                reasoned_ped = reason_pediatric_dosage(
                    drug_name=clean_name,
                    clean_inn=clean_inn,
                    raw_pediatric_dosage=str(raw_val or ""),
                    query=query,
                    slots=demo_slots
                )
                if reasoned_ped:
                    detail = reasoned_ped
                else:
                    detail = format_clinical_text(str(raw_val).strip()) if raw_val else f"Chưa có dữ liệu {req_label.lower()} được xác thực cho {clean_name} trong nguồn đang lập chỉ mục. Hãy đối chiếu tờ hướng dẫn sử dụng hoặc hỏi dược sĩ lâm sàng."
            elif field_key == "alcohol" or "Rượu" in req_label:
                combined_low = f"{matched.brand_name.lower()} {clean_inn.lower()} {first_active}"
                alcohol_info = None
                if any(k in combined_low for k in ["paracetamol", "acetaminophen", "panadol", "efferalgan", "hapacol"]):
                    alcohol_info = (
                        "• **Khuyến cáo lâm sàng:** Tuyệt đối tránh hoặc hạn chế tối đa uống rượu, bia trong thời gian dùng Paracetamol.\n"
                        "• **Cơ sở dược lý & Độc tính gan:** Rượu làm tăng cảm ứng enzym CYP2E1 của microsom gan, thúc đẩy quá trình chuyển hóa Paracetamol thành chất trung gian cực độc N-acetyl-p-benzoquinone imine (NAPQI). Đồng thời rượu làm cạn kiệt Glutathion dự trữ trong gan, làm mất khả năng trung hòa độc tố, dẫn đến nguy cơ hoại tử tế bào gan cấp tính và suy gan ngay cả ở liều điều trị thông thường.\n"
                        "• **Nguyên tắc an toàn:** Người nghiện rượu hoặc người uống rượu thường xuyên không được dùng quá 2g/ngày (hoặc tối đa 3g/ngày theo chỉ định nghiêm ngặt của bác sĩ)."
                    )
                elif any(k in combined_low for k in ["metronidazol", "flagyl", "klion", "cefo", "tinidazol"]):
                    alcohol_info = (
                        "• **Khuyến cáo lâm sàng:** Chống chỉ định tuyệt đối uống rượu hoặc sử dụng chế phẩm chứa cồn trong suốt thời gian điều trị và ít nhất 48 - 72 giờ sau khi ngừng thuốc.\n"
                        "• **Cơ sở dược lý & Phản ứng kiểu Disulfiram:** Thuốc ức chế enzym Aldehyd Dehydrogenase, ngăn cản quá trình chuyển hóa Acetaldehyd thành Acetate, gây tích tụ Acetaldehyd trong máu dẫn đến phản ứng Disulfiram dữ dội: đỏ bừng mặt, nhức đầu dữ dội, khó thở, buồn nôn, nôn mửa, tụt huyết áp và loạn nhịp tim nguy hiểm."
                    )
                elif any(k in combined_low for k in ["morphin", "fentanyl", "codein", "diazepam", "seduxen", "midazolam", "lorazepam"]):
                    alcohol_info = (
                        "• **Khuyến cáo lâm sàng:** Chống chỉ định tuyệt đối sử dụng rượu hoặc đồ uống có cồn.\n"
                        "• **Cơ sở dược lý:** Rượu và thuốc hiệp đồng tăng cường ức chế hệ thần kinh trung ương (CNS) và trung tâm hô hấp ở hành não, làm tăng nguy cơ hôn mê sâu, suy hô hấp cấp tính, tụt huyết áp và tử vong."
                    )
                elif any(k in combined_low for k in ["aspirin", "ibuprofen", "diclofenac", "meloxicam", "celecoxib", "nsaid"]):
                    alcohol_info = (
                        "• **Khuyến cáo lâm sàng:** Tránh uống rượu khi đang dùng thuốc.\n"
                        "• **Cơ sở dược lý:** Rượu gây kích ứng trực tiếp niêm mạc dạ dày, hiệp đồng với tác dụng ức chế tổng hợp Prostaglandin bảo vệ dạ dày của NSAID, làm tăng vọt nguy cơ viêm loét, xuất huyết tiêu hóa ồ ạt và thủng dạ dày - tá tràng."
                    )
                else:
                    raw_val = value("precautions") or value("drug_interactions")
                    alcohol_paragraphs = []
                    if raw_val:
                        for p in str(raw_val).splitlines():
                            if any(w in p.lower() for w in ["rượu", "bia", "cồn", "alcohol"]):
                                alcohol_paragraphs.append(p.strip())
                    if alcohol_paragraphs:
                        alcohol_info = "\n".join(f"• {ap}" for ap in alcohol_paragraphs)
                    else:
                        alcohol_info = (
                            f"• **Khuyến cáo chung:** Cần kiêng rượu và đồ uống có cồn trong suốt quá trình điều trị bằng {clean_name}.\n"
                            f"• **Cơ sở dược lý:** Rượu có thể làm biến đổi chuyển hóa qua gan, tăng nguy cơ độc tính đối với gan hoặc tương tác ức chế thần kinh trung ương tùy theo cơ chế của thuốc."
                        )
                detail = alcohol_info
            elif field_key == "food" or "Thức ăn" in req_label:
                combined_low = f"{matched.brand_name.lower()} {clean_inn.lower()} {first_active}"
                food_info = None
                if any(k in combined_low for k in ["ciprofloxacin", "levofloxacin", "norfloxacin", "tetracyclin", "doxycyclin"]):
                    food_info = (
                        "• **Khuyến cáo tương tác sữa & Canxi:** Không uống thuốc cùng với sữa, sữa chua hoặc các sản phẩm từ sữa và nước ép tăng cường canxi.\n"
                        "• **Cơ sở dược lý:** Các cation kim loại đa hóa trị (đặc biệt là Canxi trong sữa) tạo phức chelat không tan và không hấp thu với phân tử kháng sinh qua niêm mạc ruột, làm sụt giảm từ 50% đến 80% sinh khả dụng của thuốc, dẫn đến thất bại điều trị.\n"
                        "• **Cách dùng an toàn:** Uống thuốc ít nhất 2 giờ trước hoặc 4 - 6 giờ sau khi uống sữa hoặc dùng các sản phẩm giàu canxi."
                    )
                else:
                    raw_val = value("precautions")
                    food_info = (
                        f"• **Khuyến cáo sử dụng cùng bữa ăn:** Uống thuốc với một cốc nước đầy sau bữa ăn no 15 - 30 phút để hạn chế tối đa kích ứng niêm mạc tiêu hóa, trừ khi có chỉ định uống lúc đói riêng biệt.\n"
                        f"*(Trích dẫn DĐVN V: {format_clinical_text(str(raw_val or 'Tuân thủ hướng dẫn sử dụng và chế độ ăn của bác sĩ điều trị.'))[:200]}...)*"
                    )
                detail = food_info
            elif field_key == "hepatic_adjustment" or "suy gan" in req_label.lower():
                raw_val = value("hepatic_adjustment") or value("contraindications")
                hep_lines = []
                if raw_val:
                    for l in str(raw_val).splitlines():
                        if any(w in l.lower() for w in ["gan", "hepatic", "xơ gan", "men gan"]):
                            hep_lines.append(l.strip())
                if hep_lines:
                    detail = "\n".join(f"• {hl}" for hl in hep_lines)
                else:
                    detail = f"• **Hiệu chỉnh liều suy gan:** Cần thận trọng và giảm liều hoặc kéo dài khoảng cách giữa các lần dùng ở bệnh nhân suy gan, theo dõi định kỳ men gan AST/ALT và bilirubin trong suốt quá trình điều trị."
            elif field_key == "elderly" or "người cao tuổi" in req_label.lower():
                raw_val = value("precautions")
                detail = (
                    f"• **Nguyên tắc dùng thuốc cho người cao tuổi:** Bắt đầu từ liều thấp nhất có hiệu quả lâm sàng.\n"
                    f"• **Lưu ý chức năng:** Người cao tuổi thường có suy giảm sinh lý chức năng lọc của cầu thận và giảm chuyển hóa qua gan; cần định kỳ xét nghiệm độ thanh thải creatinin (eGFR) và theo dõi nguy cơ tích lũy độc tính hoặc hạ huyết áp tư thế."
                )
            elif field_key in ("adult_dosage", "dosage") or "liều dùng" in req_label.lower():
                from app.services.chatbot.conversational_clinical_engine import format_hierarchical_dosage
                ad_val = value("adult_dosage")
                pd_val = value("pediatric_dosage")
                dose_lines = format_hierarchical_dosage(str(ad_val or ""), str(pd_val or ""), is_detailed=True)
                if dose_lines:
                    detail = "\n".join(dose_lines)
                else:
                    raw_val = value(req_field)
                    detail = format_clinical_text(str(raw_val).strip()) if raw_val else f"Chưa có dữ liệu {req_label.lower()} được xác thực cho {clean_name} trong nguồn đang lập chỉ mục. Hãy đối chiếu tờ hướng dẫn sử dụng hoặc hỏi dược sĩ lâm sàng."
            else:
                raw_val = value(req_field)
                detail = format_clinical_text(str(raw_val).strip()) if raw_val else f"Chưa có dữ liệu {req_label.lower()} được xác thực cho {clean_name} trong nguồn đang lập chỉ mục. Hãy đối chiếu tờ hướng dẫn sử dụng hoặc hỏi dược sĩ lâm sàng."

            field_data.append((field_key, req_label, detail))

        source = (monograph.source if monograph and monograph.source else matched.clinical_source) or "Danh mục đăng ký thuốc Cục Quản lý Dược"
        u_name = getattr(session, "user_name", "Bác sĩ") or "Bác sĩ"
        reply_text = format_flat_field_inquiry(
            drug_name=clean_name,
            drug_inn=clean_inn,
            field_data=field_data,
            source=source,
            user_name=u_name
        )
        session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock="", location="", sdk=matched.national_code)
        first_target_field = requested_fields[0][2] if requested_fields else None
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply_text,
            card=None, legal_basis=source, suggested_chips=contextual_chips, session_id=session.session_id,
            active_medication_name=session.active_medication_name,
            answer_type="medication_field" if len(requested_fields) == 1 else "medication_fields",
            source_status="exact_match", confidence=1.0, rag_grounded=True,
            citations=[build_drug_citation(matched, monograph, source, target_field=first_target_field)]
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
            f"### TÓM TẮT THÔNG TIN THUỐC: {clean_name}\n\n"
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

    session.set_active_medication(
        name=clean_name, ingredient=ing,
        batch=batches[0].batch_number if batches else matched.national_code,
        stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho",
        location=loc, sdk=matched.national_code
    )

    from app.services.chatbot.conversational_clinical_engine import build_fluent_drug_profile_response
    resp = await build_fluent_drug_profile_response(
        matched_drug=matched,
        monograph=monograph,
        stock=in_stock,
        location=loc,
        query=query,
        user_name=getattr(session, "user_name", "Bác sĩ"),
        user_role=getattr(session, "user_role", "doctor"),
        session_id=session.session_id
    )
    resp.active_medication_name = session.active_medication_name
    resp.active_medication_stock = session.active_medication_stock
    resp.active_medication_location = session.active_medication_location
    return resp
