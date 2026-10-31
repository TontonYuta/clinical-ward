from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.security.auth import AuthenticationMiddleware, hash_password, verify_password, issue_token, verify_token


def test_password_hash_is_salted_and_verifies():
    encoded = hash_password("correct horse battery staple")
    assert encoded.startswith("pbkdf2_sha256$")
    assert verify_password("correct horse battery staple", encoded)
    assert not verify_password("wrong", encoded)


def test_signed_token_rejects_tampering_and_expiry():
    token = issue_token("u-1", "nurse", "s" * 32, ttl_seconds=60)
    user = verify_token(token, "s" * 32)
    assert user is not None and user.username == "u-1" and user.role == "nurse"
    assert verify_token(token + "x", "s" * 32) is None
    expired = issue_token("u-1", "nurse", "s" * 32, ttl_seconds=-1)
    assert verify_token(expired, "s" * 32) is None


def test_auth_middleware_protects_api_but_allows_login_route():
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32, users_json='{"nurse":{"role":"nurse"}}')

    @app.get("/api/v1/private")
    def private():
        return {"ok": True}

    @app.post("/api/v1/inventory/restock-proposal")
    def restock():
        return {"ok": True}

    @app.post("/api/v1/auth/login")
    def login():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/api/v1/private").status_code == 401
    assert client.post("/api/v1/auth/login").status_code == 200
    token = issue_token("nurse", "nurse", "s" * 32)
    assert client.get("/api/v1/private", headers={"Authorization": f"Bearer {token}"}).status_code == 200
    assert client.post("/api/v1/inventory/restock-proposal", headers={"Authorization": f"Bearer {token}"}).status_code == 403
    pharmacist_token = issue_token("pharmacist", "pharmacist", "s" * 32)
    assert client.post("/api/v1/inventory/restock-proposal", headers={"Authorization": f"Bearer {pharmacist_token}"}).status_code == 200


def test_role_policy_rejects_unprivileged_writes_and_patient_reads():
    assert not AuthenticationMiddleware._role_allowed("POST", "/api/v1/inventory/restock-proposal", "nurse")
    assert AuthenticationMiddleware._role_allowed("POST", "/api/v1/inventory/restock-proposal", "pharmacist")
    assert not AuthenticationMiddleware._role_allowed("GET", "/api/v1/patients", "biomedical_engineer")
    assert AuthenticationMiddleware._role_allowed("GET", "/api/v1/patients", "doctor")
