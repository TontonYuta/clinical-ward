from datetime import datetime
from pydantic import BaseModel, Field, model_validator

class CpoeItemSchema(BaseModel):
    id: str
    medicationName: str
    activeIngredient: str
    dosage: str
    frequency: str
    route: str
    quantity: int
    unit: str
    instructions: str
    durationDays: int | None = None

class CpoeOrderCreate(BaseModel):
    id: str | None = None
    prescriptionType: str = Field(..., description="outpatient hoặc inpatient_daily")
    patientId: str
    patientName: str
    patientCccd: str
    patientInsuranceId: str | None = None
    patientWeight: float | None = None
    patientPhone: str | None = None
    patientEmail: str | None = None
    patientAddress: str = ""
    guardianName: str = ""
    patientDob: str = ""
    patientGender: str = ""
    department: str = ""
    diagnosisIcd10: str
    diagnosisText: str
    isChronicDisease: bool = False
    daysPrescribed: int = 0
    doctorName: str
    doctorCertificate: str = ""
    prescribedAt: str | None = None
    digitalSignature: str | None = None
    status: str = "draft"
    items: list[CpoeItemSchema]

    @model_validator(mode="after")
    def validate_outpatient_duration(self):
        if self.status not in {"draft", "signed", "dispensed", "cancelled"}:
            raise ValueError("Trạng thái đơn thuốc không hợp lệ")
        if self.status == "signed" and not self.digitalSignature:
            raise ValueError("Đơn đã ký phải có dữ liệu chữ ký được xác thực từ dịch vụ ký số")
        if not self.items:
            raise ValueError("Đơn phải có ít nhất một thuốc")
        for item in self.items:
            if not item.medicationName.strip() or not item.dosage.strip() or not item.frequency.strip() or not item.route.strip() or item.quantity <= 0:
                raise ValueError("Mỗi thuốc phải có tên, liều, số lần dùng, đường dùng và số lượng hợp lệ")
        if self.prescriptionType == "outpatient" and self.daysPrescribed > 0:
            maximum = 90 if self.isChronicDisease else 30
            if not 1 <= self.daysPrescribed <= maximum:
                raise ValueError(f"Số ngày ngoại trú phải từ 1 đến {maximum} ngày theo Thông tư 26/2025/TT-BYT")
        elif self.prescriptionType == "inpatient_daily" and self.daysPrescribed not in {0, 1}:
            raise ValueError("Y lệnh nội trú hằng ngày phải có thời hạn 1 ngày")
        return self

class CpoeOrderResponse(BaseModel):
    id: str
    prescriptionType: str
    patientId: str
    patientName: str
    patientCccd: str
    patientInsuranceId: str | None = None
    patientWeight: float | None = None
    patientPhone: str | None = None
    patientEmail: str | None = None
    patientDob: str | None = None
    patientGender: str | None = None
    department: str | None = None
    diagnosisIcd10: str
    diagnosisText: str
    isChronicDisease: bool
    daysPrescribed: int
    doctorName: str
    doctorCertificate: str
    prescribedAt: str
    digitalSignature: str | None = None
    status: str
    items: list[CpoeItemSchema]
    createdAt: datetime | None = None
