from app.schemas.clinical_nlu import ClinicalNluExtraction
from app.schemas.copilot import CopilotResponse
from app.services.chatbot.answer_operation import apply_reference_note


def test_direct_lookup_stays_unlabeled():
    response = CopilotResponse(
        intent="MEDICATION_LOOKUP",
        reply_text="Chỉ định được ghi trong tài liệu.",
        rag_grounded=True,
    )

    result = apply_reference_note(response, ClinicalNluExtraction(intent="MEDICATION_LOOKUP"))

    assert "chỉ mang tính tham khảo" not in result.reply_text.casefold()


def test_nlu_classified_evidence_synthesis_gets_reference_note():
    response = CopilotResponse(
        intent="MEDICATION_LOOKUP",
        reply_text="Hai thuốc có điểm khác nhau theo tài liệu.",
        rag_grounded=True,
    )
    nlu = ClinicalNluExtraction(
        intent="MEDICATION_LOOKUP", answer_operation="evidence_synthesis"
    )

    result = apply_reference_note(response, nlu)

    assert result.reply_text.startswith("**Chỉ mang tính tham khảo.**")
    assert result.citations == []


def test_unverified_inference_is_not_presented_as_grounded_or_labeled_as_advice():
    response = CopilotResponse(
        intent="PATIENT_CASE_REASONING",
        reply_text="Chưa đủ căn cứ để đánh giá.",
        rag_grounded=False,
    )
    nlu = ClinicalNluExtraction(intent="PATIENT_CASE_REASONING")

    result = apply_reference_note(response, nlu)

    assert result.reply_text == response.reply_text
    assert result.rag_grounded is False
