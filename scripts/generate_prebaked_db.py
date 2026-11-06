import os
import sys
import gzip
import shutil
import sqlite3

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
src_db = os.path.join(backend_dir, "clinical_hospital.db")
tmp_db = "/tmp/prebaked_gen.db"

def main():
    print("🚀 Bắt đầu tạo CSDL Pre-baked SQLite từ bản chuẩn lâm sàng...")
    if os.path.exists(tmp_db):
        os.remove(tmp_db)
    for ext in ("-wal", "-shm"):
        if os.path.exists(tmp_db + ext):
            os.remove(tmp_db + ext)

    # 1. Sao chép CSDL gốc sang tmp_db
    conn_src = sqlite3.connect(src_db)
    conn_dst = sqlite3.connect(tmp_db)
    conn_src.backup(conn_dst)
    conn_src.close()

    cursor = conn_dst.cursor()

    # 2. Chuẩn hóa & tinh giản các cột văn bản trùng lặp trên dav_national_drugs
    # Dữ liệu chuyên luận chi tiết được lưu chuẩn hóa tại bảng clinical_drug_monographs
    bulk_cols = [
        "pharmacodynamics", "pharmacokinetics", "indications", "contraindications", 
        "precautions", "pregnancy_warning", "lactation_warning", "adult_dosage", 
        "pediatric_dosage", "renal_adjustment", "hepatic_adjustment", "adverse_effects", 
        "adr_management", "drug_interactions", "incompatibilities", "storage_stability", 
        "overdose_treatment", "antidote"
    ]
    cursor.execute("UPDATE dav_national_drugs SET " + ", ".join(f"{col} = NULL" for col in bulk_cols))
    conn_dst.commit()

    # 3. Kiểm tra thống kê dữ liệu
    cursor.execute("SELECT count(*) FROM dav_national_drugs")
    dav_count = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM clinical_drug_monographs")
    mono_count = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM clinical_drug_monographs WHERE pharmacodynamics IS NOT NULL")
    rich_mono_count = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM dav_national_drugs WHERE clinical_monograph_id IS NOT NULL")
    linked_count = cursor.fetchone()[0]
    cursor.execute("SELECT count(*) FROM users")
    user_count = cursor.fetchone()[0]

    print(f"📊 Thống kê dữ liệu CSDL:")
    print(f"  - Thuốc Cục QLD (dav_national_drugs): {dav_count:,}")
    print(f"  - Chuyên luận Dược Thư (clinical_drug_monographs): {mono_count:,} (Giàu dữ liệu: {rich_mono_count:,})")
    print(f"  - Số thuốc đã liên kết chuyên luận lâm sàng: {linked_count:,}")
    print(f"  - Người dùng bệnh viện (users): {user_count}")

    # 4. Thu gọn CSDL bằng VACUUM
    cursor.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    cursor.execute("VACUUM")
    conn_dst.close()

    raw_size_mb = os.path.getsize(tmp_db) / 1024 / 1024
    print(f"💾 Dung lượng SQLite sau tinh giản & VACUUM: {raw_size_mb:.2f} MB")

    out_gz_path = os.path.join(backend_dir, "clinical_prebaked.db.gz")
    print(f"📦 Đang nén gzip vào {out_gz_path}...")
    with open(tmp_db, "rb") as f_in:
        with gzip.open(out_gz_path, "wb", compresslevel=9) as f_out:
            shutil.copyfileobj(f_in, f_out)

    gz_size_mb = os.path.getsize(out_gz_path) / 1024 / 1024
    print(f"🎉 Hoàn tất! Dung lượng tệp nén gzipped: {gz_size_mb:.2f} MB")

if __name__ == "__main__":
    main()
