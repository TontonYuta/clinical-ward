"""
Real-time Clinical Auto-Dispatcher for CPOE Prescriptions & Advice.
Tự động gửi SMS Brandname và Email dặn dò bệnh nhân ngay trong thời gian thực khi Bác sĩ ký đơn.
"""
import os
import re
import uuid
import logging
import datetime
import httpx
from typing import Optional, List, Dict, Any
from app.database import AsyncSessionLocal
from app.models.sms import SmsDeliveryLog
from app.models.patient import PrescriptionAdviceRecord
from app.services.admin_integrations_service import load_integrations_config
from app.services.audit_service import record_audit_event

logger = logging.getLogger("clinical_ward.auto_dispatcher")

def _normalize_vn_phone(phone: Optional[str]) -> str:
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("84") and len(digits) >= 11:
        return "0" + digits[2:]
    if digits.startswith("0"):
        return digits
    return "0" + digits

async def auto_dispatch_cpoe_notifications(
    order_id: str,
    patient_id: str,
    patient_name: str,
    patient_phone: Optional[str],
    patient_email: Optional[str],
    doctor_name: str,
    diagnosis_text: str,
    items_summary: str = ""
) -> Dict[str, Any]:
    """
    Tiến trình nền (Background Task): Tự động phát tin SMS và Email dặn dò ngay khi đơn thuốc được ký số.
    """
    cfg = load_integrations_config()
    results: Dict[str, Any] = {"sms": None, "email": None}
    norm_phone = _normalize_vn_phone(patient_phone)
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now_iso = now_dt.isoformat()

    async with AsyncSessionLocal() as db:
        # 1. TỰ ĐỘNG GỬI SMS BRANDNAME (eSMS.vn / Sandbox)
        if norm_phone and re.match(r"^0(3|5|7|8|9)\d{8}$", norm_phone):
            sms_id = f"SMS-{now_dt.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            sms_content = (
                f"[BV LAM SANG] BS. {doctor_name} da ky don thuoc ma {order_id} cho BN {patient_name}. "
                f"Tra cuu don tai: https://donthuocquocgia.vn/?id={order_id}. Hotline: 1900-1234"
            )
            k = (cfg.get("esms_api_key") or os.getenv("ESMS_API_KEY", "")).strip()
            s = (cfg.get("esms_secret_key") or os.getenv("ESMS_SECRET_KEY", "")).strip()
            brand = (cfg.get("esms_brandname") or os.getenv("ESMS_BRANDNAME", "BV_LAMSANG")).strip()
            sandbox = "1" if cfg.get("esms_sandbox", True) else "0"

            provider_used = "sandbox"
            status_val = "delivered"
            receipt_val = f"DLR-AUTO-{uuid.uuid4().hex[:8].upper()}"
            err_msg = None

            if k and s:
                provider_used = "esms"
                payload = {
                    "ApiKey": k, "SecretKey": s, "Phone": norm_phone,
                    "Content": sms_content, "Brandname": brand, "SmsType": "2",
                    "IsUnicode": "0", "RequestId": sms_id, "Sandbox": sandbox
                }
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        resp = await client.post("http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json", json=payload)
                        data = resp.json()
                        code = str(data.get("CodeResult"))
                        if code in ("100", "101", "0"):
                            receipt_val = f"ESMS-AUTO-{data.get('SMSID') or uuid.uuid4().hex[:6]}"
                        else:
                            status_val = "failed"
                            err_msg = f"eSMS CodeResult: {code} ({data.get('ErrorMessage', '')})"
                except Exception as exc:
                    status_val = "failed"
                    err_msg = f"Lỗi mạng eSMS: {str(exc)}"

            sms_log = SmsDeliveryLog(
                id=sms_id, patient_id=patient_id, patient_name=patient_name,
                recipient_phone=norm_phone, message_type="cpoe_prescription",
                content=sms_content, characters_count=len(sms_content), sms_segments=1,
                provider=provider_used, status=status_val, reference_id=order_id,
                delivery_receipt=receipt_val, error_detail=err_msg
            )
            db.add(sms_log)
            results["sms"] = {"status": status_val, "provider": provider_used, "phone": norm_phone}
            logger.info("Auto SMS dispatched for %s (%s): %s", order_id, norm_phone, status_val)

        # 2. TỰ ĐỘNG GỬI EMAIL DẶN DÒ (Google Apps Script Webhook / SMTP)
        if patient_email and "@" in patient_email:
            adv_id = f"ADV-{now_dt.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
            webhook_url = (cfg.get("gas_webhook_url") or os.getenv("GAS_WEBHOOK_URL", "")).strip() or None
            adv_status = "sent"

            if webhook_url and webhook_url.startswith("http"):
                try:
                    gas_payload = {
                        "advice": {
                            "id": adv_id, "prescription_id": order_id, "patient_id": patient_id,
                            "patient_name": patient_name, "patient_email": patient_email,
                            "diagnosis": diagnosis_text or "Điều trị ngoại trú",
                            "doctor_name": doctor_name, "doctor_hospital": "Bệnh Viện Đa Khoa Lâm Sàng",
                            "general_doctor_advice": "Uống thuốc đúng cữ và tái khám theo lịch hẹn",
                            "items_summary": items_summary
                        }
                    }
                    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                        resp = await client.post(webhook_url, json=gas_payload)
                        if resp.status_code not in (200, 201, 302):
                            adv_status = "failed"
                except Exception as exc:
                    logger.warning("Auto GAS dispatch error: %s", exc)
                    adv_status = "failed"

            advice_rec = PrescriptionAdviceRecord(
                id=adv_id, prescription_id=order_id, patient_id=patient_id,
                patient_name=patient_name, patient_email=patient_email, patient_phone=patient_phone,
                diagnosis=diagnosis_text or "Kê đơn ngoại trú", doctor_name=doctor_name,
                doctor_hospital="Bệnh Viện Đa Khoa Lâm Sàng", department="Khoa Khám Bệnh",
                general_doctor_advice="Uống thuốc đúng liều và tái khám đúng hẹn theo chỉ định bác sĩ.",
                medications_json=items_summary or "[]", notification_status=adv_status,
                gas_webhook_url=webhook_url, email_sent_at=now_iso
            )
            db.add(advice_rec)
            results["email"] = {"status": adv_status, "email": patient_email}
            logger.info("Auto Email advice dispatched for %s (%s): %s", order_id, patient_email, adv_status)

        # 3. GHI NHẬT KÝ KIỂM TOÁN TỰ ĐỘNG
        if results["sms"] or results["email"]:
            await record_audit_event(
                db=db,
                action_type="REALTIME_NOTIFICATION_AUTO_DISPATCHED",
                action_title=f"Tự động phát tin thời gian thực cho đơn {order_id}",
                target_item=f"{patient_name} (SĐT: {norm_phone or 'N/A'}, Email: {patient_email or 'N/A'})",
                legal_basis="Thông tư 26/2025/TT-BYT & Quyết định 5948/QĐ-BYT",
                signer_name=doctor_name,
                signer_certificate="AUTO-GATEWAY-REALTIME-BYT",
                auth_method="AUTO_REALTIME_GATEWAY",
                payload_data={"order_id": order_id, "results": results}
            )

        await db.commit()
    return results
