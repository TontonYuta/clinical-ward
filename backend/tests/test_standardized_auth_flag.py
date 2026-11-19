"""
Unit & Integration Tests for Standardized Authentication Flag & Demo Personas.
Verifies Single Source of Truth, 0 regressions on 401 bypass, and Argon2 password verification.
"""
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.config import settings
from app.services.auth_service import authenticate_configured_user, DEFAULT_DEMO_USERS


@pytest.mark.asyncio
async def test_demo_personas_argon2_passwords():
    """Verify that all default demo accounts authenticate with their designated passwords."""
    personas = [
        ("bac_si_test", "Doctor@2026!", "doctor"),
        ("duoc_si_test", "Pharm@2026!", "pharmacist"),
        ("dieu_duong_test", "Nurse@2026!", "nurse"),
        ("director", "Director@2026!", "director"),
    ]
    for username, password, expected_role in personas:
        user = await authenticate_configured_user(username, password)
        assert user is not None, f"Failed to authenticate {username}"
        assert user.username == username
        assert user.role == expected_role

    # Verify wrong password rejects
    wrong_user = await authenticate_configured_user("bac_si_test", "WrongPassword123!")
    assert wrong_user is None


@pytest.mark.asyncio
async def test_auth_me_returns_single_source_of_truth():
    """Verify /api/v1/auth/me matches settings.AUTH_REQUIRED configuration."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/auth/me")
        assert res.status_code == 200
        data = res.json()
        assert "enabled" in data
        assert data["enabled"] == settings.AUTH_REQUIRED
        if not settings.AUTH_REQUIRED:
            assert data["authenticated"] is True
            assert data["role"] in {"director", "doctor"}


@pytest.mark.asyncio
async def test_copilot_chat_accessible_without_token_when_auth_disabled():
    """Verify copilot chat does NOT return 401 when AUTH_REQUIRED is false."""
    if settings.AUTH_REQUIRED:
        pytest.skip("Test only applies when AUTH_REQUIRED is false")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "query": "Paracetamol liều dùng",
            "user_name": "bac_si_test",
            "user_role": "doctor"
        }
        res = await client.post("/api/v1/copilot/chat", json=payload)
        assert res.status_code == 200, f"Expected 200 but got {res.status_code}: {res.text}"
        data = res.json()
        assert "reply_text" in data
        assert len(data["reply_text"]) > 0


@pytest.mark.asyncio
async def test_login_endpoint_issues_valid_session():
    """Verify /api/v1/auth/login issues valid credentials for demo users."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login with correct doctor credentials
        res = await client.post(
            "/api/v1/auth/login",
            json={"username": "bac_si_test", "password": "Doctor@2026!"},
            headers={"Origin": "http://localhost:3000"}
        )
        assert res.status_code == 200
        data = res.json()
        assert data["username"] == "bac_si_test"
        assert data["role"] == "doctor"
        assert "clinical_session" in res.cookies

        # 2. Login with wrong password
        fail_res = await client.post(
            "/api/v1/auth/login",
            json={"username": "bac_si_test", "password": "IncorrectPassword"},
            headers={"Origin": "http://localhost:3000"}
        )
        assert fail_res.status_code == 401
