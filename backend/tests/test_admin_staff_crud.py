"""Unit tests for Admin Staff Management CRUD endpoints with SQLite persistence."""
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_list_staff():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/admin/staff")
        assert res.status_code == 200
        data = res.json()
        assert "total" in data
        assert "items" in data
        assert data["total"] >= 5
        # Ensure initial seed users exist
        ids = [item["id"] for item in data["items"]]
        assert "u-1" in ids
        assert "u-4" in ids

@pytest.mark.asyncio
async def test_create_and_update_and_soft_delete_staff():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        unique_cchn = f"TEST-CCHN-{int(pytest.importorskip('time').time())}"
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
            "is_active": True,
        }

        # 1. Create
        create_res = await ac.post("/api/v1/admin/staff", json=payload)
        assert create_res.status_code == 201
        created = create_res.json()
        staff_id = created["id"]
        assert created["name"] == "BSCKII. Hoàng Minh Tuấn"
        assert created["academic_title"] == "BSCKII"
        assert created["dob"] == "1985-06-15"
        assert created["is_active"] is True

        # 2. Detail
        get_res = await ac.get(f"/api/v1/admin/staff/{staff_id}")
        assert get_res.status_code == 200
        assert get_res.json()["email"] == "tuan.hm@bv.gov.vn"

        # 3. Update
        update_res = await ac.put(f"/api/v1/admin/staff/{staff_id}", json={
            "phone": "0988776655",
            "role_name": "Trưởng Khoa Ngoại Chấn Thương",
        })
        assert update_res.status_code == 200
        assert update_res.json()["phone"] == "0988776655"
        assert update_res.json()["role_name"] == "Trưởng Khoa Ngoại Chấn Thương"

        # 4. Reset PIN
        pin_res = await ac.patch(f"/api/v1/admin/staff/{staff_id}/reset-pin", json={
            "new_pin": "8888",
        })
        assert pin_res.status_code == 200
        assert pin_res.json()["status"] == "pin_updated"

        # 5. Soft Delete (Tạm ngưng)
        del_res = await ac.delete(f"/api/v1/admin/staff/{staff_id}")
        assert del_res.status_code == 200
        del_data = del_res.json()
        assert del_data["status"] == "suspended"

        # Verify soft delete in detail: is_active must be False
        verify_res = await ac.get(f"/api/v1/admin/staff/{staff_id}")
        assert verify_res.status_code == 200
        assert verify_res.json()["is_active"] is False
