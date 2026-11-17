from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import auth
from app.security.auth import AuthenticationMiddleware


def test_authenticated_api_allows_logged_out_auth_status_but_keeps_admin_protected(monkeypatch):
    monkeypatch.setattr(auth.settings, "AUTH_REQUIRED", True)
    monkeypatch.setattr(auth.settings, "IDENTITY_DATABASE_URL", "")
    monkeypatch.setattr(auth.settings, "SECRET_KEY", "s" * 32)
    app = FastAPI()
    app.add_middleware(
        AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
        users_json="{\"director\":{\"role\":\"director\"}}",
    )
    app.include_router(auth.router, prefix="/api/v1")

    @app.get("/api/v1/admin/keys")
    def admin_keys():
        return {"ok": True}

    client = TestClient(app)
    status_response = client.get("/api/v1/auth/me")
    assert status_response.status_code == 200
    assert status_response.json() == {
        "enabled": True, "authenticated": False, "username": None, "role": None
    }
    assert client.get("/api/v1/admin/keys").status_code == 401
