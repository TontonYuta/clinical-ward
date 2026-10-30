import os
import re
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
    # 1. Gzip compressed master 55k dataset
    candidates_gz = (
        "data/vietnam_drug_registry/dav_master_registry.json.gz",
        "public/data/vietnam_drug_registry/dav_master_registry.json.gz",
        "../data/vietnam_drug_registry/dav_master_registry.json.gz",
        "../public/data/vietnam_drug_registry/dav_master_registry.json.gz",
        "../../data/vietnam_drug_registry/dav_master_registry.json.gz",
        "../../public/data/vietnam_drug_registry/dav_master_registry.json.gz",
    )
    for c in candidates_gz:
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p, True
        p_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", c))
        if os.path.exists(p_root):
            return p_root, True

    # 2. Essential formulary fallback (tracked in Git)
    candidates_json = (
        "data/vietnam_drug_registry/dav_essential_formulary.json",
        "public/data/vietnam_drug_registry/dav_essential_formulary.json",
        "../data/vietnam_drug_registry/dav_essential_formulary.json",
        "../public/data/vietnam_drug_registry/dav_essential_formulary.json",
        "../../data/vietnam_drug_registry/dav_essential_formulary.json",
        "../../public/data/vietnam_drug_registry/dav_essential_formulary.json",
    )
    for c in candidates_json:
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p, False
        p_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", c))
        if os.path.exists(p_root):
            return p_root, False

    return None, False

def find_monographs_source() -> str | None:
    candidates = (
        "backend/data/knowledge_base/dtqg_monographs_extracted.json",
        "data/knowledge_base/dtqg_monographs_extracted.json",
        "../data/knowledge_base/dtqg_monographs_extracted.json",
        "../../backend/data/knowledge_base/dtqg_monographs_extracted.json",
    )
    for c in candidates:
        p = os.path.abspath(os.path.join(os.path.dirname(__file__), c))
        if os.path.exists(p):
            return p
        p_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", c))
        if os.path.exists(p_root):
            return p_root
        if os.path.exists(c):
            return os.path.abspath(c)
    return None

def seed_clinical_monographs(conn: sqlite3.Connection):
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clinical_drug_monographs (
        id TEXT PRIMARY KEY,
        inn TEXT NOT NULL,
        title TEXT,
        atc_code TEXT,
        drug_class TEXT,
        dosage_forms TEXT,
        indications TEXT,
        contraindications TEXT,
        precautions TEXT,
        pregnancy_warning TEXT,
        adverse_effects TEXT,
        adult_dosage TEXT,
        pediatric_dosage TEXT,
        renal_adjustment TEXT,
        hepatic_adjustment TEXT,
        drug_interactions TEXT,
        overdose_treatment TEXT,
        antidote TEXT,
        source TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )""")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_clinical_monographs_inn ON clinical_drug_monographs(inn)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_clinical_monographs_atc ON clinical_drug_monographs(atc_code)")

    cursor.execute("SELECT COUNT(*) FROM clinical_drug_monographs")
    count = cursor.fetchone()[0]
    src = find_monographs_source()
    if not src:
        print("⚠️ Không tìm thấy dtqg_monographs_extracted.json")
        return count

    try:
        with open(src, "r", encoding="utf-8") as f:
            monos = json.load(f)
        rows = []
        for idx, m in enumerate(monos, 1):
            inn = m.get("inn", "")
            # Stable source row identity: the index distinguishes repeated INNs.
            m_id = f"DTQG-{idx:04d}-{re.sub(r'[^a-zA-Z0-9]', '', inn)[:20]}"
            rows.append((
                m_id,
                inn,
                m.get("title", ""),
                m.get("atc_code"),
                m.get("drug_class"),
                m.get("dosage_forms"),
                m.get("indications"),
                m.get("contraindications"),
                m.get("precautions"),
                m.get("pregnancy_warning"),
                m.get("adverse_effects"),
                m.get("adult_dosage"),
                m.get("pediatric_dosage"),
                m.get("renal_adjustment"),
                m.get("hepatic_adjustment"),
                m.get("drug_interactions"),
                m.get("overdose_treatment"),
                m.get("antidote"),
                m.get("source") or (f"Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT, Trang {m.get('start_page')}) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf" if m.get("start_page") else "Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT) • Tệp: Duoc_Thu_Quoc_Gia_Viet_Nam.pdf")
            ))
        cursor.execute("BEGIN TRANSACTION")
        cursor.executemany("""
        INSERT OR REPLACE INTO clinical_drug_monographs
        (id, inn, title, atc_code, drug_class, dosage_forms, indications, contraindications, precautions, pregnancy_warning, adverse_effects, adult_dosage, pediatric_dosage, renal_adjustment, hepatic_adjustment, drug_interactions, overdose_treatment, antidote, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)
        conn.commit()
        print(f"✅ Đã nạp {len(rows)} chuyên luận Dược Thư 2015 vào clinical_drug_monographs!")
        return len(rows)
    except Exception as e:
        print(f"Lỗi khi nạp chuyên luận Dược Thư: {e}")
        return 0

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
        hdsd_path TEXT, label_path TEXT,
        atc_code TEXT, drug_class TEXT,
        indications TEXT, contraindications TEXT, precautions TEXT,
        pregnancy_warning TEXT, adult_dosage TEXT, pediatric_dosage TEXT,
        renal_adjustment TEXT, hepatic_adjustment TEXT,
        adverse_effects TEXT, drug_interactions TEXT, overdose_treatment TEXT,
        antidote TEXT, clinical_source TEXT, clinical_monograph_id TEXT,
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
    for col_name, col_type in cols_to_add:
        try:
            cursor.execute(f"ALTER TABLE dav_national_drugs ADD COLUMN {col_name} {col_type}")
        except Exception:
            pass

    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_national_code ON dav_national_drugs (national_code)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_brand_name ON dav_national_drugs (brand_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_active_ingredient ON dav_national_drugs (active_ingredient)")
    cursor.execute('CREATE INDEX IF NOT EXISTS ix_dav_national_drugs_group ON dav_national_drugs ("group")')

    # Nạp bảng chuyên luận Dược Thư 2022
    seed_clinical_monographs(conn)

    cursor.execute("SELECT COUNT(*) FROM dav_national_drugs")
    existing_count = cursor.fetchone()[0]

    # Kiểm tra xem dữ liệu lâm sàng đã có chưa
    cursor.execute("SELECT COUNT(*) FROM dav_national_drugs WHERE contraindications IS NOT NULL")
    enriched_count = cursor.fetchone()[0]

    if existing_count >= 1900 and enriched_count > 0:
        conn.close()
        return existing_count

    src_path, is_gz = find_data_source()
    if not src_path:
        conn.close()
        return existing_count

    print(f"🏛️ Seeding DAV registry from {src_path} (gz={is_gz}) into {target_db}...")
    if is_gz:
        with gzip.open(src_path, "rt", encoding="utf-8") as f:
            items = json.load(f)
    else:
        with open(src_path, "r", encoding="utf-8") as f:
            items = json.load(f)

    rows = [(
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
    ) for d in items]

    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("BEGIN TRANSACTION")
    cursor.executemany("""
    INSERT OR REPLACE INTO dav_national_drugs 
    (id, national_code, brand_name, active_ingredient, concentration, dosage_form, route, standard_unit, "group", is_controlled, is_high_alert, is_crash_cart, note, packaging_spec, standard_pharmacopeia, shelf_life, manufacturer, country, applicant_name, approval_decision, hdsd_path, label_path, atc_code, drug_class, indications, contraindications, precautions, pregnancy_warning, adult_dosage, pediatric_dosage, renal_adjustment, hepatic_adjustment, adverse_effects, drug_interactions, overdose_treatment, antidote, clinical_source, clinical_monograph_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()
    print(f"✅ Đã nạp thành công {len(rows)} loại thuốc Cục Quản lý Dược vào SQLite ({target_db})!")
    return len(rows)
