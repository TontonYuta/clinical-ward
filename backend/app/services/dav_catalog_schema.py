SCHEMA = """
CREATE TABLE IF NOT EXISTS dav_catalog_runs (
 run_id TEXT PRIMARY KEY, source_sha256 TEXT NOT NULL, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 source_record_count INTEGER NOT NULL, canonical_product_count INTEGER NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dav_source_records (
 run_id TEXT NOT NULL REFERENCES dav_catalog_runs(run_id), source_key TEXT NOT NULL, source_record_id TEXT NOT NULL,
 ordinal INTEGER NOT NULL, raw_json TEXT NOT NULL, PRIMARY KEY(run_id,source_key,source_record_id), UNIQUE(run_id,source_key,ordinal)
);
CREATE TABLE IF NOT EXISTS dav_record_resolution (
 run_id TEXT NOT NULL REFERENCES dav_catalog_runs(run_id), source_record_id TEXT NOT NULL, national_code_key TEXT,
 resolution_status TEXT NOT NULL, selected_source_record_id TEXT, resolution_reason TEXT,
 PRIMARY KEY(run_id,source_record_id)
);
CREATE INDEX IF NOT EXISTS ix_dav_record_resolution_code ON dav_record_resolution(run_id,national_code_key,resolution_status);
CREATE TABLE IF NOT EXISTS dav_duplicate_groups (
 run_id TEXT NOT NULL REFERENCES dav_catalog_runs(run_id), national_code_key TEXT NOT NULL, candidate_count INTEGER NOT NULL,
 selected_source_record_id TEXT, resolution_status TEXT NOT NULL, resolution_reason TEXT,
 PRIMARY KEY(run_id,national_code_key)
);
CREATE TABLE IF NOT EXISTS dav_catalog_products (
 run_id TEXT NOT NULL REFERENCES dav_catalog_runs(run_id), source_id TEXT NOT NULL, national_code TEXT NOT NULL,
 brand_name TEXT, active_ingredient_raw TEXT, strength_raw TEXT, dosage_form TEXT, package_spec TEXT, standard_pharmacopeia TEXT,
 shelf_life TEXT, manufacturer TEXT, manufacturer_country TEXT, applicant TEXT, applicant_country TEXT, approval_date TEXT,
 expiry_date TEXT, approval_decision TEXT, is_active INTEGER, is_expired INTEGER, normalization_flags TEXT NOT NULL,
 PRIMARY KEY(run_id,source_id), UNIQUE(run_id,national_code)
);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_products_code ON dav_catalog_products(run_id,national_code);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_products_status ON dav_catalog_products(run_id,is_active,is_expired);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_products_brand ON dav_catalog_products(run_id,brand_name);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_products_order ON dav_catalog_products(run_id,brand_name COLLATE NOCASE,national_code);
CREATE TABLE IF NOT EXISTS dav_catalog_legacy_links (
 run_id TEXT NOT NULL, source_id TEXT NOT NULL, legacy_drug_id TEXT NOT NULL,
 national_code_key TEXT NOT NULL, clinical_monograph_id TEXT,
 PRIMARY KEY(run_id,source_id,legacy_drug_id),
 FOREIGN KEY(run_id,source_id) REFERENCES dav_catalog_products(run_id,source_id),
 FOREIGN KEY(legacy_drug_id) REFERENCES dav_national_drugs(id)
);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_legacy_links_code ON dav_catalog_legacy_links(run_id,national_code_key);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_legacy_links_legacy ON dav_catalog_legacy_links(run_id,legacy_drug_id);
CREATE TABLE IF NOT EXISTS dav_catalog_inventory_links (
 run_id TEXT NOT NULL, source_id TEXT NOT NULL, inventory_batch_id TEXT NOT NULL,
 registration_code_key TEXT NOT NULL,
 PRIMARY KEY(run_id,source_id,inventory_batch_id),
 FOREIGN KEY(run_id,source_id) REFERENCES dav_catalog_products(run_id,source_id),
 FOREIGN KEY(inventory_batch_id) REFERENCES inventory_batches(id)
);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_inventory_links_batch ON dav_catalog_inventory_links(inventory_batch_id);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_inventory_links_product ON dav_catalog_inventory_links(run_id,source_id,inventory_batch_id);
CREATE TABLE IF NOT EXISTS dav_catalog_clinical_links (
 run_id TEXT NOT NULL, source_id TEXT NOT NULL, monograph_id TEXT NOT NULL,
 PRIMARY KEY(run_id,source_id,monograph_id),
 FOREIGN KEY(run_id,source_id) REFERENCES dav_catalog_products(run_id,source_id)
);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_clinical_links_mono ON dav_catalog_clinical_links(run_id,monograph_id);
CREATE TABLE IF NOT EXISTS dav_catalog_clinical_matches (
 run_id TEXT NOT NULL, source_id TEXT NOT NULL, monograph_id TEXT NOT NULL,
 match_type TEXT NOT NULL, match_basis TEXT NOT NULL,
 PRIMARY KEY(run_id,source_id,monograph_id,match_type),
 FOREIGN KEY(run_id,source_id) REFERENCES dav_catalog_products(run_id,source_id)
);
CREATE TABLE IF NOT EXISTS dav_catalog_clinical_content (
 run_id TEXT NOT NULL, source_id TEXT NOT NULL, monograph_id TEXT NOT NULL,
 drug_class TEXT, indications TEXT, contraindications TEXT, precautions TEXT,
 pregnancy_warning TEXT, adverse_effects TEXT, adult_dosage TEXT, pediatric_dosage TEXT,
 renal_adjustment TEXT, hepatic_adjustment TEXT, drug_interactions TEXT,
 overdose_treatment TEXT, antidote TEXT, source TEXT,
 PRIMARY KEY(run_id,source_id,monograph_id),
 FOREIGN KEY(run_id,source_id) REFERENCES dav_catalog_products(run_id,source_id)
);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_clinical_content_source ON dav_catalog_clinical_content(run_id,source_id);
CREATE INDEX IF NOT EXISTS ix_dav_catalog_legacy_product ON dav_catalog_legacy_links(run_id,source_id,legacy_drug_id);
CREATE TABLE IF NOT EXISTS dav_product_ingredients (
 run_id TEXT NOT NULL, source_id TEXT NOT NULL, ingredient_ordinal INTEGER NOT NULL, name_raw TEXT NOT NULL,
 strength_raw TEXT, parse_status TEXT NOT NULL, review_reason TEXT,
 PRIMARY KEY(run_id,source_id,ingredient_ordinal),
 FOREIGN KEY(run_id,source_id) REFERENCES dav_catalog_products(run_id,source_id)
);
CREATE TABLE IF NOT EXISTS dav_ingredients (run_id TEXT NOT NULL, canonical_inn TEXT NOT NULL, atc_code_raw TEXT, source_title TEXT, PRIMARY KEY(run_id,canonical_inn));
CREATE TABLE IF NOT EXISTS dav_ingredient_mappings (
 run_id TEXT NOT NULL, source_id TEXT NOT NULL, ingredient_ordinal INTEGER NOT NULL, raw_name TEXT NOT NULL,
 canonical_inn TEXT, atc_code_raw TEXT, mapping_status TEXT NOT NULL, match_type TEXT,
 PRIMARY KEY(run_id,source_id,ingredient_ordinal),
 FOREIGN KEY(run_id,source_id,ingredient_ordinal) REFERENCES dav_product_ingredients(run_id,source_id,ingredient_ordinal),
 FOREIGN KEY(run_id,canonical_inn) REFERENCES dav_ingredients(run_id,canonical_inn)
);
CREATE VIRTUAL TABLE IF NOT EXISTS dav_product_search USING fts5(
 run_id UNINDEXED, source_id UNINDEXED, national_code, brand_name, active_ingredients,
 tokenize='unicode61 remove_diacritics 2'
);
CREATE VIRTUAL TABLE IF NOT EXISTS dav_product_search_trigram USING fts5(
 run_id UNINDEXED, source_id UNINDEXED, national_code, brand_name, active_ingredients, note,
 tokenize='trigram'
);
"""

PRODUCT_COLUMNS = (
    "source_id", "national_code", "brand_name", "active_ingredient_raw", "strength_raw", "dosage_form",
    "package_spec", "standard_pharmacopeia", "shelf_life", "manufacturer", "manufacturer_country",
    "applicant", "applicant_country", "approval_date", "expiry_date", "approval_decision",
    "is_active", "is_expired", "normalization_flags",
)
