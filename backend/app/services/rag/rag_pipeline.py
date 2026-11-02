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

    # 1. Mở rộng đồ thị tri thức lâm sàng (LightRAG / MedGraphRAG Layer)
    kg_data = expand_clinical_graph(query, patient_info=patient_info)

    # 2. Truy xuất lai Hybrid Retrieval (Sparse BM25 + Dense Semantic via RRF k=60)
    retrieved_chunks = retriever.retrieve(
        query=query,
        kg_entities=kg_data.get("kg_entities", []),
        top_k=4
    )

    # 3. Xây dựng danh mục trích dẫn chứng cứ y văn (PaperQA2 Attribution)
    citations = build_claim_citations(retrieved_chunks)

    # 4. Tạo bối cảnh chứng cứ thực tế (Evidence Context)
    evidence_blocks: list[str] = []
    for idx, r in enumerate(retrieved_chunks):
        evidence_blocks.append(
            f"=== [CHỨNG CỨ #{idx+1}] Nguồn: {r.chunk.source_doc} | Căn cứ: {r.chunk.legal_basis} ===\n"
            f"{r.chunk.content}"
        )
    evidence_context = "\n\n".join(evidence_blocks)

    # Thêm cảnh báo đồ thị tương tác DDI nếu có
    ddi_alert_context = ""
    if kg_data.get("active_ddi_alerts"):
        alerts = [f"- {a['drug_a']} + {a['drug_b']}: {a['severity']}. Cơ chế: {a['mechanism']}. Hậu quả: {a['consequence']}" for a in kg_data["active_ddi_alerts"]]
        ddi_alert_context = "\n\n[CẢNH BÁO TƯƠNG TÁC THUỐC TỪ ĐỒ THỊ TRI THỨC]:\n" + "\n".join(alerts)

    # 5. Sinh phản hồi Grounded qua Gemini LLM (nếu có API Key khả dụng)
    gemini_key = api_key or settings.GEMINI_API_KEY
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
    return format_grounded_answer(
        query=query,
        retrieved_chunks=retrieved_chunks,
        citations=citations,
        kg_data=kg_data,
        llm_generated_text=llm_answer
    )
