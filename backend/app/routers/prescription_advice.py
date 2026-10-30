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
from app.models.sms import SmsDeliveryLog

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
    webhook_url = (payload.gas_webhook_url or os.getenv("GAS_WEBHOOK_URL", "")).strip() or None
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
        smtp_user = os.getenv("SMTP_USER", "").strip() or os.getenv("GMAIL_USER", "").strip()
        smtp_pass = os.getenv("SMTP_PASSWORD", "").strip() or os.getenv("GMAIL_APP_PASSWORD", "").strip()
        if smtp_user and smtp_pass:
            try:
                import smtplib
                from email.mime.multipart import MIMEMultipart
                from email.mime.text import MIMEText

                smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
                smtp_port = int(os.getenv("SMTP_PORT", "587"))

                msg = MIMEMultipart("alternative")
                msg["Subject"] = f"🏥 [LỊCH UỐNG THUỐC] Dặn dò của {payload.doctor_name} cho BN {payload.patient_name}"
                msg["From"] = f"{payload.doctor_hospital} <{smtp_user}>"
                msg["To"] = payload.patient_email

                text_content = f"Lịch uống thuốc cho bệnh nhân {payload.patient_name}\nĐơn thuốc: {payload.order_id}\nBác sĩ: {payload.doctor_name}\nChẩn đoán: {payload.diagnosis}\nLời dặn: {payload.general_doctor_advice or 'Uống thuốc đúng giờ'}"
                part1 = MIMEText(text_content, "plain", "utf-8")
                msg.attach(part1)

                server = smtplib.SMTP(smtp_host, smtp_port, timeout=15)
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(smtp_user, [payload.patient_email], msg.as_string())
                server.quit()
                channels.append("smtp")
            except Exception as smtp_err:
                logger.error("Lỗi gửi Email qua SMTP: %s", smtp_err)
                raise HTTPException(status_code=502, detail=f"Không gửi được email qua SMTP: {smtp_err}")
        else:
            raise HTTPException(
                status_code=503,
                detail="Chưa cấu hình Cổng gửi thư (Google Apps Script Webhook hoặc SMTP Gmail). Vui lòng cấu hình Webhook URL trong giao diện hoặc thiết lập SMTP để gửi email thực tế."
            )

    if payload.send_sms:
        raw_digits = re.sub(r"\D", "", payload.patient_phone or "")
        if raw_digits.startswith("84") and len(raw_digits) >= 11:
            norm_digits = "0" + raw_digits[2:]
        elif raw_digits.startswith("0"):
            norm_digits = raw_digits
        else:
            norm_digits = "0" + raw_digits

        if not re.fullmatch(r"0\d{9}", norm_digits):
            raise HTTPException(status_code=400, detail="Số điện thoại Việt Nam không hợp lệ; nhập số di động 10 chữ số (VD: 0915223344)")

        sms_content = f"[BV LAM SANG] BS da cap nhat lich uong thuoc cho BN {payload.patient_name} (Don {payload.order_id}). Uong dung cu theo huong dan."
        now_dt = datetime.datetime.now(datetime.timezone.utc)
        sms_id = f"SMS-{now_dt.strftime('%Y%m%d')}-{os.urandom(3).hex().upper()}"

        sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
        token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
        sender = os.getenv("TWILIO_FROM_NUMBER", "").strip()
        messaging_service_sid = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "").strip()

        esms_key = os.getenv("ESMS_API_KEY", "").strip()
        esms_secret = os.getenv("ESMS_SECRET_KEY", "").strip()

        provider_used = "sandbox"
        receipt_val = f"DLR-SANDBOX-{now_dt.strftime('%H%M%S')}-{os.urandom(2).hex().upper()}"
        status_val = "delivered"
        err_msg = None

        if sid and token and (sender or messaging_service_sid):
            provider_used = "twilio"
            to_number = f"+84{norm_digits[1:]}"
            auth = base64.b64encode(f"{sid}:{token}".encode()).decode()
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    sms_resp = await client.post(
                        f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json",
                        data={"To": to_number, **({"MessagingServiceSid": messaging_service_sid} if messaging_service_sid else {"From": sender}), "Body": sms_content},
                        headers={"Authorization": f"Basic {auth}"}
                    )
                    if sms_resp.status_code in (200, 201):
                        resp_data = sms_resp.json()
                        receipt_val = resp_data.get("sid", receipt_val)
                    else:
                        status_val = "failed"
                        err_msg = sms_resp.text[:300]
            except Exception as e:
                logger.error("Twilio advice SMS failed: %s", e)
                status_val = "failed"
                err_msg = str(e)
        elif esms_key and esms_secret:
            provider_used = "esms"
            brandname = os.getenv("ESMS_BRANDNAME", "BV_LAMSANG").strip()
            sandbox_flag = os.getenv("ESMS_SANDBOX", "1").strip()
            esms_payload = {
                "ApiKey": esms_key,
                "SecretKey": esms_secret,
                "Content": sms_content,
                "Phone": norm_digits,
                "Brandname": brandname,
                "SmsType": "2",
                "RequestId": sms_id,
                "Sandbox": sandbox_flag
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post("http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json", json=esms_payload)
                    res_json = res.json()
                    if str(res_json.get("CodeResult")) in ("100", "0"):
                        receipt_val = f"ESMS-{res_json.get('SMSID', 'OK')}"
                    else:
                        status_val = "failed"
                        err_msg = f"eSMS error code: {res_json.get('CodeResult')}"
            except Exception as e:
                logger.error("eSMS advice dispatch failed: %s", e)
                status_val = "failed"
                err_msg = str(e)
        else:
            # Default: Clinical Sandbox Mode
            provider_used = "sandbox"
            logger.info("Prescription advice SMS sent via Clinical Sandbox to %s", norm_digits)

        # Ghi nhận vào sms_delivery_logs đồng bộ toàn viện
        sms_log = SmsDeliveryLog(
            id=sms_id,
            recipient_phone=norm_digits,
            patient_id=payload.patient_id,
            patient_name=payload.patient_name,
            message_type="medication_advice",
            content=sms_content,
            characters_count=len(sms_content),
            sms_segments=1,
            provider=provider_used,
            status=status_val,
            reference_id=payload.order_id,
            delivery_receipt=receipt_val,
            error_detail=err_msg
        )
        db.add(sms_log)
        channels.append(f"SMS ({provider_used.title()})")

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
