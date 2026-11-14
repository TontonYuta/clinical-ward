import pytest

from app.routers import availability


@pytest.mark.asyncio
async def test_availability_falls_back_to_local_when_provider_probe_fails(monkeypatch):
    class Connection:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *_):
            return False
        async def execute(self, *_):
            return 1

    class Engine:
        def connect(self):
            return Connection()

    monkeypatch.setattr(availability, "engine", Engine())
    monkeypatch.setattr(availability, "_check_provider", lambda: _async_value("unavailable"))
    monkeypatch.setattr("pathlib.Path.exists", lambda self: str(self) == "/some/fts.sqlite")
    monkeypatch.setattr("app.services.rag.sqlite_fts.get_fts_db_path", lambda: "/some/fts.sqlite")
    import sqlite3
    class Cursor:
        def __init__(self, sql): self.sql = sql
        def fetchone(self):
            if "sqlite_master" in self.sql: return (1,)
            return (1,)
    class ReadOnlyConn:
        def execute(self, sql): return Cursor(sql)
        def close(self): pass
    monkeypatch.setattr(sqlite3, "connect", lambda *args, **kwargs: ReadOnlyConn())

    status = await availability.get_availability()

    assert status.mode == "local_only"
    assert status.vector_index == "available"
    assert status.provider == "unavailable"
    assert status.database == "available"
    assert "key" not in status.model_dump_json().lower()
    assert "secret" not in status.model_dump_json().lower()


async def _async_value(value):
    return value


@pytest.mark.asyncio
async def test_availability_never_reports_online_from_key_presence_alone(monkeypatch):
    monkeypatch.setattr(availability, "_check_provider", lambda: _async_value("unavailable"))
    monkeypatch.setattr(availability, "engine", type("Engine", (), {"connect": lambda self: _BrokenConnection()})())

    status = await availability.get_availability()

    assert status.mode == "offline"
    assert status.provider == "unavailable"


@pytest.mark.asyncio
async def test_availability_uses_configured_openai_compatible_provider(monkeypatch):
    monkeypatch.setattr(availability.settings, "LLM_PROVIDER", "openai_compatible")
    monkeypatch.setattr(availability.settings, "OPENAI_API_BASE", "http://127.0.0.1:9/v1")
    monkeypatch.setattr(availability, "_provider_state", {"value": "unknown", "checked_at": 0.0})

    class Response:
        status_code = 200
    class Client:
        def __init__(self, **_kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *_args): return False
        async def get(self, *_args, **_kwargs): return Response()

    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", Client)
    assert await availability._check_provider() == "available"


class _BrokenConnection:
    async def __aenter__(self):
        raise RuntimeError("database unavailable")
    async def __aexit__(self, *_):
        return False
