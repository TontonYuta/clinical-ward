from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional

class DebtCreate(BaseModel):
    item_name: str
    item_type: str
    quantity: int
    patient_name: str
    patient_room: str
    clinical_reason: str
    borrower: str = "ĐD. Lê Thị Thu"
    pin_code: str = "1111"
    auth_method: str = "PIN"

class SettleDebtRequest(BaseModel):
    settler: str = "ĐD. Lê Thị Thu"
    pin_code: str = "1111"
    auth_method: str = "PIN"

class AmpouleDestructionRequest(BaseModel):
    method: str = "Nghiền nát hoàn toàn vỏ ống thủy tinh thành vụn bột, chôn lấp chất thải y tế"
    pharmacist_name: str = "DS. Nguyễn Bích Ngọc"
    nurse_name: str = "ĐD. Lê Thị Thu"
    doctor_name: str = "BS. Trần Văn Hùng"

class DebtResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    item_name: str
    item_type: str
    quantity: int
    patient_name: str
    patient_room: str
    borrow_time: str
    borrower: str
    clinical_reason: str
    status: str
    ampoule_returned: bool
    ampoule_destroyed: bool
    settled_at: Optional[datetime | str] = None
    settler: Optional[str] = None
