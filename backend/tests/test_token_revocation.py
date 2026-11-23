import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.security.auth import clear_revoked_tokens


@pytest.fixture(autouse=True)
def clean_tokens():
    clear_revoked_tokens()
    yield
    clear_revoked_tokens()


@pytest.mark.asyncio
async def test_logout_immediately_revokes_token():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Login to get a valid token
        login_res = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "admin",
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        assert token

        # 2. Verify token is active and authenticated
        me_res = await ac.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["authenticated"] is True
        assert me_res.json()["username"] == "admin"

        # Protected endpoint works with this token
        flags_res = await ac.get("/api/v1/admin/feature-flags", headers={"Authorization": f"Bearer {token}"})
        assert flags_res.status_code == 200

        # 3. Call Logout
        logout_res = await ac.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout_res.status_code == 200
        assert logout_res.json()["status"] == "logged_out"

        # 4. Attempt to RE-USE the revoked token on /auth/me -> Must report unauthenticated!
        me_after = await ac.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_after.status_code == 200
        assert me_after.json()["authenticated"] is False

        # 5. Attempt to RE-USE the revoked token on protected endpoint -> Must be rejected with 401!
        flags_after = await ac.get("/api/v1/admin/feature-flags", headers={"Authorization": f"Bearer {token}"})
        assert flags_after.status_code == 401

        # 6. A fresh login creates a new, valid token
        login_res_2 = await ac.post("/api/v1/auth/login", json={
            "username": "admin",
            "password": "admin",
        })
        assert login_res_2.status_code == 200
        new_token = login_res_2.json()["token"]
        assert new_token != token

        me_res_2 = await ac.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me_res_2.status_code == 200
        assert me_res_2.json()["authenticated"] is True
