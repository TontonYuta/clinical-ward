"""
Router Xử Lý & Lưu Trữ Dặn Dò Bác Sĩ & Gửi Email Google Apps Script (<=200 LOC)
"""

import datetime
import json
import logging
import os
import base64
import re
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
    send_email: bool = Field(True, alias="sendEmail")
    send_sms: bool = Field(False, alias="sendSms")

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
        existing.patient_phone = payload.patient_phone
        existing.diagnosis = payload.diagnosis
        existing.doctor_name = payload.doctor_name
        existing.general_doctor_advice = payload.general_doctor_advice
        existing.medications_json = meds_json
        existing.gas_webhook_url = payload.gas_webhook_url
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
    if payload.send_email and (not payload.patient_email or "@" not in payload.patient_email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Địa chỉ email không hợp lệ")
    if payload.send_sms and not payload.patient_phone:
        raise HTTPException(status_code=400, detail="Cần số điện thoại hợp lệ để gửi SMS")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    webhook_url = payload.gas_webhook_url.strip() if payload.gas_webhook_url else None
    channels: list[str] = []

    if payload.send_email and webhook_url and webhook_url.startswith("http"):
        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.post(webhook_url, json={"advice": payload.model_dump(by_alias=True)})
                if resp.status_code not in (200, 201, 302):
                    raise HTTPException(status_code=502, detail="Nhà cung cấp email từ chối gửi dặn dò")
                channels.append("google_apps_script")
        except Exception as exc:
            logger.error("Lỗi Google Apps Script: %s", exc)
            if isinstance(exc, HTTPException): raise exc
            raise HTTPException(status_code=502, detail="Không gửi được email; kiểm tra cấu hình Google Apps Script")
    elif payload.send_email:
        raise HTTPException(status_code=503, detail="Chưa cấu hình Google Apps Script để gửi email")

    if payload.send_sms:
        sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        sender = os.getenv("TWILIO_FROM_NUMBER", "").strip()
        messaging_service_sid = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "").strip()
        if not (sid and token and (sender or messaging_service_sid)):
            raise HTTPException(status_code=503, detail="Chưa cấu hình nhà cung cấp SMS (Twilio)")
        digits = re.sub(r"\D", "", payload.patient_phone or "")
        if digits.startswith("0"): digits = "84" + digits[1:]
        to_number = f"+{digits}"
        if not re.fullmatch(r"\+84\d{9,10}", to_number):
            raise HTTPException(status_code=400, detail="Số điện thoại Việt Nam không hợp lệ; nhập số di động 10–11 chữ số")
        text = f"{payload.patient_name}: Lịch dặn dò thuốc {('đã được gửi qua email' if payload.send_email else 'được cập nhật')}. Vui lòng xem lịch đã nhận hoặc liên hệ cơ sở y tế nếu cần hỗ trợ."
        auth = base64.b64encode(f"{sid}:{token}".encode()).decode()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                sms_resp = await client.post(
                    f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                data={"To": to_number, **({"MessagingServiceSid": messaging_service_sid} if messaging_service_sid else {"From": sender}), "Body": text},
                    headers={"Authorization": f"Basic {auth}"}
                )
        except httpx.HTTPError as exc:
            logger.error("Twilio request failed: %s", exc)
            raise HTTPException(status_code=502, detail="Không kết nối được nhà cung cấp SMS")
        if sms_resp.status_code not in (200, 201):
            logger.error("Twilio SMS error %s: %s", sms_resp.status_code, sms_resp.text[:500])
            raise HTTPException(status_code=502, detail="Email đã gửi nhưng SMS thất bại; kiểm tra số điện thoại và cấu hình Twilio")
        channels.append("SMS")

    if not channels:
        raise HTTPException(status_code=400, detail="Chọn ít nhất một kênh gửi email hoặc SMS")

    # Cập nhật trạng thái vào cơ sở dữ liệu
    res = await db.execute(select(PrescriptionAdviceRecord).where(PrescriptionAdviceRecord.id == payload.id))
    record = res.scalar_one_or_none()
    if record:
        record.notification_status = "sent"
        record.email_sent_at = now_iso
        await db.commit()

    return SendAdviceResponse(
        success=True,
        message=f"Đã gửi dặn dò qua {' và '.join(channels)} thành công tới {' / '.join(x for x in [payload.patient_email if payload.send_email else None, payload.patient_phone if payload.send_sms else None] if x)}",
        timestamp=now_iso,
        email_sent_to=payload.patient_email,
        provider="+".join(channels)
    )
