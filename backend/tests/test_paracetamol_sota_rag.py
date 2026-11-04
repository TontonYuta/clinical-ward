"""
Test kiểm chứng câu hỏi Paracetamol tích hợp toàn diện SOTA RAG & PaperQA2 Evidence Synthesis.
Loại bỏ hoàn toàn template cứng tĩnh và chuỗi cắt cụt '...'.
"""
import pytest
from app.database import AsyncSessionLocal
from app.services.copilot_drug_lookup import lookup_drug_authoritative

@pytest.mark.asyncio
async def test_paracetamol_query_uses_sota_rag_not_static_template():
    """Kiểm tra câu hỏi 'paracetamol' đi qua SOTA RAG, rag_grounded=True, không có template cũ."""
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("paracetamol", db, user_name="Bác sĩ", user_role="doctor")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.rag_grounded is True, "Phản hồi Paracetamol phải được xác thực qua RAG (rag_grounded=True)"
        assert "### 📋 Tổng Quan Dược Lâm Sàng & An Toàn Thuốc" not in resp.reply_text, "Không được dùng template cứng cũ"
        assert "Kính gửi Bác sĩ" in resp.reply_text
        assert "Kết luận lâm sàng chính (Core Clinical Guidance)" in resp.reply_text
        assert "Cảnh báo an toàn quan trọng" in resp.reply_text
        assert len(resp.citations) > 0, "Bắt buộc phải có trích dẫn chứng cứ y văn"
        assert any("1118" in str(c.get("url") or "") or "1118" in str(c.get("legal_basis") or "") for c in resp.citations)

@pytest.mark.asyncio
async def test_paracetamol_dosage_field_uses_paperqa_synthesis():
    """Kiểm tra câu hỏi chi tiết 'paracetamol liều trẻ em' được PaperQA tổng hợp hội thoại chuẩn."""
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("paracetamol liều trẻ em", db, user_name="Bác sĩ", user_role="doctor")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.rag_grounded is True
        assert "Liều dùng trẻ em" in resp.reply_text
        assert "Kết luận lâm sàng chính (Core Clinical Guidance)" in resp.reply_text
        assert "Chi Tiết Hướng Dẫn" in resp.reply_text
        assert "Cảnh báo an toàn quan trọng" in resp.reply_text
