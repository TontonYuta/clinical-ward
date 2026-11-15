from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.coldchain import ColdChainCurrentState, ColdChainTelemetry
from app.domains.cold_chain.schemas import ColdChainSnapshot, ColdChainTelemetryRecord


class ColdChainRepository:
    @staticmethod
    async def get_current_snapshot(db: AsyncSession) -> ColdChainSnapshot | None:
        result = await db.execute(select(ColdChainCurrentState).limit(1))
        state = result.scalar_one_or_none()
        if state is None:
            return None
        return ColdChainSnapshot(
            current_temp=state.current_temp,
            is_outage=state.is_outage,
            is_quarantined=state.is_quarantined,
            vvm_level=state.vvm_level,
            mkt_temp=state.mkt_temp,
            outage_minutes=state.outage_minutes,
            total_vaccine_doses=state.total_vaccine_doses,
            updated_at=state.updated_at,
        )

    @staticmethod
    async def list_recent_telemetry(
        db: AsyncSession, limit: int
    ) -> list[ColdChainTelemetryRecord]:
        result = await db.execute(
            select(ColdChainTelemetry)
            .order_by(ColdChainTelemetry.id.desc())
            .limit(max(0, limit))
        )
        return [
            ColdChainTelemetryRecord(
                telemetry_id=row.id,
                sensor_id=row.sensor_id,
                timestamp=row.timestamp,
                temperature=row.temperature,
                power_source=row.power_source,
                is_alert=row.is_alert,
            )
            for row in result.scalars().all()
        ]
