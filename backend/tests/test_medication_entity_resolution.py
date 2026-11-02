from app.services.clinical_ddi_engine.entity_resolution import resolve_registered_medications


def test_resolves_aliases_to_canonical_registry_keys_once():
    assert resolve_registered_medications("Ceftriaxone dùng cùng calcium") == ["ceftriaxon", "calci"]


def test_prefers_longest_alias_and_avoids_substring_false_positive():
    assert resolve_registered_medications("Metformin và metformin XR; calci") == ["metformin", "calci"]
    assert resolve_registered_medications("calcium carbonate") == ["calci"]


def test_unknown_text_does_not_resolve_a_drug():
    assert resolve_registered_medications("xyz medicine") == []


def test_resolves_levothyroxine_canonical_alias():
    assert resolve_registered_medications("Levothyroxine sodium") == ["levothyroxin"]


def test_alias_match_is_word_boundary_aware():
    assert resolve_registered_medications("anvo-amiodarone 200mg") == ["amiodaron"]
    assert resolve_registered_medications("xcalciumx") == []

def test_field_followup_preserves_only_resolved_drug_name():
    from app.services.copilot_drug_lookup import extract_drug_keywords

    assert extract_drug_keywords("Theo dõi xét nghiệm nào? của thuốc Lithium") == "lithium"
    assert extract_drug_keywords("Có thể tiêm tĩnh mạch không? của thuốc Insulin glargine") == "insulin glargine"


def test_extract_drug_keyword_strips_strength_and_clinical_question_scaffolding():
    from app.services.copilot_drug_lookup import extract_drug_keywords
    assert extract_drug_keywords("Thông tin thuốc Vancomycin 1g") == "vancomycin"
    assert extract_drug_keywords("Thông tin thuốc Vancomycin 1g. Nếu suy thận thì chỉnh liều thế nào?") == "vancomycin"
