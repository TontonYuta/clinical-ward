"""
Pydantic Schemas for External Integrations (eSMS.vn Brandname & Google Apps Script).
"""
from typing import Optional, List
from pydantic import BaseModel, Field

class EsmsLogItem(BaseModel):
    id: str
    patient_id: Optional[str] = None
    patient_name: str
    recipient_phone: str
    message_type: str = "cpoe_prescription"
    content: str
    characters_count: int = 0
    sms_segments: int = 1
    provider: str = "esms"
    status: str = "delivered"
    delivery_receipt: Optional[str] = None
    error_detail: Optional[str] = None
    created_at: str

class EsmsStatusResponse(BaseModel):
    configured: bool
    api_key_masked: str
    secret_key_masked: str
    brandname: str
    is_sandbox: bool
    balance_vnd: Optional[float] = None
    user_id: Optional[int] = None
    status: str = "connected"  # "connected", "error", "unconfigured"
    total_sms: int = 0
    delivered_count: int = 0
    failed_count: int = 0
    last_sent_at: Optional[str] = None
    recent_logs: List[EsmsLogItem] = []

class EsmsPingResponse(BaseModel):
    success: bool
    balance_vnd: Optional[float] = None
    user_id: Optional[int] = None
    code_response: Optional[str] = None
    latency_ms: float
    message: str

class EsmsConfigPayload(BaseModel):
    api_key: Optional[str] = Field(default=None, min_length=10)
    secret_key: Optional[str] = Field(default=None, min_length=10)
    brandname: Optional[str] = Field(default=None, max_length=50)
    is_sandbox: Optional[bool] = None

class GasLogItem(BaseModel):
    id: str
    prescription_id: Optional[str] = None
    patient_name: str
    patient_email: str
    patient_phone: Optional[str] = None
    diagnosis: Optional[str] = None
    doctor_name: Optional[str] = None
    notification_status: str
    email_sent_at: Optional[str] = None
    created_at: str

class GasStatusResponse(BaseModel):
    configured: bool
    webhook_url_masked: str
    raw_webhook_url: Optional[str] = None
    status: str = "ready"  # "ready", "unconfigured"
    total_advices: int = 0
    sent_count: int = 0
    last_sent_at: Optional[str] = None
    recent_logs: List[GasLogItem] = []

class GasPingResponse(BaseModel):
    success: bool
    status_code: Optional[int] = None
    latency_ms: float
    message: str

class GasConfigPayload(BaseModel):
    webhook_url: str = Field(min_length=15, max_length=500)
