from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class StaffBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=160, description="Họ và tên nhân viên")
    role: str = Field(..., description="Mã vai trò: doctor | nurse | pharmacist | biomedical_engineer | director")
    role_name: str = Field(..., min_length=2, max_length=128, description="Chức danh hiển thị")
    department: str = Field(..., min_length=2, max_length=160, description="Khoa phòng công tác")
    practice_certificate: str = Field(..., min_length=2, max_length=128, description="Số chứng chỉ hành nghề CCHN")
    pin_code: str = Field(..., min_length=4, max_length=10, description="Mã PIN 4-6 số")
    rfid_card_id: str = Field(..., min_length=4, max_length=64, description="Mã thẻ RFID/NFC")
    responsibilities: str = Field(default="", description="Phân công trách nhiệm")
    email: Optional[str] = Field(None, max_length=160, description="Email liên hệ")
    phone: Optional[str] = Field(None, max_length=32, description="Số điện thoại")
    dob: Optional[str] = Field(None, max_length=32, description="Ngày sinh")
    academic_title: Optional[str] = Field(None, max_length=64, description="Học hàm / Học vị (BSCKI, BSCKII, ThS, TS, PGS, GS, CN...)")
    username: Optional[str] = Field(None, max_length=100, description="Tên đăng nhập hệ thống (viết liền, không dấu)")
    is_active: bool = Field(default=True, description="Trạng thái công tác: True = Hoạt động, False = Tạm ngưng")
    avatar_url: Optional[str] = Field(None, description="Đường dẫn avatar")

class StaffCreateRequest(StaffBase):
    id: Optional[str] = Field(None, max_length=64, description="Mã nhân viên (tùy chọn, tự sinh nếu để trống)")
    password: Optional[str] = Field(None, min_length=6, max_length=128, description="Mật khẩu khởi tạo ban đầu")
    must_change_password: bool = Field(default=False, description="Yêu cầu đổi mật khẩu ở lần đăng nhập đầu")

class StaffUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=160)
    role: Optional[str] = None
    role_name: Optional[str] = Field(None, min_length=2, max_length=128)
    department: Optional[str] = Field(None, min_length=2, max_length=160)
    practice_certificate: Optional[str] = Field(None, min_length=2, max_length=128)
    pin_code: Optional[str] = Field(None, min_length=4, max_length=10)
    rfid_card_id: Optional[str] = Field(None, min_length=4, max_length=64)
    responsibilities: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    academic_title: Optional[str] = None
    username: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    must_change_password: Optional[bool] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None

class StaffStatusUpdateRequest(BaseModel):
    is_active: bool = Field(..., description="Trạng thái công tác")

class StaffResetPinRequest(BaseModel):
    new_pin: str = Field(..., min_length=4, max_length=10, description="Mã PIN mới 4-6 số")

class StaffResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=128, description="Mật khẩu mới do Admin cấp lại")
    must_change_password: bool = Field(default=True, description="Yêu cầu đổi mật khẩu ở lần đăng nhập tiếp theo")

class StaffResponse(StaffBase):
    id: str
    must_change_password: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StaffListResponse(BaseModel):
    total: int
    active_count: int
    suspended_count: int
    items: List[StaffResponse]
