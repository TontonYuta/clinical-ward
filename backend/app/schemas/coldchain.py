from pydantic import BaseModel, Field

class TelemetryLog(BaseModel):
    timestamp: str
    temperature: float

class ColdChainStateResponse(BaseModel):
    id: int
    current_temp: float
    is_outage: bool
    is_quarantined: bool
    vvm_level: int
    mkt_temp: float
    outage_minutes: int
    total_vaccine_doses: int
    quantity_basis: str = "recorded_cabinet_aggregate"
    inventory_reconciled: bool = False
    logs: list[TelemetryLog]

class ReleaseQuarantineRequest(BaseModel):
    signer_name: str = "TS.BS. Nguyễn Văn An"
    pharmacist_name: str = "DS. Nguyễn Bích Ngọc"
    vvm_level_confirmed: int = Field(default=1, ge=1, le=4, strict=True)
    mkt_confirmed: float = Field(default=5.6, allow_inf_nan=False)
