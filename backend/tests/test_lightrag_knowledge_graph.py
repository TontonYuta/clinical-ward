"""
Test Suite for LightRAG Dual-Level Knowledge Graph Layer.
Căn cứ:
- LightRAG: Simple and Fast Retrieval-Augmented Generation (arXiv:2410.05779, HKUDS).
- Đồ thị tri thức Dược lâm sàng: Thực thể nguyên tử (Low-Level) <-> Nhóm Dược lý & Bệnh nền (High-Level).
"""
import pytest
from app.services.rag.knowledge_graph import expand_clinical_graph
from app.services.rag.rag_pipeline import execute_clinical_rag

def test_lightrag_entity_and_class_identification():
    """Kiểm tra nhận diện thực thể và nhóm dược lý vĩ mô Macrolid + Statin."""
    query = "Kháng sinh nhóm Macrolid phối hợp với Statin có nguy cơ gì?"
    kg = expand_clinical_graph(query)

    assert "MACROLID" in kg["high_level_classes"], "Phải nhận diện được nhóm MACROLID"
    assert "STATIN" in kg["high_level_classes"], "Phải nhận diện được nhóm STATIN"
    assert "CLASS:MACROLID" in kg["kg_entities"]
    assert "CLASS:STATIN" in kg["kg_entities"]

    # Kiểm tra phân tích tương tác nhóm vĩ mô
    assert len(kg["class_interactions"]) >= 1, "Phải phát hiện tương tác nhóm Macrolid + Statin"
    c_ddi = kg["class_interactions"][0]
    assert "chống chỉ định" in c_ddi["severity"].lower()
    assert "tiêu cơ vân" in c_ddi["consequence"].lower()
    assert "cyp3a4" in c_ddi["mechanism"].lower()
    assert "CLASS_DDI:MACROLID<->STATIN" in kg["kg_entities"]
    assert len(kg["graph_context_text"]) > 0
    assert "Statin" in kg["graph_context_text"]

def test_lightrag_organ_and_condition_hierarchy():
    """Kiểm tra nhận diện bệnh nền suy thận mạn và cảnh báo toan Lactic của Metformin."""
    query = "Bệnh nhân đái tháo đường kèm suy thận mạn ClCr 25 ml/phút có dùng được Metformin không?"
    kg = expand_clinical_graph(query)

    assert "BIGUANID" in kg["high_level_classes"] or "INN:METFORMIN" in kg["kg_entities"]
    assert any("CONDITION:RENAL_IMPAIRMENT" in e for e in kg["kg_entities"])
    assert len(kg["organ_condition_risks"]) >= 1

    # Kiểm tra khuyến cáo thay thế an toàn
    assert len(kg["therapeutic_alternatives"]) >= 1
    subst = kg["therapeutic_alternatives"][0]
    assert "Linagliptin" in subst["recommendation"] or "Insulin" in subst["recommendation"]

def test_lightrag_therapeutic_substitution_acei_cough():
    """Kiểm tra khuyến cáo chuyển đổi nhóm thuốc khi ho khan do ACEI."""
    query = "Bệnh nhân bị ho khan do dùng Coversyl thì đổi sang nhóm nào?"
    kg = expand_clinical_graph(query)

    assert "ACEI" in kg["high_level_classes"] or "INN:PERINDOPRIL" in kg["kg_entities"]
    assert len(kg["therapeutic_alternatives"]) >= 1
    subst = kg["therapeutic_alternatives"][0]
    assert "ARB" in subst["alternative_class"]
    assert "Bradykinin" in subst["recommendation"]

@pytest.mark.asyncio
async def test_lightrag_dual_level_pipeline_integration():
    """Kiểm tra tích hợp đồ thị LightRAG vào quy trình RAG Pipeline hoàn chỉnh."""
    query = "Kháng sinh nhóm Macrolid phối hợp với Statin có nguy cơ gì?"
    rag_res = await execute_clinical_rag(query)

    assert rag_res is not None
    assert rag_res.rag_grounded is True
    assert any(term in rag_res.answer.lower() for term in ("tiêu cơ vân", "cyp3a4", "statin", "macrolid"))
    assert any(term in rag_res.answer for term in ("Tương Tác Nhóm Dược Lý", "Chống chỉ định", "CYP3A4"))
