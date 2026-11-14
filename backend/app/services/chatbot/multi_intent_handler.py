"""
Multi-Intent Query Decomposition & Synthesis Engine.
Xử lý các prompt kép/đa ý định của người dùng bằng cách phân rã thành các sub-queries độc lập,
thực thi song song qua asyncio.gather và tổng hợp câu trả lời toàn diện không bỏ sót vế nào.
"""
from __future__ import annotations

import asyncio
from typing import List, Any
from app.schemas.copilot import CopilotQuery, CopilotResponse


async def handle_multi_intent_chat(
    sub_queries: List[str],
    original_payload: CopilotQuery,
    request: Any,
    db: Any,
    session: Any = None,
    history: str = "",
    core_handler_fn: Any = None
) -> CopilotResponse:
    """
    Thực thi song song các câu hỏi con và tổng hợp phản hồi hoàn chỉnh.
    """
    if not core_handler_fn:
        from app.services.chatbot.copilot_orchestrator import _handle_copilot_chat_core
        core_handler_fn = _handle_copilot_chat_core

    tasks = []
    for sub_q in sub_queries:
        sub_payload = CopilotQuery(
            query=sub_q,
            user_role=original_payload.user_role,
            user_name=original_payload.user_name,
            session_id=original_payload.session_id,
        )
        tasks.append(core_handler_fn(sub_payload, request, db, session=session, history=history))

    results: List[CopilotResponse] = await asyncio.gather(*tasks, return_exceptions=False)

    reply_sections = []
    combined_citations = []
    seen_citation_keys = set()
    combined_chips = []
    seen_chips = set()
    last_active_med = ""
    combined_evidence = []
    evidence_keys = set()
    all_grounded = True
    confidences = []

    for idx, (sub_q, res) in enumerate(zip(sub_queries, results), 1):
        if not res:
            all_grounded = False
            continue
        factual_subanswer = res.answer_type not in {"clarification", "safe_abstention", "feedback_acknowledgment", "conversational_feedback", "conversational_guidance"}
        if factual_subanswer and not res.rag_grounded:
            all_grounded = False
        if factual_subanswer:
            confidences.append(res.confidence or 0.0)
            citation_ids = {str(c.get("chunk_id")) for c in (res.citations or []) if isinstance(c, dict) and c.get("chunk_id")}
            evidence_ids = {str(e.get("chunk_id")) for e in (res.evidence or []) if isinstance(e, dict) and e.get("chunk_id")}
            has_graph_evidence = any(isinstance(e, dict) and e.get("evidence_type") == "knowledge_graph" and e.get("content") for e in (res.evidence or []))
            if not citation_ids.intersection(evidence_ids) and not has_graph_evidence:
                all_grounded = False

        clean_reply = res.reply_text.strip()
        # Loại bỏ lời chào lặp lại ở câu trả lời thứ 2 trở đi
        if idx > 1:
            clean_reply = "\n".join(
                line for line in clean_reply.split("\n")
                if not any(line.strip().startswith(prefix) for prefix in ("Kính gửi", "Dạ kính gửi", "Dạ thưa", "Chào"))
            ).strip()

        reply_sections.append(f"### Phần {idx}: {sub_q.capitalize()}\n{clean_reply}")

        if res.active_medication_name:
            last_active_med = res.active_medication_name

        # Thu thập trích dẫn
        for c in (res.citations or []):
            cit_dict = c if isinstance(c, dict) else (c.model_dump() if hasattr(c, "model_dump") else {})
            key = f"{cit_dict.get('document_id')}_{cit_dict.get('page')}_{cit_dict.get('section')}"
            if key not in seen_citation_keys:
                seen_citation_keys.add(key)
                combined_citations.append(cit_dict)
        for evidence in (res.evidence or []):
            evidence_dict = evidence if isinstance(evidence, dict) else evidence.model_dump() if hasattr(evidence, "model_dump") else {}
            key = evidence_dict.get("evidence_id") or evidence_dict.get("chunk_id")
            if key and key not in evidence_keys:
                evidence_keys.add(key)
                combined_evidence.append(evidence_dict)

        # Thu thập gợi ý
        for chip in (res.suggested_chips or []):
            if chip not in seen_chips and len(combined_chips) < 6:
                seen_chips.add(chip)
                combined_chips.append(chip)

    composite_reply = "\n\n---\n\n".join(reply_sections)
    is_doc = any(k in (original_payload.user_role or "").lower() for k in ("doctor", "bac_si", "physician", "bs"))
    role_label = f"Bác sĩ {original_payload.user_name}" if is_doc else f"Nhân viên y tế {original_payload.user_name}"

    final_text = f"Kính gửi {role_label}, dưới đây là phản hồi chi tiết cho từng ý trong câu hỏi của Bác sĩ:\n\n{composite_reply}"

    merged_citations = [c for c in combined_citations if c.get("chunk_id") in evidence_keys]
    has_graph_evidence = any(e.get("evidence_type") == "knowledge_graph" and e.get("content") for e in combined_evidence)
    grounded = all_grounded and bool(merged_citations or has_graph_evidence)
    if not grounded:
        final_text = "Chưa thể xác minh một hoặc nhiều ý trong yêu cầu từ nguồn tài liệu có thể truy xuất. Vui lòng tách câu hỏi hoặc kiểm tra kho nguồn trước khi sử dụng nội dung chuyên môn."
    response = CopilotResponse(
        intent="MULTI_INTENT_COMPOSITE",
        reply_text=final_text,
        card=None,
        legal_basis="Dược thư Quốc gia Việt Nam & Quyết định 5948/QĐ-BYT",
        suggested_chips=combined_chips,
        session_id=original_payload.session_id,
        active_medication_name=last_active_med or session.active_medication_name if session else "",
        answer_type="composite_answer",
        source_status="exact_match",
        confidence=min(confidences, default=0.0) if grounded else 0.0,
        rag_grounded=grounded,
        citations=merged_citations,
        evidence=combined_evidence,
        abstention_reason=None if all_grounded else "Ít nhất một phần câu trả lời chưa được xác minh bằng evidence",
    )
    if grounded:
        from app.services.chatbot.answer_operation import apply_reference_note
        response = apply_reference_note(response, None, route_intent="MULTI_INTENT_COMPOSITE")
    return response
