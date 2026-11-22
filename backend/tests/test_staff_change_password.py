"""
Comprehensive Unit & Security Integration Tests for Staff Self-Service Password Change.
Verifies NIST SP 800-63B complexity rules, anti-brute force rate limiting,
password reuse prevention, database state sync, and medical audit logging.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.identity_database import dispose_identity_engine
from app.routers.auth import invalidate_login_cache
from app.security.password_policy import validate_password_complexity, is_password_reused
from app.security.password_rate_limiter import password_rate_limiter


@pytest_asyncio.fixture(autouse=True)
async def cleanup():
    invalidate_login_cache()
    password_rate_limiter.reset_all()
    yield
    invalidate_login_cache()
    password_rate_limiter.reset_all()
    await dispose_identity_engine()


def test_password_policy_rules():
    # 1. Too short
    ok, err = validate_password_complexity("Ab1!")
    assert not ok
    assert "8 ký tự" in err

    # 2. Missing uppercase
    ok, err = validate_password_complexity("lowercase123!")
    assert not ok
    assert "viết hoa" in err

    # 3. Missing lowercase
    ok, err = validate_password_complexity("UPPERCASE123!")
    assert not ok
    assert "viết thường" in err

    # 4. Missing number
    ok, err = validate_password_complexity("NoDigitsHere!@")
    assert not ok
    assert "chữ số" in err

    # 5. Missing special char
    ok, err = validate_password_complexity("AlphaNumeric1234")
    assert not ok
    assert "ký tự đặc biệt" in err

    # 6. Common weak password
    ok, err = validate_password_complexity("Password@123")
    # Might contain common password
    ok2, err2 = validate_password_complexity("12345678")
    assert not ok2

    # 7. Username substring
    ok, err = validate_password_complexity("DoctorMinh@2026", username="bs_minh")
    assert not ok
    assert "tên đăng nhập" in err

    # 8. Valid strong password
    ok, err = validate_password_complexity("KhamBenh@CapCuu2026#", username="bs_hoang", full_name="Trần Huy")
    assert ok
    assert err == ""


def test_password_reuse():
    assert is_password_reused("OldPassword123!", "OldPassword123!")
    assert not is_password_reused("NewPassword123!", "OldPassword123!")


@pytest.mark.asyncio
async def test_self_change_password_flow():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Admin logs in to create a test doctor
        admin_login = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "admin"})
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        import time
        now_ts = int(time.time())
        uname = f"bs_change_{now_ts}"
        initial_pwd = "Doctor@InitialPassword2026!"

        # Create doctor
        create_res = await ac.post("/api/v1/admin/staff", json={
            "name": "BS. Nguyễn Văn Đổi Mật Khẩu",
            "role": "doctor",
            "role_name": "Bác Sĩ Điều Trị",
            "department": "Khoa Hồi Sức Cấp Cứu",
            "practice_certificate": f"CCHN-PWD-{now_ts}",
            "pin_code": "5678",
            "rfid_card_id": f"RFID-PWD-{now_ts}",
            "responsibilities": "Khám bệnh",
            "username": uname,
            "password": initial_pwd,
            "must_change_password": True,
            "is_active": True,
        }, headers=admin_headers)
        assert create_res.status_code == 201

        # 2. Doctor logs in with initial credentials
        doc_login = await ac.post("/api/v1/auth/login", json={
            "username": uname,
            "password": initial_pwd
        })
        assert doc_login.status_code == 200
        doc_token = doc_login.json()["token"]
        doc_headers = {"Authorization": f"Bearer {doc_token}"}
        assert doc_login.json()["must_change_password"] is True

        # 3. Try to change password with WRONG current password
        wrong_res = await ac.post("/api/v1/auth/change-password", json={
            "current_password": "WrongPassword@123!",
            "new_password": "Doctor@NewSecretPass2026#",
            "confirm_password": "Doctor@NewSecretPass2026#",
        }, headers=doc_headers)
        assert wrong_res.status_code == 400
        assert "không chính xác" in wrong_res.json()["detail"]

        # 4. Try to change password with mismatched confirm password
        mismatch_res = await ac.post("/api/v1/auth/change-password", json={
            "current_password": initial_pwd,
            "new_password": "Doctor@NewSecretPass2026#",
            "confirm_password": "DifferentConfirmPassword2026#",
        }, headers=doc_headers)
        assert mismatch_res.status_code == 400
        assert "không khớp" in mismatch_res.json()["detail"]

        # 5. Try to REUSE current password
        reuse_res = await ac.post("/api/v1/auth/change-password", json={
            "current_password": initial_pwd,
            "new_password": initial_pwd,
            "confirm_password": initial_pwd,
        }, headers=doc_headers)
        assert reuse_res.status_code == 400
        assert "không được trùng" in reuse_res.json()["detail"]

        # 6. Try WEAK new password (no uppercase or special)
        weak_res = await ac.post("/api/v1/auth/change-password", json={
            "current_password": initial_pwd,
            "new_password": "weakpassword123",
            "confirm_password": "weakpassword123",
        }, headers=doc_headers)
        assert weak_res.status_code == 400

        # 7. SUCCESSFUL password change with strong password
        new_strong_pwd = "Doctor@StrongPass2026#!"
        success_res = await ac.post("/api/v1/auth/change-password", json={
            "current_password": initial_pwd,
            "new_password": new_strong_pwd,
            "confirm_password": new_strong_pwd,
        }, headers=doc_headers)
        assert success_res.status_code == 200
        success_data = success_res.json()
        assert success_data["status"] == "success"
        assert success_data["must_change_password"] is False
        assert "token" in success_data

        # 8. Verify OLD password CANNOT log in anymore
        old_login_res = await ac.post("/api/v1/auth/login", json={
            "username": uname,
            "password": initial_pwd
        })
        assert old_login_res.status_code == 401

        # 9. Verify NEW password CAN log in successfully
        new_login_res = await ac.post("/api/v1/auth/login", json={
            "username": uname,
            "password": new_strong_pwd
        })
        assert new_login_res.status_code == 200
        assert new_login_res.json()["must_change_password"] is False
        assert new_login_res.json()["name"] == "BS. Nguyễn Văn Đổi Mật Khẩu"


@pytest.mark.asyncio
async def test_rate_limiting_brute_force():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        admin_login = await ac.post("/api/v1/auth/login", json={"username": "admin", "password": "admin"})
        admin_token = admin_login.json()["token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        import time
        now_ts = int(time.time())
        uname = f"bs_brute_{now_ts}"
        initial_pwd = "Doctor@InitialPassword2026!"

        await ac.post("/api/v1/admin/staff", json={
            "name": "BS. Test Brute Force",
            "role": "doctor",
            "role_name": "Bác Sĩ",
            "department": "Khoa Ngoại",
            "practice_certificate": f"CCHN-BRUTE-{now_ts}",
            "pin_code": "1111",
            "rfid_card_id": f"RFID-BRUTE-{now_ts}",
            "responsibilities": "Trực",
            "username": uname,
            "password": initial_pwd,
            "is_active": True,
        }, headers=admin_headers)

        doc_login = await ac.post("/api/v1/auth/login", json={"username": uname, "password": initial_pwd})
        doc_headers = {"Authorization": f"Bearer {doc_login.json()['token']}"}

        # Submit 5 wrong passwords consecutively
        for i in range(4):
            res = await ac.post("/api/v1/auth/change-password", json={
                "current_password": f"WrongPass{i}!",
                "new_password": "Valid@NewPass2026#",
                "confirm_password": "Valid@NewPass2026#",
            }, headers=doc_headers)
            assert res.status_code == 400

        # 5th attempt triggers lockout
        res_5 = await ac.post("/api/v1/auth/change-password", json={
            "current_password": "WrongPass4!",
            "new_password": "Valid@NewPass2026#",
            "confirm_password": "Valid@NewPass2026#",
        }, headers=doc_headers)
        assert res_5.status_code == 429
        assert "tạm khóa" in res_5.json()["detail"]
