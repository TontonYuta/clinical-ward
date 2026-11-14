"""
Test kiểm chứng câu hỏi Paracetamol tích hợp toàn diện SOTA RAG & PaperQA2 Evidence Synthesis.
Loại bỏ hoàn toàn template cứng tĩnh và chuỗi cắt cụt '...'.
"""
import re
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
        assert any(term in resp.reply_text.lower() for term in ("liều dùng cho trẻ em", "liều dùng trẻ em"))
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
        assert re.search(r"\[Dược thư tr\.111[89]\]", resp.reply_text)
        assert len(re.findall(r"\[Dược thư tr\.111[89]\]", resp.reply_text)) == 1, "Nguồn chỉ được đính kèm đúng 1 lần ở cuối cụm thông tin"
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


@pytest.mark.asyncio
async def test_paracetamol_indications_and_dosage_both_returned():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative(
            "Chỉ định và liều dùng của Paracetamol",
            db,
            user_name="Bác sĩ",
            user_role="doctor",
        )

        assert resp.answer_type == "medication_fields"
        assert resp.rag_grounded is True
        assert "Chỉ định" in resp.reply_text
        assert "Liều dùng người lớn" in resp.reply_text


@pytest.mark.asyncio
async def test_structured_requested_fields_drive_lookup_without_query_keywords():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative(
            "Paracetamol",
            db,
            user_name="Bác sĩ",
            user_role="doctor",
            requested_fields=["indications", "adult_dosage"],
        )

        assert resp.answer_type == "medication_fields"
        assert "Chỉ định" in resp.reply_text
        assert "Liều dùng người lớn" in resp.reply_text


@pytest.mark.asyncio
async def test_structured_requested_field_without_matching_source_abstains():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative(
            "Paracetamol", db, user_name="Bác sĩ", user_role="doctor",
            requested_fields=["monitoring"],
        )

        assert resp.answer_type == "safe_abstention"
        assert resp.rag_grounded is False
        assert resp.citations == []
        assert resp.evidence == []


@pytest.mark.asyncio
async def test_unknown_drug_without_local_source_returns_safe_abstention():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative(
            "Thuốc Zorvexal-unknown-98431 có chỉ định gì?", db,
            session_id="unknown-drug-no-source-regression",
            user_name="Bác sĩ", user_role="doctor",
        )

    assert resp.answer_type == "safe_abstention"
    assert resp.rag_grounded is False
    assert resp.citations == []
    assert resp.evidence == []
    assert "chưa" in resp.reply_text.casefold() or "không" in resp.reply_text.casefold()


@pytest.mark.asyncio
async def test_empty_local_drug_resolution_does_not_call_empty_profile_formatter(monkeypatch):
    from types import SimpleNamespace
    from app.services import copilot_drug_lookup

    matcher = SimpleNamespace(
        extract_sdk=lambda _query: "",
        extract_medications=lambda _query: [],
        fuzzy_candidate_search=lambda _term, top_k=1: [],
    )
    monkeypatch.setattr(copilot_drug_lookup, "get_drug_lexical_matcher", lambda: matcher)
    monkeypatch.setattr(copilot_drug_lookup, "extract_drug_keywords", lambda _query: "unregistered-drug-identifier")
    monkeypatch.setattr(copilot_drug_lookup, "build_drug_profile_response", lambda *args, **kwargs: pytest.fail("empty results must not be formatted as a drug profile"))
    monkeypatch.setattr("app.services.chatbot.conversational_clinical_engine.find_clinical_specialty_consultation", lambda _query: None)

    async def no_crag(**_kwargs):
        return None

    monkeypatch.setattr("app.services.chatbot.corrective_rag.evaluate_crag_tripartite", no_crag)
    async with AsyncSessionLocal() as db:
        resp = await copilot_drug_lookup.lookup_drug_authoritative(
            "unregistered-drug-identifier overview",
            db,
            session_id="forced-empty-drug-resolution",
            user_name="Bác sĩ",
            user_role="doctor",
        )

    assert resp.answer_type == "safe_abstention"
    assert resp.rag_grounded is False
    assert resp.citations == []
    assert resp.evidence == []


@pytest.mark.asyncio
async def test_field_response_evidence_is_limited_to_requested_field():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative(
            "Dấu hiệu quá liều Theophylline và cách xử trí khẩn cấp?", db,
            user_name="Bác sĩ", user_role="doctor",
            requested_fields=["overdose_treatment"],
        )

        assert resp.answer_type == "medication_field"
        assert len(resp.citations) == 1
        assert resp.citations[0].get("section") == "overdose_treatment"
        assert len(resp.evidence) == 1
        assert resp.evidence[0].get("section") == resp.citations[0].get("section")
        assert resp.evidence[0].get("content")
        assert resp.citations[0].get("source_id") == "data/knowledge_base/dtqg_monographs_extracted.json"
        assert resp.citations[0].get("source_version", "").startswith("sha256:")
        assert resp.evidence[0].get("source_id") == resp.citations[0].get("source_id")
        assert resp.evidence[0].get("source_version") == resp.citations[0].get("source_version")


@pytest.mark.asyncio
async def test_unknown_requested_field_abstains_instead_of_returning_unrelated_content():
    async with AsyncSessionLocal() as db:
        resp = await lookup_drug_authoritative(
            "Theophylline", db, user_name="Bác sĩ", user_role="doctor",
            requested_fields=["unknown_clinical_facet"],
        )

        assert resp.answer_type == "safe_abstention"
        assert resp.rag_grounded is False
        assert resp.citations == []
        assert resp.evidence == []
