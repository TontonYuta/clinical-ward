from app.services.ingredient_parser import parse_active_ingredients


def test_parses_delimited_name_strength_pairs():
    result = parse_active_ingredients("Aztreonam 1,5g; Avibactam 0,5g")
    assert result["status"] == "parsed"
    assert result["ingredients"] == [
        {"name_raw": "Aztreonam", "strength_raw": "1,5g"},
        {"name_raw": "Avibactam", "strength_raw": "0,5g"},
    ]


def test_keeps_complex_expression_unparsed_without_losing_raw_text():
    raw = "Sacubitril/Valsartan dạng acid tự do 200mg (97,2mg Sacubitril và 102,8mg Valsartan)"
    result = parse_active_ingredients(raw)
    assert result["status"] == "needs_review"
    assert result["ingredients"] == []
    assert result["raw"] == raw


def test_single_ingredient_is_kept_as_single_entry():
    result = parse_active_ingredients("Venetoclax", "10mg")
    assert result["status"] == "parsed"
    assert result["ingredients"] == [{"name_raw": "Venetoclax", "strength_raw": "10mg"}]
