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

class CpoeOrderCreate(BaseModel):
    id: str | None = None
    prescriptionType: str = Field(..., description="outpatient hoặc inpatient_daily")
    patientId: str
    patientName: str
    patientCccd: str
    patientPhone: str | None = None
    patientEmail: str | None = None
    patientDob: str = "1980-01-01"
    patientGender: str = "Nam"
    department: str = "Khoa Khám Bệnh"
    diagnosisIcd10: str
    diagnosisText: str
    isChronicDisease: bool = False
    daysPrescribed: int = 30
    doctorName: str
    doctorCertificate: str = "009125/BYT-CCHN"
    prescribedAt: str | None = None
    digitalSignature: str | None = None
    status: str = "signed"
    items: list[CpoeItemSchema]

    @model_validator(mode="after")
    def validate_outpatient_duration(self):
        if self.prescriptionType == "outpatient":
            maximum = 90 if self.isChronicDisease else 30
            if not 1 <= self.daysPrescribed <= maximum:
                raise ValueError(f"Số ngày ngoại trú phải từ 1 đến {maximum} ngày theo Thông tư 26/2025/TT-BYT")
        elif self.prescriptionType == "inpatient_daily" and self.daysPrescribed != 1:
            raise ValueError("Y lệnh nội trú hằng ngày phải có thời hạn 1 ngày")
        return self

class CpoeOrderResponse(BaseModel):
    id: str
    prescriptionType: str
    patientId: str
    patientName: str
    patientCccd: str
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
