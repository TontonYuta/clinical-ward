"""Structured representation of a user turn for routing and retrieval (<=50 LOC)."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class MedicationEntity:
    canonical_id: str
    surface_form: str
    role: str
    start: int
    end: int
    resolution: str = "registry"


@dataclass(frozen=True)
class ParsedTurn:
    text: str
    intent: str
    medication_entities: list[MedicationEntity] = field(default_factory=list)
    requested_fields: set[str] = field(default_factory=set)
    context_entities: list[str] = field(default_factory=list)
    references_previous_entity: bool = False
    switches_subject: bool = False
    ambiguities: list[str] = field(default_factory=list)
    confidence: float = 1.0
