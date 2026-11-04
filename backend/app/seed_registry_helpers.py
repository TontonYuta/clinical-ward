"""
Helper schema and mapping for DAV drug registry seeding (<=200 LOC)
"""
import json
import sqlite3

DAV_TABLE_SCHEMA = """
CREATE TABLE IF NOT EXISTS dav_national_drugs (
    id VARCHAR(64) PRIMARY KEY, national_code VARCHAR(64) NOT NULL,
    brand_name VARCHAR(255) NOT NULL, active_ingredient VARCHAR(255) NOT NULL,
    concentration VARCHAR(255), dosage_form VARCHAR(255), route VARCHAR(100),
    standard_unit VARCHAR(50) DEFAULT 'Viên', "group" VARCHAR(100) DEFAULT 'Thuốc điều trị chuyên khoa',
    is_controlled INTEGER DEFAULT 0, is_high_alert INTEGER DEFAULT 0, is_crash_cart INTEGER DEFAULT 0,
    note TEXT, packaging_spec VARCHAR(255), standard_pharmacopeia VARCHAR(100),
    shelf_life VARCHAR(100), manufacturer TEXT, country VARCHAR(100),
    applicant_name TEXT, approval_decision VARCHAR(255),
    hdsd_path TEXT, label_path TEXT,
    atc_code TEXT, drug_class TEXT,
    indications TEXT, contraindications TEXT, precautions TEXT,
    pregnancy_warning TEXT, adult_dosage TEXT, pediatric_dosage TEXT,
    renal_adjustment TEXT, hepatic_adjustment TEXT,
    adverse_effects TEXT, drug_interactions TEXT, overdose_treatment TEXT,
    antidote TEXT, clinical_source TEXT, clinical_monograph_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
"""

COLS_TO_ADD = [
    ("packaging_spec", "VARCHAR(255)"),
    ("standard_pharmacopeia", "VARCHAR(100)"),
    ("shelf_life", "VARCHAR(100)"),
    ("manufacturer", "TEXT"),
    ("country", "VARCHAR(100)"),
    ("applicant_name", "TEXT"),
    ("approval_decision", "VARCHAR(255)"),
    ("hdsd_path", "TEXT"),
    ("label_path", "TEXT"),
    ("atc_code", "TEXT"),
    ("drug_class", "TEXT"),
    ("indications", "TEXT"),
    ("contraindications", "TEXT"),
    ("precautions", "TEXT"),
    ("pregnancy_warning", "TEXT"),
    ("adult_dosage", "TEXT"),
    ("pediatric_dosage", "TEXT"),
    ("renal_adjustment", "TEXT"),
    ("hepatic_adjustment", "TEXT"),
    ("adverse_effects", "TEXT"),
    ("drug_interactions", "TEXT"),
    ("overdose_treatment", "TEXT"),
    ("antidote", "TEXT"),
    ("clinical_source", "TEXT"),
    ("clinical_monograph_id", "TEXT"),
    ("created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")
]

CLINICAL_COLUMNS = (
    ("atc_code", "atcCode"), ("drug_class", "drugClass"), ("indications", "indications"),
    ("contraindications", "contraindications"), ("precautions", "precautions"),
    ("pregnancy_warning", "pregnancyWarning"), ("adult_dosage", "adultDosage"),
    ("pediatric_dosage", "pediatricDosage"), ("renal_adjustment", "renalAdjustment"),
    ("hepatic_adjustment", "hepaticAdjustment"), ("adverse_effects", "adverseEffects"),
    ("drug_interactions", "drugInteractions"), ("overdose_treatment", "overdoseTreatment"),
    ("antidote", "antidote"), ("clinical_source", "clinicalSource"),
    ("clinical_monograph_id", "clinicalMonographId"),
)

def init_dav_table(cursor: sqlite3.Cursor):
    cursor.execute(DAV_TABLE_SCHEMA)
    for col_name, col_type in COLS_TO_ADD:
        try:
            cursor.execute(f"ALTER TABLE dav_national_drugs ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_national_code ON dav_national_drugs (national_code)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_brand_name ON dav_national_drugs (brand_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_active_ingredient ON dav_national_drugs (active_ingredient)")
    cursor.execute('CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_group ON dav_national_drugs ("group")')

def update_curated_enrichment(cursor: sqlite3.Cursor, curated_path: str):
    with open(curated_path, "r", encoding="utf-8") as f:
        curated_items = json.load(f)
    for item in curated_items:
        code = item.get("nationalCode")
        if not code:
            continue
        valid_updates = {col: item[source] for col, source in CLINICAL_COLUMNS if item.get(source) is not None}
        if not valid_updates:
            continue
        set_clause = ", ".join(f"{col} = ?" for col in valid_updates)
        cursor.execute(
            f"UPDATE dav_national_drugs SET {set_clause} WHERE national_code = ?",
            (*valid_updates.values(), code),
        )

def map_drug_item_to_tuple(d: dict) -> tuple:
    return (
        d.get("id") or f"dav-{d.get('nationalCode', '')}",
        d.get("nationalCode", ""),
        d.get("brandName", ""),
        d.get("activeIngredient", ""),
        d.get("concentration", ""),
        d.get("dosageForm", ""),
        d.get("route", ""),
        d.get("standardUnit", "Viên"),
        d.get("group", "Thuốc điều trị chuyên khoa"),
        1 if d.get("isControlled") else 0,
        1 if d.get("isHighAlert") else 0,
        1 if d.get("isCrashCart") else 0,
        d.get("note", ""),
        d.get("packagingSpec", ""),
        d.get("standardPharmacopeia", "NSX"),
        d.get("shelfLife", "36 tháng"),
        d.get("manufacturer", ""),
        d.get("country", "Việt Nam"),
        d.get("applicantName", ""),
        d.get("approvalDecision", ""),
        d.get("hdsdPath") or d.get("hdsd_path"),
        d.get("labelPath") or d.get("label_path"),
        d.get("atcCode") or d.get("atc_code"),
        d.get("drugClass") or d.get("drug_class"),
        d.get("indications"),
        d.get("contraindications"),
        d.get("precautions"),
        d.get("pregnancyWarning") or d.get("pregnancy_warning"),
        d.get("adultDosage") or d.get("adult_dosage"),
        d.get("pediatricDosage") or d.get("pediatric_dosage"),
        d.get("renalAdjustment") or d.get("renal_adjustment"),
        d.get("hepaticAdjustment") or d.get("hepatic_adjustment"),
        d.get("adverseEffects") or d.get("adverse_effects"),
        d.get("drugInteractions") or d.get("drug_interactions"),
        d.get("overdoseTreatment") or d.get("overdose_treatment"),
        d.get("antidote"),
        d.get("clinicalSource") or d.get("clinical_source"),
        d.get("clinicalMonographId") or d.get("clinical_monograph_id")
    )
