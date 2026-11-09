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


def test_dual_level_query_analyzer_extraction():
    """Kiểm tra bóc tách 2 tầng Low-Level & High-Level Keywords chuẩn LightRAG Section 3.2."""
    from app.services.rag.lightrag_query_analyzer import analyze_dual_level_query
    q = "Bệnh nhân suy thận ClCr 28 mL/phút đang uống Coversyl bị ho khan kéo dài thì đổi sang thuốc gì?"
    dual = analyze_dual_level_query(q)

    # 1. Low-Level: Phải có tên thuốc/hoạt chất và thông số cụ thể
    assert "Coversyl" in dual.low_level_keywords or "perindopril" in dual.low_level_keywords
    assert any("28" in kw for kw in dual.low_level_keywords)
    assert dual.patient_metrics.get("egfr") == 28.0

    # 2. High-Level: Phải có nhóm dược lý ATC và khuyến cáo thay thế
    assert "ACEI" in dual.identified_classes
    assert any("ARB" in kw for kw in dual.high_level_keywords)
    assert "therapeutic_substitution" in dual.clinical_domains
    assert "renal_impairment" in dual.clinical_domains


def test_clinical_subgraph_traversal_and_metabolic_exception():
    """Kiểm tra duyệt đồ thị 1-hop BFS và bắt ngoại lệ chuyển hóa gan CYP (Pravastatin)."""
    from app.services.rag.sqlite_graph_service import ClinicalGraphTraversalService
    subgraph = ClinicalGraphTraversalService.traverse_clinical_subgraph(["pravastatin", "clarithromycin"])

    # 1. Phải nhận diện được 2 nhóm dược lý ATC
    assert "STATIN" in subgraph["discovered_classes"]
    assert "MACROLID" in subgraph["discovered_classes"]

    # 2. Phải phát hiện cạnh tương tác nhóm vĩ mô
    assert len(subgraph["active_class_ddis"]) >= 1
    ddi = subgraph["active_class_ddis"][0]
    assert ddi["class_a"] in ("MACROLID", "STATIN") and ddi["class_b"] in ("MACROLID", "STATIN")

    # 3. Phải phát hiện ngoại lệ chuyển hóa Pravastatin không phụ thuộc CYP3A4
    assert len(subgraph["metabolic_notes"]) >= 1
    m_note = subgraph["metabolic_notes"][0]
    assert m_note["drug"] == "pravastatin"
    assert "sulfat hóa" in m_note["exception"]["mechanism"]
    assert "CYP3A4" in m_note["exception"]["mechanism"]

