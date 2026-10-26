import os
import json
import gzip
import sqlite3

def resolve_db_path(db_file: str | None = None) -> str:
    if db_file and (os.path.exists(db_file) or "/tmp/" in db_file):
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
    # 1. Gzip compressed master 55k dataset (5.6MB, tracked in Git)
    for c in ("data/vietnam_drug_registry/dav_master_registry.json.gz",
              "../data/vietnam_drug_registry/dav_master_registry.json.gz",
              "../../data/vietnam_drug_registry/dav_master_registry.json.gz"):
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p, True
    # 2. Uncompressed master 55k dataset (109MB, local)
    for c in ("data/vietnam_drug_registry/dav_master_registry.json",
              "../data/vietnam_drug_registry/dav_master_registry.json",
              "../../data/vietnam_drug_registry/dav_master_registry.json"):
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p, False
    # 3. Essential formulary fallback (1.4MB, tracked in Git)
    for c in ("data/vietnam_drug_registry/dav_essential_formulary.json",
              "../data/vietnam_drug_registry/dav_essential_formulary.json",
              "../../data/vietnam_drug_registry/dav_essential_formulary.json"):
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p, False
    return None, False

def seed_dav_registry_if_needed(db_file: str | None = None) -> int:
    target_db = resolve_db_path(db_file)
    os.makedirs(os.path.dirname(os.path.abspath(target_db)), exist_ok=True)
    conn = sqlite3.connect(target_db)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dav_national_drugs (
        id VARCHAR(64) PRIMARY KEY, national_code VARCHAR(64) NOT NULL,
        brand_name VARCHAR(255) NOT NULL, active_ingredient VARCHAR(255) NOT NULL,
        concentration VARCHAR(255), dosage_form VARCHAR(255), route VARCHAR(100),
        standard_unit VARCHAR(50) DEFAULT 'Viên', "group" VARCHAR(100) DEFAULT 'Thuốc điều trị chuyên khoa',
        is_controlled INTEGER DEFAULT 0, is_high_alert INTEGER DEFAULT 0, is_crash_cart INTEGER DEFAULT 0,
        note TEXT, packaging_spec VARCHAR(255), standard_pharmacopeia VARCHAR(100),
        shelf_life VARCHAR(100), manufacturer TEXT, country VARCHAR(100),
        applicant_name TEXT, approval_decision VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    cols_to_add = [
        ("packaging_spec", "VARCHAR(255)"),
        ("standard_pharmacopeia", "VARCHAR(100)"),
        ("shelf_life", "VARCHAR(100)"),
        ("manufacturer", "TEXT"),
        ("country", "VARCHAR(100)"),
        ("applicant_name", "TEXT"),
        ("approval_decision", "VARCHAR(255)"),
        ("hdsd_path", "TEXT"),
        ("label_path", "TEXT"),
        ("created_at", "DATETIME DEFAULT CURRENT_TIMESTAMP")
    ]
    for col_name, col_type in cols_to_add:
        try:
            cursor.execute(f"ALTER TABLE dav_national_drugs ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_national_code ON dav_national_drugs (national_code)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_brand_name ON dav_national_drugs (brand_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_active_ingredient ON dav_national_drugs (active_ingredient)")
    cursor.execute('CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_group ON dav_national_drugs ("group")')

    cursor.execute("SELECT COUNT(*) FROM dav_national_drugs")
    existing_count = cursor.fetchone()[0]
    if existing_count >= 1900:
        conn.close()
        return existing_count

    src_path, is_gz = find_data_source()
    if not src_path:
        conn.close()
        return 0

    print(f"🏛️ Seeding DAV registry from {src_path} (gz={is_gz}) into {target_db}...")
    if is_gz:
        with gzip.open(src_path, "rt", encoding="utf-8") as f:
            items = json.load(f)
    else:
        with open(src_path, "r", encoding="utf-8") as f:
            items = json.load(f)

    rows = [(
        d.get("id") or f"dav-{d.get('nationalCode')}",
        d.get("nationalCode", ""), d.get("brandName", ""), d.get("activeIngredient", ""),
        d.get("concentration", ""), d.get("dosageForm", ""), d.get("route", ""),
        d.get("standardUnit", "Viên"), d.get("group", "Thuốc điều trị chuyên khoa"),
        1 if d.get("isControlled") else 0, 1 if d.get("isHighAlert") else 0,
        1 if d.get("isCrashCart") else 0, d.get("note", ""),
        d.get("packagingSpec", ""), d.get("standardPharmacopeia", "NSX"),
        d.get("shelfLife", "36 tháng"), d.get("manufacturer", ""),
        d.get("country", "Việt Nam"), d.get("applicantName", ""),
        d.get("approvalDecision", "")
    ) for d in items]

    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("BEGIN TRANSACTION")
    cursor.executemany("""
    INSERT OR REPLACE INTO dav_national_drugs 
    (id, national_code, brand_name, active_ingredient, concentration, dosage_form, route, standard_unit, "group", is_controlled, is_high_alert, is_crash_cart, note, packaging_spec, standard_pharmacopeia, shelf_life, manufacturer, country, applicant_name, approval_decision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()
    print(f"✅ Đã nạp thành công {len(rows)} loại thuốc Cục Quản lý Dược vào SQLite ({target_db})!")
    return len(rows)
