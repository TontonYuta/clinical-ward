from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryBatch
from app.domains.pharmacy_inventory.schemas import InventoryBatchRecord


def _record(row: InventoryBatch) -> InventoryBatchRecord:
    return InventoryBatchRecord(
        batch_id=row.id, item_name=row.item_name, batch_number=row.batch_number,
        national_code=row.national_code, registration_number=row.registration_number,
        active_ingredient=row.active_ingredient,
        category=row.category,
        current_stock=row.current_stock, days_left=row.days_left, min_threshold=row.min_threshold,
        max_threshold=row.max_threshold, is_low_stock=row.is_low_stock, is_near_expiry=row.is_near_expiry,
        unit=row.unit, expiry_date=row.expiry_date,
        warehouse_location=row.warehouse_location, is_quarantined=row.is_quarantined,
        updated_at=row.updated_at,
    )


class PharmacyInventoryRepository:
    @staticmethod
    async def find_batches(db: AsyncSession, *, item_id: str | None = None, query: str | None = None) -> list[InventoryBatchRecord]:
        stmt = select(InventoryBatch)
        if item_id:
            stmt = stmt.where(InventoryBatch.id == item_id)
        if query:
            pattern = f"%{query.strip()}%"
            stmt = stmt.where(or_(InventoryBatch.item_name.ilike(pattern), InventoryBatch.active_ingredient.ilike(pattern), InventoryBatch.national_code.ilike(pattern)))
        result = await db.execute(stmt.order_by(InventoryBatch.expiry_date.asc(), InventoryBatch.id.asc()))
        return [_record(row) for row in result.scalars().all()]

    @staticmethod
    async def list_fefo(db: AsyncSession) -> list[InventoryBatchRecord]:
        result = await db.execute(select(InventoryBatch).order_by(InventoryBatch.expiry_date.asc(), InventoryBatch.id.asc()))
        return [_record(row) for row in result.scalars().all()]
