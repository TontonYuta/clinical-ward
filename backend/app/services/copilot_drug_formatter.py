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

# This joint source monograph explicitly covers each of these substances.
# Match parsed active identities, never product-name substrings or text length.
JOINT_MONOGRAPH_IDENTITIES = {
    "norethisterone and norethisterone acetate": {
        "norethisterone", "norethisterone acetate", "norethisteron", "norethisteron acetat",
    },
}

_CLINICAL_FIELDS = ("indications", "contraindications", "adult_dosage", "pediatric_dosage",
                    "adverse_effects", "drug_interactions", "precautions", "renal_adjustment")


def _has_clinical_content(monograph) -> bool:
    return any(str(getattr(monograph, field, None) or "").strip() for field in _CLINICAL_FIELDS)


def _compatible_formulation(drug, monograph) -> bool:
    compact = lambda value: re.sub(r"\s+", "", unicodedata.normalize("NFKC", value or "").casefold())
    form, strength = compact(drug.dosage_form), compact(drug.concentration)
    if not form or not strength:
        return False
    # A form and strength must describe the same explicit presentation. A
    # tablet elsewhere in a multi-presentation source cannot validate an IV
    # concentration; release modifiers and denominators must also match.
    for presentation in re.split(r"[;\n]+", monograph.dosage_forms or ""):
        presentation = compact(presentation.strip(" •-\t\r."))
        if presentation in {form + strength, form + ":" + strength}:
            return True
    return False


def _compatible_dose_routes(drug, dose_text: str) -> bool:
    """Reject explicit source routes that the registered product does not name."""
    from app.services.chatbot.clinical_subject import _normalized
    route_patterns = (
        r"\b(?:uong|oral)\b", r"\b(?:truc trang|rectal)\b",
        r"\b(?:tinh mach|intravenous|iv)\b", r"\b(?:tiem bap|intramuscular|im)\b",
        r"\b(?:duoi da|subcutaneous)\b", r"\b(?:hit|khi dung|inhalation)\b",
        r"\b(?:boi|ngoai da|topical)\b", r"\b(?:nho mat|ophthalmic)\b",
        r"\b(?:nho tai|otic)\b", r"\b(?:am dao|vaginal)\b",
    )
    product_route, evidence = _normalized(drug.route or ""), _normalized(dose_text)
    return all(not re.search(pattern, evidence) or re.search(pattern, product_route)
               for pattern in route_patterns)


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
        if primary_mono and not _has_clinical_content(primary_mono):
            primary_mono = None

    first_active = matched.active_ingredient.split(";")[0].split("+")[0].strip().lower()
    clean_active = re.sub(r"[\d.,\s\xa0]+(?:mg|g|mcg|ml|iu|ui|%|đơn vị).*$", "", first_active, flags=re.IGNORECASE).strip().lower()
    clean_inn = re.sub(r"\(.*?\)", "", clean_active).strip()
    clean_inn = re.sub(r"\b(?:dưới dạng|tương đương|as|equivalent)\b.*$", "", clean_inn, flags=re.IGNORECASE).strip()

    monograph = primary_mono
    blank_link = False
    if not monograph:
        candidates = []
        if matched.clinical_monograph_id:
            mono_res = await db.execute(select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.id == matched.clinical_monograph_id))
            m = mono_res.scalar_one_or_none()
            if m and _has_clinical_content(m):
                monograph = m
            elif m:
                blank_link = True

        mono_targets = [t for t in [clean_inn, clean_active, first_active, matched.brand_name.lower()] if t and len(t) >= 3]
        search_targets = mono_targets + [joint for joint, identities in JOINT_MONOGRAPH_IDENTITIES.items() if clean_inn in identities]
        conds = [func.lower(ClinicalDrugMonograph.inn).like(f"%{t}%") for t in search_targets]
        conds.extend([func.lower(ClinicalDrugMonograph.title).like(f"%{t}%") for t in search_targets])
        if conds and not monograph:
            mono_res = await db.execute(select(ClinicalDrugMonograph).where(or_(*conds)))
            candidates.extend(mono_res.scalars().all())

        if candidates and not monograph:
            targets = {target.casefold().strip() for target in mono_targets}
            ingredient_targets = {target.casefold().strip() for target in (clean_inn, clean_active, first_active) if target}
            exact = {candidate.id: candidate for candidate in candidates
                     if _has_clinical_content(candidate)
                     and ((candidate.inn or "").casefold().strip() in targets
                          or (candidate.title or "").casefold().strip() in targets)
                     and (not blank_link or ((candidate.inn or "").casefold().strip() in ingredient_targets
                                             and _compatible_formulation(matched, candidate)))}
            if len(exact) == 1:
                monograph = next(iter(exact.values()))
            elif not exact and not is_combination and not blank_link:
                joint = {candidate.id: candidate for candidate in candidates
                         if clean_inn in JOINT_MONOGRAPH_IDENTITIES.get((candidate.inn or "").casefold().strip(), set())}
                if len(joint) == 1:
                    monograph = next(iter(joint.values()))

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
    asks_clinical = not requested_fields or any(field[0] not in {"stock", "ingredient"} for field in requested_fields)

    def retain_product_identity():
        # Registration identity remains useful even when clinical evidence is
        # insufficient. Clear the previous product and its operational facts.
        session.clear_active_medication()
        if matched.id and matched.national_code:
            session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient,
                                          sdk=matched.national_code)

    if blank_link and monograph is None and asks_clinical:
        retain_product_identity()
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION",
            reply_text=f"### Thông tin chế phẩm: {clean_name}\n\nHoạt chất công bố: {matched.active_ingredient}. SĐK: {matched.national_code}. "
                       "Chuyên luận được liên kết chưa có dữ liệu lâm sàng. Chưa tìm được một nguồn đúng hoạt chất, dạng bào chế và hàm lượng để thay thế duy nhất; chưa xác nhận liều hoặc cách dùng. Vui lòng đối chiếu tờ hướng dẫn của đúng chế phẩm.",
            answer_type="safe_abstention", source_status="missing_clinical_evidence", rag_grounded=False, confidence=0.0,
            session_id=session.session_id, citations=[], active_medication_name=session.active_medication_name,
        )
    if is_combination and primary_mono is None and asks_clinical:
        reply, citations, basis = build_combination_drug_profile(matched, None, components, query=query)
        retain_product_identity()
        return CopilotResponse(
            intent="MEDICATION_LOOKUP_CLARIFICATION", reply_text=reply, legal_basis=basis,
            answer_type="safe_abstention", source_status="missing_product_specific_clinical_evidence",
            rag_grounded=False, confidence=0.0, session_id=session.session_id, citations=citations,
            active_medication_name=session.active_medication_name,
        )
    route_sensitive_fields = {"adult_dosage", "pediatric_dosage", "timing", "renal_adjustment"}
    dose_or_indication = not requested_fields or any(item[0] in route_sensitive_fields | {"indications"}
                                                   for item in requested_fields)
    normalize_name = lambda text: " ".join(unicodedata.normalize("NFKC", text).casefold().split())
    brand_subject = re.sub(r"[\d.,\s\xa0]+(?:mg|g|mcg|ml|iu|ui|%).*$", "", clean_name, flags=re.IGNORECASE).strip()
    query_names = normalize_name(query)
    generic_subject = normalize_name(brand_subject) == normalize_name(clean_inn) or (
        bool(clean_inn) and re.search(r"(?<!\w)" + re.escape(normalize_name(clean_inn)) + r"(?!\w)", query_names)
        and not re.search(r"(?<!\w)" + re.escape(normalize_name(clean_name)) + r"(?!\w)", query_names)
    )
    joint_ingredient_reference = bool(monograph and requested_fields
        and clean_inn in JOINT_MONOGRAPH_IDENTITIES.get((monograph.inn or "").casefold().strip(), set())
        and not any(item[0] in route_sensitive_fields for item in requested_fields))
    if not is_combination and not generic_subject and not joint_ingredient_reference and dose_or_indication:
        dose_text = " ".join(str(value(field) or "") for field in ("adult_dosage", "pediatric_dosage"))
        if not monograph or not _compatible_formulation(matched, monograph) or not _compatible_dose_routes(matched, dose_text):
            retain_product_identity()
            return CopilotResponse(
                intent="MEDICATION_LOOKUP_CLARIFICATION",
                reply_text=f"### Thông tin chế phẩm: {clean_name}\n\nHoạt chất công bố: {matched.active_ingredient}. SĐK: {matched.national_code}. "
                           "Nguồn liên kết chưa xác minh được hướng dẫn đúng dạng bào chế, hàm lượng và đường dùng của chế phẩm này. "
                           "Chưa xác nhận chỉ định, liều hoặc cách dùng cho biệt dược; không áp dụng liều của đường dùng khác. "
                           "Vui lòng đối chiếu tờ hướng dẫn của đúng chế phẩm hoặc tra cứu riêng chuyên luận hoạt chất.",
                answer_type="safe_abstention", source_status="unverified_product_specific_clinical_evidence",
                rag_grounded=False, confidence=0.0, session_id=session.session_id, citations=[],
                active_medication_name=session.active_medication_name,
            )
    from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications
    resolved_keys = resolve_registered_medications(first_active)
    active_drug_key = resolved_keys[0] if resolved_keys else None
    # contextual_chips = generate_suggested_chips(active_drug_key, "monograph_field_lookup", {s[0] for s in requested_fields}, drug_name=clean_name)
    contextual_chips = []

    from app.services.chatbot.product_stock import lookup_product_stock
    stock_result = None
    async def get_stock():
        nonlocal stock_result
        if stock_result is None:
            stock_result = await lookup_product_stock(matched, db)
        return stock_result

    if requested_fields:
        if is_combination and not primary_mono and len(components) >= 2:
            labels, details = [], []
            combo_citations = []
            legal_bases = []
            for field_key, _, req_field, req_label in requested_fields:
                if field_key == "stock":
                    inventory = await get_stock()
                    details.append(f"- **{req_label}:** {inventory.text}")
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
                        evidence_context=f"Thông tin phối hợp hoạt chất CSDL y tế: Thuốc {clean_name}. {', '.join(labels)}:\n" + "\n".join(details),
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

        key, _, field, label = requested_fields[0]
        if len(requested_fields) > 1:
            labels, details = [], []
            for field_key, _, req_field, req_label in requested_fields:
                req_val = value(req_field) if field_key != "stock" else (await get_stock()).text
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
            inventory = await get_stock()
            session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient,
                                          stock=inventory.text, sdk=matched.national_code)
            return CopilotResponse(
                intent="MEDICATION_SAFETY_PROFILE", reply_text=f"### Tồn kho: {clean_name}\n\n{inventory.text}",
                answer_type="medication_field", source_status="verified_product_inventory" if inventory.code else "unverified_product_identity",
                confidence=1.0 if inventory.code else 0.0, citations=[], session_id=session.session_id,
            )
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

        reply_text = f"### {label}: {clean_name}\n\n{detail}"
        is_rag_grounded = False
        res_source_status = "exact_match"
        if detail:
            try:
                from app.services.rag.paperqa_synthesizer import synthesize_grounded_clinical_response
                u_role = getattr(session, "user_role", "doctor") or "doctor"
                u_name = getattr(session, "user_name", "Bác sĩ") or "Bác sĩ"
                evidence_ctx = (
                    f"### {label}: {clean_name} ({clean_inn.title()})\n"
                    f"**Kết luận lâm sàng chính (Core Clinical Guidance):** Hướng dẫn {label.lower()} cho **{clean_name}** ({clean_inn.title()}) đối soát chuẩn Dược thư Quốc gia.\n\n"
                    f"**Chi tiết thực hành & Hướng dẫn sử dụng:**\n{detail}\n\n"
                    f"**Cảnh báo an toàn & Chống chỉ định:** Bắt buộc tuân thủ đúng liều lượng chỉ định theo tuổi/cân nặng và rà soát các yếu tố an toàn của người bệnh trước khi chỉ định."
                )
                synth_res = await synthesize_grounded_clinical_response(
                    query=query,
                    evidence_context=evidence_ctx,
                    source_label=source,
                    user_role=u_role,
                    user_name=u_name
                )
                if synth_res and synth_res.conversational_answer:
                    reply_text = synth_res.conversational_answer
                    is_rag_grounded = True
                    res_source_status = synth_res.source_status
            except Exception:
                pass

        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply_text,
            card=None, legal_basis=source, suggested_chips=contextual_chips, session_id=session.session_id,
            active_medication_name=session.active_medication_name, answer_type="medication_field",
            source_status=res_source_status, confidence=1.0, rag_grounded=is_rag_grounded, citations=[build_drug_citation(matched, monograph, source)]
        )

    is_summary_request = any(p in lower_query for p in (
        "tóm tắt", "tom tat", "ngắn gọn", "ngan gon", "vắn tắt", "van tat",
        "sơ lược", "so luoc", "summary", "brief", "ngắn thôi"
    ))
    inventory = await get_stock()
    batches = inventory.batches
    loc = ", ".join(dict.fromkeys(batch.warehouse_location for batch in batches)) if batches else "Chưa xác nhận vị trí tồn kho khả dụng"
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
        stock_snippet = f"\n• **Tồn kho nội viện:** {inventory.text}" if is_stock_ask else ""
        reply = (
            f"### 📋 TÓM TẮT THÔNG TIN THUỐC: {clean_name}\n\n"
            f"• **Hoạt chất:** **{ing}** | **Hàm lượng:** {conc or 'Theo HS công bố'}\n"
            f"• **Dạng bào chế:** {matched.dosage_form or 'Đạt chuẩn DĐVN V'} | **SĐK:** `{matched.national_code}`\n"
            f"• **Phân loại:** {matched.group} ({'Kiểm soát ĐB TT 20' if matched.is_controlled else 'Thuốc thường'})"
            f"{ind_snippet}{contra_snippet}{stock_snippet}"
        )
        session.set_active_medication(name=clean_name, ingredient=ing, batch=matched.national_code, stock=inventory.text, location=loc, sdk=matched.national_code)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None, legal_basis=prof_source,
            suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
            answer_type="medication_summary", source_status="exact_match", confidence=1.0, citations=[_drug_citation(matched, monograph, prof_source)]
        )

    if is_combination and (primary_mono or len(components) >= 2):
        reply, combo_citations, legal_str = build_combination_drug_profile(matched, primary_mono, components, query=query)
        session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock=inventory.text, location=loc, sdk=matched.national_code)
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
        stock=inventory.text,
        location=loc, sdk=matched.national_code
    )

    from app.services.chatbot.conversational_clinical_engine import build_fluent_drug_profile_response
    resp = await build_fluent_drug_profile_response(
        matched_drug=matched,
        monograph=monograph,
        stock=0,
        location=loc,
        query=query,
        user_name=getattr(session, "user_name", "Bác sĩ"),
        user_role=getattr(session, "user_role", "doctor"),
        session_id=session.session_id,
        stock_summary=inventory.text,
    )
    resp.active_medication_name = session.active_medication_name
    resp.active_medication_stock = session.active_medication_stock
    resp.active_medication_location = session.active_medication_location
    return resp
