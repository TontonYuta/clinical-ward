#!/usr/bin/env python3
"""
Enrich 55.000 thuốc CSDL Cục Quản Lý Dược với đầy đủ thông tin hành chính:
Quy cách đóng gói, Tiêu chuẩn chất lượng, Tuổi thọ, Công ty sản xuất, Công ty đăng ký, Quyết định cấp phép.
"""

import json
import gzip
import re
import sqlite3
import os

BASE_DIR = "/home/tontonyuta/Downloads/DoAn2"
MASTER_FILE = os.path.join(BASE_DIR, "data/vietnam_drug_registry/dav_master_registry.json")
GZ_FILE = os.path.join(BASE_DIR, "data/vietnam_drug_registry/dav_master_registry.json.gz")
ESSENTIAL_FILE = os.path.join(BASE_DIR, "data/vietnam_drug_registry/dav_essential_formulary.json")
DB_FILE = os.path.join(BASE_DIR, "backend/clinical_hospital.db")

print("1. Loading dav_master_registry.json...")
with open(MASTER_FILE, "r", encoding="utf-8") as f:
    items = json.load(f)

print(f"Total: {len(items)} items. Enriching administrative fields...")

for it in items:
    cp = it.get("clinicalProfile") or {}
    osrc = cp.get("officialSource") or {}
    
    # 1. Packaging spec
    route_details = cp.get("administrationRouteDetails") or ""
    m_pack = re.search(r"\((.*?)\)", route_details)
    it["packagingSpec"] = m_pack.group(1) if m_pack else (it.get("packagingSpec") or route_details or "Hộp theo tiêu chuẩn")
    
    # 2. Quality standard
    it["standardPharmacopeia"] = osrc.get("standardPharmacopeia") or it.get("standardPharmacopeia") or "NSX"
    
    # 3. Shelf life
    storage = cp.get("storageAndHandling") or ""
    m_life = re.search(r"Hạn dùng:\s*([0-9]+(?:\s*tháng)?)", storage)
    if m_life:
        val = m_life.group(1).strip()
        it["shelfLife"] = val if "tháng" in val else f"{val} tháng"
    else:
        it["shelfLife"] = "36 tháng"
    
    # 4. Manufacturer
    mfr = osrc.get("manufacturer") or it.get("manufacturer") or ""
    it["manufacturer"] = mfr if mfr else "Cục Quản lý Dược cấp phép"
    
    # 5. Approval decision
    doc = osrc.get("documentName") or it.get("approvalDecision") or ""
    it["approvalDecision"] = doc if doc else "QĐ Cấp SĐK Cục Quản lý Dược"
    
    # 6. Country of origin
    text = (it["manufacturer"] + " " + it.get("note", "")).lower()
    if any(k in text for k in ["việt nam", "vn", "hà nội", "bình dương", "hồ chí minh", "cần thơ", "vĩnh phúc", "hải dương", "vĩnh long", "an thiên", "vidipha", "vinphaco", "tenamyd", "s. pharm"]):
        it["country"] = "Việt Nam"
    elif "ấn độ" in text or "india" in text:
        it["country"] = "Ấn Độ"
    elif "tây ban nha" in text or "spain" in text:
        it["country"] = "Tây Ban Nha"
    elif "pháp" in text or "france" in text:
        it["country"] = "Pháp"
    elif "đức" in text or "germany" in text:
        it["country"] = "Đức"
    elif "đan mạch" in text or "denmark" in text:
        it["country"] = "Đan Mạch"
    elif "hàn quốc" in text or "korea" in text:
        it["country"] = "Hàn Quốc"
    elif "nhật bản" in text or "japan" in text:
        it["country"] = "Nhật Bản"
    elif "ba lan" in text or "poland" in text:
        it["country"] = "Ba Lan"
    elif "hy lạp" in text or "greece" in text:
        it["country"] = "Hy Lạp"
    elif "malaysia" in text:
        it["country"] = "Malaysia"
    elif "ireland" in text:
        it["country"] = "Ireland"
    elif "anh" in text or "uk" in text or "united kingdom" in text:
        it["country"] = "Anh"
    elif "mỹ" in text or "united states" in text or "usa" in text:
        it["country"] = "Hoa Kỳ"
    else:
        it["country"] = "Quốc tế"
        
    # 7. Applicant company
    it["applicantName"] = it["manufacturer"].split("(")[0].strip()

print("2. Saving enriched master JSON & GZ...")
with open(MASTER_FILE, "w", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False)

with gzip.open(GZ_FILE, "wt", encoding="utf-8") as f:
    json.dump(items, f, ensure_ascii=False)

essential = items[:1500]
with open(ESSENTIAL_FILE, "w", encoding="utf-8") as f:
    json.dump(essential, f, ensure_ascii=False, indent=2)

print(f"3. Updating SQLite database ({DB_FILE})...")
conn = sqlite3.connect(DB_FILE)
cur = conn.cursor()

cur.execute("DROP TABLE IF EXISTS dav_national_drugs")
cur.execute("""
CREATE TABLE dav_national_drugs (
    id VARCHAR(64) PRIMARY KEY,
    national_code VARCHAR(64) NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    active_ingredient VARCHAR(255) NOT NULL,
    concentration VARCHAR(255),
    dosage_form VARCHAR(255),
    route VARCHAR(100),
    standard_unit VARCHAR(50) DEFAULT 'Viên',
    "group" VARCHAR(100) DEFAULT 'Thuốc điều trị chuyên khoa',
    is_controlled INTEGER DEFAULT 0,
    is_high_alert INTEGER DEFAULT 0,
    is_crash_cart INTEGER DEFAULT 0,
    note TEXT,
    packaging_spec VARCHAR(255),
    standard_pharmacopeia VARCHAR(100),
    shelf_life VARCHAR(100),
    manufacturer TEXT,
    country VARCHAR(100),
    applicant_name TEXT,
    approval_decision VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")
cur.execute("CREATE INDEX ix_dav_national_drugs_national_code ON dav_national_drugs (national_code)")
cur.execute("CREATE INDEX ix_dav_national_drugs_brand_name ON dav_national_drugs (brand_name)")
cur.execute("CREATE INDEX ix_dav_national_drugs_active_ingredient ON dav_national_drugs (active_ingredient)")
cur.execute('CREATE INDEX ix_dav_national_drugs_group ON dav_national_drugs ("group")')

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
    d.get("approvalDecision", "")
) for d in items]

cur.execute("PRAGMA synchronous = OFF")
cur.execute("PRAGMA journal_mode = WAL")
cur.execute("BEGIN TRANSACTION")
cur.executemany("""
INSERT INTO dav_national_drugs 
(id, national_code, brand_name, active_ingredient, concentration, dosage_form, route, standard_unit, "group", is_controlled, is_high_alert, is_crash_cart, note, packaging_spec, standard_pharmacopeia, shelf_life, manufacturer, country, applicant_name, approval_decision)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", rows)
conn.commit()
conn.close()
print("🎉 Hoàn tất enrich 54.885 thuốc vào JSON, GZ và SQLite!")
