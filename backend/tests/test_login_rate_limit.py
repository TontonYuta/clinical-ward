import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.security.password_rate_limiter import login_rate_limiter


@pytest.fixture(autouse=True)
def clean_rate_limits():
    login_rate_limiter.reset_all()
    yield
    login_rate_limiter.reset_all()


@pytest.mark.asyncio
async def test_login_rate_limiting_brute_force_lockout():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        target_user = "test_rate_limited_staff"

        # 1. 4 consecutive incorrect password attempts -> 401 Unauthorized
        for i in range(1, 5):
            res = await ac.post("/api/v1/auth/login", json={
                "username": target_user,
                "password": f"wrong_password_{i}",
            })
            assert res.status_code == 401, f"Attempt {i} should be 401"
            assert "Còn lại" in res.json()["detail"]

        # 2. 5th incorrect attempt -> 429 Too Many Requests (Threshold reached)
        res_5 = await ac.post("/api/v1/auth/login", json={
            "username": target_user,
            "password": "wrong_password_5",
        })
        assert res_5.status_code == 429
        assert "Retry-After" in res_5.headers
        assert "Tài khoản tạm thời bị khóa" in res_5.json()["detail"]

        # 3. 6th attempt (even with any password) -> Immediately blocked with 429
        res_6 = await ac.post("/api/v1/auth/login", json={
            "username": target_user,
            "password": "any_password",
        })
        assert res_6.status_code == 429
        assert "Retry-After" in res_6.headers

        # 4. Another user is NOT affected by the lockout
        res_other = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "admin",
        })
        assert res_other.status_code == 200, "Valid admin login must not be blocked by another user lockout"


@pytest.mark.asyncio
async def test_login_successful_resets_failed_attempts():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Try 2 wrong attempts
        for _ in range(2):
            res = await ac.post("/api/v1/auth/login", json={
                "username": "admin",
                "password": "wrong_password",
            })
            assert res.status_code == 401

        # Now login correctly
        res_valid = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "admin",
        })
        assert res_valid.status_code == 200

        # After successful login, failure counter is cleared
        key = "127.0.0.1:admin"
        is_blocked, _ = login_rate_limiter.check_rate_limit(key)
        assert is_blocked is False
