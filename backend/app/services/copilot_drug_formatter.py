"""Module định dạng hồ sơ Dược thẩm định và thẻ thông tin thuốc (<=185 LOC)."""
import re
import unicodedata
from typing import List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.models.inventory import InventoryBatch
from app.schemas.copilot import (
    CopilotResponse,
    CopilotActionCard,
    ClinicalSummary,
    DrugIdentitySchema,
    DosageDetailSchema,
    DosageMatrixSchema,
    StructuredClinicalPayload,
)
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


def _scope_alcohol_evidence(value: Optional[str]) -> str:
    """Keep only source sentences that address alcohol exposure."""
    text = format_clinical_text(str(value or "").strip())
    if not text:
        return ""
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+|\n+", text) if part.strip()]
    alcohol_terms = ("rượu", "bia", "cồn", "alcohol", "ethanol")
    return " ".join(sentence for sentence in sentences if any(term in sentence.casefold() for term in alcohol_terms))


def _evidence_claim_contract(
    evidence: list[dict],
    reply_text: str | None = None,
    cited_chunk_ids: set[str] | None = None,
) -> dict:
    """Build source claims only from cited evidence actually rendered in the reply."""
    from app.schemas.copilot import AnswerClaim

    def normalize(value: str) -> str:
        return re.sub(r"\s+", " ", value).strip().casefold()

    rendered = normalize(reply_text) if reply_text is not None else None

    claims = []
    evidence_claim_map = {}
    for index, item in enumerate(evidence, start=1):
        evidence_id = item.get("evidence_id")
        content = item.get("content")
        source_id = item.get("source_id")
        source_version = str(item.get("source_version") or "").strip().casefold()
        if not evidence_id or not source_id or not content or not str(content).strip():
            continue
        if not source_version or source_version in {"unknown", "none", "unversioned"}:
            continue
        chunk_id = str(item.get("chunk_id") or "")
        if cited_chunk_ids is not None and chunk_id not in cited_chunk_ids:
            continue
        fragments = [fragment.strip() for fragment in re.split(r"(?<=[.!?])\s+|\n+", str(content)) if fragment.strip()]
        claim_ids = []
        for fragment_index, fragment in enumerate(fragments, start=1):
            if rendered is not None and normalize(fragment) not in rendered:
                continue
            claim = AnswerClaim(
                claim_id=f"database-source-{index}-{fragment_index}",
                text=fragment,
                claim_type="source_fact",
                evidence_ids=[evidence_id],
                support_status="supported",
            )
            claims.append(claim)
            claim_ids.append(claim.claim_id)
        evidence_claim_map[evidence_id] = claim_ids
    return {"claims": claims, "evidence_claim_map": evidence_claim_map}


def _attach_database_claims(response: CopilotResponse) -> CopilotResponse:
    cited_chunk_ids = {str(citation.get("chunk_id")) for citation in response.citations or [] if citation.get("chunk_id")}
    contract = _evidence_claim_contract(response.evidence or [], response.reply_text, cited_chunk_ids)
    response.claims = contract["claims"]
    response.evidence_claim_map = contract["evidence_claim_map"]
    response.rag_grounded = bool(response.rag_grounded and response.claims)
    return response

def _build_drug_evidence(citations: list[dict], default_content: str = "", default_inn: str = "") -> list[dict]:
    evidence = []
    for cit in citations:
        if not isinstance(cit, dict):
            continue
        src_id = cit.get("source_id")
        src_ver = cit.get("source_version")
        content = cit.get("excerpt") or default_content
        if not src_id or not src_ver or not content:
            continue
        cid = cit.get("chunk_id") or f"monograph:{cit.get('section', default_inn or 'unknown').lower()}"
        cit["chunk_id"] = cid
        evidence.append({
            "evidence_id": f"document:{cid}",
            "evidence_type": "document_chunk",
            "chunk_id": cid,
            "source_id": src_id,
            "source_version": src_ver,
            "source_name": cit.get("source"),
            "section": cit.get("section"),
            "content": content,
        })
    return evidence


def _build_formatter_structured_payload(
    clean_name: str,
    clean_inn: str,
    matched: DavNationalDrug,
    headline: str,
    takeaway: str,
    dosage_info: Optional[str] = None,
    indications: Optional[list[str]] = None,
    contraindications: Optional[list[str]] = None,
    urgency: str = "routine"
) -> tuple[ClinicalSummary, StructuredClinicalPayload]:
    """Tạo đối tượng Schema cấu trúc cho đầu ra thuốc."""
    summary = ClinicalSummary(headline=headline, key_takeaway=takeaway, urgency=urgency)
    drug_id = DrugIdentitySchema(
        brand_name=clean_name,
        inn=clean_inn or matched.active_ingredient or None,
        national_code=matched.national_code or None,
        sdk=matched.national_code or None,
        drug_class=matched.group or None,
        dosage_form=matched.dosage_form or None
    )
    dosage_matrix = None
    if dosage_info:
        dosage_matrix = DosageMatrixSchema(
            adult=DosageDetailSchema(standard_dose=dosage_info)
        )
    payload = StructuredClinicalPayload(
        drug_identity=drug_id,
        dosage_matrix=dosage_matrix,
        indications=indications or [],
        contraindications=contraindications or []
    )
    return summary, payload


async def build_drug_profile_response(
    drugs: List[DavNationalDrug],
    db: AsyncSession,
    session: SessionState,
    query: str = "",
    requested_fields: Optional[List[str]] = None,
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
                text_len = sum(len(f or "") for f in fields)
                score = min(text_len, 5000)
                m_title = (m.title or "").strip().lower()
                m_inn = (m.inn or "").strip().lower()
                for t in mono_targets:
                    t_l = t.lower()
                    if m_title == t_l or m_inn == t_l:
                        score += 100000
                    elif m_title.startswith(t_l) or m_inn.startswith(t_l):
                        score += 20000
                    elif t_l in m_title or t_l in m_inn:
                        score += 5000
                if ("," in m_inn or ";" in m_inn or "+" in m_inn) and not any(sep in clean_inn for sep in (",", ";", "+")):
                    score -= 50000
                return score
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
        "monitoring": ("monitoring", "description", "Theo dõi / xét nghiệm"),
        "pharmacokinetics": ("pharmacokinetics", "pharmacokinetics", "Dược động học"),
        "pharmacodynamics": ("pharmacodynamics", "pharmacodynamics", "Dược lực học"),
    }
    explicit_requested_fields = None
    if requested_fields:
        explicit_requested_fields = [
            (intent_to_field[name][0], (), intent_to_field[name][1], intent_to_field[name][2])
            for name in requested_fields if name in intent_to_field
        ]
        if not explicit_requested_fields:
            return CopilotResponse(
                intent="CLINICAL_SAFE_ABSTENTION",
                reply_text="Kho tri thức hiện không có trường dữ liệu phù hợp để trả lời yêu cầu này.",
                answer_type="safe_abstention", source_status="requested_field_unavailable",
                confidence=0.0, rag_grounded=False, citations=[], evidence=[],
                abstention_reason="Không nhận diện được trường dữ liệu được yêu cầu trong kho tri thức",
                session_id=session.session_id,
            )
    is_comprehensive_request = any(w in lower_query for w in (
        "chi tiết", "chi tiet", "toàn văn", "toan van", "đầy đủ", "day du",
        "toàn bộ", "toan bo", "đầy đủ nhất", "chuyên luận"
    ))
    ranked = rank_clinical_intents(query, min_score=1.5)
    lexical_requested_fields = [
        (intent_to_field[k][0], (), intent_to_field[k][1], intent_to_field[k][2])
        for k, _ in ranked if k in intent_to_field
    ]
    if any(term in lower_query for term in ("theo dõi", "xét nghiệm", "giám sát")):
        lexical_requested_fields.append(("monitoring", (), "description", "Theo dõi / xét nghiệm"))
    # Preserve the structured NLU contract. Lexical intent ranking is only a
    # fallback when the caller did not provide requested fields.
    requested_fields = explicit_requested_fields if explicit_requested_fields is not None else lexical_requested_fields

    from app.services.clinical_reasoning.pediatric_dosage_reasoner import extract_demographic_slots
    _pre_demo = extract_demographic_slots(query)
    _is_adult = (_pre_demo.get("age_years") is not None and _pre_demo["age_years"] >= 18)
    if _is_adult:
        requested_fields = [s for s in requested_fields if s[0] != "pediatric_dosage"]
    elif any(s[0] == "pediatric_dosage" for s in requested_fields):
        requested_fields = [s for s in requested_fields if s[0] != "adult_dosage"]

    # A request with more than one independently requested field must use the
    # multi-field formatter so no requested section is silently dropped by the
    # single-facet adaptive shortcut. The field set comes from the configured
    # intent feature matrix; no medical vocabulary is introduced here.
    is_multi_field_request = len({field[0] for field in requested_fields}) > 1

    # ĐIỀU PHỐI THÍCH ỨNG (ADAPTIVE BLUF & DEEP FACET):
    # Áp dụng cho câu hỏi tổng quan (OVERVIEW) hoặc khi không có requested_fields tĩnh
    if (not explicit_requested_fields and not is_comprehensive_request
            and not is_multi_field_request and not is_combination):
        from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic
        from app.services.chatbot.adaptive_drug_slicer import slice_clinical_drug_evidence
        from app.services.chatbot.adaptive_clinical_synthesizer import synthesize_adaptive_clinical_response
        adapt_analysis = extract_clinical_query_schema_deterministic(query, session_context={"active_medication": clean_name})
        if adapt_analysis.query_depth in {"OVERVIEW", "DEEP_FACET"}:
            evidence, _, status = await slice_clinical_drug_evidence(adapt_analysis, db, session)
            if status == "ok" and evidence:
                adaptive_resp = synthesize_adaptive_clinical_response(
                    evidence,
                    user_name=getattr(session, "user_name", "Bác sĩ"),
                    user_role=getattr(session, "user_role", "doctor"),
                    session_id=session.session_id
                )
                adaptive_resp.active_medication_name = session.active_medication_name
                adaptive_resp.active_medication_stock = session.active_medication_stock
                adaptive_resp.active_medication_location = session.active_medication_location
                return _attach_database_claims(adaptive_resp)
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
                answer_type="medication_fields", source_status="exact_match", confidence=1.0, rag_grounded=True,
                citations=unique_citations,
                evidence=_build_drug_evidence(unique_citations, reply, clean_name)
            )

        from app.services.clinical_reasoning.pediatric_dosage_reasoner import (
            extract_demographic_slots,
            reason_pediatric_dosage
        )
        demo_slots = extract_demographic_slots(query)
        is_adult_patient = (demo_slots.get("age_years") is not None and demo_slots["age_years"] >= 18)

        field_data = []
        for field_key, _, req_field, req_label in requested_fields:
            if field_key == "stock":
                stock_batches = await get_batches()
                total_stock = sum(batch.current_stock for batch in stock_batches)
                detail = f"{total_stock} {matched.standard_unit}" + (f"; vị trí: {stock_batches[0].warehouse_location}" if stock_batches else "")
            elif field_key == "timing":
                raw_val = value(req_field)
                detail = format_clinical_text(str(raw_val).strip()) if raw_val else ""
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
            elif req_field == "pediatric_dosage" and not is_adult_patient:
                raw_val = value(req_field) or value("pediatric_dosage")
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
                alcohol_text = _scope_alcohol_evidence(value("drug_interactions"))
                if not alcohol_text:
                    alcohol_text = _scope_alcohol_evidence(value("precautions"))
                detail = alcohol_text or f"Chưa tìm thấy thông tin về rượu, bia hoặc cồn trong chuyên luận của {clean_name}."
            elif field_key == "food" or "Thức ăn" in req_label:
                detail = format_clinical_text(str(value("food_alcohol_interactions") or "").strip())
            elif field_key == "hepatic_adjustment" or "suy gan" in req_label.lower():
                raw_val = value("hepatic_adjustment")
                hep_lines = []
                if raw_val:
                    for l in str(raw_val).splitlines():
                        if any(w in l.lower() for w in ["gan", "hepatic", "xơ gan", "men gan"]):
                            hep_lines.append(l.strip())
                # Keep the complete source field when its text is a single
                # paragraph without an explicit liver keyword on each line.
                # Never render an empty section after a successful lookup.
                if not hep_lines and raw_val:
                    hep_lines = [format_clinical_text(str(raw_val).strip())]
                detail = "\n".join(f"• {hl}" for hl in hep_lines)
                if not detail:
                    detail = f"Kho dữ liệu hiện không có thông tin hiệu chỉnh liều suy gan cho {clean_name}."
            elif field_key == "elderly" or "người cao tuổi" in req_label.lower():
                raw_val = value("precautions")
                detail = format_clinical_text(str(raw_val or "").strip())
            elif field_key in ("adult_dosage", "dosage") or "liều dùng" in req_label.lower():
                from app.services.chatbot.conversational_clinical_engine import format_hierarchical_dosage
                ad_val = value("adult_dosage")
                pd_val = value("pediatric_dosage")
                is_explicit_adult = field_key == "adult_dosage"
                is_explicit_pediatric = field_key == "pediatric_dosage"
                target_aud = "adult" if is_explicit_adult else ("pediatric" if is_explicit_pediatric else None)
                dose_lines = format_hierarchical_dosage(
                    str(ad_val or ""),
                    str(pd_val or ""),
                    is_detailed=True,
                    target_audience=target_aud
                )
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
        field_citations = []
        field_evidence = []
        for field_key, _, req_field, req_label in requested_fields:
            # A requested facet must be backed by that exact structured field.
            # Do not substitute general precautions or another monograph section.
            if field_key == "alcohol":
                alcohol_text = _scope_alcohol_evidence(value("drug_interactions"))
                citation_field = "drug_interactions"
                if not alcohol_text:
                    alcohol_text = _scope_alcohol_evidence(value("precautions"))
                    citation_field = "precautions"
                if not alcohol_text:
                    continue
                citation = build_drug_citation(matched, monograph, source, target_field=citation_field)
                citation.update({
                    "excerpt": alcohol_text,
                    "section": req_label,
                    "source_id": getattr(monograph, "source_id", None) or getattr(matched, "source_id", None),
                    "source_version": getattr(monograph, "source_version", None) or getattr(matched, "source_version", None),
                    "chunk_id": f"monograph:{getattr(monograph, 'id', None) or clean_inn or clean_name}:{citation_field}",
                })
                if citation["source_id"] and citation["source_version"]:
                    field_citations.append(citation)
                    field_evidence.extend(_build_drug_evidence([citation]))
                continue
            if field_key in {"food", "elderly", "timing", "monitoring"}:
                continue
            raw_field_value = value(req_field)
            if not raw_field_value or not str(raw_field_value).strip():
                continue
            citation = build_drug_citation(matched, monograph, source, target_field=field_key)
            # Citation helper may fall back to a different monograph field.
            # Bind the citation excerpt to the exact requested field instead.
            citation["excerpt"] = format_clinical_text(str(raw_field_value).strip())
            citation["section"] = req_label
            citation["source_id"] = (getattr(monograph, "source_id", None) or getattr(matched, "source_id", None))
            citation["source_version"] = (getattr(monograph, "source_version", None) or getattr(matched, "source_version", None))
            citation["chunk_id"] = (
                f"monograph:{getattr(monograph, 'id', None) or clean_inn or clean_name}:{req_field}"
            )
            if citation["source_id"] and citation["source_version"]:
                field_citations.append(citation)
                field_evidence.extend(_build_drug_evidence([citation]))
        # A multi-field answer needs one citation/evidence record per requested
        # field; a single citation cannot substantiate unrelated sections.
        unique_field_citations = []
        seen_field_citations = set()
        for citation in field_citations:
            citation_key = (citation.get("chunk_id"), citation.get("page"), citation.get("excerpt"))
            if citation_key not in seen_field_citations:
                seen_field_citations.add(citation_key)
                unique_field_citations.append(citation)
        field_citations = unique_field_citations
        if not field_citations or len(field_evidence) != len(field_citations):
            return CopilotResponse(
                intent="CLINICAL_SAFE_ABSTENTION",
                reply_text="Chưa có trường dữ liệu được yêu cầu với nguồn kiểm chứng phù hợp trong kho hiện tại.",
                answer_type="safe_abstention", source_status="requested_field_unavailable",
                confidence=0.0, rag_grounded=False, citations=[], evidence=[],
                abstention_reason="Không tìm thấy dữ liệu có provenance cho các trường được yêu cầu",
                session_id=session.session_id,
            )
        first_detail = field_data[0][2] if field_data else ""
        first_label = field_data[0][1] if field_data else "Thông tin chuyên môn"
        summary, payload = _build_formatter_structured_payload(
            clean_name=clean_name,
            clean_inn=clean_inn,
            matched=matched,
            headline=f"{first_label} của {clean_name}",
            takeaway=first_detail.split("\n")[0][:120],
            dosage_info=first_detail if "liều" in first_label.lower() else None,
            indications=[first_detail] if "chỉ định" in first_label.lower() else None,
            contraindications=[first_detail] if "chống chỉ định" in first_label.lower() else None,
        )
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply_text,
            clinical_summary=summary,
            clinical_data=payload,
            card=None, legal_basis=source, suggested_chips=contextual_chips, session_id=session.session_id,
            active_medication_name=session.active_medication_name,
            answer_type="medication_field" if len(requested_fields) == 1 else "medication_fields",
            source_status="exact_match", confidence=1.0, rag_grounded=True,
            citations=field_citations,
            evidence=field_evidence
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
        ind_snippet = f"\n• **Chỉ định chính:** {_format_clinical_text(str(val_ind).strip())}" if val_ind else ""
        val_contra = value("contraindications")
        contra_snippet = f"\n• **Chống chỉ định:** {_format_clinical_text(str(val_contra).strip())}" if val_contra else ""
        stock_snippet = f"\n• **Tồn kho nội viện:** {in_stock} {matched.standard_unit} ({'Có sẵn tại kho' if in_stock > 0 else 'Chưa nhập kho'})" if is_stock_ask else ""
        conc_str = f" ({conc})" if conc and conc != ing else ""
        reply = (
            f"### TÓM TẮT THÔNG TIN THUỐC: {clean_name}\n\n"
            f"• **Hoạt chất:** **{ing}**{conc_str} • Dạng bào chế: {matched.dosage_form or 'Đạt chuẩn DĐVN V'}\n"
            f"• **Phân loại:** {matched.group} ({'Kiểm soát ĐB TT 20' if matched.is_controlled else 'Thuốc thường'})"
            f"{ind_snippet}{contra_snippet}{stock_snippet}"
        )
        session.set_active_medication(name=clean_name, ingredient=ing, batch=matched.national_code, stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho", location=loc, sdk=matched.national_code)
        summary_citations = []
        if monograph and monograph.source_id and monograph.source_version:
            summary_citation = _drug_citation(matched, monograph, prof_source)
            summary_citation["source_id"] = monograph.source_id
            summary_citation["source_version"] = monograph.source_version
            summary_citation["section"] = monograph.title or monograph.inn
            summary_citation["excerpt"] = "\n".join(
                str(getattr(monograph, field, None) or "")
                for field in ("indications", "contraindications")
                if getattr(monograph, field, None)
            )
            summary_citations = [summary_citation] if summary_citation["excerpt"] else []
        summary_evidence = _build_drug_evidence(summary_citations)
        summary_supported = bool(summary_citations and summary_evidence)
        sum_obj, pay_obj = _build_formatter_structured_payload(
            clean_name=clean_name,
            clean_inn=ing,
            matched=matched,
            headline=f"Tóm tắt thông tin thuốc {clean_name}",
            takeaway=f"{clean_name} ({ing}): {_format_clinical_text(str(val_ind).strip())}" if val_ind else clean_name,
            indications=[str(val_ind)] if val_ind else None,
            contraindications=[str(val_contra)] if val_contra else None
        )
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE",
            clinical_summary=sum_obj,
            clinical_data=pay_obj,
            card=None, legal_basis=prof_source,
            suggested_chips=contextual_chips, session_id=session.session_id, active_medication_name=session.active_medication_name,
            answer_type="medication_summary" if summary_supported else "safe_abstention", source_status="exact_match" if summary_supported else "source_unavailable", confidence=1.0 if summary_supported else 0.0, rag_grounded=summary_supported,
            reply_text=reply if summary_supported else "Không có bản ghi nguồn phiên bản hóa phù hợp để xác minh thông tin này.",
            citations=summary_citations if summary_supported else [], evidence=summary_evidence if summary_supported else []
        )

    if is_combination and (primary_mono or len(components) >= 2):
        reply, combo_citations, legal_str = build_combination_drug_profile(matched, primary_mono, components, query=query)
        session.set_active_medication(name=clean_name, ingredient=matched.active_ingredient, batch=matched.national_code, stock=f"{in_stock} {matched.standard_unit}" if in_stock > 0 else "Hết tồn kho", location=loc, sdk=matched.national_code)
        combo_evidence = _build_drug_evidence(combo_citations, reply, clean_name)
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE", reply_text=reply, card=None, legal_basis=legal_str,
            suggested_chips=contextual_chips, session_id=session.session_id,
            active_medication_name=session.active_medication_name,
            answer_type="medication_profile", source_status="exact_match", confidence=1.0, rag_grounded=True,
            citations=combo_citations, evidence=combo_evidence
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
