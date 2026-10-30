import sqlite3

from app.services.ingredient_review_queue import build_unmapped_review_queue


def test_review_queue_groups_unmapped_names_and_includes_product_examples(tmp_path):
    db = tmp_path / "stage.sqlite"
    conn = sqlite3.connect(db)
    conn.executescript("""
    CREATE TABLE normalized_products (source_id TEXT, national_code TEXT, brand_name TEXT);
    CREATE TABLE product_ingredient_mappings (source_id TEXT, ingredient_ordinal INTEGER, raw_name TEXT, canonical_inn TEXT, mapping_status TEXT);
    INSERT INTO normalized_products VALUES ('1','SDK-1','Brand One');
    INSERT INTO normalized_products VALUES ('2','SDK-2','Brand Two');
    INSERT INTO product_ingredient_mappings VALUES ('1',1,'Salt X',NULL,'unmapped');
    INSERT INTO product_ingredient_mappings VALUES ('2',1,'Salt X',NULL,'unmapped');
    INSERT INTO product_ingredient_mappings VALUES ('2',2,'Known',NULL,'mapped');
    """)
    conn.commit()
    result = build_unmapped_review_queue(conn)
    conn.close()

    assert result[0]["raw_name"] == "Salt X"
    assert result[0]["product_count"] == 2
    assert result[0]["examples"] == [{"national_code": "SDK-1", "brand_name": "Brand One"}, {"national_code": "SDK-2", "brand_name": "Brand Two"}]
