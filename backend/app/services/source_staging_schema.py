STAGING_SCHEMA_SQL = """
DROP TABLE IF EXISTS source_records;
DROP TABLE IF EXISTS pdf_pages;
DROP TABLE IF EXISTS ingredient_parse_audit;
DROP TABLE IF EXISTS product_ingredient_mappings;
DROP TABLE IF EXISTS ingredient_aliases;
DROP TABLE IF EXISTS reviewed_aliases;
DROP TABLE IF EXISTS ingredients;
DROP TABLE IF EXISTS ingredient_source_gaps;
DROP TABLE IF EXISTS product_ingredients;
DROP TABLE IF EXISTS normalized_products;
DROP TABLE IF EXISTS source_manifest;
DROP TABLE IF EXISTS dictionary_manifest;
CREATE TABLE source_manifest (
    source_key TEXT PRIMARY KEY, source_url TEXT NOT NULL,
    source_path TEXT NOT NULL, sha256 TEXT NOT NULL,
    byte_count INTEGER NOT NULL, record_count INTEGER,
    captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE dictionary_manifest (
    dictionary_key TEXT PRIMARY KEY, source_path TEXT NOT NULL,
    sha256 TEXT NOT NULL, entry_count INTEGER NOT NULL
);
CREATE TABLE source_records (
    source_key TEXT NOT NULL REFERENCES source_manifest(source_key),
    source_record_id TEXT NOT NULL, ordinal INTEGER NOT NULL,
    raw_json TEXT NOT NULL, PRIMARY KEY (source_key, source_record_id),
    UNIQUE (source_key, ordinal)
);
CREATE TABLE source_record_resolution (
    source_key TEXT NOT NULL, source_record_id TEXT NOT NULL,
    national_code_key TEXT, resolution_status TEXT NOT NULL,
    selected_source_record_id TEXT, resolution_reason TEXT,
    PRIMARY KEY (source_key, source_record_id),
    FOREIGN KEY (source_key, source_record_id) REFERENCES source_records(source_key, source_record_id)
);
CREATE INDEX ix_source_record_resolution_code ON source_record_resolution(national_code_key,resolution_status);
CREATE TABLE duplicate_registration_groups (
    national_code_key TEXT PRIMARY KEY, candidate_count INTEGER NOT NULL,
    selected_source_record_id TEXT, resolution_status TEXT NOT NULL, resolution_reason TEXT
);
CREATE TABLE pdf_pages (
    source_key TEXT NOT NULL REFERENCES source_manifest(source_key),
    physical_page INTEGER NOT NULL, raw_text TEXT NOT NULL,
    PRIMARY KEY (source_key, physical_page)
);
CREATE TABLE normalized_products (
    source_id TEXT, national_code TEXT, brand_name TEXT, active_ingredient_raw TEXT,
    strength_raw TEXT, dosage_form TEXT, package_spec TEXT, standard_pharmacopeia TEXT,
    shelf_life TEXT, manufacturer TEXT, manufacturer_country TEXT, applicant TEXT,
    applicant_country TEXT, approval_date TEXT, expiry_date TEXT, approval_decision TEXT,
    is_active INTEGER, is_expired INTEGER, normalization_flags TEXT NOT NULL,
    PRIMARY KEY (source_id)
);
CREATE INDEX ix_normalized_products_code ON normalized_products(national_code);
CREATE INDEX ix_normalized_products_brand ON normalized_products(brand_name);
CREATE INDEX ix_normalized_products_active ON normalized_products(active_ingredient_raw);
CREATE INDEX ix_normalized_products_expiry_active ON normalized_products(is_active,is_expired);
CREATE VIRTUAL TABLE product_search USING fts5(
    source_id UNINDEXED, national_code, brand_name, active_ingredients,
    tokenize='unicode61 remove_diacritics 2'
);
CREATE TABLE product_ingredients (
    source_id TEXT NOT NULL REFERENCES normalized_products(source_id),
    ingredient_ordinal INTEGER NOT NULL, name_raw TEXT NOT NULL,
    strength_raw TEXT, parse_status TEXT NOT NULL, review_reason TEXT,
    PRIMARY KEY (source_id, ingredient_ordinal)
);
CREATE INDEX ix_product_ingredients_name_raw ON product_ingredients(name_raw);
CREATE TABLE ingredient_parse_audit (
    source_id TEXT PRIMARY KEY REFERENCES normalized_products(source_id),
    raw_text TEXT NOT NULL, parse_status TEXT NOT NULL, review_reason TEXT
);
CREATE TABLE ingredients (
    canonical_inn TEXT PRIMARY KEY, atc_code_raw TEXT, source_title TEXT
);
CREATE TABLE ingredient_aliases (
    alias_key TEXT PRIMARY KEY, alias_raw TEXT NOT NULL,
    canonical_inn TEXT NOT NULL REFERENCES ingredients(canonical_inn),
    match_type TEXT NOT NULL
);
CREATE TABLE reviewed_aliases (
    alias TEXT PRIMARY KEY, canonical_inn TEXT NOT NULL,
    source TEXT NOT NULL, reviewer TEXT NOT NULL, reviewed_at TEXT NOT NULL
);
CREATE TABLE product_ingredient_mappings (
    source_id TEXT NOT NULL, ingredient_ordinal INTEGER NOT NULL,
    raw_name TEXT NOT NULL, canonical_inn TEXT, atc_code_raw TEXT,
    mapping_status TEXT NOT NULL, match_type TEXT,
    PRIMARY KEY (source_id, ingredient_ordinal)
);
CREATE INDEX ix_product_ingredient_mappings_inn ON product_ingredient_mappings(canonical_inn);
CREATE INDEX ix_product_ingredient_mappings_status ON product_ingredient_mappings(mapping_status);
CREATE INDEX ix_product_ingredient_mappings_review ON product_ingredient_mappings(mapping_status,raw_name,source_id);
CREATE INDEX ix_product_ingredient_mappings_product ON product_ingredient_mappings(source_id,ingredient_ordinal);
CREATE TABLE ingredient_source_gaps (
    raw_name TEXT PRIMARY KEY, occurrence_count INTEGER NOT NULL,
    product_count INTEGER NOT NULL, gap_type TEXT NOT NULL, action TEXT NOT NULL
);
CREATE INDEX ix_ingredient_source_gaps_type ON ingredient_source_gaps(gap_type);
CREATE INDEX ix_ingredient_source_gaps_frequency ON ingredient_source_gaps(product_count DESC,raw_name);
"""
