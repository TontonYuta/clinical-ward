"""
Tests for Step 2: Dual-Level LightRAG Knowledge Graph Retriever Integration.
Verifies that macro-level class taxonomy, class DDIs, organ risks, and therapeutic
substitutions are seamlessly retrieved, ranked, and boosted in HybridRetriever.
"""
import pytest
from app.services.rag.hybrid_retriever import HybridRetriever
from app.services.rag.embeddings.provider import MockEmbeddingProvider


@pytest.fixture(scope="module")
def retriever():
    return HybridRetriever(embedding_provider=MockEmbeddingProvider())


def test_retrieve_therapeutic_substitution_acei_cough(retriever):
    """Khi hỏi về ho khan do Coversyl, chunk khuyến cáo thay thế ACEI -> ARB phải đứng đầu."""
    results = retriever.retrieve("Uống coversyl bị ho khan nhiều quá thì đổi sang thuốc gì an toàn?", top_k=3)
    assert len(results) > 0
    top_cids = [r.chunk.chunk_id for r in results]
    assert "lightrag_therapeutic_subst_acei_cough" in top_cids
    top_result = results[0]
    assert top_result.chunk.chunk_id == "lightrag_therapeutic_subst_acei_cough"
    assert any("therapeutic substitution" in reason for reason in top_result.match_reasons)
    assert "ARB" in top_result.chunk.content


def test_retrieve_class_to_class_ddi(retriever):
    """Khi hỏi về phối hợp Macrolid + Statin, chunk tương tác nhóm vĩ mô phải xuất hiện."""
    results = retriever.retrieve("Kháng sinh Macrolid dùng chung với nhóm Statin có nguy hiểm không?", top_k=3)
    assert len(results) > 0
    top_cids = [r.chunk.chunk_id for r in results]
    assert "lightrag_class_ddi_macrolid_statin" in top_cids
    top_result = results[0]
    assert top_result.chunk.chunk_id == "lightrag_class_ddi_macrolid_statin"
    assert any("class interaction" in reason for reason in top_result.match_reasons)
    assert "Tiêu cơ vân" in top_result.chunk.content


def test_retrieve_organ_condition_risk_renal(retriever):
    """Khi hỏi về nguy cơ ở bệnh nhân suy thận ClCr < 30, chunk phân tầng suy thận phải được boost."""
    results = retriever.retrieve("Bệnh nhân suy thận nặng ClCr dưới 30 mL/phút cần lưu ý gì?", top_k=5)
    top_cids = [r.chunk.chunk_id for r in results]
    assert "lightrag_organ_risk_renal_impairment" in top_cids
    renal_res = next(r for r in results if r.chunk.chunk_id == "lightrag_organ_risk_renal_impairment")
    assert any("organ condition risk" in reason for reason in renal_res.match_reasons)
    assert "Metformin" in renal_res.chunk.content


def test_retrieve_pharmacological_class_taxonomy(retriever):
    """Khi hỏi về cơ chế hoặc phân loại nhóm Statin, chunk nhóm Statin phải được truy xuất."""
    results = retriever.retrieve("Cơ chế tác dụng dược lý của nhóm Statin hạ mỡ máu?", top_k=5)
    top_cids = [r.chunk.chunk_id for r in results]
    assert "lightrag_class_statin" in top_cids
    statin_res = next(r for r in results if r.chunk.chunk_id == "lightrag_class_statin")
    assert any("pharmacological taxonomy match" in reason for reason in statin_res.match_reasons)
    assert "HMG-CoA Reductase" in statin_res.chunk.content


def test_single_drug_query_does_not_contain_class_ddi(retriever):
    """Câu hỏi đơn lẻ về liều dùng Paracetamol tuyệt đối không bị nhiễm bẩn bởi class DDI chunks."""
    results = retriever.retrieve("Liều dùng của Paracetamol cho người lớn là bao nhiêu?", top_k=5)
    for r in results:
        assert r.chunk.entity_type != "graph_class_ddi", f"Class DDI chunk rò rỉ vào câu hỏi đơn lẻ: {r.chunk.chunk_id}"
        assert r.chunk.entity_type != "ddi", f"DDI chunk rò rỉ vào câu hỏi đơn lẻ: {r.chunk.chunk_id}"
