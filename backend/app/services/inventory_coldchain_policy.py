"""Explicit refrigerated-stock links; a cabinet ID is never guessed from a name."""
from dataclasses import dataclass
import json
import math
import os
import unicodedata

from sqlalchemy import exists, false, select, true
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models.coldchain import ColdChainCurrentState
from app.models.inventory import InventoryBatch


def requires_cold_storage(batch: InventoryBatch) -> bool:
    # This registration is the existing Vaxigrip fixture. Its backend category
    # is generic, so the verified exact identifier preserves its storage rule.
    registrations = {str(batch.registration_number or "").strip(), str(batch.national_code or "").strip()}
    category = unicodedata.normalize("NFKC", batch.category).casefold()
    location = unicodedata.normalize("NFKC", batch.warehouse_location).casefold()
    return (
        "300310033526" in registrations
        or any(label in category for label in ("vắc xin", "vaccine", "chuỗi lạnh", "cold chain"))
        or any(label in location for label in ("kho lạnh", "tủ lạnh", "cold storage"))
    )


def _configured_links() -> dict[str, int]:
    links = json.loads(os.getenv("COLDCHAIN_INVENTORY_LINKS_JSON", "{}"))
    if not isinstance(links, dict) or any(
        not isinstance(key, str) or not key.strip() or key != key.strip()
        or type(value) is not int or value <= 0
        for key, value in links.items()
    ):
        raise ValueError("Cold storage links must map exact batch IDs to positive integer state IDs")
    return links


@dataclass(frozen=True)
class ColdStorageAssessment:
    required: bool
    state_id: int | None
    link_verified: bool
    unknown_reason: str | None
    hold_reason: str | None
    dispatch_guard: ColumnElement[bool]


async def assess_cold_storage(db: AsyncSession, batch: InventoryBatch) -> ColdStorageAssessment:
    if not requires_cold_storage(batch):
        return ColdStorageAssessment(False, None, False, None, None, true())
    try:
        state_id = _configured_links().get(batch.id)
    except (ValueError, TypeError):
        reason = "Cấu hình liên kết lô/tủ lạnh không hợp lệ; chưa xác nhận an toàn"
        return ColdStorageAssessment(True, None, False, reason, reason, false())
    if state_id is None:
        reason = "Chưa xác nhận liên kết chính xác giữa lô hàng và tủ lạnh được giám sát"
        return ColdStorageAssessment(True, None, False, reason, reason, false())
    state = await db.get(ColdChainCurrentState, state_id, populate_existing=True)
    if state is None:
        reason = "Chưa có trạng thái tủ lạnh đã liên kết; chưa xác nhận an toàn"
        return ColdStorageAssessment(True, state_id, False, reason, reason, false())
    guard = exists(select(ColdChainCurrentState.id).where(
        ColdChainCurrentState.id == state_id,
        ColdChainCurrentState.is_outage.is_(False),
        ColdChainCurrentState.is_quarantined.is_(False),
        ColdChainCurrentState.current_temp >= 2,
        ColdChainCurrentState.current_temp <= 8,
        ColdChainCurrentState.vvm_level == 1,
        ColdChainCurrentState.mkt_temp >= 2,
        ColdChainCurrentState.mkt_temp < 8,
    ))
    safe = (
        not state.is_outage and not state.is_quarantined
        and math.isfinite(state.current_temp) and 2 <= state.current_temp <= 8
        and state.vvm_level == 1
        and math.isfinite(state.mkt_temp) and 2 <= state.mkt_temp < 8
    )
    reason = None if safe else "Tủ lạnh đã liên kết đang biệt trữ, mất điện hoặc chưa đạt điều kiện an toàn"
    return ColdStorageAssessment(True, state_id, True, None, reason, guard)
