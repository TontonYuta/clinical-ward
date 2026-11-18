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


def test_identity_mode_rejects_tokens_without_persisted_session_id():
    app = FastAPI()
    app.add_middleware(
        AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
        users_json="{}", identity_store_enabled=True,
    )

    @app.get("/api/v1/private")
    def private():
        return {"ok": True}

    token = issue_token("staff-1", "director", "s" * 32)
    response = TestClient(app).get("/api/v1/private", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_auth_status_endpoint_is_public_but_admin_api_remains_protected():
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32, users_json='{"director":{"role":"director"}}')

    @app.get("/api/v1/auth/me")
    def auth_status():
        return {"enabled": True, "authenticated": False}

    @app.get("/api/v1/admin/monitoring/overview")
    def admin_data():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.get("/api/v1/admin/monitoring/overview").status_code == 401


def test_auth_middleware_allows_read_only_availability_without_session():
    app = FastAPI()
    app.add_middleware(AuthenticationMiddleware, enabled=True, secret_key="s" * 32, users_json='{"nurse":{"role":"nurse"}}')

    @app.get("/api/v1/availability")
    def availability():
        return {"mode": "local_only"}

    @app.post("/api/v1/availability")
    def mutate_availability():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/api/v1/availability").status_code == 200
    assert client.post("/api/v1/availability").status_code == 401


def test_auth_middleware_allows_chat_stream_from_configured_monitor_origin():
    app = FastAPI()
    app.add_middleware(
        AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
        users_json='{"director":{"role":"director"}}',
        trusted_origins=["https://clinical-ai-monitor.vercel.app"],
    )

    @app.post("/api/v1/copilot/chat/stream")
    def chat_stream():
        return {"ok": True}

    client = TestClient(app)
    response = client.post(
        "/api/v1/copilot/chat/stream",
        headers={"Origin": "https://clinical-ai-monitor.vercel.app"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


def test_director_can_use_chat_stream_when_authenticated():
    app = FastAPI()
    secret = "s" * 32
    app.add_middleware(
        AuthenticationMiddleware, enabled=True, secret_key=secret,
        users_json='{"director":{"role":"director"}}',
        trusted_origins=["https://clinical-ward.vercel.app"],
    )

    @app.post("/api/v1/copilot/chat/stream")
    def chat_stream():
        return {"ok": True}

    token = issue_token("director", "director", secret)
    response = TestClient(app).post(
        "/api/v1/copilot/chat/stream",
        headers={"Origin": "https://clinical-ward.vercel.app", "Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200


def test_auth_middleware_accepts_chat_stream_origin_configured_by_runtime():
    app = FastAPI()
    app.add_middleware(
        AuthenticationMiddleware, enabled=True, secret_key="s" * 32,
        users_json='{"director":{"role":"director"}}',
        trusted_origins=["https://clinical-ai-monitor.vercel.app"],
    )

    @app.post("/api/v1/copilot/chat/stream")
    def chat_stream():
        return {"ok": True}

    client = TestClient(app)
    response = client.post(
        "/api/v1/copilot/chat/stream",
        headers={"Origin": "https://clinical-ai-monitor.vercel.app"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Authentication required"


def test_role_policy_rejects_unprivileged_writes_and_patient_reads():
    assert not AuthenticationMiddleware._role_allowed("POST", "/api/v1/inventory/restock-proposal", "nurse")
    assert AuthenticationMiddleware._role_allowed("POST", "/api/v1/inventory/restock-proposal", "pharmacist")
    assert not AuthenticationMiddleware._role_allowed("GET", "/api/v1/patients", "biomedical_engineer")
    assert AuthenticationMiddleware._role_allowed("GET", "/api/v1/patients", "doctor")
    assert not AuthenticationMiddleware._role_allowed("PUT", "/api/v1/admin/feature-flags", "nurse")
    assert not AuthenticationMiddleware._role_allowed("GET", "/api/v1/admin/monitoring/overview", "nurse")
    assert AuthenticationMiddleware._role_allowed("PUT", "/api/v1/admin/feature-flags", "director")
