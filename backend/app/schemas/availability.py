from typing import Literal
from pydantic import BaseModel


AvailabilityMode = Literal["online_ai", "local_only", "offline", "checking"]


class AvailabilityResponse(BaseModel):
    mode: AvailabilityMode
    backend: Literal["available", "unavailable"]
    database: Literal["available", "unavailable"]
    vector_index: Literal["available", "unavailable"]
    provider: Literal["available", "unavailable", "not_configured", "unknown"]
    checked_at: str
    provider_checked_at: str | None = None
