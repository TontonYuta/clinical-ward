"""Exact product inventory with usable batches and separate physical units."""
from dataclasses import dataclass
from datetime import date
import re
import unicodedata

from sqlalchemy import select
from app.models.inventory import InventoryBatch
from app.services.inventory_coldchain_policy import assess_cold_storage
from app.services.registry_service import normalize_code


def _presentation(value: str | None) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value or "").casefold())


@dataclass
class ProductStock:
    code: str
    batches: list[InventoryBatch]
    held_count: int = 0

    @property
    def text(self) -> str:
        if not self.code:
            return "Chưa xác minh mã đăng ký của chế phẩm; không suy ra tồn kho từ tên hoặc hoạt chất."
        quantities: dict[str, int] = {}
        for batch in self.batches:
            quantities[batch.unit] = quantities.get(batch.unit, 0) + batch.current_stock
        text = "; ".join(f"{quantity} {unit}" for unit, quantity in sorted(quantities.items()))
        text = ("Tồn kho khả dụng đã đối soát: " + text if text else "Chưa có tồn kho khả dụng được xác nhận") + f"; SĐK: {self.code}."
        if self.held_count:
            text += f" Có {self.held_count} lô đang bị giữ hoặc chưa xác minh điều kiện khả dụng."
        return text


async def lookup_product_stock(drug, db) -> ProductStock:
    code = normalize_code(drug.national_code)
    if not code or code in {"dđvn v", "dược thư"} or str(drug.id).startswith("MONO-"):
        return ProductStock("", [])
    rows = (await db.execute(select(InventoryBatch))).scalars().all()
    usable, held = [], 0
    for batch in rows:
        # Prefer the actual registration field if present; a contradictory
        # secondary code must never override it.
        identity = normalize_code(batch.registration_number or batch.national_code)
        if identity != code:
            continue
        incompatible = any(_presentation(left) and _presentation(right) and _presentation(left) != _presentation(right)
                           for left, right in ((drug.concentration, batch.concentration), (drug.dosage_form, batch.dosage_form)))
        try:
            expired = date.fromisoformat(batch.expiry_date) < date.today()
        except (ValueError, TypeError):
            expired = True
        if incompatible or expired or batch.is_quarantined or batch.current_stock <= 0 or not (batch.unit or "").strip():
            held += 1
            continue
        storage = await assess_cold_storage(db, batch)
        if storage.hold_reason:
            held += 1
            continue
        usable.append(batch)
    return ProductStock(code, usable, held)
