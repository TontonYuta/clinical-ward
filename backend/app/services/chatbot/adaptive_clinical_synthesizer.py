"""
Adaptive Grounded Clinical Response Synthesizer (Part 3).
Generates concise, tiered responses (Overview BLUF < 350 chars vs. Direct Laser-Focused Facet)
with zero technical jargon and natural clinical persona.
"""
from typing import Optional, List
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

    # 1. TẦNG 1: TỔNG QUAN TINH GỌN (OVERVIEW BLUF)
    if evidence.query_depth == "OVERVIEW":
        greeting = f"Kính gửi {role_label}," if is_doc else f"Dạ thưa {role_label},"
        from app.services.copilot_drug_citation_helper import extract_inline_citation_token
        citation_token = extract_inline_citation_token(evidence.source_label)
        lines = [
            f"{greeting} gửi {role_label} tóm tắt thông tin chuyên môn về **{clean_name}**:",
            "",
            f"• **Hoạt chất & Phân nhóm:** **{active_inn}** ({evidence.drug_class}) | SĐK: `{evidence.national_code}`",
            f"• **Chỉ định chính:** {evidence.core_indication}",
            f"• **Liều dùng & Cách dùng:**\n  - **Người lớn:** {evidence.core_adult_dose}",
            f"• **Cảnh báo đỏ / Chống chỉ định:** {evidence.core_contraindication} {citation_token}",
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
