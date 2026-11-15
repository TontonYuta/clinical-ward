from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ColdChainSnapshot:
    current_temp: float
    is_outage: bool
    is_quarantined: bool
    vvm_level: int
    mkt_temp: float | None
    outage_minutes: int
    total_vaccine_doses: int
    updated_at: datetime | None


@dataclass(frozen=True)
class ColdChainTelemetryRecord:
    telemetry_id: int
    sensor_id: str
    timestamp: str
    temperature: float
    power_source: str | None
    is_alert: bool
