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
        assert "Chỉ định chính" in resp.reply_text
        assert "[Dược thư" in resp.reply_text
        assert "Kết luận lâm sàng chính (Core Clinical Guidance)" not in resp.reply_text
        assert len(resp.citations) > 0, "Bắt buộc phải có trích dẫn chứng cứ y văn"
        assert any("1118" in str(c.get("url") or "") or "1118" in str(c.get("legal_basis") or "") for c in resp.citations)

@pytest.mark.asyncio
async def test_paracetamol_dosage_field_uses_paperqa_synthesis():
    """Kiểm tra câu hỏi chi tiết 'paracetamol liều trẻ em' theo mô hình cụm thông tin phẳng & dẫn chứng trực tiếp."""
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("paracetamol liều trẻ em", db, user_name="Bác sĩ", user_role="doctor")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.rag_grounded is True
        assert "Liều dùng trẻ em" in resp.reply_text
        assert "[Dược thư" in resp.reply_text
        # Khẳng định loại bỏ hoàn toàn 3 tầng wrapper dư thừa
        assert "Kết luận lâm sàng chính (Core Clinical Guidance)" not in resp.reply_text
        assert "Chi Tiết Hướng Dẫn" not in resp.reply_text

@pytest.mark.asyncio
async def test_paracetamol_contraindications_flat_grounded():
    """Kiểm tra tra cứu chống chỉ định Paracetamol: phẳng, có dẫn chứng [Dược thư tr.1118] gắn 1 lần ở cuối cụm, 0% trùng lặp."""
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("chống chỉ định của Paracetamol", db, user_name="Bác sĩ", user_role="doctor")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.rag_grounded is True
        assert "Chống chỉ định" in resp.reply_text
        assert "[Dược thư tr.1118]" in resp.reply_text
        assert resp.reply_text.count("[Dược thư tr.1118]") == 1, "Nguồn chỉ được đính kèm đúng 1 lần ở cuối cụm thông tin"
        assert resp.reply_text.count("quá mẫn với paracetamol") == 1, "Tuyệt đối không lặp lại nội dung chống chỉ định nhiều lần"
        assert "Kết luận lâm sàng chính" not in resp.reply_text
        assert "Chi Tiết Hướng Dẫn" not in resp.reply_text
        assert "> [!WARNING]" not in resp.reply_text

@pytest.mark.asyncio
async def test_paracetamol_multi_field_flat_grounded():
    """Kiểm tra tra cứu đa trường: liều dùng và chống chỉ định, chỉ gắn duy nhất 1 nguồn ở cuối phản hồi."""
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative("liều dùng và chống chỉ định của Paracetamol", db, user_name="Bác sĩ", user_role="doctor")
        assert resp.intent == "MEDICATION_SAFETY_PROFILE"
        assert resp.rag_grounded is True
        assert "Liều dùng người lớn" in resp.reply_text
        assert "Chống chỉ định" in resp.reply_text
        assert "[Dược thư tr.1118]" in resp.reply_text
        assert resp.reply_text.count("[Dược thư tr.1118]") == 1, "Chỉ duy nhất 1 nguồn y văn ở cuối phản hồi"
        assert resp.reply_text.count("quá mẫn với paracetamol") == 1
        assert "Kết luận lâm sàng chính" not in resp.reply_text
