import sys
import os
import shutil

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Ensure database path is writable on Vercel Serverless (/tmp)
db_source = os.path.join(backend_dir, "clinical_hospital.db")
db_dest = "/tmp/clinical_hospital.db"
if not os.path.exists(db_dest) and os.path.exists(db_source):
    try:
        shutil.copyfile(db_source, db_dest)
    except Exception as e:
        pass

db_path = db_dest
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"

# Synchronously ensure DAV national drugs registry (55k) is seeded in /tmp
try:
    from app.seed_registry import seed_dav_registry_if_needed
    seed_dav_registry_if_needed(db_dest)
except Exception as e:
    print(f"Vercel startup registry seed warning: {e}")

import app.config
import app.database
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

app.config.settings.DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"
app.database.engine = create_async_engine(
    app.config.settings.DATABASE_URL,
    connect_args={"check_same_thread": False}
)
app.database.AsyncSessionLocal = async_sessionmaker(
    bind=app.database.engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

from app.main import app
