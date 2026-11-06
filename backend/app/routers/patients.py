"""
Router Quản lý Hồ Sơ Bệnh Nhân (Patient Profiles & Clinical EHR) (<=200 LOC)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.patient import PatientProfile, PrescriptionAdviceRecord

router = APIRouter(prefix="/patients", tags=["Hồ Sơ Bệnh Nhân & Tiền Sử Dùng Thuốc"])

class PatientProfileModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
    id: str
    full_name: str = Field(..., alias="fullName")
    dob: Optional[str] = None
    age: Optional[int] = None
    gender: str = "Nam"
    cccd: Optional[str] = None
    phone: Optional[str] = None
    email: str
    room: str = "Khoa Khám Bệnh"
    allergies: str = "Không ghi nhận dị ứng"
    chronic_conditions: str = Field(default="", alias="chronicConditions")
    egfr: float = 90.0
    creatinine: float = 80.0
    weight_kg: float = Field(default=65.0, alias="weightKg")

class PatientDetailResponse(PatientProfileModel):
    advices: List[dict] = []

@router.get("", response_model=List[PatientProfileModel])
async def list_patients(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PatientProfile).order_by(PatientProfile.id))
    return res.scalars().all()

@router.get("/{patient_id}", response_model=PatientDetailResponse)
async def get_patient_detail(patient_id: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PatientProfile).where(PatientProfile.id == patient_id))
    patient = res.scalar_one_or_none()
    if not patient:
        # Tìm thử theo tên không phân biệt hoa thường
        res_name = await db.execute(select(PatientProfile).where(
            func.lower(PatientProfile.full_name) == patient_id.strip().lower()
        ).limit(2))
        matches = res_name.scalars().all()
        if len(matches) > 1:
            raise HTTPException(status_code=409, detail="Tên trùng nhiều hồ sơ; chọn đúng mã bệnh nhân")
        patient = matches[0] if matches else None
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Không tìm thấy bệnh nhân mã {patient_id}")

    # Lấy lịch sử dặn dò của bệnh nhân
    adv_res = await db.execute(select(PrescriptionAdviceRecord).where(PrescriptionAdviceRecord.patient_id == patient.id))
    advices = [
        {
            "id": a.id,
            "diagnosis": a.diagnosis,
            "doctorName": a.doctor_name,
            "createdAt": a.created_at.isoformat() if a.created_at else None,
            "notificationStatus": a.notification_status
        }
        for a in adv_res.scalars().all()
    ]
    detail = PatientDetailResponse.model_validate(patient)
    detail.advices = advices
    return detail

@router.post("", response_model=PatientProfileModel, status_code=status.HTTP_201_CREATED)
async def create_or_update_patient(payload: PatientProfileModel, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PatientProfile).where(PatientProfile.id == payload.id))
    existing = res.scalar_one_or_none()
    if existing:
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(existing, k, v)
        await db.commit()
        await db.refresh(existing)
        return existing

    new_patient = PatientProfile(**payload.model_dump())
    db.add(new_patient)
    await db.commit()
    await db.refresh(new_patient)
    return new_patient
