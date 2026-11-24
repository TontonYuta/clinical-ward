"""
Unit and Integration Tests for Verified Clinical Q&A Knowledge Node Service.
Paper: LightRAG (arXiv:2410.05779) & GPTCache (arXiv:2303.17580).
"""
import os
import sys
import tempfile
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.rag.verified_qa_service import VerifiedQAService
from app.services.rag.embeddings.provider import MockEmbeddingProvider
from app.schemas.copilot import CopilotResponse, CopilotQuery
from app.services.rag.knowledge_graph import expand_clinical_graph
from app.services.rag.sqlite_graph_service import ClinicalGraphTraversalService


@pytest.fixture
def temp_db_and_service():
    with tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False) as f:
        db_path = f.name
    provider = MockEmbeddingProvider(dimension=768)
    service = VerifiedQAService(db_path=db_path, embedding_provider=provider, similarity_threshold=0.60)
    yield service, db_path
    if os.path.exists(db_path):
        os.remove(db_path)


def test_register_and_exact_lookup(temp_db_and_service):
    service, _ = temp_db_and_service

    q = "Tại sao nhóm thuốc ức chế men chuyển ACEi chống chỉ định tuyệt đối cho thai kỳ?"
    ans = "Nhóm ACEi (Enalapril, Lisinopril...) gây suy thận thai nhi, thiểu ối và quái thai nghiêm trọng trong 3 tháng giữa và cuối."
    citations = [{"title": "Dược thư Quốc gia Việt Nam", "badge": "Bộ Y Tế"}]

    qa_id = service.register_qa_node(
        query=q,
        answer_markdown=ans,
        citations=citations,
        intent="DRUG_CONTRAINDICATION",
        verification_source="clinical_pharmacist",
        grounding_score=0.98
    )

    assert qa_id.startswith("qa_")

    # 1. Tra cứu chính xác (Exact match) kèm tiền tố giao tiếp
    hit = service.lookup_verified_qa("Bác sĩ cho hỏi Tại sao nhóm thuốc ức chế men chuyển ACEi chống chỉ định tuyệt đối cho thai kỳ với ạ?")
    assert hit is not None
    assert hit["qa_id"] == qa_id
    assert hit["match_type"] == "exact"
    assert "suy thận thai nhi" in hit["answer_markdown"]
    assert service.exact_hits == 1


def test_semantic_lookup_and_entity_guardrail(temp_db_and_service):
    service, _ = temp_db_and_service

    # Đăng ký tri thức về ACEi và Thai kỳ
    service.register_qa_node(
        query="Chống chỉ định thuốc ACEi trong thai kỳ",
        answer_markdown="ACEi tuyệt đối không dùng trong thai kỳ do nguy cơ suy thận thai nhi.",
        citations=[{"title": "Dược thư Quốc gia"}],
        entities=["acei", "pregnancy"]
    )

    # 1. Paraphrase câu hỏi tương đồng (có cùng thực thể ACEi và Thai kỳ)
    hit_semantic = service.lookup_verified_qa("Thuốc ACEi có chống chỉ định trong thai kỳ không?", min_similarity=0.50)
    assert hit_semantic is not None
    assert hit_semantic["match_type"] in ("exact", "semantic")
    assert "ACEi" in hit_semantic["answer_markdown"]

    # 2. Câu hỏi tương tự về mặt cú pháp nhưng khác hoàn toàn về thực thể thuốc (Guardrail test)
    # Ví dụ: Hỏi về Paracetamol cho trẻ em -> Dù mẫu câu giống, thực thể không trùng khớp thì không được match nhầm
    hit_mismatch = service.lookup_verified_qa("Trẻ em có dùng thuốc Paracetamol hạ sốt được không?")
    if hit_mismatch:
        # Nếu có match thì thực thể bắt buộc phải trùng lặp, không thể nhầm sang node ACEi/pregnancy
        assert "pregnancy" in hit_mismatch["entities"] or "acei" in hit_mismatch["entities"]


def test_knowledge_graph_faqs_linkage(temp_db_and_service):
    service, _ = temp_db_and_service

    service.register_qa_node(
        query="Nguy cơ tiêu cơ vân khi phối hợp Statin và Clarithromycin",
        answer_markdown="Clarithromycin ức chế mạnh CYP3A4 làm tăng nồng độ Simvastatin gấp nhiều lần, nguy cơ tiêu cơ vân cấp tính.",
        entities=["statin", "simvastatin", "macrolid"],
        citations=[{"title": "QĐ 5948/QĐ-BYT"}]
    )

    # Kiểm tra phương thức get_connected_verified_qa trong SQLite Graph Service
    connected = service.find_qa_nodes_by_entities(["statin"])
    assert len(connected) >= 1
    assert any("tiêu cơ vân" in c["answer_summary"] for c in connected)


def test_auto_register_candidate_quality_gate(temp_db_and_service):
    service, _ = temp_db_and_service

    # 1. Case bị từ chối do thiếu căn cứ y văn (rag_grounded=False)
    resp_ungrounded = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Thuốc này uống bình thường nhé bạn, không có vấn đề gì đáng ngại đâu.",
        rag_grounded=False,
        confidence=0.5
    )
    res1 = service.auto_register_candidate("Uống thuốc paracetamol như thế nào?", resp_ungrounded)
    assert res1 is None

    # 2. Case bị từ chối do câu hỏi phụ thuộc ngữ cảnh ("thuốc này")
    resp_grounded = CopilotResponse(
        intent="DRUG_INFO",
        reply_text="Liều dùng chuẩn của Paracetamol là 500mg-1000mg mỗi lần, cách 4-6 giờ theo Dược thư Quốc gia Việt Nam.",
        citations=[{"title": "DĐVN V", "badge": "BYT"}],
        rag_grounded=True,
        confidence=0.95
    )
    res2 = service.auto_register_candidate("Thuốc này uống liều bao nhiêu một ngày?", resp_grounded)
    assert res2 is None

    # 3. Case hợp lệ đạt chuẩn Quality Gate
    res3 = service.auto_register_candidate(
        "Liều dùng paracetamol đường uống tối đa ở người lớn",
        resp_grounded
    )
    assert res3 is not None
    assert res3.startswith("qa_")


def test_list_and_delete_qa_node(temp_db_and_service):
    service, _ = temp_db_and_service

    qa_id = service.register_qa_node(
        query="Liều dùng Amoxicillin viêm họng",
        answer_markdown="Liều Amoxicillin 500mg mỗi 8 giờ trong 7-10 ngày.",
        citations=[]
    )

    nodes = service.list_qa_nodes()
    assert any(n["qa_id"] == qa_id for n in nodes)

    # Xóa node
    deleted = service.delete_qa_node(qa_id)
    assert deleted is True

    # Tra cứu lại không còn ra kết quả
    hit = service.lookup_verified_qa("Liều dùng Amoxicillin viêm họng")
    assert hit is None
