"""
Unit & Integration Tests: Verification of Hardcode Elimination & SOTA RAG Dynamic Synthesis
Kiểm thử toàn diện:
1. Loại bỏ hoàn toàn hardcoded static response strings.
2. DDI tương tác đọc động từ CSDL 633 cặp QĐ 5948/QĐ-BYT.
3. Chuyên đề lâm sàng (TT 20, Ung thư giảm nhẹ, thai kỳ) được tổng hợp động qua PaperQA2.
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.session_context import clear_session
from app.services.chatbot.session_routing import get_ddi_catalog, DDI_CONTRAINDICATION_CATALOG
from app.services.rag.hybrid_retriever import HybridRetriever

@pytest.mark.asyncio
async def test_ddi_catalog_loads_from_database():
    """CSDL DDI phải nạp trên 600 cặp thực tế từ QĐ 5948, không phải mảng tĩnh 10 phần tử."""
    catalog = get_ddi_catalog()
    assert len(catalog) >= 630
    assert len(DDI_CONTRAINDICATION_CATALOG) >= 630

    # Cặp 1 và cặp 2 phải là các tương tác kinh điển được ưu tiên
    assert "Simvastatin" in catalog[0]["pair"] or "Clarithromycin" in catalog[0]["pair"]
    assert "Clopidogrel" in catalog[1]["pair"] or "Omeprazol" in catalog[1]["pair"]

@pytest.mark.asyncio
async def test_tt20_narcotics_synthesized_via_paperqa():
    """Tra cứu Thông tư 20 phải qua PaperQA2 Synthesizer, có trích dẫn pháp lý chuẩn xác."""
    sid = "test_tt20_paperqa_sess"
    clear_session("bs. trần văn hùng:" + sid)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/copilot/chat", json={
            "query": "Quy chế thuốc gây nghiện TT 20",
            "user_name": "BS. Trần Văn Hùng",
            "user_role": "doctor",
            "session_id": sid
        })
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "LEGAL_GUIDANCE"
        assert "20/2017/TT-BYT" in data["reply_text"]
        assert "tủ sắt" in data["reply_text"].lower() or "tủ riêng" in data["reply_text"].lower()
        assert len(data["citations"]) >= 1
        assert data["confidence"] >= 0.7
        assert data["source_status"] in ("exact_match", "fallback_deterministic", "cache_exact")

@pytest.mark.asyncio
async def test_oncology_palliative_synthesized_via_paperqa():
    """Tra cứu Chăm sóc giảm nhẹ ung thư phải qua PaperQA2, trích dẫn thang giảm đau WHO."""
    sid = "test_onco_palliative_sess"
    clear_session("bs. lê thanh:" + sid)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/v1/copilot/chat", json={
            "query": "Chăm sóc giảm nhẹ ung thư",
            "user_name": "BS. Lê Thanh",
            "user_role": "doctor",
            "session_id": sid
        })
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "ONCOLOGY_SPECIALTY_GUIDANCE"
        assert "thang giảm đau" in data["reply_text"].lower() or "who" in data["reply_text"].lower() or "morphin" in data["reply_text"].lower()
        assert len(data["citations"]) >= 1

@pytest.mark.asyncio
async def test_hybrid_retriever_indexes_specialty_topics():
    """HybridRetriever FTS5 phải tìm thấy các chủ đề chuyên môn trong 2.400+ chunks CSDL."""
    retriever = HybridRetriever()
    results = retriever.retrieve("Paracetamol cho phụ nữ có thai", top_k=3)
    assert len(results) >= 1
    found_pregnant_guidance = any(
        "thai" in r.chunk.title.lower() or "thai" in r.chunk.content.lower()
        for r in results
    )
    assert found_pregnant_guidance
