"""
Unit & Integration Tests for PaperQA2 Claim-Level Evidence Synthesis & Hallucination-Shield.
Paper: Language agents achieve superhuman synthesis of scientific knowledge (Future-House & Nature, 2024 / arXiv:2409.13740)
Repo: Future-House/paper-qa (9.5k stars)
"""
import pytest
from app.services.rag.paperqa_synthesizer import (
    synthesize_grounded_clinical_response,
    verify_and_purge_unsupported_claims,
    PaperQASynthesisResult,
    ClaimCitation,
)

def test_claim_verification_purges_unsupported_hallucinations():
    """Kiểm tra bộ lọc PaperQA2 Claim Verifier: tự động gạch bỏ câu khẳng định bịa đặt ngoài CSDL."""
    ground_truth_context = (
        "Perindopril uống một lần vào buổi sáng lúc đói. "
        "Thuốc điều trị tăng huyết áp và suy tim. "
        "Chống chỉ định phù mạch do ức chế enzym chuyển."
    )
    
    # Text do LLM sinh ra: Có 2 câu đúng, và 1 câu bịa đặt (uống cùng nước bưởi chùm gây ngộ độc)
    raw_llm_text = (
        "Nên uống Coversyl vào buổi sáng lúc đói trước bữa ăn [DĐVN V, Trang 1131]. "
        "Thuốc được chỉ định trong điều trị tăng huyết áp và suy tim [DĐVN V, Trang 1131]. "
        "Tuyệt đối không được uống thuốc cùng với nước bưởi chùm vì sẽ gây hoại tử tế bào gan cấp tính."
    )

    verified_text, claims = verify_and_purge_unsupported_claims(raw_llm_text, ground_truth_context)
    
    # Câu bịa đặt về nước bưởi chùm không có trong ground_truth_context phải bị loại bỏ
    assert "buổi sáng lúc đói" in verified_text
    assert "tăng huyết áp" in verified_text
    assert "hoại tử tế bào gan" not in verified_text
    assert len(claims) >= 2
    assert all(c.is_verified for c in claims)

@pytest.mark.asyncio
async def test_paperqa_dosage_synthesis(monkeypatch):
    """TC-02: Tính toán liều dùng nhi khoa chính xác kèm thẻ trích dẫn provenance."""
    async def mock_dosage_llm(*args, **kwargs):
        return (
            "Đối với trẻ em 15kg bị sốt 39°C, liều dùng Paracetamol khuyến cáo là **150 mg – 225 mg/lần** "
            "(tương ứng 10 - 15 mg/kg), dùng cách mỗi 4 - 6 giờ khi cần; không quá 4 lần/ngày "
            "và liều tối đa không vượt quá 900 mg/ngày (60 mg/kg/ngày) [DĐVN V, Trang 1118].\n\n"
            "• Lưu ý: Bổ sung đủ nước điện giải và theo dõi sát triệu chứng."
        )

    from app.services.rag import paperqa_synthesizer
    monkeypatch.setattr(paperqa_synthesizer, "_call_llm_synthesis", mock_dosage_llm)

    user_query = "Trẻ em 15kg sốt 39 độ uống Paracetamol thế nào?"
    monograph_context = (
        "Tên hoạt chất: Paracetamol. "
        "Chỉ định: Hạ sốt, giảm đau từ nhẹ đến vừa. "
        "Liều dùng trẻ em: 10 - 15 mg/kg mỗi lần, cách 4 - 6 giờ một lần; tối đa 60 mg/kg/ngày. "
        "Nguồn: Dược thư Quốc gia Việt Nam 2015, Trang 1118."
    )

    res = await synthesize_grounded_clinical_response(
        query=user_query,
        evidence_context=monograph_context,
        source_label="DĐVN V, Trang 1118",
        user_role="doctor",
        api_key="mock_valid_api_key_test"
    )

    assert isinstance(res, PaperQASynthesisResult)
    lower_ans = res.conversational_answer.lower()
    assert any(k in lower_ans for k in ("150", "225", "10 - 15 mg/kg", "10-15 mg/kg"))
    assert "1118" in res.conversational_answer or len(res.citations) >= 1
    assert res.grounded_confidence >= 0.85
    assert res.source_status == "exact_match"

@pytest.mark.asyncio
async def test_paperqa_timing_specific_answer(monkeypatch):
    """TC-01: Đi thẳng vào trọng tâm thời điểm uống thuốc (sáng hay tối), không dump Fact sheet 40 dòng."""
    async def mock_timing_llm(*args, **kwargs):
        return (
            "Thuốc **Coversyl** nên được uống vào **buổi sáng, lúc đói (trước bữa ăn)** [DĐVN V, Trang 1131].\n\n"
            "• **Lý do lâm sàng:** Thức ăn trong dạ dày làm chậm và giảm đáng kể mức độ chuyển hóa của "
            "tiền chất Perindopril thành dạng có hoạt tính perindoprilat trong tuần hoàn máu."
        )

    from app.services.rag import paperqa_synthesizer
    monkeypatch.setattr(paperqa_synthesizer, "_call_llm_synthesis", mock_timing_llm)

    user_query = "Coversyl nên uống sáng hay tối?"
    monograph_context = (
        "Tên thuốc: Coversyl (Perindopril arginine + Amlodipin besilate). "
        "Cách dùng: Perindopril thường được cho uống một lần vào buổi sáng, lúc đói (trước bữa ăn) "
        "do thức ăn làm giảm chuyển hóa thuốc thành perindoprilat có hoạt tính. "
        "Nguồn: Dược thư Quốc gia Việt Nam 2015, Trang 1131."
    )

    res = await synthesize_grounded_clinical_response(
        query=user_query,
        evidence_context=monograph_context,
        source_label="DĐVN V, Trang 1131",
        user_role="doctor",
        api_key="mock_valid_api_key_test"
    )

    assert isinstance(res, PaperQASynthesisResult)
    lower_ans = res.conversational_answer.lower()
    assert "buổi sáng" in lower_ans
    assert "đói" in lower_ans or "trước" in lower_ans
    assert len(res.conversational_answer.split("\n")) <= 15

@pytest.mark.asyncio
async def test_paperqa_contraindicated_ddi_warning_first(monkeypatch):
    """TC-03: Cảnh báo tương tác chống chỉ định nguy hiểm lên hàng đầu."""
    async def mock_ddi_llm(*args, **kwargs):
        return (
            "⚠️ **CẢNH BÁO NGUY HIỂM: NGUY CƠ XUẤT HUYẾT TIÊU HÓA NGHIÊM TRỌNG** [QĐ 5948, Bảng 3.1]\n\n"
            "Tuyệt đối không nên phối hợp **Warfarin** với **Ibuprofen (NSAID)** vì gây tác động cộng hưởng kép: "
            "Ibuprofen làm tổn thương trợt loét niêm mạc dạ dày và ức chế tiểu cầu, kết hợp tác dụng chống đông của Warfarin "
            "dẫn đến xuất huyết tiêu hóa ồ ạt khó kiểm soát. Bác sĩ nên dùng Paracetamol để hạ sốt/giảm đau thay thế."
        )

    from app.services.rag import paperqa_synthesizer
    monkeypatch.setattr(paperqa_synthesizer, "_call_llm_synthesis", mock_ddi_llm)

    user_query = "Warfarin phối hợp với Ibuprofen có sao không?"
    ddi_context = (
        "Cặp thuốc: Warfarin + Ibuprofen (NSAID). "
        "Mức độ: Chống chỉ định phối hợp hoặc cảnh báo mức độ 1 nguy cơ xuất huyết nặng. "
        "Cơ chế: Tác động cộng hưởng kép gây trợt loét niêm mạc đường tiêu hóa và ức chế tiểu cầu. "
        "Hậu quả: Xuất huyết tiêu hóa ồ ạt, kéo dài INR khó kiểm soát. "
        "Xử trí: Thay thế giảm đau bằng Paracetamol. "
        "Nguồn: Quyết định 5948/QĐ-BYT, Bảng 3.1 & 3.2."
    )

    res = await synthesize_grounded_clinical_response(
        query=user_query,
        evidence_context=ddi_context,
        source_label="QĐ 5948/QĐ-BYT",
        user_role="doctor",
        api_key="mock_valid_api_key_test"
    )

    assert isinstance(res, PaperQASynthesisResult)
    first_lines = res.conversational_answer.split("\n")[:4]
    first_text = " ".join(first_lines).lower()
    assert any(k in first_text for k in ("xuất huyết", "chống chỉ định", "nguy hiểm", "nguy cơ"))

@pytest.mark.asyncio
async def test_paperqa_failsafe_fallback_on_network_timeout(monkeypatch):
    """TC-05: Khi gặp sự cố mạng hoặc timeout, hệ thống trả về evidence gốc an toàn."""
    async def mock_failing_gemini(*args, **kwargs):
        raise TimeoutError("Simulated LLM network timeout")

    from app.services.rag import paperqa_synthesizer
    monkeypatch.setattr(paperqa_synthesizer, "_call_llm_synthesis", mock_failing_gemini)

    context = "Dữ liệu CSDL Dược Thư: Paracetamol 500mg uống cách 4-6h."
    res = await synthesize_grounded_clinical_response(
        query="Liều Paracetamol",
        evidence_context=context,
        source_label="DĐVN V",
        user_role="doctor",
        api_key="mock_valid_api_key_test"
    )

    assert res.conversational_answer == context
    assert res.has_unverified_claims is False
    assert res.grounded_confidence <= 0.70
