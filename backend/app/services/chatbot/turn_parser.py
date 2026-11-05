"""Deterministic first-pass parsing of Vietnamese clinical chat turns (<=150 LOC)."""
import re
import unicodedata
from collections.abc import Mapping

from app.services.chatbot.request_types import MedicationEntity, ParsedTurn
from app.services.clinical_ddi_engine.drug_registry import DRUG_REGISTRY
from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications

_FIELDS = {
    "contraindications": ("chống chỉ định", "cấm dùng"),
    "dosage": ("liều dùng", "liều lượng", "liều tối đa", "hiệu chỉnh liều", "chỉnh liều", "còn liều", "liều"),
    "adverse_effects": ("tác dụng phụ", "tác dụng không mong muốn", "adr"),
    "indications": ("chỉ định", "công dụng"),
    "ingredients": ("thành phần", "hoạt chất"),
    "interactions": ("tương tác", "tương kỵ", "kỵ thuốc"),
    "monitoring": ("theo dõi", "xét nghiệm", "giám sát"),
}
_SWITCH_CUES = ("đổi sang", "chuyển sang", "chuyển qua", "nếu dùng", "thế còn", "còn thuốc", "sang thuốc")
_INTERACTION_CUES = ("tương tác", "tương kỵ", "kỵ thuốc", "uống cùng", "dùng cùng", "phối hợp", "kết hợp")
_CONTEXTUAL_CUES = ("cản quang", "chụp ct", "chụp x-quang", "hạ kali", "hạ natri", "suy thận", "suy gan", "thai kỳ", "cho con bú", "nổi ban", "phát ban", "nguy cơ gì", "nguy cơ nào", "xử trí thế nào")
_DEICTIC_CUES = ("thuốc đó", "thuốc này", "nó có", "thuốc vừa nói", "của thuốc")


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in text if not unicodedata.combining(c)).replace("đ", "d")


def parse_chat_turn(text: str, session_context: Mapping | None = None) -> ParsedTurn:
    lower = (text or "").casefold()
    normalized = _normalize(lower)
    normalized_spans = []
    for index, char in enumerate(text or ""):
        fragment = unicodedata.normalize("NFKD", char.casefold())
        fragment = "".join(c for c in fragment if not unicodedata.combining(c)).replace("đ", "d")
        normalized_spans.extend([index] * len(fragment))

    refs_previous = any(cue in lower for cue in _DEICTIC_CUES)
    switches_subject = any(cue in lower for cue in _SWITCH_CUES)
    contextual_clinical = any(cue in lower for cue in _CONTEXTUAL_CUES)
    requested_fields = {
        field for field, cues in _FIELDS.items()
        if any(re.search(r"(?<![\w])" + re.escape(cue) + r"(?![\w])", lower) for cue in cues)
        and not (field == "indications" and "chống chỉ định" in lower)
    }

    found = []
    for key in DRUG_REGISTRY:
        for alias in DRUG_REGISTRY[key].get("aliases", []):
            alias_n = _normalize(alias.strip())
            for match in re.finditer(r"(?<![\w])" + re.escape(alias_n) + r"(?![\w])", normalized):
                if not normalized_spans:
                    continue
                start = normalized_spans[match.start()]
                end = normalized_spans[match.end() - 1] + 1
                found.append((start, end, key, (text or "")[start:end]))

    found.sort(key=lambda item: (item[0], -(item[1] - item[0])))
    selected = []
    occupied: list[tuple[int, int]] = []
    for start, end, key, surface in found:
        if any(start < used_end and end > used_start for used_start, used_end in occupied):
            continue
        occupied.append((start, end))
        selected.append((start, end, key, surface))

    entities = []
    for index, (start, end, key, surface) in enumerate(selected):
        role = "primary_medication" if index == 0 else "co_medication"
        if DRUG_REGISTRY.get(key, {}).get("entity_role") == "contextual_exposure":
            role = "contextual_exposure"
        elif any(cue in lower for cue in _CONTEXTUAL_CUES) and index > 0:
            role = "contextual_exposure"
        entities.append(MedicationEntity(key, surface, role, start, end))

    mentions_interaction = any(cue in lower for cue in _INTERACTION_CUES)
    # If no explicit drug was detected and this turn has deictic or field cues, inherit from session
    if not entities and not switches_subject:
        active = (session_context or {}).get("active_medication")
        active_keys = resolve_registered_medications(str(active or ""))
        if active_keys and (refs_previous or contextual_clinical or requested_fields):
            entities.append(MedicationEntity(
                active_keys[0], str(active), "primary_medication", -1, -1, "session_context"
            ))

    ambiguities = []
    if switches_subject:
        old_active = (session_context or {}).get("active_medication")
        old_keys = set(resolve_registered_medications(str(old_active or "")))
        entities = [entity for entity in entities if entity.canonical_id not in old_keys]

    if mentions_interaction and len(entities) < 2:
        active = (session_context or {}).get("active_medication")
        active_keys = resolve_registered_medications(str(active or ""))
        explicit_keys = [entity.canonical_id for entity in entities]
        if active_keys and explicit_keys and active_keys[0] not in explicit_keys:
            entities.insert(0, MedicationEntity(active_keys[0], str(active), "primary_medication", -1, -1, "session_context"))
        elif not active_keys or not explicit_keys:
            ambiguities.append("missing_interaction_partner")

    if not entities and any(cue in normalized for cue in ("thuoc", "hoat chat", "lieu dung")):
        ambiguities.append("unresolved_medication")

    if mentions_interaction:
        intent = "interaction_assessment"
    elif requested_fields and entities:
        intent = "monograph_field_lookup"
    elif contextual_clinical and entities:
        intent = "clinical_consultation"
    elif refs_previous and entities:
        intent = "contextual_followup"
    elif entities:
        intent = "medication_lookup"
    elif refs_previous:
        intent = "contextual_followup"
    else:
        intent = "general"

    confidence = 0.45 if ambiguities else (0.9 if entities else 0.6)
    return ParsedTurn(
        text=text or "", intent=intent, medication_entities=entities,
        requested_fields=requested_fields, references_previous_entity=refs_previous,
        switches_subject=switches_subject, ambiguities=ambiguities, confidence=confidence
    )


def parse_chat_turn_schema(text: str, session_context: Mapping | None = None):
    """Trích xuất Ý định & Thực thể chuẩn Pydantic V2 Schema (Zero-Hardcode)."""
    from app.services.chatbot.clinical_schema_extractor import extract_clinical_query_schema_deterministic
    return extract_clinical_query_schema_deterministic(text, session_context)

