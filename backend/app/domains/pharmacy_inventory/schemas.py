from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class InventoryBatchRecord:
    batch_id: str
    item_name: str
    batch_number: str
    national_code: str | None
    registration_number: str | None
    active_ingredient: str | None
    category: str | None
    current_stock: int | None
    days_left: int | None
    min_threshold: int | None
    max_threshold: int | None
    is_low_stock: bool
    is_near_expiry: bool
    unit: str | None
    expiry_date: str | None
    warehouse_location: str | None
    is_quarantined: bool
    updated_at: datetime | None


@dataclass(frozen=True)
class InventoryStockResult:
    records: tuple[InventoryBatchRecord, ...]
    status: str
