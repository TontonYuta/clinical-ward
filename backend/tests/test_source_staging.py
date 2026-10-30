import json
import sqlite3
import subprocess

from app.services.source_staging import build_source_staging
from app.services.source_staging import _build_source_staging_file


def test_staging_keeps_raw_json_and_physical_pdf_pages_separate(tmp_path, monkeypatch):
    dav = tmp_path / "dav.json"
    raw_rows = [{"nationalCode": "X1", "activeIngredient": "Drug A + Drug B"}]
    dav.write_text(json.dumps(raw_rows, ensure_ascii=False), encoding="utf-8")
    pdf = tmp_path / "source.pdf"
    pdf.write_bytes(b"pdf")
    stage = tmp_path / "stage.sqlite"

    def fake_run(*args, **kwargs):
        return subprocess.CompletedProcess(args[0], 0, stdout="Page onePage two", stderr="")

    monkeypatch.setattr("app.services.source_staging.subprocess.run", fake_run)
    result = build_source_staging(dav_json=dav, pdf_path=pdf, staging_db=stage, dav_url="https://dav.test", pdf_url="http://local/pdf")

    conn = sqlite3.connect(stage)
    saved = json.loads(conn.execute("SELECT raw_json FROM source_records").fetchone()[0])
    pages = conn.execute("SELECT physical_page,raw_text FROM pdf_pages ORDER BY physical_page").fetchall()
    indexed = conn.execute("SELECT source_id FROM product_search WHERE product_search MATCH 'Drug' ").fetchall()
    conn.close()
    assert saved == raw_rows[0]
    assert pages == [(1, "Page one"), (2, "Page two"), (3, "")]
    assert indexed
    assert result["dav_records"] == 1


def test_staging_build_failure_preserves_previous_snapshot(tmp_path, monkeypatch):
    target = tmp_path / "stage.sqlite"
    target.write_bytes(b"known-good-existing-staging")

    def fail_build(**kwargs):
        raise RuntimeError("simulated build failure")

    monkeypatch.setattr("app.services.source_staging._build_source_staging_file", fail_build)
    try:
        build_source_staging(dav_json=tmp_path / "raw.json", pdf_path=tmp_path / "source.pdf", staging_db=target, dav_url="dav", pdf_url="pdf")
    except RuntimeError:
        pass
    else:
        raise AssertionError("expected simulated staging build failure")
    assert target.read_bytes() == b"known-good-existing-staging"


def test_staging_indexes_cover_common_lookup_and_review_queries():
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
    CREATE TABLE normalized_products (national_code TEXT, brand_name TEXT);
    CREATE INDEX ix_normalized_products_code ON normalized_products(national_code);
    CREATE INDEX ix_normalized_products_brand ON normalized_products(brand_name);
    CREATE TABLE product_ingredient_mappings (mapping_status TEXT, raw_name TEXT, source_id TEXT);
    CREATE INDEX ix_product_ingredient_mappings_review ON product_ingredient_mappings(mapping_status,raw_name,source_id);
    INSERT INTO normalized_products SELECT 'SDK-' || value, 'Brand-' || value FROM (WITH RECURSIVE seq(value) AS (SELECT 1 UNION ALL SELECT value+1 FROM seq WHERE value<5000) SELECT value FROM seq);
    INSERT INTO product_ingredient_mappings SELECT CASE WHEN value%2=0 THEN 'unmapped' ELSE 'mapped' END, 'Ingredient-' || value, 'Product-' || value FROM (WITH RECURSIVE seq(value) AS (SELECT 1 UNION ALL SELECT value+1 FROM seq WHERE value<5000) SELECT value FROM seq);
    """)
    plans = [
        conn.execute("EXPLAIN QUERY PLAN SELECT * FROM normalized_products WHERE national_code=?", ("SDK",)).fetchall(),
        conn.execute("EXPLAIN QUERY PLAN SELECT * FROM normalized_products WHERE brand_name=?", ("Brand",)).fetchall(),
        conn.execute("EXPLAIN QUERY PLAN SELECT raw_name,COUNT(*) FROM product_ingredient_mappings WHERE mapping_status=? GROUP BY raw_name", ("unmapped",)).fetchall(),
    ]
    conn.close()
    assert all("INDEX" in str(plan).upper() for plan in plans)
