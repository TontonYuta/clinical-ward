"""
Adaptive Grounded Clinical Response Synthesizer (Part 3).
Generates concise, tiered responses (Overview BLUF < 350 chars vs. Direct Laser-Focused Facet)
with zero technical jargon and natural clinical persona.
"""
from typing import Optional, List
import re
from app.schemas.copilot import CopilotResponse
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


def _compact_sentence(text: str, max_chars: int = 70) -> str:
    clean = (text or "").strip()
    if not clean:
        return ""
    if len(clean) <= max_chars:
        return clean if clean.endswith((".", ";")) else clean + "."
    first_clause = clean.split(";")[0].strip()
    if 20 <= len(first_clause) <= max_chars:
        return first_clause + "."
    first_comma = clean.split(",")[0].strip()
    if 25 <= len(first_comma) <= max_chars:
        return first_comma + "..."
    truncated = clean[:max_chars - 3].rsplit(" ", 1)[0].strip()
    return truncated + "..."


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

        ind_snippet = (evidence.core_indication or "").split(".")[0].strip()
        contra_snippet = (evidence.core_contraindication or "").split(".")[0].strip()
        adult_snippet = re.sub(r"^(?:Người lớn|người lớn)[\s:]*", "", (evidence.core_adult_dose or "").split(".")[0].strip()).strip()
        ped_snippet = (
            re.sub(r"^(?:Trẻ em|trẻ em)[\s:]*", "", (evidence.core_pediatric_dose or "").split(".")[0].strip()).strip()
            if evidence.core_pediatric_dose
            else ""
        )

        clean_ind = _clean_clinical_lead(ind_snippet) or ind_snippet

        dose_lines = []
        if adult_snippet:
            dose_lines.append(f"  - **Người lớn:** {_compact_sentence(adult_snippet, 62)}")
        if ped_snippet:
            dose_lines.append(f"  - **Trẻ em:** {_compact_sentence(ped_snippet, 62)}")

        lines = [
            f"{greeting} tóm tắt lâm sàng về **{clean_name}**:",
            f"• **Hoạt chất:** **{active_inn}** ({evidence.drug_class[:25]}) | SĐK: `{evidence.national_code}`",
        ]
        if clean_ind:
            lines.append(f"• **Chỉ định chính:** {_compact_sentence(clean_ind, 62)}")
        if dose_lines:
            lines.append(f"• **Liều dùng & Cách dùng:**\n" + "\n".join(dose_lines))
        if contra_snippet:
            lines.append(f"• **Chống chỉ định:** {_compact_sentence(contra_snippet, 60)} [{source_cite}]")

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

        return CopilotResponse(
            intent="MEDICATION_SAFETY_PROFILE",
            reply_text=reply_text,
            card=None,
            legal_basis=evidence.source_label,
            suggested_chips=chips,
            session_id=session_id or "",
            active_medication_name=clean_name,
            answer_type="medication_summary",
            source_status="exact_match",
            confidence=1.0,
            rag_grounded=True,
            citations=citations
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

    return CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text=reply_text,
        card=None,
        legal_basis=evidence.source_label,
        suggested_chips=chips,
        session_id=session_id or "",
        active_medication_name=clean_name,
        answer_type="medication_field",
        source_status="exact_match",
        confidence=1.0,
        rag_grounded=True,
        citations=citations
    )
