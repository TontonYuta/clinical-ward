from pathlib import Path

from app.config import settings
from app.seed_registry import resolve_db_path


def test_resolve_db_path_uses_application_database_url_when_environment_is_unset(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SQLITE_DB_PATH", raising=False)

    resolved = resolve_db_path()
    configured = settings.DATABASE_URL
    expected = configured.split("sqlite+aiosqlite:///", 1)[-1].split("sqlite:///", 1)[-1]

    assert Path(resolved).resolve() == Path(expected).resolve()
