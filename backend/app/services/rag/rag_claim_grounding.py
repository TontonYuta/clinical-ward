"""LLM synthesis, claim parsing, and Self-RAG verification for Clinical RAG."""
import json
import logging
import re
from typing import Optional

from app.schemas.copilot import AnswerClaim
from app.services.rag.citation_grounder import render_validated_claims
from app.services.rag.types import EvidenceRecord, RagResult

logger = logging.getLogger(__name__)


def build_clinical_rag_prompt(
    *,
    query: str,
    user_role: str,
    conversation_context: str,
    evidence_context: str,
    ddi_alert_context: str,
) -> str:
    """Build the grounded clinical synthesis prompt with strict claim-ID contract."""
    return (
        f"Bạn là Chuyên gia Dược lâm sàng & Pháp lý Bệnh viện.\n"
        f"=== NGỮ CẢNH HỘI THOẠI (chỉ giúp hiểu câu hỏi tiếp nối, không phải chứng cứ y khoa) ===\n"
        f"{conversation_context or '(không có)'}\n\n"
        f"=== CHỨNG CỨ ĐÃ TRUY XUẤT (nguồn duy nhất để đưa ra thông tin chuyên môn) ===\n"
        f"{evidence_context}{ddi_alert_context}\n\n"
        f"Hãy trả lời câu hỏi sau của nhân viên y tế ({user_role}):\n"
        f"\"{query}\"\n\n"
        f"Hợp đồng trả lời:\n"
        f"- BẮT BUỘC mở đầu bằng mục `### Tóm tắt / Kết luận` (1-3 câu ngắn gọn trả lời trực tiếp vào trọng tâm câu hỏi kèm con số/ngưỡng/quy định chốt, không để người đọc tự suy luận).\n"
        f"- Tiếp theo là mục `### Chi tiết` (trình bày bằng gạch đầu dòng hoặc bảng Markdown sạch, mỗi ý xuống dòng rõ ràng, không nhắc mã chunk nội bộ như `qd708_...` trong câu trả lời).\n"
        f"- Nếu có cảnh báo an toàn, ngoại lệ hoặc điều kiện áp dụng, thêm mục `### Lưu ý` ở cuối.\n"
        f"- Chỉ dùng dữ kiện ghi trong chứng cứ; bỏ qua các điều khoản/mục phụ không liên quan trong cùng đoạn ngữ cảnh; dùng ký tự Unicode chuẩn (β-lactam, ≥, ≤) thay vì mã LaTeX (`\\beta`, `\\geq`); nếu thiếu căn cứ cho một phần, nói rõ phần chưa đủ dữ liệu và không đoán.\n"
        f"- Sau câu trả lời, xuất thêm đúng một thẻ <ANSWER_CLAIMS> chứa JSON array các claim có trường claim_id, text, claim_type (source_fact/evidence_inference), evidence_ids. Mỗi evidence_id chỉ được chọn từ các mã chứng cứ backend ở context. Nếu không đủ căn cứ, không khai báo claim được hỗ trợ. Không tạo source ID, citation hay mã evidence mới.\n"
        f"Nguyên tắc bắt buộc: chỉ dùng các chứng cứ đã cung cấp; phân biệt dữ kiện ghi trong nguồn với phép tổng hợp; không biến tương quan thành nhân quả; không tạo số liệu/liều dùng/tác dụng/chống chỉ định mới. Nếu có tương tác chống chỉ định hoặc cảnh báo bệnh nền được chứng minh trong chứng cứ thì nêu cảnh báo trước. Nếu truy xuất không đủ trả lời, abstain. Dùng Markdown rõ ràng, không thêm nội dung không có căn cứ."
    )


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
    """Resolve an active Gemini key and synthesize a grounded response if available."""
    from app.services.admin_key_vault import get_active_api_key_async

    gemini_key = api_key or await get_active_api_key_async(provider="gemini") or default_api_key
    if not gemini_key or gemini_key == "MY_GEMINI_API_KEY" or len(gemini_key.strip()) < 10:
        return None

    try:
        from app.services.copilot_gemini import query_gemini_models

        prompt = build_clinical_rag_prompt(
            query=query,
            user_role=user_role,
            conversation_context=conversation_context,
            evidence_context=evidence_context,
            ddi_alert_context=ddi_alert_context,
        )
        return await query_gemini_models(prompt, gemini_key)
    except Exception as exc:
        logger.warning("Gemini synthesis failed in RAG pipeline: %s", exc)
        return None


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

    if not validated_answer and evidence_records and not inference_required:
        # Fallback cleanly to Top-1 document (plus sibling parts of the same section & graph if first)
        # so multi-part monographs/guidelines and citations are preserved intact.
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
        verification, validated_answer, accepted_claims, used_evidence_ids = _run_claim_verification(
            source_fact_claims(fallback_records),
            evidence_dicts,
            inference_required=inference_required,
        )

    rag_res.claims = verification["claims"]
    rag_res.claims_audit = [claim.model_dump() for claim in rag_res.claims]
    rag_res.evidence_claim_map = {
        evidence_id: [claim.claim_id for claim in rag_res.claims if evidence_id in claim.evidence_ids]
        for evidence_id in {item for claim in rag_res.claims for item in claim.evidence_ids}
    }
    rag_res.evidence = evidence_dicts

    if validated_answer:
        if answer_text and len(answer_text.strip()) > 40 and answer_text.strip() not in validated_answer:
            rag_res.answer = answer_text.strip()
        else:
            top_basis = rag_res.legal_basis or (
                rag_res.citations[0].legal_basis if rag_res.citations else "Tài liệu chuyên môn"
            )
            summary_lines = build_extractive_summary(query, validated_answer)
            summary_block = f"### Tóm tắt nhanh ({top_basis})\n{summary_lines}\n\n" if summary_lines else ""
            rag_res.answer = f"{summary_block}### Chi tiết trích xuất từ {top_basis}\n\n{validated_answer}"

        rag_res.claims = accepted_claims
        rag_res.evidence_claim_map = {
            evidence_id: [claim.claim_id for claim in accepted_claims if evidence_id in claim.evidence_ids]
            for evidence_id in used_evidence_ids
        }
        rag_res.citations = [
            citation for citation in rag_res.citations
            if any(
                record.chunk_id == citation.chunk_id
                for record in evidence_records
                if record.evidence_id in used_evidence_ids
            )
        ]
        rag_res.evidence = [
            record.to_dict() for record in evidence_records
            if record.evidence_id in used_evidence_ids
        ]
    elif rag_res.rag_grounded:
        rag_res.answer = (
            "Đã tìm thấy tài liệu liên quan nhưng chưa thể xác minh câu trả lời bằng bằng chứng "
            "có nguồn gốc rõ ràng. Vui lòng đối chiếu tài liệu đã lập chỉ mục."
        )
        rag_res.rag_grounded = False
        rag_res.confidence_score = 0.0
        rag_res.citations = []
        rag_res.evidence = []

    rag_res.rag_grounded = bool(accepted_claims)
    if not accepted_claims:
        rag_res.confidence_score = 0.0
        rag_res.critique_verdict = "NOT_VERIFIABLE"
    elif not verification["all_supported"]:
        rag_res.critique_verdict = "CAUTION"

    return rag_res
