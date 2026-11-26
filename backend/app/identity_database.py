"""Isolated storage boundary for staff identity and shared provider secrets.

Clinical operational data intentionally stays on the existing clinical database.
"""
import os
from threading import Lock
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.engine import make_url
from sqlalchemy.pool import NullPool
from app.models.identity import IdentityBase
from app.config import settings

CLINICAL_DATABASE_URL = settings.DATABASE_URL.strip()
IDENTITY_DATABASE_URL = settings.IDENTITY_DATABASE_URL
_identity_resources_lock = Lock()
_identity_engine = None
_identity_session_factory = None
_identity_cached_url = None

def _database_identity(database_url: str) -> tuple[str, str, int | None, str, str | None]:
    parsed = make_url(database_url)
    backend = parsed.drivername.split("+", 1)[0]
    return (backend, parsed.host or "", parsed.port, parsed.database or "", parsed.query.get("service"))


def validate_identity_database_url(identity_url: str, clinical_url: str | None = None) -> str:
    """Validate identity storage boundary without opening a connection."""
    identity = (identity_url or "").strip()
    clinical = (CLINICAL_DATABASE_URL if clinical_url is None else clinical_url or "").strip()
    if not identity:
        raise RuntimeError("IDENTITY_DATABASE_URL is required for identity storage.")
    if clinical:
        try:
            same_database = _database_identity(identity) == _database_identity(clinical)
        except Exception as exc:
            raise RuntimeError("Identity and clinical database URLs must be valid SQLAlchemy URLs.") from exc
        if same_database:
            raise RuntimeError("Identity storage must use a database separate from clinical data.")
    return identity


def create_identity_session_factory(database_url: str):
    url = validate_identity_database_url(database_url)
    # NullPool ensures asyncpg connections never outlive transient worker event loops (prevents Event loop is closed / SIGSEGV).
    engine = create_async_engine(url, poolclass=NullPool)
    return engine, async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


def get_identity_session_factory():
    global _identity_engine, _identity_session_factory, _identity_cached_url
    url = validate_identity_database_url(IDENTITY_DATABASE_URL)
    with _identity_resources_lock:
        if _identity_engine is not None and _identity_cached_url == url:
            return _identity_engine, _identity_session_factory
        if _identity_engine is not None:
            raise RuntimeError("IDENTITY_DATABASE_URL changed after identity engine initialization.")
        _identity_engine, _identity_session_factory = create_identity_session_factory(url)
        _identity_cached_url = url
        return _identity_engine, _identity_session_factory


async def dispose_identity_engine() -> None:
    global _identity_engine, _identity_session_factory, _identity_cached_url
    with _identity_resources_lock:
        engine = _identity_engine
        _identity_engine = None
        _identity_session_factory = None
        _identity_cached_url = None
    if engine is not None:
        await engine.dispose()
