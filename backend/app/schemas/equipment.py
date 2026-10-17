from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional

class IncidentCreate(BaseModel):
    device_name: str
    device_model: str
    serial_number: str
    risk_class: str
    location: str
    accessory_issue: str
    urgency: str = "urgent"
    assigned_engineer: str = "KS. Đặng Văn Nam (Kỹ sư TBYT trực)"

class HandoverRequest(BaseModel):
    test_result: str = "Đạt tiêu chuẩn an toàn điện lực (dòng rò 42µA < 100µA) và áp lực khí chuẩn"
    assigned_engineer: str = "KS. Đặng Văn Nam"
    clinical_receiver: str = "Bác sĩ Khoa Lâm Sàng tiếp nhận"
    pin_code: str = "3333"
    auth_method: str = "PIN"

class EquipmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    device_name: str
    device_model: str
    serial_number: str
    risk_class: str
    location: str
    accessory_issue: str
    urgency: str
    status: str
    assigned_engineer: str
    next_inspection_due: str
    inspection_unit: str
    legal_basis: str
    action_log: list[str]
    resolved_at: Optional[datetime | str] = None
    handover_engineer: Optional[str] = None
    handover_receiver: Optional[str] = None
