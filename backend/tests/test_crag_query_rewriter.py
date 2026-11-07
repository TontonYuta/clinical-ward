"""
Unit & Integration Tests for CRAG Clinical Query Rewriter & Multi-turn De-contextualization.
Paper: Corrective Retrieval Augmented Generation (CRAG - Yan et al., 2024 / arXiv:2401.15884)
Repo: HuskyInSalt/CRAG & LangGraph Agentic Workflows
"""
import pytest
from app.services.rag.query_rewriter import (
    rewrite_clinical_query,
    ClinicalRewriteResult,
    assess_query_complexity,
)

@pytest.mark.asyncio
async def test_passthrough_for_independent_complete_queries():
    """TC-05: Câu hỏi độc lập hoàn chỉnh thì giữ nguyên (Idempotency)."""
    standalone_query = "Thông tin thuốc Teglutik"
    res = await rewrite_clinical_query(standalone_query, history="")
    assert isinstance(res, ClinicalRewriteResult)
    assert res.original_query == standalone_query
    # Với câu hỏi đã rõ ràng và không có history, query được giữ nguyên hoặc chuẩn hóa tương đương
    assert "Teglutik" in res.rewritten_query
    assert res.is_continuation is False

@pytest.mark.asyncio
async def test_ddi_continuation_rewriting():
    """TC-01: 'lấy 4 cặp nữa' sau khi xem tương tác thuốc."""
    history = (
        "Bác sĩ: lấy ví dụ cho tôi 3 cặp tương tác thuốc chống chỉ định\n"
        "Trợ lý: Dưới đây là 3 cặp tương tác: Simvastatin + Clarithromycin, Clopidogrel + Omeprazol, Methotrexat + NSAID"
    )
    res = await rewrite_clinical_query("lấy 4 cặp nữa", history=history)
    assert res.is_continuation is True
    lower_rewritten = res.rewritten_query.lower()
    assert any(k in lower_rewritten for k in ("tương tác", "chống chỉ định", "qđ 5948", "cặp"))
    assert "4" in res.rewritten_query or "bốn" in lower_rewritten

@pytest.mark.asyncio
async def test_dosage_continuation_rewriting():
    """TC-02: 'trẻ em thì dùng thế nào' sau khi hỏi Paracetamol."""
    history = (
        "Bác sĩ: Thông tin thuốc Paracetamol\n"
        "Trợ lý: Paracetamol là thuốc giảm đau, hạ sốt cho người lớn liều 500mg-1000mg"
    )
    res = await rewrite_clinical_query("trẻ em thì dùng thế nào", history=history)
    assert res.is_continuation is True
    assert "paracetamol" in res.rewritten_query.lower()
    assert any(k in res.rewritten_query.lower() for k in ("trẻ em", "nhi khoa", "liều"))

@pytest.mark.asyncio
async def test_pronoun_resolution_coversyl():
    """TC-03: 'nó có kỵ với thuốc hạ áp nào không' -> đại từ 'nó' thay bằng Coversyl."""
    history = (
        "Bác sĩ: Thông tin thuốc Coversyl\n"
        "Trợ lý: Coversyl là thuốc phối hợp Perindopril và Amlodipine điều trị tăng huyết áp"
    )
    res = await rewrite_clinical_query("nó có kỵ với thuốc hạ áp nào không", history=history)
    assert res.is_continuation is True
    lower = res.rewritten_query.lower()
    assert "coversyl" in lower or "perindopril" in lower
    assert any(k in lower for k in ("tương tác", "kỵ", "hạ áp", "huyết áp", "chống chỉ định"))

@pytest.mark.asyncio
async def test_mixed_capability_compound_query():
    """TC-04: Câu ghép 'Bạn có thể làm được gì Tôi muốn hỏi về thuốc Coversyl'."""
    res = await rewrite_clinical_query("Bạn có thể làm được gì Tôi muốn hỏi về thuốc Coversyl", history="")
    lower = res.rewritten_query.lower()
    assert "coversyl" in lower
    # Phải tập trung vào việc tra cứu thuốc Coversyl
    assert any(k in lower for k in ("thuốc", "coversyl", "thông tin", "chuyên luận"))

@pytest.mark.asyncio
async def test_failsafe_fallback_on_network_or_timeout(monkeypatch):
    """TC-06: Khi gặp sự cố mạng hoặc timeout, hệ thống fallback về câu gốc an toàn."""
    async def mock_failing_call(*args, **kwargs):
        raise TimeoutError("Simulated LLM network timeout")

    from app.services.rag import query_rewriter
    monkeypatch.setattr(query_rewriter, "_call_llm_rewriter", mock_failing_call)

    original = "bác sĩ bảo điều chỉnh thế nào trong ca bệnh tôi vừa nói"
    res = await rewrite_clinical_query(original, history="Bác sĩ: Ca bệnh tăng huyết áp")
    assert res.rewritten_query == original
    assert res.fallback_used is True
    assert res.confidence <= 0.60

@pytest.mark.asyncio
async def test_dynamic_entity_extraction_arbitrary_drug():
    """TC-07: Kiểm tra trích xuất động với thuốc bất kỳ không có trong danh sách hardcode cũ."""
    history = (
        "Bác sĩ: Tra cứu chuyên luận thuốc Venclexta\n"
        "Trợ lý: Venclexta (Venetoclax) là thuốc ức chế BCL-2 chỉ định trong bệnh bạch cầu mạn dòng lympho"
    )
    res = await rewrite_clinical_query("suy thận có uống được không", history=history)
    assert res.is_continuation is True
    lower = res.rewritten_query.lower()
    assert "venclexta" in lower or "venetoclax" in lower
    assert any(k in lower for k in ("suy thận", "thận", "chỉnh liều"))

@pytest.mark.asyncio
async def test_pronoun_resolution_arbitrary_inn():
    """TC-08: Đại từ 'nó' với thuốc bất kỳ không có trong mảng hardcode."""
    history = (
        "Bác sĩ: Liều dùng thuốc Remdesivir thế nào\n"
        "Trợ lý: Remdesivir là thuốc kháng virus dùng đường tiêm truyền"
    )
    res = await rewrite_clinical_query("nó có dùng cho trẻ em được không", history=history)
    assert res.is_continuation is True
    lower = res.rewritten_query.lower()
    assert "remdesivir" in lower
    assert "trẻ em" in lower
