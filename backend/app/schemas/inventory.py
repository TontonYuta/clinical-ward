from pydantic import BaseModel, ConfigDict

class BatchDispatch(BaseModel):
    quantity: int = 10

class RestockProposalRequest(BaseModel):
    batch_ids: list[str]
    urgency_reason: str = "Chạm cơ số an toàn tối thiểu, nguy cơ đứt gãy cung ứng cấp cứu"
    pharmacist_name: str = "DS. Nguyễn Bích Ngọc (Kho Dược)"

class BatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    item_name: str
    batch_number: str
    national_code: str | None = None
    registration_number: str | None = None
    active_ingredient: str | None = None
    concentration: str | None = None
    dosage_form: str | None = None
    manufacturer: str | None = None
    country: str | None = None
    packaging_spec: str | None = None
    standard_pharmacopeia: str | None = None
    shelf_life: str | None = None
    manufacturer_address: str | None = None
    applicant_name: str | None = None
    approval_decision: str | None = None
    route: str | None = None
    category: str
    expiry_date: str
    days_left: int
    current_stock: int
    min_threshold: int
    max_threshold: int
    unit: str
    warehouse_location: str
    is_near_expiry: bool
    is_low_stock: bool
    is_quarantined: bool
