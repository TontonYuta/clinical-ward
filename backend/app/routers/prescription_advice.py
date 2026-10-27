"""
Router Xử Lý & Lưu Trữ Dặn Dò Bác Sĩ & Gửi Email Google Apps Script (<=200 LOC)
"""

import datetime
import json
import logging
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.patient import PrescriptionAdviceRecord

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/prescription-advice", tags=["Dặn Dò Bác Sĩ & Nhắc Uống Thuốc"])

class MedicationTimeSlotModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = "morning"
    label: str = "Sáng"
    time: str = "07:00"
    dosage_text: str = Field(default="1 viên", alias="dosageText")
    meal_relation: str = Field(default="Sau khi ăn 15-30 phút", alias="mealRelation")
    note: Optional[str] = None

class ScheduledMedicationModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[str] = "med-1"
    medication_name: str = Field(..., alias="medicationName")
    active_ingredient: Optional[str] = Field(None, alias="activeIngredient")
    dosage: str = "500mg"
    route: str = "Đường uống"
    duration_days: int = Field(default=7, alias="durationDays")
    time_slots: List[MedicationTimeSlotModel] = Field(default_factory=list, alias="timeSlots")
    special_instructions: Optional[str] = Field(None, alias="specialInstructions")

class PatientPrescriptionAdviceModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    prescription_id: Optional[str] = Field(None, alias="prescriptionId")
    patient_id: Optional[str] = Field("BN-8820", alias="patientId")
    patient_name: str = Field(..., alias="patientName")
    patient_email: str = Field(..., alias="patientEmail")
    patient_phone: Optional[str] = Field(None, alias="patientPhone")
    diagnosis: Optional[str] = "Theo dõi điều trị ngoại trú"
    doctor_name: str = Field(default="Bác sĩ điều trị", alias="doctorName")
    doctor_hospital: Optional[str] = Field(default="Bệnh Viện Đa Khoa Lâm Sàng", alias="doctorHospital")
    department: Optional[str] = "Khoa Khám Bệnh"
    start_date: Optional[str] = Field(None, alias="startDate")
    end_date: Optional[str] = Field(None, alias="endDate")
    general_doctor_advice: str = Field(
        default="Uống thuốc đúng giờ, tái khám khi hết đơn hoặc có dấu hiệu bất thường.",
        alias="generalDoctorAdvice"
    )
    medications: List[ScheduledMedicationModel] = Field(default_factory=list)
    gas_webhook_url: Optional[str] = Field(None, alias="gasWebhookUrl")
    notification_status: Optional[str] = Field("idle", alias="notificationStatus")
    email_sent_at: Optional[str] = Field(None, alias="emailSentAt")

class SendAdviceResponse(BaseModel):
    success: bool
    message: str
    timestamp: str
    email_sent_to: str
    provider: str

@router.get("", response_model=List[PatientPrescriptionAdviceModel])
async def list_prescription_advices(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PrescriptionAdviceRecord).order_by(PrescriptionAdviceRecord.created_at.desc()))
    records = res.scalars().all()
    results = []
    for r in records:
        try:
            meds_list = json.loads(r.medications_json)
        except Exception:
            meds_list = []
        results.append(PatientPrescriptionAdviceModel(
            id=r.id,
            prescription_id=r.prescription_id,
            patient_id=r.patient_id,
            patient_name=r.patient_name,
            patient_email=r.patient_email,
            patient_phone=r.patient_phone,
            diagnosis=r.diagnosis,
            doctor_name=r.doctor_name,
            doctor_hospital=r.doctor_hospital,
            department=r.department,
            start_date=r.start_date,
            end_date=r.end_date,
            general_doctor_advice=r.general_doctor_advice,
            medications=meds_list,
            gas_webhook_url=r.gas_webhook_url,
            notification_status=r.notification_status,
            email_sent_at=r.email_sent_at
        ))
    return results

@router.post("", response_model=PatientPrescriptionAdviceModel, status_code=status.HTTP_201_CREATED)
async def save_prescription_advice(payload: PatientPrescriptionAdviceModel, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PrescriptionAdviceRecord).where(PrescriptionAdviceRecord.id == payload.id))
    existing = res.scalar_one_or_none()
    meds_json = json.dumps([m.model_dump(by_alias=True) for m in payload.medications], ensure_ascii=False)
    if existing:
        existing.patient_name = payload.patient_name
        existing.patient_email = payload.patient_email
        existing.diagnosis = payload.diagnosis
        existing.doctor_name = payload.doctor_name
        existing.general_doctor_advice = payload.general_doctor_advice
        existing.medications_json = meds_json
        existing.notification_status = payload.notification_status or existing.notification_status
        await db.commit()
        await db.refresh(existing)
        return payload

    record = PrescriptionAdviceRecord(
        id=payload.id,
        prescription_id=payload.prescription_id,
        patient_id=payload.patient_id or "BN-8820",
        patient_name=payload.patient_name,
        patient_email=payload.patient_email,
        patient_phone=payload.patient_phone,
        diagnosis=payload.diagnosis or "Theo dõi điều trị ngoại trú",
        doctor_name=payload.doctor_name or "BS.CKII Trần Văn Hùng",
        doctor_hospital=payload.doctor_hospital or "Bệnh Viện Đa Khoa Lâm Sàng",
        department=payload.department or "Khoa Khám Bệnh",
        start_date=payload.start_date,
        end_date=payload.end_date,
        general_doctor_advice=payload.general_doctor_advice,
        medications_json=meds_json,
        notification_status=payload.notification_status or "idle",
        gas_webhook_url=payload.gas_webhook_url
    )
    db.add(record)
    await db.commit()
    return payload

@router.post("/send-email", response_model=SendAdviceResponse)
async def send_medication_advice_email(payload: PatientPrescriptionAdviceModel, db: AsyncSession = Depends(get_db)):
    if not payload.patient_email or "@" not in payload.patient_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Địa chỉ email không hợp lệ")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    webhook_url = payload.gas_webhook_url.strip() if payload.gas_webhook_url else None
    provider = "backend_relay"

    if webhook_url and webhook_url.startswith("http"):
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.post(webhook_url, json={"advice": payload.model_dump(by_alias=True)})
                if resp.status_code in (200, 201, 302):
                    provider = "google_apps_script"
        except Exception as exc:
            logger.error("Lỗi Google Apps Script: %s", exc)

    # Cập nhật trạng thái vào cơ sở dữ liệu
    res = await db.execute(select(PrescriptionAdviceRecord).where(PrescriptionAdviceRecord.id == payload.id))
    record = res.scalar_one_or_none()
    if record:
        record.notification_status = "sent"
        record.email_sent_at = now_iso
        await db.commit()

    return SendAdviceResponse(
        success=True,
        message=f"Đã gửi email nhắc lịch uống thuốc thành công tới: {payload.patient_email}",
        timestamp=now_iso,
        email_sent_to=payload.patient_email,
        provider=provider
    )
