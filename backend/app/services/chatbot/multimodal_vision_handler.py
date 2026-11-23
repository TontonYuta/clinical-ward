"""
Multimodal Vision Handler for Copilot Orchestrator.
Encapsulates Gemini Multimodal Vision API calls, guardrails, and clinical prescription analysis.
"""
from typing import Optional
from app.schemas.copilot import CopilotQuery, CopilotResponse
import app.services.llm_provider as llm_provider
from app.services.chatbot.prescription_vision_analyser import analyse_vision_prescription


async def handle_multimodal_vision_turn(
    payload: CopilotQuery,
    user_role: str,
) -> Optional[CopilotResponse]:
    """
    Handle multimodal vision query when payload contains image_base64.
    Returns CopilotResponse if image processing took place, else None.
    """
    if not payload.image_base64:
        return None

    vision_res = await llm_provider.query_clinical_multimodal_chat(
        image_base64=payload.image_base64,
        mime_type=payload.image_mime_type or "image/jpeg",
        user_query=payload.query,
        user_role=user_role,
    )
    if not vision_res or not isinstance(vision_res, dict):
        return None

    is_non_clinical = vision_res.get("is_clinical") is False or vision_res.get("category") == "NON_CLINICAL"
    if is_non_clinical:
        reply_text = str(vision_res.get("reply_markdown") or "Hệ thống chỉ hỗ trợ phân tích ảnh thuốc, đơn thuốc và tài liệu BHYT.")
        return CopilotResponse(
            intent="MULTIMODAL_CLINICAL_VISION",
            reply_text=reply_text,
            legal_basis=None,
            clinical_summary=None,
            suggested_chips=["Tra cứu Dược Thư", "Quy chế thuốc BHYT", "Hướng dẫn sử dụng"],
            card=None,
            cdss_alert=None,
            rag_grounded=False,
            citations=[],
            evidence=[],
            answer_type="safe_abstention",
            source_status="out_of_scope",
            abstention_reason="Hình ảnh ngoài phạm vi y tế / dược lâm sàng",
            prompt_tokens=vision_res.get("_prompt_tokens", 0),
            completion_tokens=vision_res.get("_completion_tokens", 0),
            total_tokens=vision_res.get("_total_tokens", 0),
            model_name=vision_res.get("_model_used", "gemini-3.5-flash-lite"),
            has_image=True,
            image_tokens=vision_res.get("_image_tokens", 0),
        )

    # Phân tích toàn diện: Bóc tách đơn thuốc + Đối chiếu DDI Dược Thư + Giám định BHYT TT 20
    analysis = analyse_vision_prescription(vision_res, user_role=user_role)

    reply_text = analysis["reply_text"]
    clinical_summary = analysis["clinical_summary"]
    card_obj = analysis["card"]
    cdss_alert = analysis["cdss_alert"]
    evidence = analysis["evidence"]
    citations = analysis["citations"]
    grounded = analysis["rag_grounded"]
    suggested_chips = analysis["suggested_chips"]
    legal_basis = "Thông tư 20/2022/TT-BYT & QĐ 5948/QĐ-BYT Dược Thư Quốc Gia" if grounded else None

    return CopilotResponse(
        intent="MULTIMODAL_CLINICAL_VISION",
        reply_text=reply_text,
        legal_basis=legal_basis,
        clinical_summary=clinical_summary,
        suggested_chips=suggested_chips,
        card=card_obj,
        cdss_alert=cdss_alert,
        rag_grounded=grounded,
        citations=citations,
        evidence=evidence,
        answer_type="grounded_reference" if grounded else "image_extraction",
        source_status="verified_evidence" if grounded else "image_extracted_unverified",
        abstention_reason=None if grounded else "Không có dữ liệu thuốc được kiểm chứng từ ảnh",
        prompt_tokens=vision_res.get("_prompt_tokens", 0),
        completion_tokens=vision_res.get("_completion_tokens", 0),
        total_tokens=vision_res.get("_total_tokens", 0),
        model_name=vision_res.get("_model_used", "gemini-3.5-flash-lite"),
        has_image=True,
        image_tokens=vision_res.get("_image_tokens", 0),
    )
