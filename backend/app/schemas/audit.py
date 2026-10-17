from pydantic import BaseModel, ConfigDict
from typing import Optional

class AuditRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    timestamp: str
    action_type: str
    action_title: str
    target_item: str
    legal_basis: str
    signer_name: str
    signer_certificate: str
    witness_name: Optional[str] = None
    witness_certificate: Optional[str] = None
    auth_method: str
    integrity_hash: str
    previous_hash: str

class VerifyIntegrityResponse(BaseModel):
    is_valid: bool
    total_records: int
    broken_at_id: Optional[str] = None
    message: str
