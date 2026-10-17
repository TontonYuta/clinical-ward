from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class ColdChainTelemetry(Base):
    __tablename__ = "cold_chain_telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(String, default="VAX-LOG-04")
    timestamp: Mapped[str] = mapped_column(String, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, nullable=False)
    power_source: Mapped[str] = mapped_column(String, default="Lưới điện 220V")
    is_alert: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

class ColdChainCurrentState(Base):
    __tablename__ = "cold_chain_current_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    current_temp: Mapped[float] = mapped_column(Float, default=4.5)
    is_outage: Mapped[bool] = mapped_column(Boolean, default=False)
    is_quarantined: Mapped[bool] = mapped_column(Boolean, default=False)
    vvm_level: Mapped[int] = mapped_column(Integer, default=1)
    mkt_temp: Mapped[float] = mapped_column(Float, default=5.6)
    outage_minutes: Mapped[int] = mapped_column(Integer, default=0)
    total_vaccine_doses: Mapped[int] = mapped_column(Integer, default=1250)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
