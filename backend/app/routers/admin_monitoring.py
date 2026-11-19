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
    BhytAuditLogItem, PaginatedTelemetryResponse, FeatureFlagItem,
    FeatureFlagResponse, FeatureFlagUpdate
)
from app.models.feature_flag import ClinicalFeatureFlag
from sqlalchemy import update
from app.services.admin_key_vault import (
    get_all_masked_keys, add_api_key, delete_api_key, ping_test_gemini_key, _load_vault_data,
    get_raw_key_by_id_async
)
from app.services.admin_monitoring_service import (
    aggregate_telemetry_overview, get_budget_status, save_budget_config,
    get_paginated_telemetry_logs
)

router = APIRouter(prefix="/admin", tags=["Cổng Quản Trị & Giám Sát AI"])

FEATURE_FLAG_METADATA = {
    "overview": ("Tổng quan", "Màn hình tổng quan vận hành"),
    "cpoe": ("Kê đơn thuốc", "Kê đơn và hồ sơ CPOE"),
    "debt": ("Sổ nợ vỏ", "Theo dõi mượn và hoàn trả thuốc kiểm soát đặc biệt"),
    "equipment": ("Sự cố thiết bị", "Báo hỏng và theo dõi thiết bị y tế"),
    "fefo": ("Kho dược", "Tồn kho, FEFO và dự trù"),
    "coldchain": ("Chuỗi lạnh", "Theo dõi nhiệt độ và trạng thái bảo quản lạnh"),
    "asset_audit": ("Kiểm kê tài sản", "Kiểm kê và điều chuyển tài sản"),
    "bhyt_audit": ("Giám định BHYT", "Rà soát thanh toán và cảnh báo xuất toán"),
    "documents": ("Tài liệu", "Thư viện văn bản y tế"),
}
DEFAULT_ENABLED_FLAGS = {"overview", "cpoe", "bhyt_audit", "fefo", "documents"}

async def _ensure_feature_flags(db: AsyncSession) -> list[ClinicalFeatureFlag]:
    connection = await db.connection()
    await connection.run_sync(lambda sync_connection: ClinicalFeatureFlag.__table__.create(sync_connection, checkfirst=True))
    rows = (await db.execute(select(ClinicalFeatureFlag).order_by(ClinicalFeatureFlag.key))).scalars().all()
    existing = {row.key for row in rows}
    if not rows or existing != set(FEATURE_FLAG_METADATA):
        for key, (label, description) in FEATURE_FLAG_METADATA.items():
            if key not in existing:
                db.add(ClinicalFeatureFlag(key=key, label=label, description=description, enabled=key in DEFAULT_ENABLED_FLAGS, version=1))
        await db.commit()
        rows = (await db.execute(select(ClinicalFeatureFlag).order_by(ClinicalFeatureFlag.key))).scalars().all()
    return list(rows)

@router.get("/feature-flags", response_model=FeatureFlagResponse)
async def get_feature_flags(db: AsyncSession = Depends(get_db)):
    rows = await _ensure_feature_flags(db)
    return FeatureFlagResponse(
        version=max((row.version for row in rows), default=1),
        flags=[FeatureFlagItem(key=row.key, label=row.label, description=row.description, enabled=row.enabled) for row in rows],
    )

@router.put("/feature-flags", response_model=FeatureFlagResponse)
async def update_feature_flags(payload: FeatureFlagUpdate, db: AsyncSession = Depends(get_db)):
    rows = await _ensure_feature_flags(db)
    current_version = max((row.version for row in rows), default=1)
    if payload.version != current_version:
        raise HTTPException(status_code=409, detail={"reason": "stale_version", "current_version": current_version})
    requested = {item.key: item.enabled for item in payload.flags if item.key in FEATURE_FLAG_METADATA}
    if set(requested) != set(FEATURE_FLAG_METADATA) or len(payload.flags) != len(FEATURE_FLAG_METADATA):
        raise HTTPException(status_code=422, detail="Cần gửi đầy đủ trạng thái của mọi tab đã đăng ký.")
    next_version = current_version + 1
    for row in rows:
        if row.key in requested:
            row.enabled = True if row.key == "overview" else requested[row.key]
        row.version = next_version
    await db.commit()
    return await get_feature_flags(db)

@router.get("/monitoring/overview", response_model=TelemetryOverviewResponse)
async def get_telemetry_overview(db: AsyncSession = Depends(get_db)):
    """Lấy số liệu giám sát vận hành AI, BHYT và an toàn lâm sàng."""
    return await aggregate_telemetry_overview(db)

@router.get("/monitoring/telemetry-logs", response_model=PaginatedTelemetryResponse)
async def get_monitoring_telemetry_logs(
    page: int = Query(1, ge=1, description="Số thứ tự trang hiện tại"),
    page_size: int = Query(25, ge=5, le=200, description="Số bản ghi trên một trang"),
    event_type: Optional[str] = Query(None, description="Lọc theo loại sự kiện"),
    model_name: Optional[str] = Query(None, description="Lọc theo model AI"),
    user_role: Optional[str] = Query(None, description="Lọc theo vai trò người dùng"),
    q: Optional[str] = Query(None, description="Tìm kiếm theo từ khóa câu hỏi, ID hoặc nội dung"),
    db: AsyncSession = Depends(get_db)
):
    """Lấy danh sách nhật ký tương tác AI & Telemetry có phân trang, bộ lọc và tìm kiếm toàn văn."""
    return await get_paginated_telemetry_logs(
        db=db,
        page=page,
        page_size=page_size,
        event_type=event_type,
        model_name=model_name,
        user_role=user_role,
        q=q
    )

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
            (BhytAuditLog.primary_icd10.ilike(term)) |
            (BhytAuditLog.violations_json.ilike(term))
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
    from app.config import settings
    if settings.IDENTITY_DATABASE_URL and settings.KEY_ENCRYPTION_KEY:
        from app.identity_database import get_identity_session_factory
        from app.services.identity_service import list_provider_keys
        factory = get_identity_session_factory()[1]
        async with factory() as session:
            return await list_provider_keys(session)
    return get_all_masked_keys()

@router.post("/keys", response_model=ApiKeyItem)
async def create_api_key(payload: AddApiKeyRequest):
    """Thêm một khóa API mới vào bể khóa xoay vòng."""
    from app.config import settings
    if settings.IDENTITY_DATABASE_URL and settings.KEY_ENCRYPTION_KEY:
        from app.identity_database import get_identity_session_factory
        from app.services.identity_service import add_provider_key
        factory = get_identity_session_factory()[1]
        async with factory() as session:
            result = await add_provider_key(session, payload.name, payload.api_key, payload.provider)
    else:
        result = add_api_key(name=payload.name, raw_key=payload.api_key, provider=payload.provider)
    from app.routers.availability import invalidate_availability_cache
    invalidate_availability_cache()
    return result

@router.delete("/keys/{key_id}")
async def remove_api_key(key_id: str):
    """Xóa một khóa API khỏi bể khóa."""
    from app.config import settings
    if settings.IDENTITY_DATABASE_URL and settings.KEY_ENCRYPTION_KEY:
        from app.identity_database import get_identity_session_factory
        from app.services.identity_service import delete_provider_key
        factory = get_identity_session_factory()[1]
        async with factory() as session:
            success = await delete_provider_key(session, key_id)
    else:
        success = delete_api_key(key_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy Key ID để xóa")
    from app.routers.availability import invalidate_availability_cache
    invalidate_availability_cache()
    return {"status": "success", "message": f"Đã xóa khóa {key_id}"}

@router.post("/keys/test", response_model=TestKeyResponse)
async def test_api_key_connection(payload: TestKeyRequest):
    """Kiểm tra kết nối và hạn ngạch (Ping Test) cho API Key."""
    raw_key = None
    if payload.api_key:
        raw_key = payload.api_key
    elif payload.key_id:
        raw_key = await get_raw_key_by_id_async(payload.key_id)

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
