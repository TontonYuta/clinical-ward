"""
Admin External Integrations Service (eSMS.vn Brandname & Google Apps Script).
Quản trị kết nối, kiểm tra số dư và nhật ký truyền thông viễn thông thật 100%.
"""
import os
import json
import time
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.schemas.admin_integrations_schema import (
    EsmsStatusResponse, EsmsPingResponse, EsmsLogItem,
    GasStatusResponse, GasPingResponse, GasLogItem
)

_INTEGRATIONS_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/integrations_config.json"))

def _mask_val(v: Optional[str]) -> str:
    cleaned = (v or "").strip()
    if not cleaned:
        return "Chưa cấu hình"
    if len(cleaned) <= 8:
        return cleaned[:2] + "****"
    return cleaned[:4] + "..." + cleaned[-4:]

def _mask_url(url: Optional[str]) -> str:
    cleaned = (url or "").strip()
    if not cleaned:
        return "Chưa cấu hình Webhook URL"
    if len(cleaned) <= 30:
        return cleaned
    return cleaned[:32] + "..." + cleaned[-8:]

def load_integrations_config() -> Dict[str, Any]:
    if os.path.exists(_INTEGRATIONS_FILE):
        try:
            with open(_INTEGRATIONS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # Mặc định lấy từ biến môi trường
    cfg = {
        "esms_api_key": os.getenv("ESMS_API_KEY", "").strip(),
        "esms_secret_key": os.getenv("ESMS_SECRET_KEY", "").strip(),
        "esms_brandname": os.getenv("ESMS_BRANDNAME", "BV_LAMSANG").strip(),
        "esms_sandbox": os.getenv("ESMS_SANDBOX", "1").strip() == "1",
        "gas_webhook_url": os.getenv("GAS_WEBHOOK_URL", "").strip()
    }
    save_integrations_config(cfg)
    return cfg

def save_integrations_config(cfg: Dict[str, Any]) -> None:
    try:
        os.makedirs(os.path.dirname(_INTEGRATIONS_FILE), exist_ok=True)
        with open(_INTEGRATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

async def ping_esms(api_key: Optional[str] = None, secret_key: Optional[str] = None) -> EsmsPingResponse:
    cfg = load_integrations_config()
    k = (api_key or cfg.get("esms_api_key") or "").strip()
    s = (secret_key or cfg.get("esms_secret_key") or "").strip()
    if not k or not s:
        return EsmsPingResponse(success=False, latency_ms=0.0, message="Thiếu eSMS API Key hoặc Secret Key")

    start = time.perf_counter()
    url = f"http://rest.esms.vn/MainService.svc/json/GetBalance/{k}/{s}"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            lat = round((time.perf_counter() - start) * 1000, 1)
            data = resp.json()
            code = str(data.get("CodeResponse", ""))
            if code == "100":
                bal = float(data.get("Balance", 0))
                uid = int(data.get("UserID", 0)) if data.get("UserID") else None
                return EsmsPingResponse(
                    success=True, balance_vnd=bal, user_id=uid, code_response=code, latency_ms=lat,
                    message=f"Kết nối eSMS thành công! Số dư tài khoản: {bal:,.0f} đ (User #{uid})"
                )
            return EsmsPingResponse(
                success=False, code_response=code, latency_ms=lat,
                message=f"eSMS phản hồi mã lỗi {code} (Kiểm tra lại cặp API Key & Secret Key)"
            )
    except Exception as exc:
        lat = round((time.perf_counter() - start) * 1000, 1)
        return EsmsPingResponse(success=False, latency_ms=lat, message=f"Không thể kết nối cổng eSMS.vn: {str(exc)}")

async def get_esms_status(db: AsyncSession) -> EsmsStatusResponse:
    cfg = load_integrations_config()
    k, s = cfg.get("esms_api_key", ""), cfg.get("esms_secret_key", "")
    configured = bool(k and s)

    # Thống kê từ database thật
    res_stats = await db.execute(text("""
        SELECT COUNT(*),
               SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END),
               SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END),
               MAX(created_at)
        FROM sms_delivery_logs
    """))
    row_stats = res_stats.fetchone() or (0, 0, 0, None)
    total_sms = row_stats[0] or 0
    deliv = row_stats[1] or 0
    fail = row_stats[2] or 0
    last_sent = str(row_stats[3]) if row_stats[3] else None

    # Lấy 10 log mới nhất
    res_logs = await db.execute(text("""
        SELECT id, patient_id, patient_name, recipient_phone, message_type,
               content, characters_count, sms_segments, provider, status,
               delivery_receipt, error_detail, created_at
        FROM sms_delivery_logs
        ORDER BY created_at DESC LIMIT 10
    """))
    logs: List[EsmsLogItem] = []
    for r in res_logs.fetchall():
        logs.append(EsmsLogItem(
            id=r[0], patient_id=r[1], patient_name=r[2], recipient_phone=r[3],
            message_type=r[4], content=r[5], characters_count=r[6] or 0,
            sms_segments=r[7] or 1, provider=r[8] or "esms", status=r[9] or "delivered",
            delivery_receipt=r[10], error_detail=r[11], created_at=str(r[12])
        ))

    # Kiểm tra số dư eSMS thật
    balance, user_id, status_str = None, None, "unconfigured"
    if configured:
        ping = await ping_esms(k, s)
        status_str = "connected" if ping.success else "error"
        balance = ping.balance_vnd
        user_id = ping.user_id

    return EsmsStatusResponse(
        configured=configured, api_key_masked=_mask_val(k), secret_key_masked=_mask_val(s),
        brandname=cfg.get("esms_brandname", "BV_LAMSANG"), is_sandbox=cfg.get("esms_sandbox", True),
        balance_vnd=balance, user_id=user_id, status=status_str,
        total_sms=total_sms, delivered_count=deliv, failed_count=fail,
        last_sent_at=last_sent, recent_logs=logs
    )

async def ping_gas(webhook_url: Optional[str] = None) -> GasPingResponse:
    cfg = load_integrations_config()
    target_url = (webhook_url or cfg.get("gas_webhook_url") or "").strip()
    if not target_url:
        return GasPingResponse(success=False, latency_ms=0.0, message="Chưa cấu hình Google Apps Script Webhook URL")

    start = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            resp = await client.post(target_url, json={"action": "ping", "caller": "Clinical AI Monitor", "timestamp": time.time()})
            lat = round((time.perf_counter() - start) * 1000, 1)
            ok = resp.status_code in (200, 302)
            return GasPingResponse(
                success=ok, status_code=resp.status_code, latency_ms=lat,
                message=f"Google Apps Script Webhook phản hồi HTTP {resp.status_code} ({lat} ms)"
            )
    except Exception as exc:
        lat = round((time.perf_counter() - start) * 1000, 1)
        return GasPingResponse(success=False, latency_ms=lat, message=f"Lỗi kết nối GAS Webhook: {str(exc)}")

async def get_gas_status(db: AsyncSession) -> GasStatusResponse:
    cfg = load_integrations_config()
    url = cfg.get("gas_webhook_url", "").strip()
    configured = bool(url and url.startswith("http"))

    res_stats = await db.execute(text("""
        SELECT COUNT(*),
               SUM(CASE WHEN notification_status = 'sent' THEN 1 ELSE 0 END),
               MAX(created_at)
        FROM prescription_advice_records
    """))
    row_stats = res_stats.fetchone() or (0, 0, None)
    total_advices = row_stats[0] or 0
    sent_advices = row_stats[1] or 0
    last_sent = str(row_stats[2]) if row_stats[2] else None

    res_logs = await db.execute(text("""
        SELECT id, prescription_id, patient_name, patient_email, patient_phone,
               diagnosis, doctor_name, notification_status, email_sent_at, created_at
        FROM prescription_advice_records
        ORDER BY created_at DESC LIMIT 10
    """))
    logs: List[GasLogItem] = []
    for r in res_logs.fetchall():
        logs.append(GasLogItem(
            id=r[0], prescription_id=r[1], patient_name=r[2], patient_email=r[3],
            patient_phone=r[4], diagnosis=r[5], doctor_name=r[6],
            notification_status=r[7] or "sent", email_sent_at=str(r[8]) if r[8] else None,
            created_at=str(r[9])
        ))

    return GasStatusResponse(
        configured=configured, webhook_url_masked=_mask_url(url),
        raw_webhook_url=url if url else None,
        status="ready" if configured else "unconfigured",
        total_advices=total_advices, sent_count=sent_advices,
        last_sent_at=last_sent, recent_logs=logs
    )
