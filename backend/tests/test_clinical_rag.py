"""
Test Suite for Clinical Pure RAG Engine & PaperQA2 Grounding
Kiểm thử toàn diện 7 khía cạnh cốt lõi của RAG Y tế (<=180 LOC)
"""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.rag.clinical_indexer import load_all_clinical_chunks
from app.services.rag.sqlite_fts import SqliteFtsIndex
from app.services.rag.knowledge_graph import expand_clinical_graph
from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.rag.citation_grounder import build_claim_citations
from app.services.rag.rag_pipeline import execute_clinical_rag

def test_clinical_indexer_chunks():
    chunks = load_all_clinical_chunks()
    assert len(chunks) >= 30
    titles = [c.title for c in chunks]
    assert any("Paracetamol" in t for t in titles)
    assert any("Ceftriaxon" in t for t in titles)
    assert any("Phản Vệ" in c.source_doc for c in chunks)

def test_sqlite_fts_bm25_retrieval():
    idx = SqliteFtsIndex()
    chunks = load_all_clinical_chunks()
    idx.sync_chunks(chunks)
    res = idx.search_bm25("paracetamol liều tối đa 4g", top_k=3)
    assert len(res) > 0
    assert any("Paracetamol" in r.chunk.title for r in res)
    assert res[0].bm25_rank == 1

def test_clinical_knowledge_graph_ddi():
    kg = expand_clinical_graph("Bệnh nhân đang dùng Ceftriaxon có được truyền Calci không?")
    assert "INN:CEFTRIAXON" in kg["kg_entities"]
    assert "DDI:CEFTRIAXON<->CALCI" in kg["kg_entities"]
    assert len(kg["active_ddi_alerts"]) == 1
    alert = kg["active_ddi_alerts"][0]
    assert "kết tủa" in alert["mechanism"].lower()

    # Kiểm tra các cặp tương tác trọng yếu mới bổ sung theo QĐ 5948/QĐ-BYT
    kg_nitrat = expand_clinical_graph("Bệnh nhân dùng Nitroglycerin có được uống Sildenafil không?")
    assert any("DDI:NITROGLYCERIN<->SILDENAFIL" in e for e in kg_nitrat["kg_entities"])

    kg_warfarin = expand_clinical_graph("Warfarin uống cùng Fluconazol có sao không?")
    assert any("DDI:WARFARIN<->MICONAZOL" in e for e in kg_warfarin["kg_entities"])

    kg_allopurinol = expand_clinical_graph("Allopurinol phối hợp Azathioprin")
    assert any("DDI:ALLOPURINOL<->AZATHIOPRIN" in e for e in kg_allopurinol["kg_entities"])

    kg_metformin = expand_clinical_graph("Metformin tiêm thuốc cản quang iod")
    assert any("DDI:METFORMIN<->THUỐC CẢN QUANG IOD" in e for e in kg_metformin["kg_entities"])

def test_clinical_knowledge_graph_patient_risk():
    patient = {"egfr": 20, "allergies": ["cephalosporin"]}
    kg = expand_clinical_graph("Kê đơn ceftriaxon cho bệnh nhân", patient_info=patient)
    assert any("BÁO ĐỘNG ĐỎ" in w for w in kg["contra_warnings"])

def test_hybrid_rrf_retriever():
    retriever = HybridRetriever()
    results = retriever.retrieve("Xử trí cấp cứu phản vệ bằng Adrenalin", top_k=3)
    assert len(results) > 0
    top = results[0]
    assert top.score > 0
    assert any("Phản Vệ" in top.chunk.source_doc or "Adrenalin" in top.chunk.content for r in results)

def test_citation_grounder_attribution():
    retriever = HybridRetriever()
    results = retriever.retrieve("Paracetamol liều tối đa người lớn", top_k=3)
    citations = build_claim_citations(results)
    assert len(citations) > 0
    assert any("Quyết định 3445" in c.legal_basis for c in citations)
    assert len(citations[0].excerpt) > 10

@pytest.mark.asyncio
async def test_end_to_end_rag_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/copilot/rag",
            json={"query": "Liều dùng tối đa của Paracetamol 24h là bao nhiêu?"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["rag_grounded"] is True
        assert len(data["citations"]) > 0
        assert "4000 mg" in data["answer"] or "4g" in data["answer"] or "Paracetamol" in data["answer"]

@pytest.mark.asyncio
async def test_copilot_chat_rag_integration():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post(
            "/api/v1/copilot/chat",
            json={"query": "Thời gian bán thải và liều tối đa của Paracetamol trong huyết tương"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "CLINICAL_AI_CONSULTATION"
        assert data["rag_grounded"] is True
        assert len(data["citations"]) > 0
