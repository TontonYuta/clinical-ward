from pydantic import BaseModel, ConfigDict

class TransferAssetRequest(BaseModel):
    new_department: str
    engineer_name: str = "KS. Đặng Văn Nam"
    receiver_name: str = "ĐD. Lê Thị Thu"

class LiquidateAssetRequest(BaseModel):
    director_name: str = "TS.BS. Nguyễn Văn An"
    reason: str = "Thiết bị hao mòn >90%, vận hành trên 8 năm, chi phí sửa chữa vượt quá giá trị máy"

class AssetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    device_name: str
    model: str
    serial_number: str
    risk_class: str
    registered_department: str
    actual_department: str
    is_misallocated: bool
    depreciation_rate_percent: int
    operating_years: int
    pending_liquidation: bool
    last_scanned_at: str
