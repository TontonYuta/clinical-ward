from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.audit import AuditRecord
from app.schemas.audit import AuditRecordResponse, VerifyIntegrityResponse
from app.services.audit_service import verify_ledger_integrity

router = APIRouter(prefix="/audit", tags=["Sổ Nhật Ký Kiểm Toán Lâm Sàng (NĐ 130)"])

@router.get("/ledger", response_model=list[AuditRecordResponse])
async def get_audit_ledger(db: AsyncSession = Depends(get_db)):
    stmt = select(AuditRecord).order_by(AuditRecord.created_at.desc(), AuditRecord.id.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()
    return records

@router.get("/verify-integrity", response_model=VerifyIntegrityResponse)
async def verify_integrity(db: AsyncSession = Depends(get_db)):
    result = await verify_ledger_integrity(db)
    return result
