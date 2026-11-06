"""
Dữ liệu khởi tạo Danh mục Thuốc Quốc gia Cục Quản lý Dược (DAV) (<=200 LOC)
"""
import os
import json
import gzip
import sqlite3
from app.seed_monographs import seed_clinical_monographs
from app.seed_registry_helpers import (
    init_dav_table,
    update_curated_enrichment,
    map_drug_item_to_tuple
)

def resolve_db_path(db_file: str | None = None) -> str:
    if db_file:
        return db_file
    for env_key in ("DATABASE_URL", "SQLITE_DB_PATH"):
        val = os.environ.get(env_key, "")
        if "sqlite:///" in val:
            return val.split("sqlite:///")[-1]
        if "sqlite+aiosqlite:///" in val:
            return val.split("sqlite+aiosqlite:///")[-1]
    if os.path.exists("/tmp/clinical_hospital.db"):
        return "/tmp/clinical_hospital.db"
    for candidate in ("clinical_hospital.db", "backend/clinical_hospital.db", "../clinical_hospital.db"):
        if os.path.exists(candidate):
            return os.path.abspath(candidate)
    return "/tmp/clinical_hospital.db" if os.environ.get("VERCEL") else "clinical_hospital.db"

def find_data_source() -> tuple[str | None, bool]:
    candidates_gz = (
        "/app/data/vietnam_drug_registry/dav_master_registry.json.gz",
        "data/vietnam_drug_registry/dav_master_registry.json.gz",
        "backend/data/vietnam_drug_registry/dav_master_registry.json.gz",
        "public/data/vietnam_drug_registry/dav_master_registry.json.gz",
        "../data/vietnam_drug_registry/dav_master_registry.json.gz",
        "../public/data/vietnam_drug_registry/dav_master_registry.json.gz",
        "../../data/vietnam_drug_registry/dav_master_registry.json.gz",
        "../../public/data/vietnam_drug_registry/dav_master_registry.json.gz",
    )
    for c in candidates_gz:
        if os.path.exists(c):
            return os.path.abspath(c), True
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p, True
        p_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", c))
        if os.path.exists(p_root):
            return p_root, True

    candidates_json = (
        "/app/data/vietnam_drug_registry/dav_essential_formulary.json",
        "data/vietnam_drug_registry/dav_essential_formulary.json",
        "backend/data/vietnam_drug_registry/dav_essential_formulary.json",
        "public/data/vietnam_drug_registry/dav_essential_formulary.json",
        "../data/vietnam_drug_registry/dav_essential_formulary.json",
        "../public/data/vietnam_drug_registry/dav_essential_formulary.json",
        "../../data/vietnam_drug_registry/dav_essential_formulary.json",
        "../../public/data/vietnam_drug_registry/dav_essential_formulary.json",
    )
    for c in candidates_json:
        if os.path.exists(c):
            return os.path.abspath(c), False
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p, False
        p_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", c))
        if os.path.exists(p_root):
            return p_root, False

    return None, False

def seed_dav_registry_if_needed(db_file: str | None = None) -> int:
    target_db = resolve_db_path(db_file)
    os.makedirs(os.path.dirname(os.path.abspath(target_db)), exist_ok=True)
    conn = sqlite3.connect(target_db)
    cursor = conn.cursor()

    init_dav_table(cursor)
    seed_clinical_monographs(conn)

    cursor.execute("SELECT COUNT(*) FROM dav_national_drugs")
    existing_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM dav_national_drugs WHERE contraindications IS NOT NULL")
    enriched_count = cursor.fetchone()[0]

    curated_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../data/vietnam_drug_registry/dav_essential_formulary.json"))
    if existing_count >= 1900 and enriched_count > 0:
        if os.path.exists(curated_path):
            update_curated_enrichment(cursor, curated_path)
            conn.commit()
        seed_clinical_monographs(conn)
        conn.close()
        return existing_count

    src_path, is_gz = find_data_source()
    if not src_path:
        conn.close()
        return existing_count

    print(f"🏛️ Seeding DAV registry from {src_path} (gz={is_gz}) into {target_db}...")
    opener = gzip.open if is_gz else open
    mode = "rt" if is_gz else "r"
    with opener(src_path, mode, encoding="utf-8") as f:
        items = json.load(f)

    if os.path.exists(curated_path):
        with open(curated_path, "r", encoding="utf-8") as f:
            curated_by_code = {item.get("nationalCode"): item for item in json.load(f)}
        items = [
            {**item, **{k: v for k, v in curated_by_code.get(item.get("nationalCode"), {}).items() if v is not None}}
            for item in items
        ]

    rows = [map_drug_item_to_tuple(d) for d in items]
    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("BEGIN TRANSACTION")
    cursor.executemany("""
    INSERT OR REPLACE INTO dav_national_drugs 
    (id, national_code, brand_name, active_ingredient, concentration, dosage_form, route, standard_unit, "group", is_controlled, is_high_alert, is_crash_cart, note, packaging_spec, standard_pharmacopeia, shelf_life, manufacturer, country, applicant_name, approval_decision, hdsd_path, label_path, atc_code, drug_class, indications, contraindications, precautions, pregnancy_warning, adult_dosage, pediatric_dosage, renal_adjustment, hepatic_adjustment, adverse_effects, drug_interactions, overdose_treatment, antidote, clinical_source, clinical_monograph_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    seed_clinical_monographs(conn)
    conn.close()
    print(f"✅ Đã nạp thành công {len(rows)} loại thuốc Cục Quản lý Dược vào SQLite ({target_db})!")
    return len(rows)
