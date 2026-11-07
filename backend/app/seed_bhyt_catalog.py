"""
Khởi tạo và nạp danh mục CSDL Thuốc BHYT (Thông tư 20/2022/TT-BYT) vào SQLite
"""
import os
import json
import sqlite3
import unicodedata

def remove_vietnamese_accents(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    text = text.replace('đ', 'd').replace('Đ', 'D')
    return text.lower().strip()

def resolve_db_path() -> str:
    candidates = (
        "clinical_hospital.db",
        "backend/clinical_hospital.db",
        "../clinical_hospital.db",
        "/home/tontonyuta/Downloads/DoAn2/backend/clinical_hospital.db"
    )
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return os.path.abspath("backend/clinical_hospital.db")

def seed_bhyt_catalog() -> int:
    db_path = resolve_db_path()
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Tạo bảng nếu chưa tồn tại
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bhyt_drug_catalog (
        id VARCHAR(64) PRIMARY KEY,
        stt_thong_tu_20 INTEGER,
        atc_code VARCHAR(10) NOT NULL,
        active_ingredient VARCHAR(255) NOT NULL,
        active_ingredient_normalized VARCHAR(255) NOT NULL,
        brand_names_json TEXT NOT NULL DEFAULT '[]',
        route VARCHAR(64) DEFAULT 'Uống',
        allowed_ranks_json TEXT NOT NULL,
        payment_ratio REAL NOT NULL DEFAULT 1.0,
        requires_consultation BOOLEAN NOT NULL DEFAULT 0,
        max_outpatient_days INTEGER NOT NULL DEFAULT 30,
        allowed_icd10_json TEXT DEFAULT NULL,
        forbidden_icd10_json TEXT DEFAULT NULL,
        special_conditions TEXT DEFAULT NULL,
        pdf_page INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bhyt_therapeutic_classes (
        id VARCHAR(32) PRIMARY KEY,
        class_name VARCHAR(255) NOT NULL,
        atc_prefixes_json TEXT NOT NULL,
        max_allowed INTEGER NOT NULL DEFAULT 1,
        rejection_title VARCHAR(255) NOT NULL,
        rejection_rationale TEXT NOT NULL,
        legal_doc_code VARCHAR(64) NOT NULL DEFAULT '3618/QĐ-BHXH',
        legal_section VARCHAR(128) NOT NULL DEFAULT 'Mục 3.2.b (Kiểm tra trùng lặp chỉ định thuốc)',
        legal_page INTEGER NOT NULL DEFAULT 22
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bhyt_incompatible_classes (
        id VARCHAR(64) PRIMARY KEY,
        class_code_a VARCHAR(32) NOT NULL,
        atc_prefix_a VARCHAR(16) NOT NULL,
        class_code_b VARCHAR(32) NOT NULL,
        atc_prefix_b VARCHAR(16) NOT NULL,
        pair_name VARCHAR(255) NOT NULL,
        rejection_title VARCHAR(255) NOT NULL,
        rejection_rationale TEXT NOT NULL,
        legal_doc_code VARCHAR(64) NOT NULL DEFAULT '3618/QĐ-BHXH',
        legal_section VARCHAR(128) NOT NULL DEFAULT 'Mục 3.2.b & Hướng dẫn điều trị BYT',
        legal_page INTEGER NOT NULL DEFAULT 22
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bhyt_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        prescription_id VARCHAR(64) NOT NULL,
        patient_name VARCHAR(128) DEFAULT '',
        insurance_card_number VARCHAR(20) DEFAULT '',
        hospital_rank VARCHAR(32) DEFAULT 'HANG_I',
        treatment_type VARCHAR(16) DEFAULT 'NGOAI_TRU',
        primary_icd10 VARCHAR(16) DEFAULT '',
        status VARCHAR(16) DEFAULT 'PASS',
        total_cost_vnd REAL DEFAULT 0.0,
        at_risk_cost_vnd REAL DEFAULT 0.0,
        violations_count INTEGER DEFAULT 0,
        violations_json TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bhyt_catalog_atc ON bhyt_drug_catalog(atc_code);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bhyt_catalog_nosign ON bhyt_drug_catalog(active_ingredient_normalized);")

    # Seed bảng quy tắc nhóm trùng lặp (Declarative Rules - Không hardcode trong logic code)
    therapeutic_rules = [
        ("PPI", "PPI dạ dày", json.dumps(["A02BC", "A02B"]), 1,
         "Trùng lặp nhóm tác dụng (PPI dạ dày)",
         "Cơ quan BHXH từ chối thanh toán 2 thuốc ức chế bơm proton cùng cơ chế tác dụng trong 1 đợt khám."),
        ("NSAID", "NSAID kháng viêm", json.dumps(["M01A"]), 1,
         "Trùng lặp nhóm tác dụng (NSAID kháng viêm)",
         "Cơ quan BHXH từ chối thanh toán 2 thuốc chống viêm không steroid (NSAID) cùng cơ chế tác dụng trong 1 đợt khám."),
        ("STATIN", "Statin hạ lipid máu", json.dumps(["C10AA"]), 1,
         "Trùng lặp nhóm tác dụng (Statin hạ lipid máu)",
         "Cơ quan BHXH từ chối thanh toán 2 thuốc nhóm Statin hạ lipid máu trong cùng 1 đơn ngoại trú do tăng nguy cơ tiêu cơ vân."),
        ("CORTICOID", "Corticoid toàn thân", json.dumps(["H02AB"]), 1,
         "Trùng lặp nhóm tác dụng (Corticoid toàn thân)",
         "Cơ quan BHXH từ chối thanh toán 2 glucocorticoid đường toàn thân đồng thời.")
    ]
    for tr in therapeutic_rules:
        cursor.execute("""
        INSERT OR REPLACE INTO bhyt_therapeutic_classes (
            id, class_name, atc_prefixes_json, max_allowed, rejection_title, rejection_rationale
        ) VALUES (?, ?, ?, ?, ?, ?)
        """, tr)

    # Seed bảng cặp thuốc chống chỉ định phối hợp
    incompatible_rules = [
        ("INC-RAAS-DUAL", "ACEI", "C09A", "ARB", "C09C",
         "Phối hợp ức chế men chuyển (ACEI) + Chẹn thụ thể (ARB)",
         "Trùng lặp nhóm tác dụng (Thuốc ức chế hệ RAAS (ACEI/ARB))",
         "Bộ Y Tế và BHXH nghiêm cấm phối hợp đồng thời thuốc ức chế men chuyển và chẹn thụ thể angiotensin do làm tăng nguy cơ suy thận cấp, hạ huyết áp quá mức và tăng kali máu.")
    ]
    for ir in incompatible_rules:
        cursor.execute("""
        INSERT OR REPLACE INTO bhyt_incompatible_classes (
            id, class_code_a, atc_prefix_a, class_code_b, atc_prefix_b, pair_name, rejection_title, rejection_rationale
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ir)

    # 2. Tìm file data JSON
    json_candidates = (
        "data/bhyt_drug_rules.json",
        "backend/data/bhyt_drug_rules.json",
        "../backend/data/bhyt_drug_rules.json",
        "/home/tontonyuta/Downloads/DoAn2/backend/data/bhyt_drug_rules.json"
    )
    json_path = None
    for p in json_candidates:
        if os.path.exists(p):
            json_path = os.path.abspath(p)
            break

    if not json_path:
        print("ERROR: Không tìm thấy file bhyt_drug_rules.json")
        conn.close()
        return 0

    with open(json_path, "r", encoding="utf-8") as f:
        rules = json.load(f)

    print(f"Loaded {len(rules)} rules from {json_path}")

    # 3. Insert / Update
    inserted = 0
    for idx, r in enumerate(rules):
        rule_id = f"BHYT-{r.get('atcGroup', 'GEN')}-{idx+1:04d}"
        stt = idx + 1
        atc = r.get("atcGroup", "")
        active_ing = r.get("activeIngredient", "")
        active_ing_norm = remove_vietnamese_accents(active_ing)
        brand_names = json.dumps(r.get("drugNames", []), ensure_ascii=False)
        allowed_ranks = json.dumps(r.get("allowedRanks", []), ensure_ascii=False)
        payment_ratio = float(r.get("paymentRatio", 1.0))
        requires_consultation = 1 if r.get("requiresConsultation") else 0
        approved_icds = json.dumps(r.get("approvedIcd10Prefixes", []), ensure_ascii=False) if r.get("approvedIcd10Prefixes") else None
        forbidden_icds = json.dumps(r.get("forbiddenIcd10Prefixes", []), ensure_ascii=False) if r.get("forbiddenIcd10Prefixes") else None
        special_conditions = r.get("specialConditions", "")
        pdf_page = int(r.get("pdfPage", 1))

        cursor.execute("""
        INSERT OR REPLACE INTO bhyt_drug_catalog (
            id, stt_thong_tu_20, atc_code, active_ingredient, active_ingredient_normalized,
            brand_names_json, route, allowed_ranks_json, payment_ratio,
            requires_consultation, max_outpatient_days, allowed_icd10_json,
            forbidden_icd10_json, special_conditions, pdf_page
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule_id, stt, atc, active_ing, active_ing_norm,
            brand_names, "Uống", allowed_ranks, payment_ratio,
            requires_consultation, 30, approved_icds,
            forbidden_icds, special_conditions, pdf_page
        ))
        inserted += 1

    conn.commit()
    conn.close()
    print(f"Successfully seeded {inserted} BHYT drug rules into SQLite!")
    return inserted

if __name__ == "__main__":
    seed_bhyt_catalog()
