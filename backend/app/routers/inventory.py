from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.inventory import InventoryBatch
from app.schemas.inventory import BatchResponse, BatchDispatch, RestockProposalRequest
from app.services.audit_service import record_audit_event
from app.security.auth import audit_actor_fields
from app.services.inventory_coldchain_policy import assess_cold_storage

router = APIRouter(prefix="/inventory", tags=["Kho Dược & Hạn Dùng FEFO (GSP TT 36 & TT 22)"])

async def _batch_response(batch: InventoryBatch, db: AsyncSession) -> BatchResponse:
    response = BatchResponse.model_validate(batch)
    try:
        response.days_left = (date.fromisoformat(batch.expiry_date) - date.today()).days
    except ValueError:
        raise HTTPException(status_code=409, detail=f"Lô {batch.id} chưa có hạn dùng hợp lệ")
    response.is_near_expiry = response.days_left < 60
    response.is_low_stock = batch.current_stock <= batch.min_threshold
    storage = await assess_cold_storage(db, batch)
    response.cold_storage_required = storage.required
    response.cold_chain_state_id = storage.state_id
    response.cold_storage_link_verified = storage.link_verified
    response.cold_storage_unknown_reason = storage.unknown_reason
    response.dispatch_hold_reason = (
        "Lô đang biệt trữ độc lập" if batch.is_quarantined else
        "Lô đã hết hạn" if response.days_left < 0 else
        "Lô không còn tồn kho khả dụng" if batch.current_stock <= 0 else
        storage.hold_reason
    )
    response.is_dispatchable = response.dispatch_hold_reason is None
    return response

@router.get("/batches", response_model=list[BatchResponse])
async def get_batches(
    near_expiry: bool | None = Query(None, description="Lọc lô cận hạn < 60 ngày"),
    low_stock: bool | None = Query(None, description="Lọc lô dưới định mức Min"),
    search: str | None = Query(None, description="Tìm tên thuốc, số lô, vị trí kệ"),
    db: AsyncSession = Depends(get_db)
):
    # FEFO order: expiry_date ASC
    stmt = select(InventoryBatch).order_by(InventoryBatch.expiry_date.asc())
    res = await db.execute(stmt)
    batches = res.scalars().all()

    filtered = []
    for batch in batches:
        b = await _batch_response(batch, db)
        if near_expiry is not None and b.is_near_expiry != near_expiry:
            continue
        if low_stock is not None and (b.current_stock <= b.min_threshold) != low_stock:
            continue
        if search:
            q = search.lower()
            if q not in b.item_name.lower() and q not in b.batch_number.lower() and q not in b.warehouse_location.lower():
                continue
        filtered.append(b)
    return filtered

@router.post("/batches/{batch_id}/dispatch", response_model=BatchResponse)
async def dispatch_fefo_batch(
    batch_id: str,
    payload: BatchDispatch,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    stmt = select(InventoryBatch).where(InventoryBatch.id == batch_id)
    res = await db.execute(stmt)
    batch = res.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Không tìm thấy lô hàng")

    try:
        expired = date.fromisoformat(batch.expiry_date) < date.today()
    except ValueError:
        raise HTTPException(status_code=409, detail="Lô hàng chưa có hạn dùng hợp lệ")
    if batch.is_quarantined or expired:
        raise HTTPException(status_code=409, detail="Không được xuất lô đang biệt trữ hoặc đã hết hạn")
    storage = await assess_cold_storage(db, batch)
    if storage.hold_reason:
        raise HTTPException(status_code=409, detail=storage.hold_reason)

    # Availability and decrement must happen in one database operation. A second
    # operator may have consumed or quarantined this stock since the initial read.
    result = await db.execute(
        update(InventoryBatch)
        .where(
            InventoryBatch.id == batch_id,
            InventoryBatch.current_stock >= payload.quantity,
            InventoryBatch.is_quarantined.is_(False),
            InventoryBatch.expiry_date >= date.today().isoformat(),
            storage.dispatch_guard,
        )
        .values(
            current_stock=InventoryBatch.current_stock - payload.quantity,
            is_low_stock=(InventoryBatch.current_stock - payload.quantity <= InventoryBatch.min_threshold),
        )
        .returning(InventoryBatch)
        .execution_options(populate_existing=True)
    )
    updated = result.scalar_one_or_none()
    if updated is None:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Tồn kho khả dụng đã thay đổi hoặc không đủ số lượng để xuất",
        )
    batch = updated

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="DISPATCH_FEFO",
        action_title=f"Xuất kho FEFO {payload.quantity} {batch.unit} {batch.item_name}",
        target_item=f"{batch.item_name} (Lô: {batch.batch_number})",
        legal_basis="Mục 12 Phụ lục I Thông tư 36/2018/TT-BYT (GSP)",
        **audit_actor_fields(request),
        payload_data={
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "dispatched_qty": payload.quantity,
            "remaining_stock": batch.current_stock
        }
    )
    await db.refresh(batch)
    return await _batch_response(batch, db)

@router.post("/restock-proposal")
async def create_restock_proposal(
    payload: RestockProposalRequest,
    db: AsyncSession = Depends(get_db),
    request: Request = None,
):
    stmt = select(InventoryBatch).where(InventoryBatch.id.in_(payload.batch_ids))
    res = await db.execute(stmt)
    batches = res.scalars().all()

    if len(batches) != len(set(payload.batch_ids)):
        raise HTTPException(status_code=404, detail="Không tìm thấy các lô hàng đề xuất")

    total_requested = 0
    item_summaries = []
    for b in batches:
        needed = max(0, b.max_threshold - b.current_stock)
        total_requested += needed
        item_summaries.append(f"{b.item_name} (+{needed} {b.unit})")

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="RESTOCK_PROPOSAL",
        action_title=f"Lập phiếu dự trù bổ sung cơ số {len(batches)} mặt hàng cạn kho",
        target_item=f"{len(batches)} mặt hàng kho dược ({', '.join(item_summaries[:2])}...)",
        legal_basis="Mẫu số 01/TT22 & Điều 7 Thông tư 22/2011/TT-BYT",
        **audit_actor_fields(request),
        payload_data={
            "restocked_batches": payload.batch_ids,
            "total_items": len(batches),
            "reason": payload.urgency_reason,
            "claimed_signer_name": payload.pharmacist_name,
        }
    )

    return {
        "message": f"Đã lập phiếu dự trù cho {len(batches)} mặt hàng; chờ tiếp nhận hàng thực tế",
        "proposed_count": len(batches),
        "total_units_requested": total_requested,
        "restocked_count": 0,
        "total_units_replenished": 0,
    }
