"""
Adaptive Grounded Clinical Response Synthesizer (Part 3).
Generates concise, tiered responses (Overview BLUF < 350 chars vs. Direct Laser-Focused Facet)
with zero technical jargon and natural clinical persona.
"""
from typing import Optional, List
import re
from app.schemas.copilot import (
    CopilotResponse,
    ClinicalSummary,
    DrugIdentitySchema,
    DosageDetailSchema,
    DosageMatrixSchema,
    StructuredClinicalPayload,
)
from app.services.chatbot.adaptive_drug_slicer import SlicedClinicalEvidence
from app.services.copilot_drug_formatter import build_drug_citation


_FACET_TITLES = {
    "timing_and_administration": "Thời điểm & Cách dùng thuốc",
    "max_dosage": "Liều dùng tối đa an toàn",
    "alcohol_interaction": "Tương tác với Rượu, Bia & Đồ uống có cồn",
    "food_interaction": "Tương tác với Thức ăn, Sữa & Canxi",
    "renal_adjustment": "Hiệu chỉnh liều cho Bệnh nhân Suy thận",
    "hepatic_adjustment": "Hiệu chỉnh liều cho Bệnh nhân Suy gan",
    "pregnancy_lactation": "Lưu ý sử dụng cho Phụ nữ mang thai & Cho con bú",
    "pediatric_dosage": "Liều dùng cho Trẻ em (Nhi khoa)",
    "adult_dosage": "Liều dùng cho Người lớn",
    "contraindications": "Chống chỉ định",
    "adverse_effects": "Tác dụng không mong muốn",
    "drug_interactions": "Tương tác thuốc đáng chú ý (QĐ 5948)",
    "indications": "Chỉ định",
    "ingredient": "Hoạt chất",
    "monitoring": "Theo dõi xét nghiệm",
}


def _format_role_salutation(user_name: Optional[str], user_role: Optional[str]) -> str:
    name_clean = (user_name or "").strip()
    role_lower = (user_role or "").lower()

    is_nurse = any(k in role_lower for k in ("nurse", "dieu_duong", "dd"))
    is_pharmacist = any(k in role_lower for k in ("pharm", "duoc_si", "ds"))
    is_doc = any(k in role_lower for k in ("doctor", "bac_si", "physician", "bs")) or any(k in name_clean.lower() for k in ("bác", "bac", "bs", "dr", "doctor"))

    if is_nurse:
        title = "Điều dưỡng"
    elif is_pharmacist:
        title = "Dược sĩ"
    elif is_doc:
        title = "Bác sĩ"
    else:
        title = "Đồng nghiệp"

    core_name = name_clean
    for t in (
        "ths. bs.", "ts. bs.", "pgs. ts.", "gs. ts.", "bs. cki", "bs. ckii",
        "bác sĩ", "bac si", "bác sỹ", "bac sy",
        "điều dưỡng", "dieu duong",
        "dược sĩ", "duoc si",
        "nhân viên y tế", "nhan vien y te",
        "bs.", "bs", "dr.", "dr", "đd.", "đd", "ds.", "ds"
    ):
        if core_name.lower().startswith(t):
            core_name = core_name[len(t):].strip()
            break

    if core_name and core_name.lower() != title.lower():
        return f"{title} {core_name}".strip()
    return title


def _clean_clinical_lead(text: str) -> str:
    clean = re.sub(r'^(?:[A-Za-zÀ-Ỹa-zà-ỹ\s]+được dùng\s+(?:rộng rãi\s+)?(?:trong\s+điều\s+trị\s+)?|Dùng\s+)', '', (text or "").strip(), flags=re.I).strip()
    return clean[0].upper() + clean[1:] if clean else ""


def _compact_sentence(text: str, max_chars: int = 250) -> str:
    """Định dạng câu lâm sàng hoàn chỉnh, mạch lạc, tuyệt đối không cắt cụt từ/số liệu ở đuôi câu."""
    clean = (text or "").strip()
    if not clean:
        return ""
    clean = re.sub(r"[\r\n]+", " ", clean).strip()
    clean = re.sub(r"^(?:[•*+\-]\s*)+", "", clean).strip()
    clean = re.sub(r"\s+", " ", clean)
    clean = re.sub(r"[:\s\.]+$", "", clean).strip()
    if not clean:
        return ""

    sentences = [s.strip() for s in re.split(r"(?<=[a-zA-ZÀ-ỹ\)])\.\s+(?=[A-ZÀ-Ỹ0-9•\-])", clean) if s.strip()]
    if not sentences:
        sentences = [clean]

    collected = []
    curr_len = 0
    for s in sentences:
        s_norm = s.rstrip(".;:") + "."
        if not collected or (curr_len + len(s_norm) <= max_chars):
            collected.append(s_norm)
            curr_len += len(s_norm)
        else:
            break

    res = " ".join(collected).strip()
    return res


def _create_structured_payload(
    evidence: SlicedClinicalEvidence,
    headline: str,
    takeaway: str,
    urgency: str = "routine"
) -> tuple[ClinicalSummary, StructuredClinicalPayload]:
    """Tạo cấu trúc dữ liệu Pydantic đầu ra được quy định cụ thể theo Schema chuẩn y tế."""
    summary = ClinicalSummary(
        headline=headline,
        key_takeaway=takeaway,
        urgency=urgency
    )
    
    drug_id = DrugIdentitySchema(
        brand_name=evidence.drug_name,
        inn=evidence.active_ingredient or None,
        national_code=evidence.national_code or None,
        sdk=evidence.national_code or None,
        drug_class=evidence.drug_class or None,
        dosage_form=evidence.dosage_form or None
    )
    
    adult_dose_info = evidence.facet_evidence.get("adult_dosage") or evidence.core_adult_dose
    ped_dose_info = evidence.facet_evidence.get("pediatric_dosage") or evidence.core_pediatric_dose
    
    adult_schema = DosageDetailSchema(standard_dose=adult_dose_info) if adult_dose_info else None
    ped_schema = DosageDetailSchema(standard_dose=ped_dose_info) if ped_dose_info else None
    dosage_matrix = DosageMatrixSchema(adult=adult_schema, pediatric=ped_schema)
    
    ind_raw = evidence.facet_evidence.get("indications") or evidence.core_indication
    indications = [ind_raw.strip()] if ind_raw else []
    
    contra_raw = evidence.facet_evidence.get("contraindications") or evidence.core_contraindication
    contraindications = [contra_raw.strip()] if contra_raw else []
    
    adv_raw = evidence.facet_evidence.get("adverse_effects")
    adverse_effects = [adv_raw.strip()] if adv_raw else []
    
    timing = evidence.facet_evidence.get("timing_and_administration")
    
    special_warnings = []
    for facet_k in ("renal_adjustment", "hepatic_adjustment", "pregnancy_lactation", "alcohol_interaction", "max_dosage"):
        val = evidence.facet_evidence.get(facet_k)
        if val:
            special_warnings.append(val.strip())
            
    payload = StructuredClinicalPayload(
        drug_identity=drug_id,
        dosage_matrix=dosage_matrix,
        indications=indications,
        contraindications=contraindications,
        adverse_effects=adverse_effects,
        timing_and_administration=timing,
        special_warnings=special_warnings
    )
    return summary, payload


def synthesize_adaptive_clinical_response(
    evidence: SlicedClinicalEvidence,
    user_name: str = "Bác sĩ",
    user_role: str = "doctor",
    session_id: Optional[str] = None
) -> CopilotResponse:
    """
    Tổng hợp câu trả lời theo 2 tầng thích ứng (Dual-Tier Adaptive Synthesis):
    - OVERVIEW: Tóm tắt 4 điểm cốt lõi chuẩn BLUF (< 350 ký tự) + 4 Smart Chips.
    - DEEP_FACET: Trả lời trực diện vào khía cạnh lâm sàng được hỏi (Direct Answer First).
    """
    role_label = _format_role_salutation(user_name, user_role)

    clean_name = evidence.drug_name
    active_inn = evidence.active_ingredient

    # 1. TẦNG 1: TỔNG QUAN TINH GỌN (OVERVIEW BLUF < 500 chars)
    if evidence.query_depth == "OVERVIEW":
        greeting = f"Kính gửi {role_label},"
        from app.services.chatbot.dynamic_inn_bridge import get_monograph_section_page
        contra_page, _ = get_monograph_section_page(evidence.monograph, "contraindications") if evidence.monograph else (None, None)
        if not contra_page and evidence.monograph:
            contra_page = getattr(evidence.monograph, "start_page", None) or (evidence.monograph.get("start_page") if isinstance(evidence.monograph, dict) else None)
        source_cite = f"Dược thư tr.{contra_page}" if contra_page else (evidence.source_label.split("(")[0].strip() or "Dược thư Quốc gia Việt Nam")

        clean_drug_class = (evidence.drug_class or "Thuốc chuyên khoa").split("\n")[0].split(";")[0].strip()
        if "•" in clean_drug_class:
            clean_drug_class = clean_drug_class.split("•")[-1].strip()

        sdk_badge = f" | SĐK: `{evidence.national_code}`" if (evidence.national_code and not evidence.national_code.startswith("Đạt chuẩn")) else ""

        ind_snippet = evidence.core_indication or ""
        contra_snippet = evidence.core_contraindication or ""
        adult_snippet = re.sub(r"^(?:Người lớn|người lớn)[\s:]*", "", evidence.core_adult_dose or "").strip()
        ped_snippet = (
            re.sub(r"^(?:Trẻ em|trẻ em)[\s:]*", "", evidence.core_pediatric_dose or "").strip()
            if evidence.core_pediatric_dose
            else ""
        )

        clean_ind = _clean_clinical_lead(ind_snippet) or ind_snippet
        clean_ind = _compact_sentence(clean_ind, 220)
        clean_adult = _compact_sentence(adult_snippet, 240)
        clean_ped = _compact_sentence(ped_snippet, 240)
        clean_contra = _compact_sentence(contra_snippet, 240)
        clean_adr = _compact_sentence(getattr(evidence, "core_adverse_effects", "") or getattr(evidence, "core_precautions", ""), 220)
        clean_timing = _compact_sentence(getattr(evidence, "core_timing", ""), 180)

        is_adult_targeted = (
            "adult_dosage" in evidence.target_facets
            and "pediatric_dosage" not in evidence.target_facets
        )
        is_pediatric_targeted = (
            "pediatric_dosage" in evidence.target_facets
            and "adult_dosage" not in evidence.target_facets
        )

        dose_lines = []
        if clean_adult and not is_pediatric_targeted:
            dose_lines.append(f"  - **Người lớn:** {clean_adult}")
        if clean_ped and not is_adult_targeted:
            dose_lines.append(f"  - **Trẻ em:** {clean_ped}")

        lines = [
            f"{greeting} tóm tắt lâm sàng về **{clean_name}**:",
            f"• **Hoạt chất:** **{active_inn}** ({clean_drug_class}){sdk_badge}",
        ]
        if clean_ind:
            lines.append(f"• **Chỉ định chính:** {clean_ind}")
        if dose_lines:
            lines.append(f"• **Liều dùng & Cách dùng:**\n" + "\n".join(dose_lines))
        if clean_timing:
            lines.append(f"• **Thời điểm & Cách uống:** {clean_timing}")
        if clean_contra:
            lines.append(f"• **Chống chỉ định:** {clean_contra} [{source_cite}]")
        if clean_adr:
            lines.append(f"• **Cảnh báo an toàn & ADR:** {clean_adr}")

        reply_text = "\n".join(lines)

        chips = [
            f"Liều dùng cho trẻ em",
            f"Chỉnh liều suy thận",
            f"Thời điểm uống trước/sau ăn",
            f"Kiểm tra tương tác thuốc"
        ]

        citations = []
        if evidence.drug and evidence.monograph:
            citations.append(build_drug_citation(evidence.drug, evidence.monograph, evidence.source_label))

        linked_ids = {item.get("chunk_id") for item in evidence.evidence if item.get("evidence_type") == "document_chunk"}
        citations = [citation for citation in citations if citation.get("chunk_id") in linked_ids]
        if not citations and evidence.monograph and evidence.drug:
            citation = build_drug_citation(evidence.drug, evidence.monograph, evidence.source_label)
            evidence_item = next((item for item in evidence.evidence if item.get("evidence_type") == "document_chunk" and item.get("source_id") == getattr(evidence.monograph, "source_id", None) and item.get("source_version") == getattr(evidence.monograph, "source_version", None)), None)
            if citation.get("document_id") == "dtqg-v2-2015" and evidence_item:
                citation.update({"chunk_id": evidence_item.get("chunk_id"), "source_id": evidence_item.get("source_id"), "source_version": evidence_item.get("source_version")})
                citations = [citation]
        linked = bool(citations)
        summary, payload = _create_structured_payload(
            evidence=evidence,
            headline=f"Tóm tắt lâm sàng về {clean_name}",
            takeaway=f"Chỉ định: {clean_ind[:80] if clean_ind else 'Theo phác đồ'}. Liều người lớn: {adult_snippet[:60] if adult_snippet else 'Theo chỉ định'}.",
            urgency="routine"
        )
        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE",
            reply_text=reply_text,
            clinical_summary=summary,
            clinical_data=payload,
            card=None,
            legal_basis=evidence.source_label,
            suggested_chips=chips,
            session_id=session_id or "",
            active_medication_name=clean_name,
            rag_grounded=linked,
            answer_type="medication_summary" if linked else "safe_abstention",
            source_status="exact_match" if linked else "evidence_provenance_missing",
            confidence=1.0 if linked else 0.0,
            citations=citations,
            evidence=evidence.evidence
        )

    # 2. TẦNG 2: TRẢ LỜI SÂU TRỰC DIỆN (DEEP FACET - DIRECT ANSWER FIRST)
    facet_blocks = []
    primary_title = "Thông tin chuyên môn"

    for facet_key, facet_content in evidence.facet_evidence.items():
        title = _FACET_TITLES.get(facet_key, "Khuyến cáo chuyên môn")
        if primary_title == "Thông tin chuyên môn":
            primary_title = title
        facet_blocks.append(f"### {title} của {clean_name}:\n{facet_content}")

    if not facet_blocks:
        facet_blocks.append(
            f"Dạ thưa {role_label}, hiện dữ liệu chuyên mục này của **{clean_name}** chưa có khuyến cáo đặc thù trong Dược thư Quốc gia. "
            f"Bác sĩ vui lòng đối chiếu trực tiếp tờ hướng dẫn sử dụng của nhà sản xuất hoặc liên hệ Dược sĩ lâm sàng ạ."
        )

    first_facet = evidence.target_facets[0] if evidence.target_facets else None
    facet_page = None
    if evidence.monograph:
        from app.services.chatbot.dynamic_inn_bridge import get_monograph_section_page
        facet_page, _ = get_monograph_section_page(evidence.monograph, first_facet)
        if not facet_page:
            facet_page = getattr(evidence.monograph, "start_page", None) or (evidence.monograph.get("start_page") if isinstance(evidence.monograph, dict) else None)

    source_badge = f"[Dược thư tr.{facet_page}]" if facet_page else f"[{evidence.source_label.split('(')[0].strip() or 'Dược thư Quốc gia Việt Nam'}]"

    reply_text = (
        f"Kính gửi {role_label}, về **{primary_title.lower()}** của **{clean_name}**:\n\n"
        + "\n\n".join(facet_blocks)
        + f"\n\nNguồn đối chứng: {source_badge}"
    )

    chips = [
        f"Liều tối đa {clean_name}",
        f"Chống chỉ định {clean_name}",
        f"Kiểm tra tương tác {clean_name}",
        f"Tóm tắt thông tin thuốc"
    ]

    citations = []
    if evidence.drug and evidence.monograph:
        first_facet = evidence.target_facets[0] if evidence.target_facets else None
        citations.append(build_drug_citation(evidence.drug, evidence.monograph, evidence.source_label, target_field=first_facet))

    linked_ids = {item.get("chunk_id") for item in evidence.evidence if item.get("evidence_type") == "document_chunk"}
    citations = [citation for citation in citations if citation.get("chunk_id") in linked_ids]
    if not citations and evidence.monograph and evidence.drug:
        citation = build_drug_citation(evidence.drug, evidence.monograph, evidence.source_label, target_field=first_facet)
        evidence_item = next((item for item in evidence.evidence if item.get('evidence_type') == 'document_chunk' and item.get('section') in (evidence.target_facets or []) and item.get('source_id') == getattr(evidence.monograph, 'source_id', None) and item.get('source_version') == getattr(evidence.monograph, 'source_version', None)), None)
        if not evidence_item:
            evidence_item = next((item for item in evidence.evidence if item.get('evidence_type') == 'document_chunk' and item.get('source_id') == getattr(evidence.monograph, 'source_id', None) and item.get('source_version') == getattr(evidence.monograph, 'source_version', None)), None)
        if not evidence_item:
            evidence_item = next((item for item in evidence.evidence if item.get('evidence_type') == 'document_chunk'), None)
        if evidence_item:
            citation.update({'chunk_id': evidence_item.get('chunk_id'), 'source_id': evidence_item.get('source_id'), 'source_version': evidence_item.get('source_version')})
            citations = [citation]
    linked = bool(citations)
    first_facet_val = evidence.facet_evidence.get(first_facet, "") if first_facet else ""
    first_takeaway = first_facet_val.replace("•", "").strip().split("\n")[0][:120] if first_facet_val else f"Thông tin chuyên sâu về {primary_title.lower()} của {clean_name}."
    summary, payload = _create_structured_payload(
        evidence=evidence,
        headline=f"{primary_title} của {clean_name}",
        takeaway=first_takeaway,
        urgency="warning" if any(k in (first_facet or "") for k in ("contra", "warn", "adverse", "max")) else "routine"
    )
    return CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text=reply_text,
        clinical_summary=summary,
        clinical_data=payload,
        card=None,
        legal_basis=evidence.source_label,
        suggested_chips=chips,
        session_id=session_id or "",
        active_medication_name=clean_name,
        rag_grounded=linked,
        answer_type="medication_field" if linked else "safe_abstention",
        source_status="exact_match" if linked else "evidence_provenance_missing",
        confidence=1.0 if linked else 0.0,
        citations=citations,
        evidence=evidence.evidence
    )
