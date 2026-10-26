#!/usr/bin/env python3
"""
Batch enrich DAV documents (HDSD & Mẫu nhãn) directly from DAV Portal.
Fetches top newest approved drugs and updates local master JSON, GZ, and SQLite DB.
"""

import json
import gzip
import sqlite3
import os
import urllib.request
import time

BASE_DIR = "/home/tontonyuta/Downloads/DoAn2"
MASTER_JSON = os.path.join(BASE_DIR, "data/vietnam_drug_registry/dav_master_registry.json")
MASTER_GZ = os.path.join(BASE_DIR, "data/vietnam_drug_registry/dav_master_registry.json.gz")
PUBLIC_GZ = os.path.join(BASE_DIR, "public/data/vietnam_drug_registry/dav_master_registry.json.gz")
DB_FILES = [
    os.path.join(BASE_DIR, "backend/clinical_hospital.db"),
    os.path.join(BASE_DIR, "clinical_hospital.db")
]

DAV_API = "https://dichvucong.dav.gov.vn/api/services/app/soDangKy/GetAllPublicServerPaging"

def extract_path(raw_json):
    if not raw_json or not isinstance(raw_json, str):
        return None
    try:
        arr = json.loads(raw_json)
        if isinstance(arr, list) and len(arr) > 0 and isinstance(arr[0], dict):
            return arr[0].get("duongDanTep")
    except Exception:
        pass
    return None

def fetch_page(skip, max_count=200):
    payload = json.dumps({
        "skipCount": skip,
        "maxResultCount": max_count,
        "filterText": "",
        "SoDangKyThuoc": {},
        "KichHoat": True
    }).encode("utf-8")
    req = urllib.request.Request(
        DAV_API,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("result", {}).get("items", [])
    except Exception as e:
        print(f"Error fetching skip={skip}: {e}")
        return []

def main():
    print("🚀 Fetching top newest approved drugs from DAV to enrich PDF documents...")
    all_docs = {}
    
    # Fetch 5 pages = 1000 drugs
    for page_idx in range(5):
        skip = page_idx * 200
        print(f"  Fetching batch {page_idx + 1}/5 (skipCount={skip})...")
        items = fetch_page(skip, 200)
        found_in_batch = 0
        for it in items:
            sdk = it.get("soDangKy")
            if not sdk:
                continue
            tai_lieu = it.get("thongTinTaiLieu") or {}
            hdsd = extract_path(tai_lieu.get("urlHuongDanSuDung"))
            label = extract_path(tai_lieu.get("urlNhan"))
            if hdsd or label:
                all_docs[sdk] = {"hdsd": hdsd, "label": label}
                found_in_batch += 1
        print(f"    Batch {page_idx + 1} done. Extracted {found_in_batch} drugs with documents.")
        time.sleep(0.5)

    print(f"\n✅ Total extracted drugs with PDF documents: {len(all_docs)}")

    # Update SQLite databases
    for db_path in DB_FILES:
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='dav_national_drugs'")
            if not c.fetchone():
                conn.close()
                continue
            updated = 0
            for sdk, doc in all_docs.items():
                c.execute(
                    "UPDATE dav_national_drugs SET hdsd_path = ?, label_path = ? WHERE national_code = ?",
                    (doc["hdsd"], doc["label"], sdk)
                )
                if c.rowcount > 0:
                    updated += c.rowcount
            conn.commit()
            conn.close()
            print(f"  Updated {updated} records in SQLite DB: {db_path}")

    # Update Master JSON
    if os.path.exists(MASTER_JSON):
        with open(MASTER_JSON, "r", encoding="utf-8") as f:
            items = json.load(f)
        
        json_updated = 0
        for it in items:
            sdk = it.get("nationalCode")
            if sdk in all_docs:
                it["hdsdPath"] = all_docs[sdk]["hdsd"]
                it["labelPath"] = all_docs[sdk]["label"]
                json_updated += 1

        with open(MASTER_JSON, "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False)
        print(f"  Updated {json_updated} records in {MASTER_JSON}")

        # Update GZ files
        for gz_path in [MASTER_GZ, PUBLIC_GZ]:
            with gzip.open(gz_path, "wt", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False)
            print(f"  Saved compressed {gz_path}")

    print("\n🎉 Batch enrichment complete!")

if __name__ == "__main__":
    main()
