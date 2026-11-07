"""
Clinical Pure RAG Pipeline Coordinator
Điều phối toàn diện: Query -> KG Expansion -> Hybrid RRF -> LLM Grounding -> Citations (<=180 LOC)
"""
from typing import Optional
from app.config import settings
from app.services.rag.types import RagResult
from app.services.rag.knowledge_graph import expand_clinical_graph
from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.rag.citation_grounder import build_claim_citations, format_grounded_answer
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
    conversation_context: str = ""
) -> RagResult:
    retriever = get_rag_retriever()
    budget_cfg = classify_query_complexity(query)

    # 1. Mở rộng đồ thị tri thức lâm sàng nếu cần (LightRAG / MedGraphRAG Layer)
    kg_data = expand_clinical_graph(query, patient_info=patient_info) if budget_cfg.include_graph else {}

    # 2. Truy xuất lai Hybrid Retrieval có cấp phát ngân sách (Adaptive Top-K RRF k=60)
    retrieved_chunks = retriever.retrieve(
        query=query,
        kg_entities=kg_data.get("kg_entities", []) if kg_data else [],
        top_k=budget_cfg.top_k
    )

    # 3. Xây dựng danh mục trích dẫn chứng cứ y văn (PaperQA2 Attribution)
    citations = build_claim_citations(retrieved_chunks)

    # 4. Tạo bối cảnh chứng cứ thực tế có kiểm soát ngân sách token (Evidence Context Budgeting)
    evidence_blocks: list[str] = []
    if budget_cfg.include_graph and kg_data.get("graph_context_text"):
        evidence_blocks.append(
            "=== [ĐỒ THỊ TƯƠNG TÁC DƯỢC LÝ & AN TOÀN ĐIỀU TRỊ] ===\n" +
            kg_data["graph_context_text"]
        )
    for idx, r in enumerate(retrieved_chunks):
        evidence_blocks.append(
            f"=== [CHỨNG CỨ #{idx+1}] Nguồn: {r.chunk.source_doc} | Căn cứ: {r.chunk.legal_basis} ===\n"
            f"{r.chunk.content}"
        )
    evidence_context = "\n\n".join(evidence_blocks)
    if len(evidence_context) > budget_cfg.max_context_chars:
        evidence_context = evidence_context[:budget_cfg.max_context_chars] + "…\n[Đã tinh gọn văn bản theo ngân sách token]"

    # Thêm cảnh báo đồ thị tương tác DDI nếu có
    ddi_alert_context = ""
    if budget_cfg.include_graph and kg_data.get("active_ddi_alerts"):
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
                f"Nguyên tắc bắt buộc (PaperQA2 Grounding):\n"
                f"1. Chỉ trả lời dựa trên các chứng cứ y văn đã cung cấp ở trên.\n"
                f"2. Nêu rõ liều dùng, đường dùng và nguồn cụ thể; không khẳng định văn bản pháp quy nếu chunk không có provenance xác minh.\n"
                f"3. Nếu có tương tác thuốc chống chỉ định hoặc cảnh báo bệnh nền, BẮT BUỘC cảnh báo đầu tiên.\n"
                f"4. Định dạng Markdown rõ ràng, gạch đầu dòng, tuyệt đối không bịa đặt."
            )
            llm_answer = await query_gemini_models(prompt, gemini_key)
        except Exception:
            llm_answer = None

    # 6. Đóng gói kết quả RAG có chứng thực
    rag_res = format_grounded_answer(
        query=query,
        retrieved_chunks=retrieved_chunks,
        citations=citations,
        kg_data=kg_data,
        llm_generated_text=llm_answer
    )

    # 7. Self-RAG Reflective Verification Layer (ICLR 2024)
    if rag_res.rag_grounded and rag_res.answer:
        from app.services.rag.self_rag_verifier import verify_clinical_answer
        audit_res = verify_clinical_answer(
            query=query,
            answer=rag_res.answer,
            retrieved_chunks=retrieved_chunks,
            kg_data=kg_data
        )
        rag_res.factuality_score = audit_res["factuality_score"]
        rag_res.hallucination_rate = audit_res["hallucination_rate"]
        rag_res.critique_verdict = audit_res["critique_verdict"]
        rag_res.claims_audit = audit_res["claims_audit"]
        rag_res.answer = audit_res["cleaned_answer"]

        # Nếu phát hiện mâu thuẫn lâm sàng nghiêm trọng hoặc hallucination rate > 0.6
        if audit_res["critique_verdict"] == "REJECT":
            rag_res.rag_grounded = False
            rag_res.confidence_score = 0.2

    # 8. CDSS Alert Sentinel: Tự động kích hoạt khi phát hiện tương tác nguy hiểm trong KG
    if kg_data.get("active_ddi_alerts"):
        top = kg_data["active_ddi_alerts"][0]
        is_contra = "chống chỉ định" in top["severity"].lower() or "mức độ 1" in top["severity"].lower()
        sub_drug = None
        conseq_lower = (top.get("consequence", "") + " " + top.get("mechanism", "")).lower()
        if "pantoprazol" in conseq_lower or "omeprazol" in top.get("drug_a", "").lower() or "omeprazol" in top.get("drug_b", "").lower():
            sub_drug = "Pantoprazol 40mg"
        elif "linagliptin" in conseq_lower:
            sub_drug = "Linagliptin 5mg"
        elif "prednisolon" in conseq_lower:
            sub_drug = "Prednisolon 20mg"
        elif "giảm liều" in conseq_lower:
            sub_drug = "Hiệu chỉnh giảm 50% liều"

        rag_res.cdss_alert = {
            "level": "critical" if is_contra else "warning",
            "title": "🛑 CHỐNG CHỈ ĐỊNH (QĐ 5948/QĐ-BYT)" if is_contra else "⚠️ CẢNH BÁO TƯƠNG TÁC THUỐC (QĐ 5948)",
            "message": f"{top['drug_a']} + {top['drug_b']}: {top['consequence']}",
            "antidoteRecommendation": f"Cơ chế: {top['mechanism']}. Khuyến cáo xử trí: Không phối hợp hoặc chuyển đổi sang thuốc thay thế an toàn.",
            "regulatoryReference": "Quyết định 5948/QĐ-BYT",
            "substituteDrug": sub_drug
        }

    return rag_res
