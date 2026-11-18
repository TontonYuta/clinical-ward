from sqlalchemy import UniqueConstraint
import pytest


def test_identity_store_is_separate_and_has_staff_auth_and_key_vault_models():
    from app import identity_database
    from app.models.identity import (
        IdentityBase, ProviderApiKey, StaffAccount, StaffProfile, StaffRoleGrant,
    )

    assert identity_database.validate_identity_database_url(
        "sqlite+aiosqlite:///identity.db", "sqlite+aiosqlite:///clinical.db"
    ) == "sqlite+aiosqlite:///identity.db"
    with pytest.raises(RuntimeError, match="separate"):
        identity_database.validate_identity_database_url(
            "sqlite+aiosqlite:///clinical.db", "sqlite+aiosqlite:///clinical.db"
        )
    with pytest.raises(RuntimeError, match="separate"):
        identity_database.validate_identity_database_url(
            "postgresql+asyncpg://user:secret@db.internal/clinical",
            "postgresql://another-user:other-secret@db.internal/clinical",
        )
    with pytest.raises(RuntimeError, match="required"):
        identity_database.validate_identity_database_url("", "sqlite+aiosqlite:///clinical.db")
    assert {"staff_profiles", "staff_accounts", "staff_role_grants", "provider_api_keys"}.issubset(
        IdentityBase.metadata.tables
    )
    assert StaffAccount.__table__.c.staff_id.foreign_keys
    assert StaffAccount.__table__.c.password_hash.nullable is False
    assert ProviderApiKey.__table__.c.encrypted_key.nullable is False
    assert any(isinstance(item, UniqueConstraint) for item in StaffAccount.__table__.constraints)
    assert StaffProfile.__tablename__ == "staff_profiles"
    assert StaffRoleGrant.__tablename__ == "staff_role_grants"
    assert {"identity_sessions"}.issubset(IdentityBase.metadata.tables)
    assert ProviderApiKey.__table__.c.key_id.primary_key
    assert StaffRoleGrant.__table__.c.account_id.foreign_keys
    assert identity_database.validate_identity_database_url(
        "postgresql+asyncpg://identity/db", "postgresql+asyncpg://clinical/db"
    ) == "postgresql+asyncpg://identity/db"
    with pytest.raises(RuntimeError, match="separate"):
        identity_database.validate_identity_database_url(
            "postgresql+asyncpg://clinical/db", "postgresql+asyncpg://clinical/db"
        )
    with pytest.raises(RuntimeError, match="required"):
        identity_database.validate_identity_database_url("", "postgresql+asyncpg://clinical/db")


def test_key_vault_rejects_partial_identity_configuration(monkeypatch):
    from app.config import settings
    from app.services import admin_key_vault

    monkeypatch.setattr(settings, "IDENTITY_DATABASE_URL", "sqlite+aiosqlite:///identity.db")
    monkeypatch.setattr(settings, "KEY_ENCRYPTION_KEY", None)
    with pytest.raises(RuntimeError, match="Both IDENTITY_DATABASE_URL and KEY_ENCRYPTION_KEY"):
        admin_key_vault._load_vault_data()
    monkeypatch.setattr(settings, "IDENTITY_DATABASE_URL", "")
    monkeypatch.setattr(settings, "KEY_ENCRYPTION_KEY", "partial-key-config")
    with pytest.raises(RuntimeError, match="Both IDENTITY_DATABASE_URL and KEY_ENCRYPTION_KEY"):
        admin_key_vault._load_vault_data()
