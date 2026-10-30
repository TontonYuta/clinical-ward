import sqlite3

from app.services.ingredient_source_gaps import build_source_gap_report


def test_source_gap_report_distinguishes_expression_and_missing_catalog_entry(tmp_path):
    db = sqlite3.connect(":memory:")
    db.executescript("""
    CREATE TABLE product_ingredient_mappings (raw_name TEXT, mapping_status TEXT, source_id TEXT);
    INSERT INTO product_ingredient_mappings VALUES ('Unknown drug', 'unmapped', '1');
    INSERT INTO product_ingredient_mappings VALUES ('Salt A (as sodium) 100mg', 'unmapped', '2');
    """)
    report = build_source_gap_report(db)
    assert {row["raw_name"] for row in report} == {"Unknown drug", "Salt A (as sodium) 100mg"}
    assert next(row for row in report if row["raw_name"] == "Unknown drug")["gap_type"] == "not_in_dtqg_catalog"
    assert next(row for row in report if row["raw_name"].startswith("Salt A"))["gap_type"] == "needs_alias_or_parser_review"
