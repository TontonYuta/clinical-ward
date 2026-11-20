from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import auth
from app.security.auth import AuthenticationMiddleware
from app.security.auth import hash_password


def make_client(monkeypatch, users: dict[str, dict]):
    monkeypatch.setattr(auth.settings, "AUTH_REQUIRED", True)
    monkeypatch.setattr(auth.settings, "IDENTITY_DATABASE_URL", "")
    monkeypatch.setattr(auth.settings, "AUTH_USERS_JSON", __import__("json").dumps(users))
    monkeypatch.setattr(auth.settings, "SECRET_KEY", "s" * 32)
    app = FastAPI()
    app.include_router(auth.router, prefix="/api/v1")
    return TestClient(app)


def test_login_uses_only_configured_account_and_sets_httponly_session(monkeypatch):
    client = make_client(monkeypatch, {"staff.user": {"password_hash": hash_password("real-pass"), "role": "pharmacist"}})
    response = client.post("/api/v1/auth/login", json={"username": "staff.user", "password": "real-pass"})
    assert response.status_code == 200
    assert response.json()["role"] == "pharmacist"
    assert response.cookies.get("clinical_session")
    assert "httponly" in response.headers["set-cookie"].lower()
    assert "samesite=lax" in response.headers["set-cookie"].lower()
    assert client.get("/api/v1/auth/me").json()["authenticated"] is True
    previous_token = response.cookies.get("clinical_session")
    refreshed = client.get("/api/v1/auth/me")
    assert refreshed.status_code == 200 and refreshed.json()["authenticated"] is True
    assert refreshed.cookies.get("clinical_session") != previous_token
    client.post("/api/v1/auth/logout")
    assert client.get("/api/v1/auth/me").json()["authenticated"] is False


def test_login_does_not_accept_demo_pin_or_role_name(monkeypatch):
    client = make_client(monkeypatch, {})
    response = client.post("/api/v1/auth/login", json={"username": "director", "password": "admin123"})
    assert response.status_code == 401


def test_auth_me_reports_login_disabled_without_blocking_local_app(monkeypatch):
    monkeypatch.setattr(auth.settings, "AUTH_REQUIRED", False)
    app = FastAPI()
    app.include_router(auth.router, prefix="/api/v1")
    client = TestClient(app)
    assert client.get("/api/v1/auth/me").json() == {
        "enabled": False, "authenticated": True, "username": "local", "role": "nurse"
    }
    assert client.post("/api/v1/auth/login", json={"username": "x", "password": "y"}).status_code == 404


def test_auth_me_reports_unauthenticated_session_as_state_instead_of_http_error(monkeypatch):
    client = make_client(monkeypatch, {"admin": {"password_hash": hash_password("admin"), "role": "director"}})
    client.app.add_middleware(
        AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
        users_json=__import__("json").dumps({"admin": {"role": "director"}}),
    )
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 200
    assert response.json() == {
        "enabled": True, "authenticated": False, "username": None, "role": None
    }


def test_admin_demo_account_login_success(monkeypatch):
    client = make_client(monkeypatch, {})
    response = client.post("/api/v1/auth/login", json={"username": "admin", "password": "admin"})
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "admin"
    assert data["role"] == "director"
    assert "token" in data
