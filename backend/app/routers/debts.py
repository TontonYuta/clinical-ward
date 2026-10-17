from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.debt import DebtRecord
from app.schemas.debt import (
    DebtResponse,
    DebtCreate,
    SettleDebtRequest,
    AmpouleDestructionRequest
)
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/debts", tags=["Sổ Nợ Tủ Trực (TT 22 & TT 20)"])

@router.get("", response_model=list[DebtResponse])
async def get_debts(
    status: str | None = Query(None, description="debt hoặc settled"),
    item_type: str | None = Query(None, description="Lọc theo loại thuốc"),
    search: str | None = Query(None, description="Tìm tên thuốc hoặc bệnh nhân"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DebtRecord).order_by(DebtRecord.created_at.desc())
    result = await db.execute(stmt)
    records = result.scalars().all()

    filtered = []
    for r in records:
        if status and r.status != status:
            continue
        if item_type and r.item_type != item_type:
            continue
        if search:
            q = search.lower()
            if q not in r.item_name.lower() and q not in r.patient_name.lower() and q not in r.code.lower():
                continue
        filtered.append(r)
    return filtered

@router.post("/borrow", response_model=DebtResponse, status_code=status.HTTP_201_CREATED)
async def borrow_emergency_item(
    payload: DebtCreate,
    db: AsyncSession = Depends(get_db)
):
    # Generate code
    stmt = select(DebtRecord)
    res = await db.execute(stmt)
    count = len(res.scalars().all())
    code = f"PN-2026-{count + 100:03d}"
    now_str = datetime.now().strftime("%I:%M %p")

    import uuid
    is_narcotic = payload.item_type == "Thuốc gây nghiện"
    record_id = f"d-{uuid.uuid4().hex[:8]}"

    debt = DebtRecord(
        id=record_id,
        code=code,
        item_name=payload.item_name,
        item_type=payload.item_type,
        quantity=payload.quantity,
        patient_name=payload.patient_name,
        patient_room=payload.patient_room,
        borrow_time=now_str,
        borrower=payload.borrower,
        clinical_reason=payload.clinical_reason,
        status="debt",
        ampoule_returned=False if is_narcotic else True,
        ampoule_destroyed=False
    )
    db.add(debt)
    await db.commit()
    await db.refresh(debt)

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="BORROW_MEDICATION",
        action_title=f"Lập phiếu mượn khẩn {payload.quantity} {payload.item_name}",
        target_item=f"{payload.item_name} ({payload.quantity}) - {payload.patient_name}",
        legal_basis="Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT",
        signer_name=payload.borrower,
        signer_certificate="004812/HN-CCHN",
        auth_method=payload.auth_method,
        payload_data={
            "ticket_code": code,
            "quantity": payload.quantity,
            "patient_room": payload.patient_room,
            "clinical_reason": payload.clinical_reason
        }
    )

    return debt

@router.put("/{debt_id}/return-ampoule", response_model=DebtResponse)
async def return_ampoule(
    debt_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DebtRecord).where(DebtRecord.id == debt_id)
    res = await db.execute(stmt)
    debt = res.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nợ")

    debt.ampoule_returned = True
    await db.commit()
    await db.refresh(debt)

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="RETURN_AMPOULE",
        action_title=f"Thu hồi vỏ ống thuốc gây nghiện {debt.item_name}",
        target_item=f"Vỏ ống {debt.code} ({debt.item_name})",
        legal_basis="Điều 15 Thông tư 20/2017/TT-BYT",
        signer_name="ĐD. Lê Thị Thu",
        signer_certificate="004812/HN-CCHN",
        auth_method="PIN",
        payload_data={"debt_id": debt.id, "code": debt.code}
    )

    return debt

@router.post("/destroy-ampoules")
async def destroy_ampoules(
    payload: AmpouleDestructionRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DebtRecord).where(
        DebtRecord.item_type == "Thuốc gây nghiện",
        DebtRecord.ampoule_returned == True,
        DebtRecord.ampoule_destroyed == False
    )
    res = await db.execute(stmt)
    ampoules = res.scalars().all()

    if not ampoules:
        return {"message": "Hiện không có vỏ ống nào cần tiêu hủy", "count": 0}

    for a in ampoules:
        a.ampoule_destroyed = True

    await db.commit()

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="DESTROY_AMPOULES",
        action_title=f"Hội đồng 3 bên tiêu hủy {len(ampoules)} vỏ ống Morphin",
        target_item=f"Biên bản tiêu hủy {len(ampoules)} vỏ ống gây nghiện",
        legal_basis="Điều 16 Thông tư 20/2017/TT-BYT",
        signer_name=payload.pharmacist_name,
        signer_certificate="001098/BYT-CCHN",
        witness_name=payload.nurse_name,
        witness_certificate="004812/HN-CCHN",
        auth_method="PIN",
        payload_data={"method": payload.method, "destroyed_count": len(ampoules)}
    )

    return {"message": f"Đã tiêu hủy thành công {len(ampoules)} vỏ ống gây nghiện", "count": len(ampoules)}

@router.put("/{debt_id}/settle", response_model=DebtResponse)
async def settle_debt(
    debt_id: str,
    payload: SettleDebtRequest,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(DebtRecord).where(DebtRecord.id == debt_id)
    res = await db.execute(stmt)
    debt = res.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nợ")

    # Hard Business Rule (TT 20/2017): Narcotics must have ampoule returned before settle
    if debt.item_type == "Thuốc gây nghiện" and not debt.ampoule_returned:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="BẮT BUỘC THU HỒI VỎ: Theo Điều 15 Thông tư 20/2017/TT-BYT, phải nộp vỏ ống thuốc gây nghiện vào khay kiểm soát trước khi được duyệt hoàn bù cơ số."
        )

    debt.status = "settled"
    debt.settled_at = datetime.now()
    debt.settler = payload.settler
    await db.commit()
    await db.refresh(debt)

    # Record Audit Trail
    await record_audit_event(
        db=db,
        action_type="SETTLE_DEBT",
        action_title=f"Duyệt hoàn bù cơ số {debt.item_name} tủ trực",
        target_item=f"{debt.code} - {debt.item_name} ({debt.quantity})",
        legal_basis="Thông tư 22/2011/TT-BYT",
        signer_name=payload.settler,
        signer_certificate="004812/HN-CCHN",
        auth_method=payload.auth_method,
        payload_data={"debt_id": debt.id, "code": debt.code, "patient": debt.patient_name}
    )

    return debt
