from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field

class SmsProviderType(str, Enum):
    SANDBOX = "sandbox"
    ESMS = "esms"
    SPEEDSMS = "speedsms"
    TWILIO = "twilio"

class SmsMessageType(str, Enum):
    CPOE_PRESCRIPTION = "cpoe_prescription"
    MEDICATION_ADVICE = "medication_advice"
    HOSPITAL_NOTICE = "hospital_notice"

class SendSmsRequest(BaseModel):
    recipient_phone: str = Field(..., alias="recipientPhone", description="Số điện thoại nhận tin (VD: 0915223344)")
    patient_id: str = Field(..., alias="patientId", description="Mã hồ sơ bệnh nhân (BN-8817)")
    patient_name: str = Field(..., alias="patientName", description="Họ và tên bệnh nhân")
    message_type: SmsMessageType = Field(default=SmsMessageType.CPOE_PRESCRIPTION, alias="messageType")
    content: str = Field(..., max_length=480, description="Nội dung tin nhắn")
    reference_id: Optional[str] = Field(None, alias="referenceId", description="Mã đơn thuốc hoặc hồ sơ liên quan")
    provider: SmsProviderType = Field(default=SmsProviderType.SANDBOX, description="Nhà cung cấp SMS (sandbox, esms, speedsms, twilio)")

    model_config = {
        "populate_by_name": True
    }

class SmsDeliveryLogResponse(BaseModel):
    id: str
    recipient_phone: str = Field(..., alias="recipientPhone")
    patient_id: str = Field(..., alias="patientId")
    patient_name: str = Field(..., alias="patientName")
    message_type: str = Field(..., alias="messageType")
    content: str
    characters_count: int = Field(..., alias="charactersCount")
    sms_segments: int = Field(..., alias="smsSegments")
    provider: str
    status: str
    reference_id: Optional[str] = Field(None, alias="referenceId")
    delivery_receipt: Optional[str] = Field(None, alias="deliveryReceipt")
    error_detail: Optional[str] = Field(None, alias="errorDetail")
    created_at: Optional[datetime] = Field(None, alias="createdAt")

    model_config = {
        "populate_by_name": True,
        "from_attributes": True
    }

class SmsTemplateItem(BaseModel):
    id: str
    title: str
    category: str
    template: str
    description: str
