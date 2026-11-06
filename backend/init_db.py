import os
import sqlite3
import asyncio
from app.database import engine, Base
from app.seed import seed
from app.services.registry_service import warm_up_registry_cache_and_fts
from app.config import settings

async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed()
    warm_up_registry_cache_and_fts()

    # Truncate WAL and VACUUM SQLite database to guarantee minimum size on Render Free Tier (<80MB)
    try:
        db_path = settings.DATABASE_URL.replace("sqlite+aiosqlite:///", "").replace("sqlite:///", "")
        if db_path and os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            conn.execute("PRAGMA wal_checkpoint(TRUNCATE);")
            conn.execute("VACUUM;")
            conn.close()
            print(f"🚀 SQLite compacted and truncated: {os.path.getsize(db_path) / 1024 / 1024:.2f} MB")
    except Exception as e:
        print(f"Warning: Không thể compact SQLite: {e}")

if __name__ == "__main__":
    asyncio.run(init())
