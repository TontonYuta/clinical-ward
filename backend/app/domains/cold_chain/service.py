from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.domains.cold_chain.repository import ColdChainRepository
from app.domains.cold_chain.schemas import ColdChainSnapshot, ColdChainTelemetryRecord
from app.models.coldchain import ColdChainCurrentState, ColdChainTelemetry
from app.services.coldchain_service import calculate_mkt
from datetime import datetime


@dataclass(frozen=True)
class ColdChainStatusResult:
    snapshot: ColdChainSnapshot | None
    telemetry: tuple[ColdChainTelemetryRecord, ...]
    status: str
    missing_fields: tuple[str, ...]


class ColdChainService:
    REQUIRED_STATUS_FIELDS = ("current_temp", "is_outage", "is_quarantined")

    def __init__(self, repository: type[ColdChainRepository] = ColdChainRepository):
        self.repository = repository

    async def get_status(self, db: AsyncSession) -> ColdChainStatusResult:
        snapshot = await self.repository.get_current_snapshot(db)
        telemetry = tuple(await self.repository.list_recent_telemetry(db, limit=6))
        if snapshot is None:
            return ColdChainStatusResult(None, telemetry, "unavailable", self.REQUIRED_STATUS_FIELDS)
        status = "alert" if snapshot.is_outage or snapshot.is_quarantined else "normal"
        return ColdChainStatusResult(snapshot, telemetry, status, ())

    async def get_recent_telemetry(self, db: AsyncSession, limit: int = 6) -> list[ColdChainTelemetryRecord]:
        return await self.repository.list_recent_telemetry(db, limit=limit)

    async def simulate_outage(self, db: AsyncSession, temperature: float, outage_minutes: int, sensor_id: str) -> None:
        result = await db.execute(select(ColdChainCurrentState).limit(1))
        state = result.scalar_one_or_none()
        if state is None:
            raise ValueError("cold_chain_state_unavailable")
        state.current_temp = temperature
        state.is_outage = True
        state.is_quarantined = True
        state.outage_minutes = outage_minutes
        db.add(ColdChainTelemetry(sensor_id=sensor_id, timestamp=datetime.now().strftime("%H:%M"), temperature=temperature, power_source="MẤT ĐIỆN LƯỚI (CẢNH BÁO)", is_alert=True))
        result = await db.execute(select(ColdChainTelemetry.temperature).limit(20))
        state.mkt_temp = calculate_mkt(list(result.scalars().all()) + [temperature])
        await db.commit()

    async def restore_power(self, db: AsyncSession, temperature: float, sensor_id: str) -> None:
        result = await db.execute(select(ColdChainCurrentState).limit(1))
        state = result.scalar_one_or_none()
        if state is None:
            raise ValueError("cold_chain_state_unavailable")
        state.current_temp = temperature
        state.is_outage = False
        db.add(ColdChainTelemetry(sensor_id=sensor_id, timestamp=datetime.now().strftime("%H:%M"), temperature=temperature, power_source="Đã khôi phục điện lưới 220V", is_alert=False))
        await db.commit()

    async def release_quarantine(self, db: AsyncSession) -> None:
        result = await db.execute(select(ColdChainCurrentState).limit(1))
        state = result.scalar_one_or_none()
        if state is None:
            raise ValueError("cold_chain_state_unavailable")
        state.is_quarantined = False
        state.outage_minutes = 0
        await db.commit()
