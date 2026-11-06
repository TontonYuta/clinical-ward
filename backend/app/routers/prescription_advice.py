import datetime
import json
import logging
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.patient import PrescriptionAdviceRecord
from app.services.advice_delivery import deliver_once
from app.services.advice_notifier import dispatch_email_notification, dispatch_sms_notification, normalize_advice_phone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/prescription-advice", tags=["Dặn Dò Bác Sĩ & Nhắc Uống Thuốc"])

class MedicationTimeSlotModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = "morning"
    label: str = "Sáng"
    time: str = ""
    dosage_text: str = Field(default="", alias="dosageText")
    meal_relation: str = Field(default="", alias="mealRelation")
    note: Optional[str] = None

class ScheduledMedicationModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[str] = "med-1"
    medication_name: str = Field(..., alias="medicationName")
    active_ingredient: Optional[str] = Field(None, alias="activeIngredient")
    dosage: str = ""
    route: str = ""
    duration_days: int = Field(default=0, ge=0, alias="durationDays")
    frequency: Optional[str] = None
    time_slots: List[MedicationTimeSlotModel] = Field(default_factory=list, alias="timeSlots")
    special_instructions: Optional[str] = Field(None, alias="specialInstructions")

class PatientPrescriptionAdviceModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str
    prescription_id: Optional[str] = Field(None, alias="prescriptionId")
    patient_id: str = Field(..., alias="patientId", min_length=1)
    patient_name: str = Field(..., alias="patientName")
    patient_email: str = Field(..., alias="patientEmail")
    patient_phone: Optional[str] = Field(None, alias="patientPhone")
    diagnosis: Optional[str] = ""
    doctor_name: str = Field(default="", alias="doctorName")
    doctor_hospital: Optional[str] = Field(default="", alias="doctorHospital")
    department: Optional[str] = ""
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
    send_email: bool = Field(True, alias="sendEmail")
    send_sms: bool = Field(False, alias="sendSms")

class SendAdviceResponse(BaseModel):
    success: bool
    message: str
    timestamp: str
    email_sent_to: str
    provider: str

@router.get("", response_model=List[PatientPrescriptionAdviceModel])
@router.get("/", response_model=List[PatientPrescriptionAdviceModel])
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
            id=r.id, prescription_id=r.prescription_id, patient_id=r.patient_id,
            patient_name=r.patient_name, patient_email=r.patient_email, patient_phone=r.patient_phone,
            diagnosis=r.diagnosis, doctor_name=r.doctor_name, doctor_hospital=r.doctor_hospital,
            department=r.department, start_date=r.start_date, end_date=r.end_date,
            general_doctor_advice=r.general_doctor_advice, medications=meds_list,
            gas_webhook_url=r.gas_webhook_url, notification_status=r.notification_status,
            email_sent_at=r.email_sent_at
        ))
    return results

@router.post("", response_model=PatientPrescriptionAdviceModel, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PatientPrescriptionAdviceModel, status_code=status.HTTP_201_CREATED)
async def save_prescription_advice(payload: PatientPrescriptionAdviceModel, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PrescriptionAdviceRecord).where(PrescriptionAdviceRecord.id == payload.id))
    existing = res.scalar_one_or_none()
    meds_json = json.dumps([m.model_dump(by_alias=True) for m in payload.medications], ensure_ascii=False)
    if existing:
        if existing.patient_id != payload.patient_id:
            raise HTTPException(status_code=409, detail="Mã dặn dò đã thuộc hồ sơ khác; tạo mã dặn dò mới")
        existing.prescription_id = payload.prescription_id
        existing.doctor_hospital = payload.doctor_hospital or ""
        existing.department = payload.department or ""
        existing.start_date = payload.start_date
        existing.end_date = payload.end_date
        existing.patient_name = payload.patient_name
        existing.patient_email = payload.patient_email
        existing.patient_phone = payload.patient_phone
        existing.diagnosis = payload.diagnosis or ""
        existing.doctor_name = payload.doctor_name
        existing.general_doctor_advice = payload.general_doctor_advice
        existing.medications_json = meds_json
        existing.gas_webhook_url = payload.gas_webhook_url
        # Notification outcomes are server-owned; saving a draft cannot reset or assert delivery.
        await db.commit()
        await db.refresh(existing)
        return payload

    record = PrescriptionAdviceRecord(
        id=payload.id, prescription_id=payload.prescription_id,
        patient_id=payload.patient_id, patient_name=payload.patient_name,
        patient_email=payload.patient_email, patient_phone=payload.patient_phone,
        diagnosis=payload.diagnosis or "",
        doctor_name=payload.doctor_name or "",
        doctor_hospital=payload.doctor_hospital or "",
        department=payload.department or "", start_date=payload.start_date,
        end_date=payload.end_date, general_doctor_advice=payload.general_doctor_advice,
        medications_json=meds_json, notification_status="idle",
        gas_webhook_url=payload.gas_webhook_url
    )
    db.add(record)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Hồ sơ dặn dò vừa được tạo ở yêu cầu khác; tải lại trước khi gửi")
    return payload

@router.post("/send-email", response_model=SendAdviceResponse)
async def send_medication_advice_email(payload: PatientPrescriptionAdviceModel, db: AsyncSession = Depends(get_db)):
    if payload.send_email and (not payload.patient_email or "@" not in payload.patient_email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Địa chỉ email không hợp lệ")
    if payload.send_sms:
        normalize_advice_phone(payload.patient_phone)

    # Validate ownership before any external side effect, even for direct API calls.
    stored = await db.get(PrescriptionAdviceRecord, payload.id)
    if stored is not None and stored.patient_id != payload.patient_id:
        raise HTTPException(status_code=409, detail="Mã dặn dò thuộc hồ sơ bệnh nhân khác; chưa gửi thông báo")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    channels: list[str] = []

    if not payload.send_email and not payload.send_sms:
        raise HTTPException(status_code=400, detail="Chọn ít nhất một kênh gửi email hoặc SMS")
    if stored is None:
        await save_prescription_advice(payload, db)
    record = await db.get(PrescriptionAdviceRecord, payload.id)

    if payload.send_email:
        async def email(providers):
            await dispatch_email_notification(payload, providers, httpx_cls=httpx.AsyncClient)
        provider, dispatched = await deliver_once(payload, "email", db, email)
        channels.append(provider)
        record.notification_status = "partial" if payload.send_sms else "sent"
        if dispatched:
            record.email_sent_at = now_iso
        await db.commit()
    if payload.send_sms:
        async def sms(providers):
            await dispatch_sms_notification(payload, db, providers)
        provider, _ = await deliver_once(payload, "sms", db, sms)
        channels.append(provider)
        record.notification_status = "sent"
        await db.commit()

    targets = [payload.patient_email if payload.send_email else None, payload.patient_phone if payload.send_sms else None]
    return SendAdviceResponse(
        success=True,
        message=f"Dịch vụ gửi đã tiếp nhận thành công yêu cầu dặn dò cho {' / '.join(x for x in targets if x)}. Chưa xác nhận thông báo đã đến người nhận.",
        timestamp=now_iso, email_sent_to=payload.patient_email if payload.send_email else "", provider="+".join(channels)
    )
