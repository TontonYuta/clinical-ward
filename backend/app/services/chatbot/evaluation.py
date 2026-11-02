"""Deterministic component scoring for chatbot regression cases (<=65 LOC)."""
from collections.abc import Mapping, Sequence


def evaluate_response_components(
    *,
    response: Mapping,
    expected_entities: Sequence[str] = (),
    forbidden_entities: Sequence[str] = (),
    entity_aliases: Mapping[str, Sequence[str]] | None = None,
    expected_citations: bool = False,
) -> dict[str, bool]:
    """Score observable response properties independently of prose similarity."""
    answer = str(response.get("reply_text", "")).casefold()
    citations = response.get("citations") or []
    aliases = entity_aliases or {}

    def present(entity: str, text: str) -> bool:
        candidates = (entity, *aliases.get(entity, ()))
        return any(candidate.casefold() in text for candidate in candidates)

    entity_correct = all(present(entity, answer) for entity in expected_entities)
    critical_entity_leak = any(present(entity, answer) for entity in forbidden_entities)
    citation_present = bool(citations)
    cited_text = " ".join(
        str(citation.get(key, ""))
        for citation in citations if isinstance(citation, Mapping)
        for key in ("source", "excerpt", "section", "legal_basis")
    ).casefold()
    citation_relevant = bool(citations) and (
        not expected_entities or any(present(entity, cited_text) for entity in expected_entities)
    )
    evidence_supported = citation_relevant and entity_correct
    safe_behavior = response.get("answer_type") in {"clarification", "safe_abstention"}
    evidence_requirement_met = not expected_citations or citation_relevant or safe_behavior
    expected_intent = response.get("expected_intent")
    intent_correct = expected_intent is None or response.get("intent") == expected_intent
    overall_pass = not critical_entity_leak and evidence_requirement_met and intent_correct and (entity_correct or safe_behavior)

    return {
        "entity_correct": entity_correct,
        "intent_correct": intent_correct,
        "critical_entity_leak": critical_entity_leak,
        "citation_present": citation_present,
        "citation_relevant": citation_relevant,
        "evidence_supported": evidence_supported,
        "safe_behavior": safe_behavior,
        "overall_pass": overall_pass,
    }
