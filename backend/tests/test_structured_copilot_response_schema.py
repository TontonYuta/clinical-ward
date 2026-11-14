"""
Kiểm thử tự động hợp đồng Schema Đầu Ra Cấu Trúc (Structured Output Schema Contract) của Chatbot.
Xác minh 100% đầu ra tuân thủ nghiêm ngặt Schema Pydantic: clinical_summary, clinical_data, citations.
"""
import pytest
from app.database import AsyncSessionLocal
from app.schemas.copilot import (
    CopilotQuery,
    CopilotResponse,
    ClinicalSummary,
    StructuredClinicalPayload,
)
from app.services.copilot_drug_lookup import lookup_drug_authoritative


@pytest.mark.asyncio
async def test_structured_output_schema_for_medication_field():
    """Kiểm tra phản hồi tra cứu trường thông tin thuốc có đầy đủ cấu trúc JSON schema."""
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("liều dùng paracetamol cho người lớn", db, user_name="BS. Hùng", user_role="doctor")
        
        # 1. Kiểm tra đối tượng phản hồi cấp cao nhất
        assert isinstance(resp, CopilotResponse)
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.rag_grounded is True
        
        # 2. Kiểm tra khối Tóm tắt lâm sàng (ClinicalSummary)
        assert resp.clinical_summary is not None
        assert isinstance(resp.clinical_summary, ClinicalSummary)
        assert len(resp.clinical_summary.headline) > 5
        assert len(resp.clinical_summary.key_takeaway) > 10
        assert resp.clinical_summary.urgency in ("routine", "warning", "emergency")
        
        # 3. Kiểm tra khối Dữ liệu lâm sàng có cấu trúc (StructuredClinicalPayload)
        assert resp.clinical_data is not None
        assert isinstance(resp.clinical_data, StructuredClinicalPayload)
        
        # 3.1 Định danh thuốc
        assert resp.clinical_data.drug_identity is not None
        assert resp.clinical_data.drug_identity.brand_name.lower() == "paracetamol"
        
        # 3.2 Ma trận liều dùng
        assert resp.clinical_data.dosage_matrix is not None
        assert resp.clinical_data.dosage_matrix.adult is not None
        assert len(resp.clinical_data.dosage_matrix.adult.standard_dose or "") > 5
        
        # 4. Kiểm tra Serialization thành JSON chuẩn
        json_dict = resp.model_dump()
        assert "clinical_summary" in json_dict
        assert "clinical_data" in json_dict
        assert json_dict["clinical_summary"]["headline"] == resp.clinical_summary.headline
        assert json_dict["clinical_data"]["drug_identity"]["brand_name"] == "Paracetamol"


@pytest.mark.asyncio
async def test_structured_output_schema_for_drug_overview():
    """Kiểm tra phản hồi tóm tắt thuốc (Overview) có cấu trúc đầy đủ."""
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("paracetamol", db, user_name="Bác sĩ", user_role="doctor")
        assert resp.clinical_summary is not None
        assert resp.clinical_data is not None
        assert resp.clinical_data.drug_identity.brand_name == "Paracetamol"
        assert isinstance(resp.clinical_data.indications, list)
        assert isinstance(resp.clinical_data.contraindications, list)


@pytest.mark.asyncio
async def test_structured_output_schema_for_ddi():
    """Kiểm tra phản hồi tương tác thuốc (DDI) có cấu trúc ddi_findings chuẩn chỉnh."""
    from app.services.clinical_ddi_engine.multi_drug_matrix import format_multi_ddi_response
    
    resp = format_multi_ddi_response(["Clopidogrel", "Omeprazol"], "Tương tác Clopidogrel và Omeprazol")
    assert isinstance(resp, CopilotResponse)
    assert resp.clinical_summary is not None
    assert resp.clinical_summary.urgency in ("warning", "emergency")
    assert resp.clinical_data is not None
    assert len(resp.clinical_data.ddi_findings) >= 1
    
    finding = resp.clinical_data.ddi_findings[0]
    assert finding.drug_a.lower() in ("clopidogrel", "omeprazol")
    assert finding.drug_b.lower() in ("clopidogrel", "omeprazol")
    assert finding.severity in ("critical", "warning")
    assert finding.clinical_action is not None


@pytest.mark.asyncio
async def test_structured_output_schema_for_safe_abstention():
    """Kiểm tra luồng từ chối an toàn (Safe Abstention) có abstention_details chuẩn cấu trúc."""
    from starlette.requests import Request
    from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
    from app.services.session_context import get_or_create_session
    
    session = get_or_create_session("test_abstention_session", "Bác sĩ", "doctor")
    req = Request(scope={"type": "http", "headers": []})
    
    # Truy vấn thuốc hoàn toàn không có trong danh mục
    query_payload = CopilotQuery(
        query="Thuốc FakeDrugXYZ123 liều dùng thế nào",
        user_name="BS. Nam",
        user_role="doctor",
        session_id="test_abstention_session"
    )
    
    async with AsyncSessionLocal() as db:
        resp = await handle_copilot_chat(query_payload, req, db, session=session, history="")
        assert isinstance(resp, CopilotResponse)
        assert resp.answer_type in ("safe_abstention", "clarification")
        assert resp.clinical_summary is not None
        assert resp.clinical_data is not None
        if resp.clinical_data.abstention_details:
            assert resp.clinical_data.abstention_details.reason_code is not None
            assert isinstance(resp.clinical_data.abstention_details.professional_recommendations, list)


def test_reasoning_route_labels_grounded_reply_as_reference():
    import asyncio
    from unittest.mock import AsyncMock, patch
    from starlette.requests import Request
    from app.services.chatbot.copilot_orchestrator import handle_copilot_chat

    response = CopilotResponse(
        intent="PATIENT_CASE_REASONING", reply_text="Dữ kiện cho thấy cần đối chiếu chức năng thận.",
        answer_type="grounded_reference", rag_grounded=True,
        citations=[{"source": "Tài liệu", "legal_basis": "Tài liệu", "chunk_id": "reasoning-source"}],
        evidence=[{"evidence_id": "document:reasoning-source", "evidence_type": "document_chunk", "source_id": "doc", "source_version": "sha256:1", "chunk_id": "reasoning-source", "content": "Dữ kiện chức năng thận."}],
    )
    request = Request(scope={"type": "http", "headers": []})
    request.state.workflow_route = type("Route", (), {"intent": "PATIENT_CASE_REASONING"})()
    with patch("app.services.chatbot.copilot_orchestrator._handle_copilot_chat_core", new=AsyncMock(return_value=response)), \
         patch("app.services.chatbot.citation_standardizer.standardize_response_citations", side_effect=lambda value, _query: value), \
         patch("app.services.chatbot.copilot_orchestrator.validate_response_evidence_contract", side_effect=lambda value: value):
        result = asyncio.run(handle_copilot_chat(CopilotQuery(query="đánh giá dữ liệu"), request, None, session=None, history=""))

    assert "chỉ mang tính tham khảo" in result.reply_text.casefold()
    assert result.citations[0]["chunk_id"] == "reasoning-source"



