"""Apply output labels from the semantic answer operation selected by NLU."""

from app.schemas.clinical_nlu import ClinicalNluExtraction
from app.schemas.copilot import CopilotResponse

_REFERENCE_OPERATIONS = {"evidence_synthesis", "patient_specific_inference"}
_NON_FACTUAL_ANSWER_TYPES = {
    "clarification", "safe_abstention", "feedback_acknowledgment",
    "conversational_feedback", "conversational_guidance",
    "unavailable", "operational_result", "action_result",
    "action_confirmation", "acknowledgment",
}
_REFERENCE_INTENTS = {"PATIENT_CASE_REASONING", "MULTI_INTENT_COMPOSITE"}
_LABEL = "**Chỉ mang tính tham khảo.**"


def requires_reference_note(nlu: ClinicalNluExtraction | None, route_intent: str | None = None) -> bool:
    """Return whether the semantic task is synthesis/inference, not direct lookup."""
    return bool(
        (nlu and getattr(nlu, "answer_operation", "direct_lookup") in _REFERENCE_OPERATIONS)
        or route_intent in _REFERENCE_INTENTS
    )


def apply_reference_note(
    response: CopilotResponse,
    nlu: ClinicalNluExtraction | None,
    route_intent: str | None = None,
) -> CopilotResponse:
    """Label grounded synthesized answers while leaving lookups and abstentions intact."""
    if (
        not response.rag_grounded
        or response.answer_type in _NON_FACTUAL_ANSWER_TYPES
        or not requires_reference_note(nlu, route_intent)
        or "chỉ mang tính tham khảo" in response.reply_text.casefold()
    ):
        return response
    response.reply_text = f"{_LABEL}\n\n{response.reply_text}"
    return response
