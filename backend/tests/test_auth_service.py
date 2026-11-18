import pytest
from app.security.auth import hash_password
from app.services.auth_service import authenticate_configured_user


@pytest.mark.asyncio
async def test_configured_login_accepts_only_configured_credentials_and_supported_roles(monkeypatch):
    monkeypatch.setattr(
        "app.services.auth_service.settings.AUTH_USERS_JSON",
        __import__("json").dumps({"staff.user": {"password_hash": hash_password("private-pass"), "role": "pharmacist"}}),
    )
    assert (await authenticate_configured_user("staff.user", "private-pass")).role == "pharmacist"
    assert await authenticate_configured_user("staff.user", "wrong") is None
    assert await authenticate_configured_user("director", "admin123") is None


@pytest.mark.asyncio
async def test_configured_login_rejects_unsupported_role(monkeypatch):
    monkeypatch.setattr(
        "app.services.auth_service.settings.AUTH_USERS_JSON",
        __import__("json").dumps({"staff.user": {"password_hash": hash_password("private-pass"), "role": "superuser"}}),
    )
    assert await authenticate_configured_user("staff.user", "private-pass") is None
