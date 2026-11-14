import pytest
import re
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.registry import DavNationalDrug, ClinicalDrugMonograph
from app.services.chatbot.conversational_clinical_engine import (
    build_fluent_drug_profile_response,
    format_hierarchical_dosage,
    format_hierarchical_special_populations
)
from app.services.copilot_drug_citation_helper import (
    format_clinical_text, format_flat_field_inquiry, split_clinical_chunks, smart_unfold_clinical_text,
)


@pytest.mark.asyncio
async def test_smart_unfold_and_fragment_prevention():
    """Kiểm tra smart_unfold_clinical_text không bị rách dòng do căn lề hay số liều."""
    sample = (
        "Đặt trực tràng: 0,5 - 1 g/lần, 4 - 6 giờ một lần, tối đa\n"
        "4 lần/ngày.\n"
        "Sơ sinh: 10 mg/kg cách\n"
        "4 - 6 giờ/lần; tối đa 30 mg/kg/24 giờ.\n"
        "Trẻ em cân nặng < 10 kg:.\n"
        "10 mg/kg cách 4 - 6 giờ/lần; tối đa 30 mg/kg/24 giờ.\n"
        "Trẻ em 12 - 18 tuổi:\n"
        "500 mg cách 4 - 6 giờ/lần.\n"
        "Đau Paracetamol được dùng điều trị đau nhẹ.\n"
        "Sốt Paracetamol thường được dùng hạ thân nhiệt."
    )
    unfolded = smart_unfold_clinical_text(sample)
    
    # Không được có rách dòng tại "tối đa" hay "cách"
    assert "tối đa." not in unfolded
    assert "cách." not in unfolded
    assert "tối đa 4 lần/ngày" in unfolded
    assert "10 mg/kg cách 4 - 6 giờ/lần" in unfolded
    assert "Trẻ em 12 - 18 tuổi: 500 mg cách 4 - 6 giờ/lần" in unfolded
    assert "Giảm đau: Paracetamol" in unfolded
    assert "Hạ sốt: Paracetamol" in unfolded
    assert "Đau Paracetamol" not in unfolded
    assert "Sốt Paracetamol" not in unfolded


def test_clinical_text_repairs_pdf_line_wrap_spaces_without_changing_content():
    raw = (
        "4 - 6giờ truyền một lần, liều tối đa là 4 g/ngày. Dưới 50 kg: Liều một lần là 15 mg/kg,\n"
        "cứ cách 4 - 6 giờ truyền một lần; tối đa là 60 mg/kg/ngày."
    )

    formatted = format_clinical_text(raw)

    assert "6 giờ" in formatted
    assert "15 mg/kg, cứ cách 4 - 6 giờ" in formatted
    assert "60 mg/kg/ngày" in formatted
    assert "CYP3A4" in format_clinical_text("CYP3A4")
    assert "B12" in format_clinical_text("B12")
    assert "..." not in formatted
    assert "…" not in formatted


def test_clinical_text_restores_missing_spaces_after_punctuation_and_percent():
    formatted = format_clinical_text("Nói chung,ceftriaxon tốt.Khoảng8% số người bệnh.")

    assert formatted == "Nói chung, ceftriaxon tốt. Khoảng 8% số người bệnh."


def test_summary_does_not_truncate_clinical_facts_mid_word():
    from app.services import copilot_drug_formatter

    source = open(copilot_drug_formatter.__file__, encoding="utf-8").read()
    assert "[:160]}..." not in source
    assert "[:90]}" not in source


def test_adult_dosage_uses_one_consistent_nested_list_format():
    raw_dosage = (
        "Liều uống thường dùng là 0,5 - 1 g/lần, 4 - 6 giờ một lần; tối đa là 4 g/ngày."
        " Đặt trực tràng: 0,5 - 1 g/lần, 4 - 6 giờ một lần, tối đa 4 lần/ngày."
        " Truyền tĩnh mạch trong 15 phút: Trên 50 kg: Liều một lần là 1 g, cứ cách 4 - 6 giờ truyền một lần."
        " Không được vượt quá liều tối đa 3 g/ngày ở bệnh nhân nghiện rượu."
    )
    dose_lines = format_hierarchical_dosage(raw_dosage, "", is_detailed=True, target_audience="adult")

    assert dose_lines[0].strip() == "- **Người lớn:**"
    assert all(line.strip().startswith("- " ) for line in dose_lines[1:])
    assert any("**Đường uống:**" in line for line in dose_lines)
    assert any("**Đặt trực tràng:**" in line for line in dose_lines)
    assert any("**Truyền tĩnh mạch (15 phút):**" in line for line in dose_lines)

    rendered = format_flat_field_inquiry(
        drug_name="Paracetamol 500mg",
        drug_inn="Paracetamol",
        field_data=[("adult_dosage", "Liều dùng người lớn", "\n".join(dose_lines))],
        source="Dược thư tr.1118",
    )
    assert rendered.count("**Người lớn:**") == 1
    assert "+ **" not in rendered
    assert "\n  - **Đường uống:**" in rendered


@pytest.mark.asyncio
async def test_paracetamol_detail_profile_no_prefix_repetition():
    """Kiểm tra toàn diện phản hồi tra cứu chi tiết Paracetamol: không lặp prefix, cấu trúc phân cấp."""
    async with AsyncSessionLocal() as db:
        drug = (await db.execute(select(DavNationalDrug).filter(DavNationalDrug.national_code == '893100141525'))).scalars().first()
        assert drug is not None
        mono = (await db.execute(select(ClinicalDrugMonograph).filter(ClinicalDrugMonograph.id == drug.clinical_monograph_id))).scalars().first() if drug.clinical_monograph_id else None

        resp = await build_fluent_drug_profile_response(drug, mono, 100, "Kho Ngoại Trú", "thông tin chi tiết paracetamol")
        text = resp.reply_text

        # 1. Khử lặp prefix tuyệt đối
        adult_prefix_count = len(re.findall(r'^\s*-\s*\*\*Người lớn:\*\*', text, re.MULTILINE))
        ped_prefix_count = len(re.findall(r'^\s*-\s*\*\*Trẻ em:\*\*', text, re.MULTILINE))
        renal_prefix_count = len(re.findall(r'^\s*-\s*\*\*Hiệu chỉnh suy thận:\*\*', text, re.MULTILINE))

        assert adult_prefix_count <= 1, f"Người lớn prefix lặp {adult_prefix_count} lần!"
        assert ped_prefix_count <= 1, f"Trẻ em prefix lặp {ped_prefix_count} lần (trước đây lặp 34 lần)!"
        assert renal_prefix_count <= 1, f"Hiệu chỉnh suy thận prefix lặp {renal_prefix_count} lần!"

        # 2. Không còn câu cụt, vỡ dòng do OCR
        assert "tối đa." not in text
        assert "cách." not in text
        assert "< 10 kg:." not in text
        assert "Đau Paracetamol" not in text
        assert "Sốt Paracetamol" not in text

        # 3. Phân cấp chuẩn y khoa
        assert "• **Liều dùng & Cách dùng:**" in text
        assert "- **Người lớn:**" in text
        assert "- **Đường uống:**" in text
        assert "- **Đặt trực tràng:**" in text
        assert "- **Truyền tĩnh mạch (15 phút):**" in text
        assert "- **Trẻ em:**" in text
        assert "- **Đau & Sốt (Đường uống):**" in text

        # 4. Thận trọng & Đối tượng đặc biệt có phân cấp
        assert "• **Thận trọng & Đối tượng đặc biệt:**" in text
        assert "  - **Hiệu chỉnh suy thận:**" in text
        assert "  - **Phụ nữ mang thai & cho con bú:**" in text

        # 5. Duy nhất 1 tag nguồn ở cuối
        assert text.endswith("[Dược thư tr.1118]") or "Nguồn: [Dược thư" in text
        assert "Căn cứ Y văn:" not in text


@pytest.mark.asyncio
async def test_paracetamol_summary_has_no_truncated_or_joined_fact_words():
    async with AsyncSessionLocal() as db:
        drug = (await db.execute(select(DavNationalDrug).filter(
            DavNationalDrug.national_code == "840110304425"
        ))).scalars().first()
        assert drug is not None
        from app.services.session_context import get_or_create_session
        from app.services.copilot_drug_formatter import build_drug_profile_response
        response = await build_drug_profile_response(
            [drug], db, get_or_create_session("summary-format-regression", "Điều dưỡng", "nurse"),
            query="tóm tắt",
        )

        assert "..." not in response.reply_text
        assert "…" not in response.reply_text
        assert "..." not in response.clinical_summary.key_takeaway
        assert "…" not in response.clinical_summary.key_takeaway
        assert "vi khu..." not in response.reply_text
        assert "Nóichung,ceftriaxon" not in response.reply_text
        assert "Ceftriaxon" in response.reply_text


@pytest.mark.asyncio
async def test_profile_abstains_when_database_monograph_lacks_source_provenance(monkeypatch):
    async with AsyncSessionLocal() as db:
        drug = (await db.execute(select(DavNationalDrug).filter(DavNationalDrug.national_code == '893100141525'))).scalars().first()
        assert drug is not None
        mono = (await db.execute(select(ClinicalDrugMonograph).filter(ClinicalDrugMonograph.id == drug.clinical_monograph_id))).scalars().first() if drug.clinical_monograph_id else None
        if mono is None:
            pytest.skip("No matching monograph for provenance regression")
        mono_source_id, mono_source_version = mono.source_id, mono.source_version
        drug_source_id, drug_source_version = drug.source_id, drug.source_version
        mono.source_id = None
        mono.source_version = None
        drug.source_id = None
        drug.source_version = None
        monkeypatch.setattr(
            "app.services.rag.source_resolver.load_source_documents",
            lambda: ([], {}, {}),
        )
        class EmptyRetriever:
            all_chunks = []
            async def retrieve_async(self, *args, **kwargs):
                return []
        monkeypatch.setattr(
            "app.services.rag.hybrid_retriever.HybridRetriever", EmptyRetriever
        )
        try:
            resp = await build_fluent_drug_profile_response(
                drug, mono, 0, "", "thông tin chi tiết paracetamol"
            )
        finally:
            mono.source_id, mono.source_version = mono_source_id, mono_source_version
            drug.source_id, drug.source_version = drug_source_id, drug_source_version

        assert resp.rag_grounded is False
        assert resp.citations == []
        assert resp.evidence == []
        assert resp.confidence == 0.0


@pytest.mark.asyncio
@pytest.mark.parametrize("requested_field,query", [
    ("adult_dosage", "Liều dùng Paracetamol"),
    ("indications", "Chỉ định Paracetamol"),
    ("contraindications", "Chống chỉ định Paracetamol"),
    ("adverse_effects", "Tác dụng không mong muốn Paracetamol"),
])
async def test_authoritative_lookup_returns_field_claims_linked_to_database_evidence(requested_field, query):
    from app.services.copilot_drug_lookup import lookup_drug_authoritative

    async with AsyncSessionLocal() as db:
        response = await lookup_drug_authoritative(
            query, db, requested_fields=[requested_field]
        )
    from app.services.chatbot.copilot_orchestrator import validate_response_evidence_contract
    response = validate_response_evidence_contract(response)

    assert response.answer_type == "medication_field"
    assert response.rag_grounded is True
    assert "chỉ mang tính tham khảo" not in response.reply_text.casefold()
    evidence_by_id = {item["evidence_id"]: item for item in response.evidence}
    assert response.claims
    assert response.evidence_claim_map
    for claim in response.claims:
        assert claim.claim_type == "source_fact"
        assert claim.support_status == "supported"
        for evidence_id in claim.evidence_ids:
            evidence = evidence_by_id[evidence_id]
            assert evidence["source_id"] and evidence["source_version"]
            assert claim.text in evidence["content"]
            assert claim.claim_id in response.evidence_claim_map[evidence_id]

def test_inline_citation_uses_verified_source_not_topic_or_field_name():
    from app.services.copilot_drug_citation_helper import format_flat_field_inquiry

    reply = format_flat_field_inquiry(
        drug_name="Example",
        drug_inn="Example",
        field_data=[("drug_interactions", "Tương tác thuốc", "Nguồn tham khảo Quyết định 5948 trong nội dung.")],
        source="Dược thư Quốc gia Việt Nam (2015, Trang 1120)",
    )

    assert reply.endswith("[Dược thư tr.1120]")
    assert "[QĐ 5948]" not in reply
