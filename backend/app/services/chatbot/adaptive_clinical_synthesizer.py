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
    is_doc = any(k in (user_role or "").lower() for k in ("doctor", "bac_si", "physician", "bs")) or any(k in (user_name or "").lower() for k in ("bác", "bac", "bs", "dr", "doctor"))
    role_label = "Bác sĩ" if is_doc else "Nhân viên y tế"
    clean_name = evidence.drug_name
    active_inn = evidence.active_ingredient

    # 1. TẦNG 1: TỔNG QUAN TINH GỌN (OVERVIEW BLUF < 500 chars)
    if evidence.query_depth == "OVERVIEW":
        greeting = f"Kính gửi {role_label}," if is_doc else f"Dạ thưa {role_label},"
        source_name = evidence.source_label.split("(")[0].strip() or "Dược thư Quốc gia Việt Nam"
        ind_snippet = evidence.core_indication.split(".")[0].strip()
        contra_snippet = evidence.core_contraindication.split(".")[0].strip()
        adult_snippet = re.sub(r"^(?:Người lớn|người lớn)[\s:]*", "", evidence.core_adult_dose.split(".")[0].strip()).strip()
        ped_snippet = (
            re.sub(r"^(?:Trẻ em|trẻ em)[\s:]*", "", evidence.core_pediatric_dose.split(".")[0].strip()).strip()
            if evidence.core_pediatric_dose
            else "Tính theo mg/kg theo chuyên khoa nhi"
        )

        dose_lines = [
            f"  - **Người lớn:** {adult_snippet[:45]}.",
            f"  - **Trẻ em:** {ped_snippet[:45]}."
        ]
        lines = [
            f"{greeting} gửi {role_label} tóm tắt về **{clean_name}**:",
            f"• **Hoạt chất:** **{active_inn}** ({evidence.drug_class[:25]}) | SĐK: `{evidence.national_code}`",
            f"• **Chỉ định chính:** {ind_snippet[:60]}.",
            f"• **Liều dùng & Cách dùng:**\n" + "\n".join(dose_lines),
            f"• **Chống chỉ định:** {contra_snippet[:50]}. [{source_name}]"
        ]
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

    reply_text = (
        f"Dạ thưa {role_label}, về **{primary_title.lower()}** của **{clean_name}**:\n\n"
        + "\n\n".join(facet_blocks)
        + f"\n\n📌 **Nguồn tài liệu:** {evidence.source_label}"
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
