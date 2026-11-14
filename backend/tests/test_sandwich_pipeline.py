"""
Kiểm thử Toàn Diện Kiến Trúc Sandwich Pipeline (NLU -> DB Retrieval -> Controlled Synthesis -> Guardrails)
Đo lường độ chính xác (Grounding Accuracy) và hiệu năng (Latency).
"""
import pytest
import time
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import AsyncSessionLocal
from app.services.chatbot.sandwich_pipeline import (
    parse_clinical_prompt_nlu,
    retrieve_ground_truth_context,
    synthesize_persona_optimized_output,
    execute_clinical_sandwich_pipeline
)
from app.schemas.copilot import CopilotResponse
from app.services.chatbot.copilot_orchestrator import validate_response_evidence_contract

@pytest.mark.asyncio
async def test_sandwich_nlu_parsing_styles():
    """Kiểm thử Pha 1: Bóc tách thực thể thuốc và phong cách tối ưu hóa người dùng."""
    # 1. Phong cách Bác sĩ
    res_doc = await parse_clinical_prompt_nlu("Tóm tắt súc tích liều dùng Paracetamol", "doctor")
    assert "paracetamol" in res_doc["primary_drug"].lower()
    assert res_doc["style"] in ("concise_summary", "doctor_brief")

    # 2. Phong cách Dặn dò Người bệnh / Người nhà
    res_patient = await parse_clinical_prompt_nlu("Dặn dò bệnh nhân uống Paracetamol thế nào cho người nhà dễ hiểu", "nurse")
    assert "paracetamol" in res_patient["primary_drug"].lower()
    assert res_patient["style"] == "patient_guidance"

    # 3. Phong cách Điều dưỡng checklist
    res_nurse = await parse_clinical_prompt_nlu("Lưu ý dùng thuốc Morphin cho ca trực", "nurse")
    assert "morphin" in res_nurse["primary_drug"].lower()
    assert res_nurse["style"] == "nurse_checklist"

@pytest.mark.asyncio
async def test_sandwich_ground_truth_db_retrieval():
    """Kiểm thử Pha 2: Đọc thông tin thẩm định từ CSDL Dược thư & Cục QLD."""
    async with AsyncSessionLocal() as db:
        nlu_data = {"primary_drug": "Paracetamol", "style": "doctor_brief"}
        gt = await retrieve_ground_truth_context(nlu_data, db)

        assert gt["found"] is True
        assert gt["drug"] is not None
        assert "paracetamol" in gt["drug"].active_ingredient.lower()
        assert len(gt["context_text"]) > 100
        assert len(gt["citations"]) >= 1
        assert "dược thư quốc gia" in gt["legal_basis"].lower() or "cục quản lý dược" in gt["legal_basis"].lower()

@pytest.mark.asyncio
async def test_sandwich_controlled_synthesis_safety():
    """Kiểm thử Pha 3 & 4: Tổng hợp có kiểm soát & Rào chắn an toàn (Guardrails)."""
    async with AsyncSessionLocal() as db:
        nlu_data = {"primary_drug": "Paracetamol", "style": "patient_guidance"}
        gt = await retrieve_ground_truth_context(nlu_data, db)
        assert gt["found"] is True

        start_time = time.perf_counter()
        synth_output = await synthesize_persona_optimized_output(
            query="Dặn dò người nhà cách dùng Paracetamol",
            ground_truth=gt,
            user_role="nurse",
            user_name="ĐD. Lê Thị Thu",
            nlu_data=nlu_data,
            api_key=None  # Test deterministic fallback
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        assert len(synth_output) > 50
        assert "Chống chỉ định" in synth_output or "Thận trọng" in synth_output
        assert "Paracetamol" in synth_output or gt["drug"].brand_name in synth_output
        # Đảm bảo tốc độ xử lý template dưới 50ms
        assert elapsed_ms < 50.0

@pytest.mark.asyncio
async def test_sandwich_end_to_end_pipeline():
    """Kiểm thử Tích Hợp Toàn Bộ Pipeline từ A-Z với Database."""
    async with AsyncSessionLocal() as db:
        query = "Bác sĩ giải thích ngắn gọn cách dùng Paracetamol cho người nhà bệnh nhân"
        resp = await execute_clinical_sandwich_pipeline(
            query=query,
            user_role="doctor",
            user_name="BS. Trần Văn Hùng",
            session_id="test_sandwich_session_1",
            db=db
        )

        assert resp is not None
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.rag_grounded is True
        assert resp.answer_type == "medication_profile"
        assert len(resp.citations) >= 1
        assert len(resp.suggested_chips) >= 1
        assert "dược thư quốc gia" in resp.legal_basis.lower() or "cục qld" in resp.legal_basis.lower()
        assert len(resp.reply_text) > 80


def test_sandwich_database_response_is_not_verified_without_attached_provenance():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE", reply_text="clinical claim",
        answer_type="medication_profile", source_status="grounded_sandwich_synthesis",
        rag_grounded=True, confidence=1.0, citations=[{"document_id": "dav-registry"}], evidence=[],
    )

    validated = validate_response_evidence_contract(response)

    assert validated.answer_type == "safe_abstention"
    assert validated.rag_grounded is False
    assert validated.confidence == 0.0
