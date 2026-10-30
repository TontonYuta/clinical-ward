from app.services.ingredient_mapping import build_ingredient_dictionary, map_ingredient_name


def test_maps_exact_inn_and_parenthetical_alias():
    dictionary = build_ingredient_dictionary([{"inn": "Aciclovir (Acyclovir)", "atc_code": "J05AB01."}])
    assert map_ingredient_name("Aciclovir", dictionary) == {"canonical_inn": "Aciclovir (Acyclovir)", "atc_code": "J05AB01.", "status": "mapped", "match_type": "exact"}
    assert map_ingredient_name("Acyclovir", dictionary)["match_type"] == "alias"


def test_unmapped_name_is_not_fuzzy_matched():
    dictionary = build_ingredient_dictionary([{"inn": "Ceftriaxone", "atc_code": "J01DD04."}])
    result = map_ingredient_name("Ceftriaxone sodium hydrate", dictionary)
    assert result["status"] == "unmapped"
    assert result["canonical_inn"] is None


def test_curated_vietnamese_spelling_alias_is_explicit():
    dictionary = build_ingredient_dictionary([{"inn": "Hydrochlorothiazide", "atc_code": "C03AA03."}])
    result = map_ingredient_name("Hydroclorothiazid", dictionary)
    assert result["status"] == "mapped"
    assert result["match_type"] == "curated_alias"


def test_strips_strength_and_approved_salt_suffix_only_when_base_exists():
    dictionary = build_ingredient_dictionary([{"inn": "Paracetamol", "atc_code": "N02BE01."}])
    result = map_ingredient_name("Paracetamol 500mg", dictionary)
    assert result["status"] == "mapped"
    assert result["match_type"] == "normalized_form"
    assert map_ingredient_name("Unknown 500mg", dictionary)["status"] == "unmapped"
