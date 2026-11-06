import os
import sys
import gzip
import shutil
import sqlite3
import asyncio

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

tmp_db_path = "/tmp/prebaked_gen.db"
if os.path.exists(tmp_db_path):
    os.remove(tmp_db_path)
for ext in ("-wal", "-shm"):
    if os.path.exists(tmp_db_path + ext):
        os.remove(tmp_db_path + ext)

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{tmp_db_path}"

from init_db import init

async def main():
    print("🚀 Bắt đầu tạo CSDL Pre-baked SQLite...")
    await init()

    # Kiểm tra tính toàn vẹn dữ liệu
    conn = sqlite3.connect(tmp_db_path)
    cursor = conn.cursor()
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

    print(f"📊 Thống kê dữ liệu:")
    print(f"  - Thuốc Cục QLD (dav_national_drugs): {dav_count:,}")
    print(f"  - Chuyên luận Dược Thư (clinical_drug_monographs): {mono_count:,} (Giàu dữ liệu: {rich_mono_count:,})")
    print(f"  - Số thuốc đã liên kết chuyên luận lâm sàng: {linked_count:,}")
    print(f"  - Người dùng bệnh viện (users): {user_count}")

    # Thu gọn và nén CSDL
    cursor.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    cursor.execute("VACUUM")
    conn.close()

    raw_size_mb = os.path.getsize(tmp_db_path) / 1024 / 1024
    print(f"💾 Dung lượng SQLite sau nén: {raw_size_mb:.2f} MB")

    out_gz_path = os.path.join(backend_dir, "clinical_prebaked.db.gz")
    print(f"📦 Đang nén gzip vào {out_gz_path}...")
    with open(tmp_db_path, "rb") as f_in:
        with gzip.open(out_gz_path, "wb", compresslevel=9) as f_out:
            shutil.copyfileobj(f_in, f_out)

    gz_size_mb = os.path.getsize(out_gz_path) / 1024 / 1024
    print(f"🎉 Hoàn tất! Dung lượng tệp nén gzipped: {gz_size_mb:.2f} MB")

if __name__ == "__main__":
    asyncio.run(main())
