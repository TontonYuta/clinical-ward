from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.inventory import InventoryBatch
from app.schemas.inventory import BatchResponse, BatchDispatch, RestockProposalRequest
from app.services.audit_service import record_audit_event
from app.services.registry_service import invalidate_hospital_stock_cache

router = APIRouter(prefix="/inventory", tags=["Kho Dược & Hạn Dùng FEFO (GSP TT 36 & TT 22)"])

@router.get("/batches", response_model=list[BatchResponse])
async def get_batches(
    near_expiry: bool | None = Query(None, description="Lọc lô cận hạn < 60 ngày"),
    low_stock: bool | None = Query(None, description="Lọc lô dưới định mức Min"),
    search: str | None = Query(None, description="Tìm tên thuốc, số lô, vị trí kệ"),
    limit: int = Query(200, ge=1, le=1000, description="Giới hạn số bản ghi"),
    offset: int = Query(0, ge=0, description="Bỏ qua số bản ghi"),
    db: AsyncSession = Depends(get_db)
):
    # FEFO order: expiry_date ASC, fully pushed to SQL indexes
    stmt = select(InventoryBatch)
    if near_expiry is not None:
        stmt = stmt.where(InventoryBatch.is_near_expiry == near_expiry)
    if low_stock is not None:
        stmt = stmt.where(or_(InventoryBatch.is_low_stock == True, InventoryBatch.current_stock <= InventoryBatch.min_threshold))
    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        stmt = stmt.where(or_(
            func.lower(InventoryBatch.item_name).like(q),
            func.lower(InventoryBatch.batch_number).like(q),
            func.lower(InventoryBatch.warehouse_location).like(q)
        ))
    stmt = stmt.order_by(InventoryBatch.expiry_date.asc()).offset(offset).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/batches/{batch_id}/dispatch", response_model=BatchResponse)
async def dispatch_fefo_batch(
    batch_id: str,
    payload: BatchDispatch,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(InventoryBatch).where(InventoryBatch.id == batch_id)
    res = await db.execute(stmt)
    batch = res.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Không tìm thấy lô hàng")

    if batch.current_stock < payload.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Số lượng tồn kho ({batch.current_stock}) không đủ để xuất ({payload.quantity})"
        )

    batch.current_stock -= payload.quantity
    batch.is_low_stock = batch.current_stock <= batch.min_threshold

    await db.commit()
    invalidate_hospital_stock_cache()
    await db.refresh(batch)

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="DISPATCH_FEFO",
        action_title=f"Xuất kho FEFO {payload.quantity} {batch.unit} {batch.item_name}",
        target_item=f"{batch.item_name} (Lô: {batch.batch_number})",
        legal_basis="Mục 12 Phụ lục I Thông tư 36/2018/TT-BYT (GSP)",
        signer_name="DS. Nguyễn Bích Ngọc",
        signer_certificate="001098/BYT-CCHN",
        auth_method="PIN",
        payload_data={
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "dispatched_qty": payload.quantity,
            "remaining_stock": batch.current_stock
        }
    )

    return batch

@router.post("/restock-proposal")
async def create_restock_proposal(
    payload: RestockProposalRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(InventoryBatch).where(InventoryBatch.id.in_(payload.batch_ids))
    res = await db.execute(stmt)
    batches = res.scalars().all()

    if not batches:
        raise HTTPException(status_code=404, detail="Không tìm thấy các lô hàng đề xuất")

    total_restocked = 0
    item_summaries = []
    for b in batches:
        needed = max(0, b.max_threshold - b.current_stock)
        b.current_stock = b.max_threshold
        b.is_low_stock = False
        total_restocked += needed
        item_summaries.append(f"{b.item_name} (+{needed} {b.unit})")

    await db.commit()

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="RESTOCK_MEDICATION",
        action_title=f"Lập phiếu dự trù bổ sung cơ số {len(batches)} mặt hàng cạn kho",
        target_item=f"{len(batches)} mặt hàng kho dược ({', '.join(item_summaries[:2])}...)",
        legal_basis="Mẫu số 01/TT22 & Điều 7 Thông tư 22/2011/TT-BYT",
        signer_name=payload.pharmacist_name,
        signer_certificate="001098/BYT-CCHN",
        auth_method="PIN",
        payload_data={
            "restocked_batches": payload.batch_ids,
            "total_items": len(batches),
            "reason": payload.urgency_reason
        }
    )

    return {
        "message": f"Đã lập và duyệt phiếu dự trù cho {len(batches)} mặt hàng",
        "restocked_count": len(batches),
        "total_units_replenished": total_restocked
    }
