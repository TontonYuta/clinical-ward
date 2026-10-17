from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.asset import AssetRecord
from app.schemas.asset import AssetResponse, TransferAssetRequest, LiquidateAssetRequest
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/assets", tags=["Kiểm Kê Định Kỳ & Quản Lý Tài Sản (NĐ 151 & NĐ 114)"])

@router.get("", response_model=list[AssetResponse])
async def get_assets(
    misallocated: bool | None = Query(None, description="Lọc máy lệch buồng phòng"),
    liquidation: bool | None = Query(None, description="Lọc máy chờ thanh lý"),
    search: str | None = Query(None, description="Tìm mã tài sản, tên máy, khoa phòng"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AssetRecord).order_by(AssetRecord.id.asc())
    res = await db.execute(stmt)
    assets = res.scalars().all()

    filtered = []
    for a in assets:
        if misallocated is not None and a.is_misallocated != misallocated:
            continue
        if liquidation is not None and a.pending_liquidation != liquidation:
            continue
        if search:
            q = search.lower()
            if q not in a.code.lower() and q not in a.device_name.lower() and q not in a.actual_department.lower():
                continue
        filtered.append(a)
    return filtered

@router.post("/{asset_id}/scan-qr", response_model=AssetResponse)
async def scan_qr_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AssetRecord).where(AssetRecord.id == asset_id)
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    asset.last_scanned_at = now_str
    await db.commit()
    await db.refresh(asset)
    return asset

@router.put("/{asset_id}/transfer", response_model=AssetResponse)
async def transfer_asset(
    asset_id: str,
    payload: TransferAssetRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AssetRecord).where(AssetRecord.id == asset_id)
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    old_dept = asset.registered_department
    asset.registered_department = payload.new_department
    asset.actual_department = payload.new_department
    asset.is_misallocated = False
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    asset.last_scanned_at = now_str

    await db.commit()
    await db.refresh(asset)

    # Record Audit Trail (Mẫu 01/TSC-ĐC)
    await record_audit_event(
        db=db,
        action_type="TRANSFER_ASSET",
        action_title=f"Ký biên bản điều chuyển tài sản {asset.device_name}",
        target_item=f"{asset.code} ({asset.device_name}): {old_dept} ➔ {payload.new_department}",
        legal_basis="Mẫu số 01/TSC-ĐC theo Nghị định 151/2017/NĐ-CP",
        signer_name=payload.engineer_name,
        signer_certificate="BME-204/VTYT",
        witness_name=payload.receiver_name,
        witness_certificate="004812/HN-CCHN",
        auth_method="PIN",
        payload_data={
            "asset_code": asset.code,
            "old_dept": old_dept,
            "new_dept": payload.new_department
        }
    )

    return asset

@router.put("/{asset_id}/liquidate", response_model=AssetResponse)
async def liquidate_asset(
    asset_id: str,
    payload: LiquidateAssetRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AssetRecord).where(AssetRecord.id == asset_id)
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài sản")

    asset.pending_liquidation = True
    await db.commit()
    await db.refresh(asset)

    # Record Audit Trail (Director sole authority under NĐ 151 & NĐ 114)
    await record_audit_event(
        db=db,
        action_type="LIQUIDATE_ASSET",
        action_title=f"Lập tờ trình hội đồng thanh lý tài sản {asset.device_name}",
        target_item=f"{asset.code} - {asset.device_name} ({asset.operating_years} năm sử dụng)",
        legal_basis="Điều 39 & 40 Nghị định 151/2017 & NĐ 114/2024",
        signer_name=payload.director_name,
        signer_certificate="001002/BYT-CCHN",
        auth_method="PIN",
        payload_data={
            "asset_code": asset.code,
            "depreciation": asset.depreciation_rate_percent,
            "reason": payload.reason
        }
    )

    return asset
