from app.schemas.copilot import CopilotResponse
from app.services.chatbot.offline_drug_reply_formatter import format_offline_drug_reply


def test_formatter_preserves_already_formatted_vietnamese_reply():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="**Chỉ định của thuốc:**\nNội dung theo chuyên luận.",
        answer_type="medication_field",
    )

    assert format_offline_drug_reply(response).reply_text == response.reply_text


def test_formatter_keeps_source_in_structured_citations_not_reply_text():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="**Chỉ định:**\nGiảm đau.\n\nNguồn: [Dược thư tr.1118]",
        answer_type="medication_field",
        citations=[{"source": "Dược thư Quốc gia", "page": 1118}],
    )

    formatted = format_offline_drug_reply(response)

    assert formatted.reply_text == "**Chỉ định:**\nGiảm đau."
    assert formatted.citations[0]["page"] == 1118


def test_formatter_removes_pdf_source_links_from_reply_prose():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="Thông tin theo tài liệu [Dược thư Quốc gia](/pdf/duoc-thu.pdf#page=10).",
        answer_type="medication_field",
        citations=[{"source": "Dược thư Quốc gia", "url": "/pdf/duoc-thu.pdf#page=10"}],
    )

    formatted = format_offline_drug_reply(response)

    assert formatted.reply_text == "Thông tin theo tài liệu."


def test_formatter_replaces_serialized_schema_dump_with_versioned_evidence():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text=(
            "routine\n drug identity\n brand name\n Fentanyl\n"
            "indications\n Giảm đau trong và sau phẫu thuật."
        ),
        answer_type="medication_fields",
        rag_grounded=True,
        evidence=[{
            "evidence_id": "e1",
            "evidence_type": "document_chunk",
            "chunk_id": "monograph:drug:indications",
            "source_id": "dtqg",
            "source_version": "sha256:abc",
            "section": "indications",
            "content": "Giảm đau trong và sau phẫu thuật.",
        }],
        citations=[{"chunk_id": "monograph:drug:indications", "source_id": "dtqg", "source_version": "sha256:abc"}],
    )

    formatted = format_offline_drug_reply(response)

    assert formatted.reply_text == "**Chỉ định:**\nGiảm đau trong và sau phẫu thuật."
    assert "routine" not in formatted.reply_text
    assert "drug identity" not in formatted.reply_text
    assert formatted.evidence == response.evidence
    assert formatted.rag_grounded
    assert formatted.claims[0].evidence_ids == ["e1"]


def test_formatter_abstains_from_schema_dump_without_verified_evidence():
    response = CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text="routine drug identity brand name Fentanyl dosage matrix",
        answer_type="medication_fields",
    )

    formatted = format_offline_drug_reply(response)

    assert formatted.answer_type == "safe_abstention"
    assert formatted.reply_text == "Chưa thể trình bày hồ sơ thuốc vì chưa có dữ liệu nguồn đã xác minh."
