import os
import json
import sqlite3

def seed_dav_registry_if_needed(db_file: str = "clinical_hospital.db"):
    if not os.path.exists(db_file):
        return

    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dav_national_drugs'")
    if not cursor.fetchone():
        conn.close()
        return

    cursor.execute("SELECT COUNT(*) FROM dav_national_drugs")
    count = cursor.fetchone()[0]
    if count >= 50000:
        conn.close()
        return

    json_candidates = [
        "../data/vietnam_drug_registry/dav_master_registry.json",
        "data/vietnam_drug_registry/dav_master_registry.json",
        "../../data/vietnam_drug_registry/dav_master_registry.json"
    ]
    json_path = None
    for cand in json_candidates:
        abs_c = os.path.abspath(os.path.join(os.path.dirname(__file__), cand))
        if os.path.exists(abs_c):
            json_path = abs_c
            break

    if not json_path:
        conn.close()
        return

    print(f"🏛️ Seeding 55.000 DAV drugs into SQLite from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        items = json.load(f)

    rows = []
    for d in items:
        rows.append((
            d.get("id") or f"dav-{d.get('nationalCode')}",
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
            d.get("note", "")
        ))

    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("BEGIN TRANSACTION")
    cursor.executemany("""
    INSERT OR REPLACE INTO dav_national_drugs 
    (id, national_code, brand_name, active_ingredient, concentration, dosage_form, route, standard_unit, "group", is_controlled, is_high_alert, is_crash_cart, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()
    print(f"✅ Đã nạp thành công {len(rows)} loại thuốc Cục Quản lý Dược vào SQLite!")
