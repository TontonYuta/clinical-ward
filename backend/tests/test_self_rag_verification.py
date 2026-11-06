"""
Unit & Integration Tests for Phase 4: Self-RAG Reflective Verification Layer (ICLR 2024).
Verifies claim-level evidence grounding, hallucination scoring, and safety contradiction rejection.
"""
import pytest
from app.services.rag.self_rag_verifier import (
    _extract_clinical_claims,
    _evaluate_claim_support,
    _detect_safety_contradictions,
    verify_clinical_answer,
    SelfRagVerifier
)
from app.services.rag.types import RagChunk, RetrievedChunk, RagResult
from app.services.rag.rag_pipeline import execute_clinical_rag

def _make_sample_chunk(title: str, content: str) -> RetrievedChunk:
    chunk = RagChunk(
        chunk_id="test_chunk_01",
        source_doc="Dược thư Quốc gia Việt Nam 2015",
        legal_basis="DĐVN V",
        page_or_section="PERINDOPRIL",
        title=title,
        content=content,
        keywords=["perindopril", "coversyl", "acei", "tăng huyết áp"]
    )
    return RetrievedChunk(chunk=chunk, score=0.9)

def test_self_rag_claim_segmentation():
    raw_text = """
### Khuyến Cáo Dược Lâm Sàng
Dạ chào Bác sĩ, dưới đây là thông tin chuyên môn ạ.
Liều khuyến nghị của Perindopril là 4 mg/ngày uống một lần vào buổi sáng.
Khi bệnh nhân bị suy thận nặng ClCr dưới 30 thì cần giảm liều 2 mg mỗi hai ngày.
Vui lòng liên hệ dược sĩ nếu cần thêm chi tiết.
"""
    claims = _extract_clinical_claims(raw_text)
    assert len(claims) >= 2
    assert any("4 mg/ngày" in c for c in claims)
    assert any("ClCr dưới 30" in c for c in claims)
    # Greetings should be filtered out
    assert not any("dạ chào bác sĩ" in c.lower() for c in claims)

def test_self_rag_supported_claims_pass():
    verifier = SelfRagVerifier()
    evidence_content = (
        "Liều khuyến nghị là 4 mg perindopril erbumin uống một lần vào buổi sáng trước bữa ăn. "
        "Trong suy thận: ClCr 30 - 60 ml/phút dùng 2 mg/ngày. ClCr 15 - 30 ml/phút dùng 2 mg mỗi hai ngày."
    )
    retrieved = [_make_sample_chunk("Chỉ định & Liều lượng: Perindopril", evidence_content)]
    kg_data = {
        "graph_context_text": "Phân loại: Nhóm ức chế men chuyển (ACEI). Thay thế an toàn khi ho khan: Nhóm ARB.",
        "therapeutic_alternatives": [{"alternative_class": "ARB", "recommendation": "Đổi sang ARB (Losartan, Telmisartan) khi ho khan."}]
    }

    answer = (
        "Liều khuyến nghị là 4 mg perindopril uống một lần vào buổi sáng trước bữa ăn. "
        "Khi bệnh nhân bị ho khan do ACEI, khuyến cáo chuyển sang nhóm ARB như Losartan hoặc Telmisartan."
    )
    res = verifier.audit_and_critique(
        query="Bệnh nhân bị ho khan do Coversyl thì đổi sang nhóm nào?",
        answer=answer,
        retrieved_chunks=retrieved,
        kg_data=kg_data
    )

    assert res["factuality_score"] >= 0.8
    assert res["hallucination_rate"] <= 0.2
    assert res["critique_verdict"] == "PASS"
    assert "Đã đối soát" in res["audit_summary"]
    assert res["cleaned_answer"] is not None and len(res["cleaned_answer"]) > 0

def test_self_rag_unsupported_hallucinated_dosage():
    verifier = SelfRagVerifier()
    evidence_content = (
        "Liều khuyến nghị là 4 mg perindopril một lần mỗi ngày. Liều tối đa 8 mg/ngày."
    )
    retrieved = [_make_sample_chunk("Perindopril", evidence_content)]
    kg_data = {}

    # Hallucinated dosage: 500 mg perindopril 4 lần/ngày
    hallucinated_answer = (
        "Perindopril nên uống với liều 500 mg mỗi lần, dùng 4 lần/ngày để đạt hiệu quả tối đa."
    )
    res = verifier.audit_and_critique(
        query="Liều dùng Perindopril là bao nhiêu?",
        answer=hallucinated_answer,
        retrieved_chunks=retrieved,
        kg_data=kg_data
    )

    assert res["factuality_score"] < 0.5
    assert res["hallucination_rate"] > 0.5
    assert res["critique_verdict"] == "REJECT"

def test_self_rag_fatal_contradiction_detection():
    # Test 1: Metformin in severe renal failure
    contra1 = _detect_safety_contradictions(
        "Bệnh nhân có ClCr dưới 30 ml/phút có thể uống Metformin 1000mg bình thường.",
        "Bệnh nhân đái tháo đường kèm suy thận ClCr dưới 30 thì dùng Metformin được không?"
    )
    assert contra1 is not None
    assert "Lactic Acidosis" in contra1

    # Test 2: Safe statement should NOT be flagged as contradiction
    contra2 = _detect_safety_contradictions(
        "Bệnh nhân có ClCr dưới 30 ml/phút chống chỉ định tuyệt đối Metformin do nguy cơ nhiễm toan Lactic.",
        "Bệnh nhân đái tháo đường kèm suy thận ClCr dưới 30"
    )
    assert contra2 is None

    # Test 3: Macrolide + Statin contradiction
    contra3 = _detect_safety_contradictions(
        "Phối hợp kháng sinh Clarithromycin nhóm Macrolid với Simvastatin nhóm Statin rất an toàn và không có tương tác.",
        "Macrolid phối hợp với Statin có nguy cơ gì?"
    )
    assert contra3 is not None
    assert "Rhabdomyolysis" in contra3

@pytest.mark.asyncio
async def test_self_rag_pipeline_integration():
    q = "Kháng sinh nhóm Macrolid phối hợp với Statin có nguy cơ gì?"
    res = await execute_clinical_rag(q)
    assert res.rag_grounded is True
    assert hasattr(res, "factuality_score")
    assert res.factuality_score >= 0.7
    assert res.critique_verdict in ("PASS", "CAUTION")
    assert res.answer is not None and len(res.answer) > 0
    resp_dict = res.to_response_dict()
    assert "factuality_score" in resp_dict
    assert "critique_verdict" in resp_dict
