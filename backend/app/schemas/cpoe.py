from datetime import datetime
from pydantic import BaseModel, Field

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
    patientDob: str = "1980-01-01"
    patientGender: str = "Nam"
    department: str
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

class CpoeOrderResponse(BaseModel):
    id: str
    prescriptionType: str
    patientId: str
    patientName: str
    patientCccd: str
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
