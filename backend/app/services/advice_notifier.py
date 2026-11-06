import os
import re
import datetime
import logging
import base64
import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sms import SmsDeliveryLog

logger = logging.getLogger("clinical_ward.advice_notifier")

def build_advice_email_text(payload) -> str:
    lines = [f"Thông tin dùng thuốc cho người bệnh {payload.patient_name}",
             f"Mã nguồn: {payload.prescription_id or payload.id}",
             f"Người kê trên nguồn: {payload.doctor_name or 'Chưa ghi'}",
             f"Cơ sở: {payload.doctor_hospital or 'Chưa ghi'}",
             f"Chẩn đoán: {payload.diagnosis or 'Chưa ghi'}",
             f"Khoảng thời gian đã xác nhận: {payload.start_date or 'Chưa ghi'} đến {payload.end_date or 'Chưa ghi'}"]
    for number, med in enumerate(payload.medications, 1):
        lines.extend([f"{number}. {med.medication_name}",
                      f"Liều: {med.dosage or 'Chưa ghi'}; Đường dùng: {med.route or 'Chưa ghi'}; Tần suất: {med.frequency or 'Chưa ghi'}",
                      f"Thời hạn: {str(med.duration_days)+' ngày' if med.duration_days > 0 else 'Chưa ghi'}"])
        if med.special_instructions: lines.append(f"Chỉ dẫn: {med.special_instructions}")
        if not med.time_slots: lines.append("Chưa cấu hình giờ dùng; xem chỉ định đã kê.")
        for slot in med.time_slots:
            lines.append(f"{slot.label}: {slot.time or 'Chưa ghi giờ'}; {slot.dosage_text or 'Chưa ghi liều'}; {slot.meal_relation or 'Chưa ghi liên hệ bữa ăn'}")
            if slot.note: lines.append(f"Ghi chú giờ dùng: {slot.note}")
    if payload.general_doctor_advice: lines.append(f"Lời dặn: {payload.general_doctor_advice}")
    return "\n".join(lines)


async def dispatch_email_notification(payload, channels: list[str], httpx_cls=None):
    if httpx_cls is None:
        httpx_cls = httpx.AsyncClient
    webhook_url = (payload.gas_webhook_url or os.getenv("GAS_WEBHOOK_URL", "")).strip() or None
    if webhook_url and webhook_url.startswith("http"):
        try:
            async with httpx_cls(timeout=15.0, follow_redirects=True) as client:
                resp = await client.post(webhook_url, json={"advice": payload.model_dump(by_alias=True)})
                if resp.status_code not in (200, 201, 302):
                    raise HTTPException(status_code=502, detail="Nhà cung cấp email từ chối gửi dặn dò")
                try:
                    result = resp.json()
                except (ValueError, AttributeError):
                    result = None
                if not isinstance(result, dict) or result.get("success") is not True or result.get("error"):
                    raise HTTPException(status_code=502, detail="Nhà cung cấp email không xác nhận gửi dặn dò")
                channels.append("google_apps_script")
        except Exception as exc:
            logger.error("Lỗi Google Apps Script: %s", exc)
            if isinstance(exc, HTTPException):
                raise exc
            raise HTTPException(status_code=502, detail="Không gửi được email; kiểm tra cấu hình Google Apps Script")
    else:
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
                msg["From"] = f"{payload.doctor_hospital} <{smtp_user}>" if payload.doctor_hospital else smtp_user
                msg["To"] = payload.patient_email

                text_content = build_advice_email_text(payload)
                msg.attach(MIMEText(text_content, "plain", "utf-8"))

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

def normalize_advice_phone(phone: str | None) -> str:
    raw_digits = re.sub(r"\D", "", phone or "")
    if raw_digits.startswith("84") and len(raw_digits) >= 11:
        norm_digits = "0" + raw_digits[2:]
    elif raw_digits.startswith("0"):
        norm_digits = raw_digits
    else:
        norm_digits = "0" + raw_digits

    if not re.fullmatch(r"0[35789]\d{8}", norm_digits):
        raise HTTPException(status_code=400, detail="Số điện thoại Việt Nam không hợp lệ; nhập số di động 10 chữ số (VD: 0915223344)")

    return norm_digits


def build_advice_sms_content(payload) -> str:
    return f"Thong tin dung thuoc cho {payload.patient_name}. Ma nguon: {payload.prescription_id or payload.id}. Doi chieu chi dan da duoc nguoi ke xac nhan."


async def dispatch_sms_notification(payload, db: AsyncSession, channels: list[str]):
    norm_digits = normalize_advice_phone(payload.patient_phone)
    sms_content = build_advice_sms_content(payload)
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    sms_id = f"SMS-{now_dt.strftime('%Y%m%d')}-{os.urandom(3).hex().upper()}"

    sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    sender = os.getenv("TWILIO_FROM_NUMBER", "").strip()
    messaging_service_sid = os.getenv("TWILIO_MESSAGING_SERVICE_SID", "").strip()

    esms_key = os.getenv("ESMS_API_KEY", "").strip()
    esms_secret = os.getenv("ESMS_SECRET_KEY", "").strip()

    provider_used = ""
    receipt_val = None
    status_val = "sent"
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
                    result = sms_resp.json()
                    receipt_val = result.get("sid")
                    if not receipt_val or result.get("status") in ("failed", "undelivered", "canceled"):
                        status_val = "failed"
                        err_msg = "Nhà cung cấp không xác nhận tiếp nhận SMS"
                else:
                    status_val = "failed"
                    err_msg = sms_resp.text[:300]
        except Exception as e:
            logger.error("Twilio advice SMS failed: %s", e)
            status_val = "failed"
            err_msg = str(e)
    elif esms_key and esms_secret:
        provider_used = "esms"
        brandname = os.getenv("ESMS_BRANDNAME", "").strip()
        if not brandname:
            raise HTTPException(status_code=503, detail="Chưa cấu hình Brandname đã đăng ký với nhà cung cấp SMS")
        sandbox_flag = os.getenv("ESMS_SANDBOX", "1").strip()
        if sandbox_flag != "0":
            raise HTTPException(status_code=503, detail="eSMS đang ở chế độ thử nghiệm; chưa gửi SMS thực tế")
        esms_payload = {
            "ApiKey": esms_key, "SecretKey": esms_secret, "Content": sms_content,
            "Phone": norm_digits, "Brandname": brandname, "SmsType": "2",
            "RequestId": sms_id, "Sandbox": sandbox_flag
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post("https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json", json=esms_payload)
                res_json = res.json()
                if res.status_code in (200, 201) and str(res_json.get("CodeResult")) in ("100", "0") and res_json.get("SMSID"):
                    receipt_val = f"ESMS-{res_json['SMSID']}"
                else:
                    status_val = "failed"
                    err_msg = f"eSMS error code: {res_json.get('CodeResult')}"
        except Exception as e:
            logger.error("eSMS advice dispatch failed: %s", e)
            status_val = "failed"
            err_msg = str(e)
    else:
        raise HTTPException(status_code=503, detail="Chưa cấu hình nhà cung cấp SMS; chưa gửi thông báo")

    if status_val == "failed":
        raise HTTPException(status_code=502, detail="Nhà cung cấp SMS không xác nhận gửi thông báo")

    sms_log = SmsDeliveryLog(
        id=sms_id, recipient_phone=norm_digits, patient_id=payload.patient_id,
        patient_name=payload.patient_name, message_type="medication_advice",
        content=sms_content, characters_count=len(sms_content), sms_segments=1,
        provider=provider_used, status=status_val, reference_id=payload.prescription_id or payload.id,
        delivery_receipt=receipt_val, error_detail=err_msg
    )
    db.add(sms_log)
    channels.append(f"SMS ({provider_used.title()})")
