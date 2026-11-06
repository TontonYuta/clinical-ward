from app.seed_registry import resolve_db_path


def test_explicit_new_registry_destination_overrides_environment(monkeypatch):
    monkeypatch.setenv('DATABASE_URL','sqlite+aiosqlite:////should-not-be-used.sqlite')
    destination = '/var/lib/clinical-audit-not-created/new-registry.sqlite'
    assert resolve_db_path(destination) == destination
