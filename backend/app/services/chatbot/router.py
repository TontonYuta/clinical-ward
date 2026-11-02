"""Turn-level route decisions from parsed intent and entities (<=50 LOC)."""
from dataclasses import dataclass, field

from app.services.chatbot.request_types import ParsedTurn


@dataclass(frozen=True)
class RouteDecision:
    route: str
    reason_code: str
    required_entities: list[str] = field(default_factory=list)
    required_evidence: str | None = None


def route_chat_turn(parsed: ParsedTurn, session_context=None) -> RouteDecision:
    """Choose a safe deterministic route before retrieval or synthesis."""
    entities = [entity.canonical_id for entity in parsed.medication_entities]
    text = parsed.text.casefold()
    if any(term in text for term in ("khó thở", "phù môi", "thở rít", "tụt huyết áp")) and any(term in text for term in ("sau tiêm", "sau uống", "sau dùng", "sau khi dùng")):
        return RouteDecision("emergency", "post_medication_red_flag", required_evidence="emergency_protocol")
    if parsed.intent == "interaction_assessment":
        if len(entities) < 2:
            return RouteDecision("clarification", "missing_interaction_partner", entities, "drug_interaction")
        return RouteDecision("ddi_pair_assessment", "resolved_interaction_pair", entities[:2], "drug_interaction")
    if parsed.intent == "monograph_field_lookup":
        if not entities:
            return RouteDecision("clarification", "missing_medication", [], "drug_monograph")
        return RouteDecision("monograph_field_lookup", "resolved_medication_fields", entities, "drug_monograph")
    if parsed.intent == "clinical_consultation":
        return RouteDecision("clinical_consultation", "resolved_clinical_context", entities, "clinical_guideline")
    if parsed.intent == "medication_lookup":
        return RouteDecision("medication_lookup", "resolved_medication", entities, "drug_monograph")
    if parsed.ambiguities:
        return RouteDecision("clarification", parsed.ambiguities[0])
    return RouteDecision("general", "no_clinical_route_required", entities)
