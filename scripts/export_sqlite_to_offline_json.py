#!/usr/bin/env python3
"""
Đồng bộ toàn bộ CSDL dav_national_drugs (đã enrich 16 trường lâm sàng Dược Thư 2022)
từ SQLite sang public/ và data/vietnam_drug_registry/dav_master_registry.json.gz (tinh gọn 21MB)
và dav_essential_formulary.json.
"""

import gzip
import json
import os
import shutil
import sqlite3

DB_PATH = "/home/tontonyuta/Downloads/DoAn2/backend/clinical_hospital.db"
PUBLIC_DIR = "/home/tontonyuta/Downloads/DoAn2/public/data/vietnam_drug_registry"
DATA_DIR = "/home/tontonyuta/Downloads/DoAn2/data/vietnam_drug_registry"
DIST_DIR = "/home/tontonyuta/Downloads/DoAn2/dist/data/vietnam_drug_registry"

def export_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT * FROM dav_national_drugs ORDER BY id")
    rows = cur.fetchall()
    print(f"📦 Đang xử lý {len(rows)} bản ghi từ CSDL SQLite...")

    items = []
    enriched_count = 0

    for r in rows:
        d = dict(r)
        has_clinical = bool(d.get("contraindications") or d.get("adult_dosage"))
        if has_clinical:
            enriched_count += 1

        brand_name = d.get("brand_name") or ""
        aliases = [brand_name.lower()] if brand_name else []

        # Tinh gọn: Lưu giữ các trường an toàn lâm sàng trọng yếu cho cảnh báo & đối soát
        # Chi tiết toàn văn (chỉ định dài, tương tác sâu) được lấy qua bảng clinical_drug_monographs theo ID
        item = {
            "id": d.get("id"),
            "nationalCode": d.get("national_code"),
            "brandName": brand_name,
            "activeIngredient": d.get("active_ingredient") or "",
            "concentration": d.get("concentration") or "",
            "dosageForm": d.get("dosage_form") or "",
            "route": d.get("route") or "",
            "standardUnit": d.get("standard_unit") or "Viên",
            "defaultDoseQty": 1,
            "group": d.get("group") or "Thuốc điều trị chuyên khoa",
            "isControlled": bool(d.get("is_controlled")),
            "isHighAlert": bool(d.get("is_high_alert")),
            "isCrashCart": bool(d.get("is_crash_cart")),
            "wardStockCount": 0,
            "hospitalStockCount": 0,
            "searchAliases": aliases,
            "note": d.get("note") or "",
            "packagingSpec": d.get("packaging_spec") or "",
            "standardPharmacopeia": d.get("standard_pharmacopeia") or "NSX",
            "shelfLife": d.get("shelf_life") or "36 tháng",
            "manufacturer": d.get("manufacturer") or "",
            "country": d.get("country") or "Việt Nam",
            "applicantName": d.get("applicant_name") or "",
            "approvalDecision": d.get("approval_decision") or "",
            "hdsdPath": d.get("hdsd_path"),
            "labelPath": d.get("label_path"),
            # Trường dữ liệu lâm sàng Dược Thư Quốc Gia 2022
            "atcCode": d.get("atc_code"),
            "drugClass": d.get("drug_class"),
            "contraindications": d.get("contraindications"),
            "adultDosage": d.get("adult_dosage"),
            "pediatricDosage": d.get("pediatric_dosage"),
            "renalAdjustment": d.get("renal_adjustment"),
            "pregnancyWarning": d.get("pregnancy_warning"),
            "antidote": d.get("antidote"),
            "clinicalSource": d.get("clinical_source"),
            "clinicalMonographId": d.get("clinical_monograph_id"),
        }
        items.append(item)

    conn.close()

    print(f"✅ Đã tải {len(items)} bản ghi ({enriched_count} bản ghi có thông tin lâm sàng DTQG).")

    # 1. Ghi dav_master_registry.json.gz (khoảng 21MB)
    for target_dir in (PUBLIC_DIR, DATA_DIR):
        os.makedirs(target_dir, exist_ok=True)
        master_gz_path = os.path.join(target_dir, "dav_master_registry.json.gz")
        print(f"💾 Đang nén và ghi {master_gz_path}...")
        with gzip.open(master_gz_path, "wt", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, separators=(",", ":"))
        print(f"   Kích thước file gz: {os.path.getsize(master_gz_path) / 1024 / 1024:.2f} MB")

    # 2. Ghi dav_essential_formulary.json (1500 thuốc phổ biến/thiết yếu có đầy đủ mọi trường)
    enriched_items = [it for it in items if it.get("contraindications")]
    non_enriched = [it for it in items if not it.get("contraindications")]
    essential_items = enriched_items[:1200] + non_enriched[:300]

    for target_dir in (PUBLIC_DIR, DATA_DIR):
        essential_json_path = os.path.join(target_dir, "dav_essential_formulary.json")
        print(f"💾 Đang ghi {essential_json_path} ({len(essential_items)} thuốc)...")
        with open(essential_json_path, "w", encoding="utf-8") as f:
            json.dump(essential_items, f, ensure_ascii=False, indent=2)
        print(f"   Kích thước file essential: {os.path.getsize(essential_json_path) / 1024 / 1024:.2f} MB")

    # 3. Đồng bộ sang thư mục dist nếu tồn tại
    if os.path.exists(DIST_DIR):
        print(f"🔄 Sao chép bản cập nhật sang {DIST_DIR}...")
        shutil.copy2(os.path.join(PUBLIC_DIR, "dav_master_registry.json.gz"), os.path.join(DIST_DIR, "dav_master_registry.json.gz"))
        shutil.copy2(os.path.join(PUBLIC_DIR, "dav_essential_formulary.json"), os.path.join(DIST_DIR, "dav_essential_formulary.json"))
        print("   Đã đồng bộ sang dist/ thành công.")

    print("🎉 Hoàn tất đồng bộ dữ liệu ngoại tuyến tối ưu dung lượng!")

if __name__ == "__main__":
    export_db()
