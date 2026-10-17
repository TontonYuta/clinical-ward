from pydantic import BaseModel, ConfigDict

class TelemetryLog(BaseModel):
    timestamp: str
    temperature: float

class ColdChainStateResponse(BaseModel):
    current_temp: float
    is_outage: bool
    is_quarantined: bool
    vvm_level: int
    mkt_temp: float
    outage_minutes: int
    total_vaccine_doses: int
    logs: list[TelemetryLog]

class ReleaseQuarantineRequest(BaseModel):
    signer_name: str = "TS.BS. Nguyễn Văn An"
    pharmacist_name: str = "DS. Nguyễn Bích Ngọc"
    vvm_level_confirmed: int = 1
    mkt_confirmed: float = 5.6
