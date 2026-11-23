"""Unit tests for Admin Staff Management CRUD endpoints with SQLite persistence and Auth."""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.identity_database import dispose_identity_engine
from app.routers.auth import invalidate_login_cache


@pytest_asyncio.fixture(autouse=True)
async def cleanup_identity():
    invalidate_login_cache()
    yield
    invalidate_login_cache()
    await dispose_identity_engine()


async def get_admin_headers(ac: AsyncClient) -> dict:
    login_res = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "admin"})
    if login_res.status_code != 200:
        raise RuntimeError(f"Admin login failed: {login_res.status_code} {login_res.text}")
    token = login_res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_list_staff():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = await get_admin_headers(ac)
        res = await ac.get("/api/v1/admin/staff", headers=headers)
        if res.status_code != 200:
            print("STAFF ERROR:", res.status_code, res.text)
        assert res.status_code == 200
        data = res.json()
        assert "total" in data
        assert "items" in data
        assert data["total"] >= 5
        # Ensure initial seed users exist
        ids = [item["id"] for item in data["items"]]
        assert "u-1" in ids
        assert "u-4" in ids
        assert data["items"][0]["username"] is not None


@pytest.mark.asyncio
async def test_create_and_update_and_soft_delete_staff():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        headers = await get_admin_headers(ac)
        now_ts = int(pytest.importorskip('time').time())
        unique_cchn = f"TEST-CCHN-{now_ts}"
        custom_username = f"bs_tuan_{now_ts}"
        custom_password = "Doctor@Password2026!"

        payload = {
            "name": "BSCKII. Hoàng Minh Tuấn",
            "role": "doctor",
            "role_name": "Bác Sĩ Chuyên Khoa II",
            "department": "Khoa Ngoại Chấn Thương",
            "practice_certificate": unique_cchn,
            "pin_code": "5555",
            "rfid_card_id": "RFID-DOC-5555",
            "responsibilities": "Phẫu thuật ngoại khoa, khám và điều trị nội trú",
            "email": "tuan.hm@bv.gov.vn",
            "phone": "0912345678",
            "dob": "1985-06-15",
            "academic_title": "BSCKII",
            "username": custom_username,
            "password": custom_password,
            "must_change_password": True,
            "is_active": True,
        }

        # 1. Create Staff with username & password
        create_res = await ac.post("/api/v1/admin/staff", json=payload, headers=headers)
        assert create_res.status_code == 201
        created = create_res.json()
        staff_id = created["id"]
        assert created["name"] == "BSCKII. Hoàng Minh Tuấn"
        assert created["academic_title"] == "BSCKII"
        assert created["username"] == custom_username
        assert created["must_change_password"] is True
        assert "hashed_password" not in created  # Password hash is never leaked!

        # 2. Verify that the new staff can immediately LOG IN to the web system!
        login_res = await ac.post("/api/v1/auth/login", json={
            "username": custom_username,
            "password": custom_password,
        })
        assert login_res.status_code == 200
        login_data = login_res.json()
        assert login_data["username"] == custom_username
        assert login_data["role"] == "doctor"
        assert "token" in login_data

        # 3. Detail
        get_res = await ac.get(f"/api/v1/admin/staff/{staff_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["email"] == "tuan.hm@bv.gov.vn"

        # 4. Update
        update_res = await ac.put(f"/api/v1/admin/staff/{staff_id}", json={
            "phone": "0988776655",
            "role_name": "Trưởng Khoa Ngoại Chấn Thương",
        }, headers=headers)
        assert update_res.status_code == 200
        assert update_res.json()["phone"] == "0988776655"
        assert update_res.json()["role_name"] == "Trưởng Khoa Ngoại Chấn Thương"

        # 5. Reset Password via Admin API
        new_password = "Doctor@NewSecret2026!"
        reset_pwd_res = await ac.patch(f"/api/v1/admin/staff/{staff_id}/reset-password", json={
            "new_password": new_password,
            "must_change_password": False,
        }, headers=headers)
        assert reset_pwd_res.status_code == 200
        assert reset_pwd_res.json()["status"] == "success"

        # Old password must now fail
        old_login = await ac.post("/api/v1/auth/login", json={
            "username": custom_username,
            "password": custom_password,
        })
        assert old_login.status_code == 401

        # New password must succeed and return FULL user profile
        new_login = await ac.post("/api/v1/auth/login", json={
            "username": custom_username,
            "password": new_password,
        })
        assert new_login.status_code == 200
        user_info = new_login.json()
        assert user_info["role"] == "doctor"
        assert user_info["name"] == "BSCKII. Hoàng Minh Tuấn"
        assert user_info["department"] == "Khoa Ngoại Chấn Thương"
        assert user_info["practice_certificate"] == unique_cchn
        assert "pin_code" not in user_info  # Sensitive PIN is protected and not leaked in login response

        # Verify /auth/me returns the identical full profile
        user_token = user_info["token"]
        me_res = await ac.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert me_res.status_code == 200
        me_info = me_res.json()
        assert me_info["authenticated"] is True
        assert me_info["name"] == "BSCKII. Hoàng Minh Tuấn"
        assert me_info["department"] == "Khoa Ngoại Chấn Thương"
        assert me_info["practice_certificate"] == unique_cchn

        # Verify Copilot chat greets this doctor by their authentic name
        chat_res = await ac.post("/api/v1/copilot/chat", json={"query": "xin chào"}, headers={"Authorization": f"Bearer {user_token}"})
        assert chat_res.status_code == 200
        reply = chat_res.json().get("reply_text", "")
        assert "Hoàng Minh Tuấn" in reply

        # 6. Reset PIN
        pin_res = await ac.patch(f"/api/v1/admin/staff/{staff_id}/reset-pin", json={
            "new_pin": "8888",
        }, headers=headers)
        assert pin_res.status_code == 200
        assert pin_res.json()["status"] == "pin_updated"

        # 7. Soft Delete (Tạm ngưng công tác)
        del_res = await ac.delete(f"/api/v1/admin/staff/{staff_id}", headers=headers)
        assert del_res.status_code == 200
        del_data = del_res.json()
        assert del_data["status"] == "suspended"

        # Verify soft delete in detail: is_active must be False
        verify_res = await ac.get(f"/api/v1/admin/staff/{staff_id}", headers=headers)
        assert verify_res.status_code == 200
        assert verify_res.json()["is_active"] is False

        # Login must now FAIL because staff is inactive (tạm ngưng)
        inactive_login = await ac.post("/api/v1/auth/login", json={
            "username": custom_username,
            "password": new_password,
        })
        assert inactive_login.status_code == 401
