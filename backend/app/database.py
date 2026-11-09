from collections.abc import AsyncGenerator
from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# Set high-concurrency WAL mode & memory-saving SQLite PRAGMAs (512MB RAM cap on Render)
if "sqlite" in settings.DATABASE_URL:
    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("PRAGMA journal_mode = WAL;")  # Concurrent non-blocking reads during writes
        except Exception:
            pass
        try:
            cursor.execute("PRAGMA synchronous = NORMAL;") # Faster reliable disk commits
            cursor.execute("PRAGMA busy_timeout = 5000;")  # Wait up to 5s instead of immediate database locked
            cursor.execute("PRAGMA cache_size = -2000;")   # Limit page cache to 2MB per connection
            cursor.execute("PRAGMA mmap_size = 0;")        # Disable memory-mapped I/O ballooning
            cursor.execute("PRAGMA temp_store = FILE;")    # Store temp tables/indexes on disk
        except Exception:
            pass
        finally:
            cursor.close()

# Session maker
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Declarative Base
class Base(DeclarativeBase):
    pass

# Dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
