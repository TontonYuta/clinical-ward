"""
Admin External Integrations Router (eSMS & Google Apps Script).
Endpoints kiểm tra số dư thật, ping gateway và cấu hình viễn thông.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.admin_integrations_schema import (
    EsmsStatusResponse, EsmsPingResponse, EsmsConfigPayload,
    GasStatusResponse, GasPingResponse, GasConfigPayload
)
from app.services.admin_integrations_service import (
    get_esms_status, ping_esms, load_integrations_config, save_integrations_config,
    get_gas_status, ping_gas
)

router = APIRouter(prefix="/admin/integrations", tags=["Cổng Viễn Thông & GAS"])

@router.get("/esms/status", response_model=EsmsStatusResponse)
async def fetch_esms_status(db: AsyncSession = Depends(get_db)):
    """Lấy trạng thái kết nối, số dư tài khoản thật (VNĐ) và nhật ký gửi SMS từ SQLite."""
    return await get_esms_status(db)

@router.post("/esms/ping", response_model=EsmsPingResponse)
async def test_esms_connection(payload: EsmsConfigPayload = None):
    """Kiểm tra kết nối và số dư trực tiếp qua API GetBalance của eSMS.vn."""
    k = payload.api_key if payload else None
    s = payload.secret_key if payload else None
    return await ping_esms(api_key=k, secret_key=s)

@router.post("/esms/config", response_model=EsmsStatusResponse)
async def update_esms_config(payload: EsmsConfigPayload, db: AsyncSession = Depends(get_db)):
    """Cập nhật cấu hình cặp Key eSMS.vn, Brandname và chế độ Sandbox."""
    cfg = load_integrations_config()
    if payload.api_key is not None:
        cfg["esms_api_key"] = payload.api_key.strip()
    if payload.secret_key is not None:
        cfg["esms_secret_key"] = payload.secret_key.strip()
    if payload.brandname is not None:
        cfg["esms_brandname"] = payload.brandname.strip()
    if payload.is_sandbox is not None:
        cfg["esms_sandbox"] = payload.is_sandbox
    save_integrations_config(cfg)
    return await get_esms_status(db)

@router.get("/gas/status", response_model=GasStatusResponse)
async def fetch_gas_status(db: AsyncSession = Depends(get_db)):
    """Lấy trạng thái Webhook Google Apps Script và nhật ký gửi email dặn dò."""
    return await get_gas_status(db)

@router.post("/gas/ping", response_model=GasPingResponse)
async def test_gas_connection(payload: GasConfigPayload = None):
    """Ping kiểm tra tính sẵn sàng của Google Apps Script Web App Webhook."""
    url = payload.webhook_url if payload else None
    return await ping_gas(webhook_url=url)

@router.post("/gas/config", response_model=GasStatusResponse)
async def update_gas_config(payload: GasConfigPayload, db: AsyncSession = Depends(get_db)):
    """Cập nhật Google Apps Script Webhook URL cho hệ thống."""
    cfg = load_integrations_config()
    cfg["gas_webhook_url"] = payload.webhook_url.strip()
    save_integrations_config(cfg)
    return await get_gas_status(db)
