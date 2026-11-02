from app.services.chatbot.turn_parser import parse_chat_turn


def test_parses_primary_drug_and_requested_field():
    parsed = parse_chat_turn("Thông tin thuốc Metformin, chống chỉ định và liều dùng")
    assert parsed.intent == "monograph_field_lookup"
    assert parsed.medication_entities[0].canonical_id == "metformin"
    assert parsed.requested_fields == {"contraindications", "dosage"}


def test_assigns_contextual_exposure_role_for_procedure():
    parsed = parse_chat_turn("Metformin chụp CT có thuốc cản quang thì sao?")
    roles = {entity.canonical_id: entity.role for entity in parsed.medication_entities}
    assert roles["metformin"] == "primary_medication"
    assert roles["thuoc_can_quang"] == "contextual_exposure"
    assert parsed.intent == "clinical_consultation"


def test_marks_subject_switch_and_does_not_promote_stale_session_entity():
    parsed = parse_chat_turn(
        "Đổi sang Cefotaxim, hiệu chỉnh suy thận ra sao?",
        session_context={"active_medication": "ceftriaxon"},
    )
    assert parsed.switches_subject is True
    assert parsed.medication_entities[0].canonical_id == "cefotaxim"
    assert parsed.medication_entities[0].role == "primary_medication"


def test_generic_interaction_query_is_ambiguous_without_invented_pair():
    parsed = parse_chat_turn("Paracetamol có tương tác không?")
    assert parsed.intent == "interaction_assessment"
    assert [entity.canonical_id for entity in parsed.medication_entities] == ["paracetamol"]
    assert parsed.ambiguities == ["missing_interaction_partner"]


def test_handles_accent_normalization_and_unknown_entity_conservatively():
    parsed = parse_chat_turn("Có tương tác với Warfarin không?")
    assert parsed.medication_entities[0].canonical_id == "warfarin"
    unknown = parse_chat_turn("Thông tin thuốc BrandX-999")
    assert unknown.medication_entities == []
    assert "unresolved_medication" in unknown.ambiguities

def test_short_field_followup_inherits_active_medication_context():
    parsed = parse_chat_turn(
        "Liều tối đa trong ngày là bao nhiêu?",
        session_context={"active_medication": "paracetamol"},
    )
    assert parsed.intent == "monograph_field_lookup"
    assert parsed.medication_entities[0].canonical_id == "paracetamol"
    assert parsed.requested_fields == {"dosage"}
    assert parsed.medication_entities[0].resolution == "session_context"

def test_parser_preserves_explicit_drug_with_contextual_rash_followup():
    parsed = parse_chat_turn(
        "Allopurinol, nếu nổi ban thì xử trí thế nào?",
        session_context={"active_medication": "digoxin"},
    )
    assert parsed.medication_entities[0].canonical_id == "allopurinol"
    assert parsed.medication_entities[0].role == "primary_medication"
