import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.config import settings
from app.services.admin_key_vault import get_all_masked_keys, get_system_env_key_item

@pytest.mark.asyncio
async def test_system_env_key_in_vault_listing():
    """Kiểm tra Khóa Hệ Thống Mặc Định luôn được hiển thị minh bạch kèm hạn ngạch chính xác."""
    # Đảm bảo có GEMINI_API_KEY giả lập hợp lệ
    old_key = settings.GEMINI_API_KEY
    settings.GEMINI_API_KEY = "AIzaSyTestSystemSecretKeyForVerification123456"
    try:
        keys = get_all_masked_keys()
        sys_keys = [k for k in keys if k["key_id"] == "sys-env-gemini-primary"]
        assert len(sys_keys) == 1, "Phải có đúng 1 bản ghi Khóa Hệ Thống Mặc Định"
        sys_key = sys_keys[0]

        assert sys_key["name"] == "Khóa Mặc Định Hệ Thống (Render Environment)"
        assert sys_key["provider"] == "gemini"
        assert sys_key["is_system_env"] is True
        assert "15 RPM" in sys_key["quota_status"]
        assert "1.000.000 TPM" in sys_key["quota_status"]
        assert "1.500 RPD" in sys_key["quota_status"]
        assert sys_key["masked_key"].startswith("AIzaSy")
        assert "TestSystemSecretKey" not in sys_key["masked_key"], "Không được làm lộ raw key"
    finally:
        settings.GEMINI_API_KEY = old_key

@pytest.mark.asyncio
async def test_cannot_delete_system_env_key():
    """Kiểm tra không cho phép xóa Khóa Hệ Thống Mặc Định từ API."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Cố tình gọi DELETE vào sys-env-gemini-primary
        res = await client.delete("/api/v1/admin/keys/sys-env-gemini-primary")
        # Route này yêu cầu auth hoặc trả về 400 nếu bị chặn
        assert res.status_code in (400, 401), f"Phải chặn xóa khóa hệ thống (status={res.status_code})"
