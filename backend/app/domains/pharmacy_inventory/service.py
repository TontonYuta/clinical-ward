from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.pharmacy_inventory.repository import PharmacyInventoryRepository
from app.domains.pharmacy_inventory.schemas import InventoryStockResult, InventoryBatchRecord


class PharmacyInventoryService:
    def __init__(self, repository: type[PharmacyInventoryRepository] = PharmacyInventoryRepository):
        self.repository = repository

    async def get_stock(self, db: AsyncSession, *, item_id: str | None = None, query: str | None = None) -> InventoryStockResult:
        records = tuple(await self.repository.find_batches(db, item_id=item_id, query=query))
        return InventoryStockResult(records, "available" if records else "unavailable")

    async def get_fefo_candidates(self, db: AsyncSession) -> list[InventoryBatchRecord]:
        return await self.repository.list_fefo(db)
