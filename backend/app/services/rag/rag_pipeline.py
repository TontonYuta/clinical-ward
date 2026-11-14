"""
Clinical Pure RAG Pipeline Coordinator
Điều phối toàn diện: Query -> KG Expansion -> Hybrid RRF -> LLM Grounding -> Citations (<=180 LOC)
"""
from typing import Optional
from app.config import settings
from app.services.rag.types import RagResult, EvidenceRecord
from app.schemas.copilot import AnswerClaim
from app.services.rag.knowledge_graph import expand_clinical_graph
from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.rag.citation_grounder import build_claim_citations, format_grounded_answer, render_validated_claims
from app.services.rag.adaptive_retriever import classify_query_complexity

_GLOBAL_RETRIEVER: Optional[HybridRetriever] = None

def get_rag_retriever() -> HybridRetriever:
    global _GLOBAL_RETRIEVER
    if _GLOBAL_RETRIEVER is None:
        _GLOBAL_RETRIEVER = HybridRetriever()
    return _GLOBAL_RETRIEVER

async def execute_clinical_rag(
    query: str,
    patient_info: Optional[dict] = None,
    user_role: str = "nurse",
    api_key: Optional[str] = None,
    conversation_context: str = "",
    inference_required: bool = False,
) -> RagResult:
    retriever = get_rag_retriever()
    budget_cfg = classify_query_complexity(query)

    # 1. Mở rộng đồ thị tri thức lâm sàng nếu cần (LightRAG / MedGraphRAG Layer)
    kg_data = expand_clinical_graph(query, patient_info=patient_info) if budget_cfg.include_graph else {}

    # 2. Truy xuất lai Hybrid Retrieval có cấp phát ngân sách (Adaptive Top-K RRF k=60, Async Parallel)
    retrieved_chunks = await retriever.retrieve_async(
        query=query,
        kg_entities=kg_data.get("kg_entities", []) if kg_data else [],
        top_k=budget_cfg.top_k
    )

    # Keep evidence records aligned with complete blocks passed to generation.
    evidence_records: list[EvidenceRecord] = []
    evidence_blocks: list[str] = []
    selected_chunks = []
    graph_text_for_audit = ""
    if budget_cfg.include_graph and kg_data.get("graph_context_text"):
        graph_block = (
            "=== [ĐỒ THỊ TƯƠNG TÁC DƯỢC LÝ & AN TOÀN ĐIỀU TRỊ] ===\n" +
            kg_data["graph_context_text"]
        )
        if len(graph_block) <= budget_cfg.max_context_chars:
            evidence_blocks.append(graph_block)
            graph_text_for_audit = kg_data["graph_context_text"]
            evidence_records.append(EvidenceRecord(
                evidence_id=f"graph:{kg_data.get('graph_source', 'curated-clinical-graph')}",
                evidence_type="knowledge_graph",
                source_id=kg_data.get("graph_source", "curated-clinical-graph"),
                source_version=kg_data.get("graph_version", "unversioned"),
                content=kg_data["graph_context_text"],
            ))
    for idx, r in enumerate(retrieved_chunks):
        block = (
            f"=== [CHỨNG CỨ #{idx+1}] Mã: {r.chunk.chunk_id} | Nguồn: {r.chunk.source_doc} | Căn cứ: {r.chunk.legal_basis} | Mục: {r.chunk.page_or_section} ===\n"
            f"{r.chunk.content}"
        )
        separator = "\n\n" if evidence_blocks else ""
        if sum(map(len, evidence_blocks)) + len(separator) + len(block) > budget_cfg.max_context_chars:
            continue
        evidence_blocks.append(block)
        selected_chunks.append(r)
        evidence_records.append(EvidenceRecord(
            evidence_id=f"document:{r.chunk.chunk_id}",
            evidence_type="document_chunk",
            source_id=r.chunk.source_id or r.chunk.source_doc,
            source_version=r.chunk.source_version,
            content=r.chunk.content,
            chunk_id=r.chunk.chunk_id,
            source_name=r.chunk.source_doc,
            section=r.chunk.page_or_section,
        ))
    # The model may refer only to evidence blocks actually included in its context.
    evidence_blocks = [
        block.replace(
            block.splitlines()[0],
            f"{block.splitlines()[0]}\nMã chứng cứ backend: {record.evidence_id}",
            1,
        )
        for block, record in zip(evidence_blocks, evidence_records)
    ]
    evidence_context = "\n\n".join(evidence_blocks)

    # 3. Citations are built only for chunks actually included in the prompt.
    citations = build_claim_citations(selected_chunks, query=query)

    # Thêm cảnh báo đồ thị tương tác DDI nếu có
    ddi_alert_context = ""
    if budget_cfg.include_graph and kg_data.get("active_ddi_alerts") and graph_text_for_audit:
        alerts = [f"- {a['drug_a']} + {a['drug_b']}: {a['severity']}. Cơ chế: {a['mechanism']}. Hậu quả: {a['consequence']}" for a in kg_data["active_ddi_alerts"]]
        ddi_alert_context = "\n\n[CẢNH BÁO TƯƠNG TÁC THUỐC TỪ ĐỒ THỊ TRI THỨC]:\n" + "\n".join(alerts)

    # 5. Sinh phản hồi Grounded qua Gemini LLM (nếu có API Key khả dụng)
    from app.services.admin_key_vault import get_active_api_key
    gemini_key = api_key or get_active_api_key(provider="gemini") or settings.GEMINI_API_KEY
    llm_answer: Optional[str] = None

    if gemini_key and gemini_key != "MY_GEMINI_API_KEY" and len(gemini_key.strip()) >= 10:
        try:
            from app.services.copilot_gemini import query_gemini_models

            prompt = (
                f"Bạn là Chuyên gia Dược lâm sàng & Pháp lý Bệnh viện.\n"
                f"=== NGỮ CẢNH HỘI THOẠI (chỉ giúp hiểu câu hỏi tiếp nối, không phải chứng cứ y khoa) ===\n{conversation_context or '(không có)'}\n\n"
                f"=== CHỨNG CỨ ĐÃ TRUY XUẤT (nguồn duy nhất để đưa ra thông tin chuyên môn) ===\n"
                f"{evidence_context}{ddi_alert_context}\n\n"
                f"Hãy trả lời câu hỏi sau của nhân viên y tế ({user_role}):\n"
                f"\"{query}\"\n\n"
                f"Hợp đồng trả lời:\n"
                f"- Trả lời trực tiếp chỉ bằng dữ kiện ghi trong chứng cứ; không thêm nhãn tham khảo cho phần tra cứu/trích tóm tắt.\n"
                f"- Nếu cần so sánh, tổng hợp hoặc suy luận, phân biệt phần dữ kiện với kết luận suy ra. Chỉ mang tính tham khảo; nêu rõ dữ kiện làm căn cứ; không thêm kiến thức ngoài chứng cứ. Nếu thiếu căn cứ cho một phần, nói rõ phần chưa đủ dữ liệu và không đoán.\n"
                f"- Sau câu trả lời, xuất thêm đúng một thẻ <ANSWER_CLAIMS> chứa JSON array các claim có trường claim_id, text, claim_type (source_fact/evidence_inference), evidence_ids. Mỗi evidence_id chỉ được chọn từ các mã chứng cứ backend ở context. Nếu không đủ căn cứ, không khai báo claim được hỗ trợ. Không tạo source ID, citation hay mã evidence mới.\n"
                f"Nguyên tắc bắt buộc: chỉ dùng các chứng cứ đã cung cấp; phân biệt dữ kiện ghi trong nguồn với phép tổng hợp; không biến tương quan thành nhân quả; không tạo số liệu/liều dùng/tác dụng/chống chỉ định mới. Nếu có tương tác chống chỉ định hoặc cảnh báo bệnh nền được chứng minh trong chứng cứ thì nêu cảnh báo trước. Nếu truy xuất không đủ trả lời, abstain. Dùng Markdown rõ ràng, không thêm nội dung không có căn cứ."
            )
            llm_answer = await query_gemini_models(prompt, gemini_key)
        except Exception:
            llm_answer = None

    # Parse claim references only after binding them to this exact prompt context.
    answer_text, generated_claims = _parse_answer_claims(llm_answer, {r.evidence_id for r in evidence_records})

    # 6. Đóng gói kết quả RAG có chứng thực
    rag_res = format_grounded_answer(
        query=query,
        retrieved_chunks=selected_chunks,
        citations=citations,
        kg_data={**kg_data, "graph_context_text": graph_text_for_audit},
        llm_generated_text=answer_text,
        inference_required=inference_required,
    )
    rag_res.claims = generated_claims
    rag_res.evidence = [record.to_dict() for record in evidence_records]

    # Offline direct lookup may expose source text verbatim, but never synthesize claims.
    if not gemini_key and not inference_required and not rag_res.claims:
        rag_res.claims = _source_fact_claims(evidence_records)

    # 7. Verify model-declared claim/evidence links; claim IDs are only proposals.
    from app.services.rag.self_rag_verifier import verify_answer_claims
    claim_verification = verify_answer_claims(
        rag_res.claims, [record.to_dict() for record in evidence_records]
    )
    rag_res.claims = claim_verification["claims"]
    rag_res.evidence_claim_map = {
        evidence_id: [claim.claim_id for claim in rag_res.claims if evidence_id in claim.evidence_ids]
        for evidence_id in {item for claim in rag_res.claims for item in claim.evidence_ids}
    }
    rag_res.claims_audit = [claim.model_dump() for claim in rag_res.claims]
    validated_answer, accepted_claims, used_evidence_ids = render_validated_claims(
        rag_res.claims, [record.to_dict() for record in evidence_records],
        inference_required=inference_required,
    )
    if validated_answer:
        rag_res.answer = validated_answer
        rag_res.claims = accepted_claims
        rag_res.evidence_claim_map = {
            evidence_id: [claim.claim_id for claim in accepted_claims if evidence_id in claim.evidence_ids]
            for evidence_id in used_evidence_ids
        }
        rag_res.citations = [
            citation for citation in rag_res.citations
            if any(record.chunk_id == citation.chunk_id for record in evidence_records if record.evidence_id in used_evidence_ids)
        ]
        rag_res.evidence = [
            record.to_dict() for record in evidence_records
            if record.evidence_id in used_evidence_ids
        ]
    elif rag_res.rag_grounded:
        rag_res.answer = "Chưa thể xác minh câu trả lời từ evidence có nguồn và provenance phù hợp; vui lòng đối chiếu tài liệu đã lập chỉ mục."
        rag_res.rag_grounded = False
        rag_res.confidence_score = 0.0
        rag_res.citations = []
        rag_res.evidence = []
    rag_res.rag_grounded = bool(accepted_claims)
    if not accepted_claims:
        rag_res.confidence_score = 0.0
        rag_res.critique_verdict = "NOT_VERIFIABLE"
    elif not claim_verification["all_supported"]:
        rag_res.critique_verdict = "CAUTION"

    return rag_res


def _parse_answer_claims(response: str | None, allowed_evidence_ids: set[str]) -> tuple[str | None, list[AnswerClaim]]:
    if not response:
        return response, []
    import json
    import re

    match = re.search(r"<ANSWER_CLAIMS>(.*?)</ANSWER_CLAIMS>", response, flags=re.DOTALL)
    if not match:
        return response, []
    answer_text = (response[:match.start()] + response[match.end():]).strip()
    try:
        payload = json.loads(match.group(1))
        if not isinstance(payload, list):
            return answer_text or None, []
        claims = []
        for item in payload:
            if not isinstance(item, dict):
                continue
            evidence_ids = item.get("evidence_ids")
            if not isinstance(evidence_ids, list) or not evidence_ids or any(
                evidence_id not in allowed_evidence_ids for evidence_id in evidence_ids
            ):
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


def _source_fact_claims(evidence_records: list[EvidenceRecord]) -> list[AnswerClaim]:
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
        if record.content.strip() and record.evidence_type == "document_chunk"
    ]
