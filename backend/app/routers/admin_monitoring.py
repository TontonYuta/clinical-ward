"""
Admin Monitoring & API Key Gateway Router.
Cung cấp endpoints quản trị Telemetry, Bể khóa API Key và Ngân sách Token.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.bhyt import BhytAuditLog
from app.schemas.admin_monitoring_schema import (
    ApiKeyItem, AddApiKeyRequest, TestKeyRequest, TestKeyResponse,
    BudgetCapConfig, BudgetCapResponse, TelemetryOverviewResponse,
    BhytAuditLogItem
)
from app.services.admin_key_vault import (
    get_all_masked_keys, add_api_key, delete_api_key, ping_test_gemini_key, _load_vault_data
)
from app.services.admin_monitoring_service import (
    aggregate_telemetry_overview, get_budget_status, save_budget_config
)

router = APIRouter(prefix="/admin", tags=["Cổng Quản Trị & Giám Sát AI"])

@router.get("/monitoring/overview", response_model=TelemetryOverviewResponse)
async def get_telemetry_overview(db: AsyncSession = Depends(get_db)):
    """Lấy số liệu giám sát vận hành AI, BHYT và an toàn lâm sàng."""
    return await aggregate_telemetry_overview(db)

@router.get("/monitoring/bhyt-logs", response_model=List[BhytAuditLogItem])
async def get_monitoring_bhyt_logs(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Lấy danh sách nhật ký giám định BHYT để kiểm tra lỗi và rà soát xuất toán."""
    stmt = select(BhytAuditLog).order_by(BhytAuditLog.created_at.desc(), BhytAuditLog.id.desc())
    if status and status.upper() != "ALL":
        stmt = stmt.where(BhytAuditLog.status == status.upper())
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            (BhytAuditLog.patient_name.ilike(term)) |
            (BhytAuditLog.prescription_id.ilike(term)) |
            (BhytAuditLog.insurance_card_number.ilike(term)) |
            (BhytAuditLog.primary_icd10.ilike(term))
        )
    stmt = stmt.limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    
    return [
        BhytAuditLogItem(
            id=r.id,
            prescription_id=r.prescription_id,
            patient_name=r.patient_name or "Bệnh nhân",
            insurance_card_number=r.insurance_card_number or "",
            hospital_rank=r.hospital_rank or "HANG_I",
            treatment_type=r.treatment_type or "NGOAI_TRU",
            primary_icd10=r.primary_icd10 or "",
            status=r.status or "PASS",
            total_cost_vnd=float(r.total_cost_vnd or 0.0),
            at_risk_cost_vnd=float(r.at_risk_cost_vnd or 0.0),
            violations_count=int(r.violations_count or 0),
            violations_json=r.violations_json or "[]",
            created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None
        )
        for r in rows
    ]

@router.get("/keys", response_model=List[ApiKeyItem])
async def list_api_keys():
    """Lấy danh sách các khóa API trong Key Pool (đã che mờ an toàn)."""
    return get_all_masked_keys()

@router.post("/keys", response_model=ApiKeyItem)
async def create_api_key(payload: AddApiKeyRequest):
    """Thêm một khóa API mới vào bể khóa xoay vòng."""
    return add_api_key(name=payload.name, raw_key=payload.api_key, provider=payload.provider)

@router.delete("/keys/{key_id}")
async def remove_api_key(key_id: str):
    """Xóa một khóa API khỏi bể khóa."""
    success = delete_api_key(key_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy Key ID để xóa")
    return {"status": "success", "message": f"Đã xóa khóa {key_id}"}

@router.post("/keys/test", response_model=TestKeyResponse)
async def test_api_key_connection(payload: TestKeyRequest):
    """Kiểm tra kết nối và hạn ngạch (Ping Test) cho API Key."""
    raw_key = None
    if payload.api_key:
        raw_key = payload.api_key
    elif payload.key_id:
        keys = _load_vault_data()
        for k in keys:
            if k["key_id"] == payload.key_id:
                raw_key = k.get("raw_key")
                break
    if not raw_key:
        raise HTTPException(status_code=400, detail="Thiếu thông tin API Key để kiểm tra")

    ok, msg, lat, models = await ping_test_gemini_key(raw_key)
    return TestKeyResponse(
        success=ok,
        status="active" if ok else "failed",
        message=msg,
        latency_ms=lat,
        available_models=models
    )

@router.post("/keys/auto-heartbeat")
async def trigger_auto_heartbeat():
    """Tự động quét sức khỏe toàn bộ bể khóa API Key & Auto-failover."""
    from app.services.admin_key_vault import auto_heartbeat_all_keys
    return await auto_heartbeat_all_keys()

@router.get("/budget", response_model=BudgetCapResponse)
async def get_token_budget():
    """Lấy cấu hình trần ngân sách Token và tiến độ sử dụng hôm nay."""
    return await get_budget_status()

@router.post("/budget", response_model=BudgetCapConfig)
async def update_token_budget(cfg: BudgetCapConfig):
    """Cập nhật hạn mức ngân sách Token hàng ngày / hàng tháng."""
    save_budget_config(cfg)
    return cfg
