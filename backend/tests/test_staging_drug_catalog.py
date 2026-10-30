import sqlite3
from app.services.staging_drug_catalog import StagingDrugCatalog


def test_catalog_searches_code_brand_and_ingredient(tmp_path):
    db = tmp_path / "stage.sqlite"
    conn = sqlite3.connect(db)
    conn.executescript("""
    CREATE TABLE normalized_products (source_id TEXT,national_code TEXT,brand_name TEXT,active_ingredient_raw TEXT,strength_raw TEXT,dosage_form TEXT,manufacturer TEXT,is_active INTEGER,is_expired INTEGER);
    INSERT INTO normalized_products VALUES ('1','SDK-1','Brand One','Active X','10mg','tablet','Maker',1,0);
    CREATE TABLE product_ingredient_mappings (source_id TEXT,canonical_inn TEXT);
    INSERT INTO product_ingredient_mappings VALUES ('1','Paracetamol');
    CREATE VIRTUAL TABLE product_search USING fts5(source_id UNINDEXED,national_code,brand_name,active_ingredients,tokenize='unicode61');
    INSERT INTO product_search VALUES ('1','SDK-1','Brand One','Active X Paracetamol');
    """)
    conn.commit(); conn.close()

    catalog = StagingDrugCatalog(db)
    assert catalog.search("SDK-1")["items"][0]["national_code"] == "SDK-1"
    assert catalog.search("Brand")["items"][0]["brand_name"] == "Brand One"
    assert catalog.search("Paracetamol")["items"][0]["canonical_ingredients"] == ["Paracetamol"]


def test_catalog_never_returns_inactive_or_expired_records(tmp_path):
    db = tmp_path / "stage.sqlite"
    conn = sqlite3.connect(db)
    conn.executescript("""
    CREATE TABLE normalized_products (source_id TEXT,national_code TEXT,brand_name TEXT,active_ingredient_raw TEXT,strength_raw TEXT,dosage_form TEXT,manufacturer TEXT,is_active INTEGER,is_expired INTEGER);
    INSERT INTO normalized_products VALUES ('1','SDK-OLD','Old Brand','Drug A','10mg','tablet','Maker',0,0);
    INSERT INTO normalized_products VALUES ('2','SDK-EXP','Expired Brand','Drug B','10mg','tablet','Maker',1,1);
    CREATE VIRTUAL TABLE product_search USING fts5(source_id UNINDEXED,national_code,brand_name,active_ingredients,tokenize='unicode61');
    INSERT INTO product_search VALUES ('1','SDK-OLD','Old Brand','Drug A');
    INSERT INTO product_search VALUES ('2','SDK-EXP','Expired Brand','Drug B');
    """)
    conn.commit(); conn.close()

    assert StagingDrugCatalog(db).search("Drug", active_only=True)["items"] == []
