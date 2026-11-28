"""LLM synthesis, claim parsing, and Self-RAG verification for Clinical RAG."""
import json
import logging
import re
from typing import Optional

from app.schemas.copilot import AnswerClaim
from app.services.rag.citation_grounder import render_validated_claims
from app.services.rag.types import EvidenceRecord, RagResult

logger = logging.getLogger(__name__)


def build_clinical_rag_messages(
    *,
    query: str,
    user_role: str,
    conversation_context: str,
    evidence_context: str,
    ddi_alert_context: str,
) -> tuple[str, str]:
    """
    Build strictly separated `(system_instruction, user_prompt)` for grounded Clinical RAG
    following Instruction Hierarchy (Wallace et al., 2024) + Spotlighting (Hines et al., 2024).
    """
    from app.security.prompt_isolator import (
        build_hierarchy_preamble,
        generate_boundary_nonce,
        sanitize_history_for_prompt,
        wrap_untrusted_block,
    )

    nonce = generate_boundary_nonce()
    clean_hist = sanitize_history_for_prompt(conversation_context or "", max_chars=800)
    hist_block, hist_tag = wrap_untrusted_block("chat_history", clean_hist or "(không có)", nonce=nonce)
    ev_block, ev_tag = wrap_untrusted_block(
        "rag_evidence",
        f"{evidence_context}{ddi_alert_context}",
        nonce=nonce,
        datamark=True,
    )
    query_block, query_tag = wrap_untrusted_block("user_query", query, nonce=nonce)
    hierarchy = build_hierarchy_preamble([hist_tag, ev_tag, query_tag])

    system_instruction = (
        "Bạn là Chuyên gia Dược lâm sàng & Pháp lý Bệnh viện (Clinical AI Copilot).\n"
        f"{hierarchy}\n\n"
        "HỢP ĐỒNG TRẢ LỜI BẮT BUỘC (Zero Free Claims Policy):\n"
        "1. BỐ CỤC PHÂN TẦNG DỄ QUÉT MẮT (Phong cách Y khoa Thụy Sĩ — bác sĩ nói với bác sĩ):\n"
        "   - Mở đầu bằng khung tóm tắt trực diện 1–2 câu đi thẳng vào câu hỏi kèm con số/ngưỡng/quy định chốt:\n"
        "     > **Tóm tắt nhanh:** <1–2 câu kết luận trực diện kèm thông số trọng tâm nhất>\n"
        "   - Tiếp theo chia các mục `###` rõ nghĩa theo nội dung câu hỏi (dùng gạch đầu dòng ngắn gọn hoặc bảng Markdown gọn mỗi ô 1 dòng, không nhắc mã chunk nội bộ như `qd708_...` trong câu trả lời).\n"
        "   - Nếu có chống chỉ định, cảnh báo an toàn, ngoại lệ hoặc điều kiện áp dụng trong chứng cứ, đóng khung nổi bật ở cuối bằng `> **Cảnh báo an toàn & Lưu ý:**`.\n"
        "2. CHỐNG ẢO GIÁC & NGHIÊM TÚC LÂM SÀNG:\n"
        "   - CHỈ dùng dữ kiện ghi trong chứng cứ đã truy xuất; bỏ qua các điều khoản/mục phụ không liên quan; phân biệt dữ kiện nguồn với phép tổng hợp; không biến tương quan thành nhân quả; tuyệt đối không tự bịa số liệu/liều dùng/tác dụng/chống chỉ định mới. Nếu thiếu căn cứ, nói rõ phần chưa đủ dữ liệu và từ chối an toàn (abstain).\n"
        "   - TUYỆT ĐỐI KHÔNG dùng emoji/icon, KHÔNG chào hỏi dài dòng, KHÔNG viết câu sáo rỗng kiểu 'Hãy tham khảo ý kiến bác sĩ chuyên khoa', KHÔNG sinh mã HTML hay mã lập trình.\n"
        "   - Dùng ký tự Unicode chuẩn (≥, ≤, °C, µg, β-lactam, ±, ×) — TUYỆT ĐỐI KHÔNG xuất mã LaTeX (`\\ge`, `\\le`, `$...$`, `^\\circ\\text{C}`).\n"
        "3. ĐỐI CHỨNG CLAIM (<ANSWER_CLAIMS>):\n"
        "   - Sau câu trả lời, xuất đúng một thẻ <ANSWER_CLAIMS> chứa JSON array các claim gồm `claim_id`, `text`, `claim_type` (`source_fact`/`evidence_inference`), `evidence_ids`.\n"
        "   - Với mỗi mục `claim_type: \"source_fact\"`, trường `text` BẮT BUỘC trích NGUYÊN VĂN một câu hoặc vế câu có mặt đúng chữ trong đoạn chứng cứ mang `evidence_id` đó (không diễn giải lại trong trường `text`; phần tổng hợp diễn đạt mượt viết ở nội dung trả lời phía trên).\n"
        "   - Mỗi `evidence_id` chỉ được chọn từ các mã chứng cứ backend có sẵn trong ngữ cảnh; không tự tạo source ID, citation hay mã evidence mới."
    )

    user_prompt = (
        f"=== NGỮ CẢNH HỘI THOẠI (chỉ giúp hiểu câu hỏi tiếp nối, không phải chứng cứ y khoa) ===\n"
        f"{hist_block}\n\n"
        f"=== CHỨNG CỨ ĐÃ TRUY XUẤT (nguồn duy nhất để đưa ra thông tin chuyên môn) ===\n"
        f"{ev_block}\n\n"
        f"Câu hỏi của nhân viên y tế ({user_role}):\n"
        f"{query_block}\n\n"
        f"Phản hồi lâm sàng có bảo chứng:"
    )
    return system_instruction, user_prompt


def build_clinical_rag_prompt(
    *,
    query: str,
    user_role: str,
    conversation_context: str,
    evidence_context: str,
    ddi_alert_context: str,
) -> str:
    """Backwards-compatible single-string wrapper combining `(system_instruction, user_prompt)`."""
    sys_instr, user_prompt = build_clinical_rag_messages(
        query=query,
        user_role=user_role,
        conversation_context=conversation_context,
        evidence_context=evidence_context,
        ddi_alert_context=ddi_alert_context,
    )
    return f"{sys_instr}\n\n{user_prompt}"


async def synthesize_grounded_response(
    *,
    query: str,
    user_role: str,
    conversation_context: str,
    evidence_context: str,
    ddi_alert_context: str,
    api_key: Optional[str] = None,
    default_api_key: str = "",
) -> Optional[str]:
    """Resolve an active Gemini key and synthesize a grounded response with separated Instruction Hierarchy."""
    from app.services.admin_key_vault import get_active_api_key_async

    gemini_key = api_key or await get_active_api_key_async(provider="gemini") or default_api_key
    if not gemini_key or gemini_key == "MY_GEMINI_API_KEY" or len(gemini_key.strip()) < 10:
        return None

    try:
        from app.services.copilot_gemini import query_gemini_models

        sys_instr, user_prompt = build_clinical_rag_messages(
            query=query,
            user_role=user_role,
            conversation_context=conversation_context,
            evidence_context=evidence_context,
            ddi_alert_context=ddi_alert_context,
        )
        try:
            return await query_gemini_models(user_prompt, gemini_key, system_instruction=sys_instr)
        except TypeError:
            return await query_gemini_models(f"{sys_instr}\n\n{user_prompt}", gemini_key)
    except Exception as exc:
        logger.warning("Gemini synthesis failed in RAG pipeline: %s", exc)
        return None


async def stream_grounded_response(
    *,
    query: str,
    user_role: str,
    conversation_context: str,
    evidence_context: str,
    ddi_alert_context: str,
    api_key: Optional[str] = None,
    default_api_key: str = "",
):
    """Async generator yielding live LLM token deltas with full Instruction Hierarchy system_instruction."""
    from app.services.admin_key_vault import get_active_api_key_async
    from app.services.llm_provider import stream_clinical_llm

    gemini_key = api_key or await get_active_api_key_async(provider="gemini") or default_api_key
    if not gemini_key or gemini_key == "MY_GEMINI_API_KEY" or len(gemini_key.strip()) < 10:
        return

    sys_instr, user_prompt = build_clinical_rag_messages(
        query=query,
        user_role=user_role,
        conversation_context=conversation_context,
        evidence_context=evidence_context,
        ddi_alert_context=ddi_alert_context,
    )
    async for delta in stream_clinical_llm(
        prompt=user_prompt,
        system_instruction=sys_instr,
        api_key=gemini_key,
        temperature=0.15,
        max_output_tokens=2048,
        timeout_sec=30.0,
    ):
        if delta:
            yield delta


def parse_answer_claims(
    response: str | None,
    allowed_evidence_ids: set[str],
) -> tuple[str | None, list[AnswerClaim]]:
    """Extract `<ANSWER_CLAIMS>` or trailing JSON array from an LLM response."""
    if not response:
        return response, []

    match = re.search(r"<ANSWER_CLAIMS>(.*?)</ANSWER_CLAIMS>", response, flags=re.DOTALL)
    if not match:
        match = re.search(r"```json\s*(\[[\s\S]*?\])\s*```\s*$", response.strip(), flags=re.DOTALL)
    if not match:
        return response, []

    answer_text = (response[:match.start()] + response[match.end():]).strip()
    answer_text = re.sub(r"\n?---\s*$", "", answer_text).strip()
    try:
        payload = json.loads(match.group(1))
        if not isinstance(payload, list):
            return answer_text or None, []
        claims: list[AnswerClaim] = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            raw_eids = item.get("evidence_ids")
            if not isinstance(raw_eids, list) or not raw_eids:
                continue
            evidence_ids = []
            for eid in raw_eids:
                if eid in allowed_evidence_ids:
                    evidence_ids.append(eid)
                elif f"document:{eid}" in allowed_evidence_ids:
                    evidence_ids.append(f"document:{eid}")
            if not evidence_ids:
                continue
            claims.append(AnswerClaim(
                claim_id=str(item.get("claim_id") or ""),
                text=str(item.get("text") or ""),
                claim_type=item.get("claim_type"),
                evidence_ids=evidence_ids,
                support_status="insufficient_evidence",
            ))
        return answer_text or None, claims
    except (ValueError, TypeError, KeyError):
        return answer_text or None, []


def build_extractive_summary(query: str, text: str, max_items: int = 2) -> str:
    """Pick the top 1-2 sentences/bullets in `text` matching query terms for a concise BLUF header."""
    q_terms = {w for w in re.findall(r"[\w]+", query.casefold()) if len(w) >= 3}
    candidates = [
        ln.strip().lstrip("-•* ").strip()
        for ln in re.split(r"\n+|(?<=[.!?])\s+", text)
        if 25 <= len(ln.strip()) <= 280 and not ln.strip().startswith("#")
    ]
    if not candidates:
        return ""
    scored = sorted(
        candidates,
        key=lambda s: sum(1 for t in q_terms if t in s.casefold()),
        reverse=True,
    )
    picked = [s for s in scored[:max_items] if s]
    return "\n".join(f"- {s}" for s in picked)


def source_fact_claims(evidence_records: list[EvidenceRecord]) -> list[AnswerClaim]:
    """Create unverified, verbatim source claims for offline direct lookup only."""
    return [
        AnswerClaim(
            claim_id=f"source-{index}",
            text=record.content,
            claim_type="source_fact",
            evidence_ids=[record.evidence_id],
            support_status="insufficient_evidence",
        )
        for index, record in enumerate(evidence_records, start=1)
        if record.content.strip() and record.evidence_type in {"document_chunk", "knowledge_graph"}
    ]


def _run_claim_verification(
    claims: list[AnswerClaim],
    evidence_dicts: list[dict],
    *,
    inference_required: bool,
) -> tuple[dict, str, list[AnswerClaim], set[str]]:
    from app.services.rag.self_rag_verifier import verify_answer_claims

    verification = verify_answer_claims(claims, evidence_dicts)
    verified_claims = verification["claims"]
    validated_answer, accepted_claims, used_evidence_ids = render_validated_claims(
        verified_claims,
        evidence_dicts,
        inference_required=inference_required,
    )
    return verification, validated_answer, accepted_claims, used_evidence_ids


_STOPWORDS_SCOPE = {
    "cac", "nhung", "thuoc", "benh", "nhan", "nguoi", "can", "luu", "dung", "su",
    "thuong", "hay", "cho", "voi", "nhu", "the", "nao", "ra", "sao", "la", "gi", "cua", "va",
    "co", "khong", "duoc", "trong", "khi", "theo", "nen", "ve", "tai", "bi", "nhom", "loai",
    "nguy", "co", "phoi", "hop", "cung", "chung",
}


def _fallback_records_cover_inference_query(query: str, records: list[EvidenceRecord]) -> bool:
    """
    Allow verified verbatim source_fact fallback under `inference_required=True` ONLY when
    retrieved document chunks genuinely match the core clinical query scope (and never for
    mismatched DDI queries missing an entity, such as Macrolid + Statin on pneumonia docs).
    """
    import unicodedata

    def _ascii_tokens(val: str) -> set[str]:
        s = unicodedata.normalize("NFKD", (val or "").casefold())
        s = "".join(c for c in s if not unicodedata.combining(c)).replace("đ", "d")
        return {w for w in re.findall(r"[a-z0-9]{2,}", s) if w not in _STOPWORDS_SCOPE}

    doc_records = [r for r in records if r.evidence_type == "document_chunk" and r.source_id and r.source_version]
    if not doc_records:
        return False

    q_lower = (query or "").casefold()
    is_ddi_q = any(t in q_lower for t in ("tương tác", "tương kỵ", "phối hợp", "uống cùng", "dùng cùng", "uống chung"))
    if is_ddi_q and not any(r.evidence_type == "knowledge_graph" for r in records):
        return False

    q_toks = _ascii_tokens(query)
    if not q_toks:
        return False
    combined_doc_toks = _ascii_tokens(" ".join(r.content for r in doc_records))
    coverage = len(q_toks & combined_doc_toks) / len(q_toks)
    return coverage >= 0.5


def verify_and_finalize_claims(
    rag_res: RagResult,
    *,
    query: str,
    answer_text: Optional[str],
    generated_claims: list[AnswerClaim],
    evidence_records: list[EvidenceRecord],
    inference_required: bool,
) -> RagResult:
    """Verify claims against retrieved evidence, apply Top-1 fallback if needed, and finalize RagResult."""
    evidence_dicts = [record.to_dict() for record in evidence_records]
    initial_claims = generated_claims
    if not initial_claims and evidence_records and not inference_required:
        initial_claims = source_fact_claims(evidence_records)

    verification, validated_answer, accepted_claims, used_evidence_ids = _run_claim_verification(
        initial_claims,
        evidence_dicts,
        inference_required=inference_required,
    )

    used_deterministic_fallback = False
    if not validated_answer and evidence_records:
        fallback_records: list[EvidenceRecord] = []
        if evidence_records[0].evidence_type == "knowledge_graph":
            fallback_records.append(evidence_records[0])
        doc_records = [r for r in evidence_records if r.evidence_type == "document_chunk"]
        if doc_records:
            top_doc = doc_records[0]
            top_prefix = (top_doc.chunk_id or "").rsplit("_", 1)[0]
            siblings = [
                r for r in doc_records
                if r is top_doc or (
                    top_prefix and (r.chunk_id or "").startswith(f"{top_prefix}_")
                    and (r.chunk_id or "").rsplit("_", 1)[-1].isdigit()
                )
            ]
            # For multi-section guidelines/circulars, keep top 3 distinct document chunks if fewer than 2 siblings exist
            if len(siblings) >= 2:
                fallback_records.extend(siblings[:3])
            else:
                fallback_records.extend(doc_records[:3])
        if not fallback_records:
            fallback_records = evidence_records[:1]

        allow_fallback = (not inference_required) or _fallback_records_cover_inference_query(query, fallback_records)
        if allow_fallback:
            verification, validated_answer, accepted_claims, used_evidence_ids = _run_claim_verification(
                source_fact_claims(fallback_records),
                evidence_dicts,
                inference_required=inference_required,
            )
            used_deterministic_fallback = bool(validated_answer and accepted_claims)

    rag_res.claims = verification["claims"]
    rag_res.claims_audit = [claim.model_dump() for claim in rag_res.claims]
    rag_res.evidence_claim_map = {
        evidence_id: [claim.claim_id for claim in rag_res.claims if evidence_id in claim.evidence_ids]
        for evidence_id in {item for claim in rag_res.claims for item in claim.evidence_ids}
    }
    rag_res.evidence = evidence_dicts

    if validated_answer:
        filtered_citations = [
            citation for citation in rag_res.citations
            if any(
                record.chunk_id == citation.chunk_id
                for record in evidence_records
                if record.evidence_id in used_evidence_ids
            )
        ]
    else:
        filtered_citations = []

    if validated_answer and filtered_citations:
        if not used_deterministic_fallback and answer_text and len(answer_text.strip()) > 40 and answer_text.strip() not in validated_answer:
            clean_llm = answer_text.strip()
            if inference_required and "chỉ mang tính tham khảo" not in clean_llm.casefold():
                clean_llm = f"**Chỉ mang tính tham khảo.**\n\n{clean_llm}"
            rag_res.answer = clean_llm
        else:
            top_basis = rag_res.legal_basis or (
                rag_res.citations[0].legal_basis if rag_res.citations else "Tài liệu chuyên môn"
            )
            clean_body = validated_answer.removeprefix("**Chỉ mang tính tham khảo.**").strip()
            prefix_note = "**Chỉ mang tính tham khảo.**\n\n" if (inference_required or validated_answer.startswith("**Chỉ mang tính tham khảo.**")) else ""
            summary_lines = build_extractive_summary(query, clean_body)
            summary_block = f"### Tóm tắt nhanh ({top_basis})\n{summary_lines}\n\n" if summary_lines else ""
            rag_res.answer = f"{prefix_note}{summary_block}### Chi tiết trích xuất từ {top_basis}\n\n{clean_body}"

        rag_res.claims = accepted_claims
        rag_res.evidence_claim_map = {
            evidence_id: [claim.claim_id for claim in accepted_claims if evidence_id in claim.evidence_ids]
            for evidence_id in used_evidence_ids
        }
        rag_res.citations = filtered_citations
        rag_res.evidence = [
            record.to_dict() for record in evidence_records
            if record.evidence_id in used_evidence_ids
        ]
    else:
        accepted_claims = []
        if rag_res.rag_grounded or validated_answer:
            rag_res.answer = (
                "Đã tìm thấy tài liệu liên quan nhưng chưa thể xác minh câu trả lời bằng bằng chứng "
                "có nguồn gốc rõ ràng. Vui lòng đối chiếu tài liệu đã lập chỉ mục."
            )
        rag_res.rag_grounded = False
        rag_res.confidence_score = 0.0
        rag_res.citations = []
        rag_res.evidence = []

    rag_res.rag_grounded = bool(accepted_claims and rag_res.citations)
    if not rag_res.rag_grounded:
        rag_res.confidence_score = 0.0
        rag_res.critique_verdict = "NOT_VERIFIABLE"
    elif not verification["all_supported"]:
        rag_res.critique_verdict = "CAUTION"

    return rag_res
