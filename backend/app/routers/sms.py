import math
import os
import re
import uuid
from datetime import datetime
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.sms import SmsDeliveryLog
from app.schemas.sms import SendSmsRequest, SmsDeliveryLogResponse, SmsTemplateItem, SmsProviderType
from app.services.audit_service import record_audit_event

router = APIRouter(prefix="/sms", tags=["Cổng Tin Nhắn SMS Bệnh Nhân (TT 26/2025/TT-BYT)"])

CLINICAL_SMS_TEMPLATES: list[SmsTemplateItem] = [
    SmsTemplateItem(
        id="tpl_cpoe_national",
        title="Thông tin hồ sơ đơn thuốc nội bộ",
        category="cpoe_prescription",
        template="Nguoi benh {patientName} ({patientId}). Ma ho so noi bo {orderId}; trang thai nguon: {orderStatus}. Nguoi ke don tren ho so: {doctorName}. Noi dung thuoc: {medicationsSummary}.",
        description="Dùng mã và trạng thái thực trên hồ sơ; không xác nhận chữ ký hay phát hành trên hệ thống khác."
    ),
    SmsTemplateItem(
        id="tpl_medication_advice",
        title="Thông tin dùng thuốc theo hồ sơ",
        category="medication_advice",
        template="Thong tin cua {patientName}, ho so noi bo {orderId}, trang thai {orderStatus}: {medicationsSummary}. Kiem tra lai voi nguoi dieu tri truoc khi thuc hien.",
        description="Chỉ điền liều, tần suất, đường dùng và lời dặn thực được cung cấp."
    ),
    SmsTemplateItem(
        id="tpl_hospital_notice",
        title="Thông báo khác cho người bệnh",
        category="hospital_notice",
        template="Thong tin cho {patientName} ({patientId}). Noi dung thong bao, vien phi hoac lich hen: chua co du lieu xac nhan; can bo sung tu ho so thuc te.",
        description="Không tự xác nhận thanh toán, lịch hẹn, cơ sở hoặc thông tin liên hệ."
    )
]

def normalize_vn_phone(phone: str) -> str:
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    if cleaned.startswith("+84"):
        return "0" + cleaned[3:]
    if cleaned.startswith("84") and len(cleaned) == 11:
        return "0" + cleaned[2:]
    return cleaned

def calculate_sms_metrics(text: str) -> tuple[int, int]:
    length = len(text)
    is_unicode = any(ord(c) > 127 for c in text)
    if is_unicode:
        segments = 1 if length <= 70 else math.ceil(length / 67)
    else:
        segments = 1 if length <= 160 else math.ceil(length / 153)
    return length, max(1, segments)

@router.get("/templates", response_model=list[SmsTemplateItem])
async def get_sms_templates():
    return CLINICAL_SMS_TEMPLATES

@router.get("/logs", response_model=list[SmsDeliveryLogResponse])
async def list_sms_logs(
    patient_id: str | None = Query(None, description="Lọc theo mã hồ sơ bệnh nhân"),
    recipient_phone: str | None = Query(None, description="Lọc theo SĐT"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SmsDeliveryLog).order_by(SmsDeliveryLog.created_at.desc())
    if patient_id:
        stmt = stmt.where(SmsDeliveryLog.patient_id == patient_id)
    if recipient_phone:
        norm = normalize_vn_phone(recipient_phone)
        stmt = stmt.where(SmsDeliveryLog.recipient_phone.like(f"%{norm}%"))
    stmt = stmt.limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/send", response_model=SmsDeliveryLogResponse, status_code=status.HTTP_201_CREATED)
async def send_patient_sms(
    payload: SendSmsRequest,
    db: AsyncSession = Depends(get_db)
):
    norm_phone = normalize_vn_phone(payload.recipient_phone)
    if not re.match(r"^0(3|5|7|8|9)\d{8}$", norm_phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số điện thoại '{payload.recipient_phone}' không hợp lệ. Vui lòng nhập số di động Việt Nam 10 chữ số (03x, 05x, 07x, 08x, 09x)"
        )

    chars_count, segments_count = calculate_sms_metrics(payload.content)
    now_id = f"SMS-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    status_str = "simulated"
    receipt_str = f"DLR-SIM-{uuid.uuid4().hex[:8].upper()}"
    error_msg = None

    provider = payload.provider or SmsProviderType.SANDBOX

    # 1. Chế độ Viễn thông Thật eSMS.vn Brandname (Nếu cấu hình)
    if provider == SmsProviderType.ESMS:
        esms_api_key = os.getenv("ESMS_API_KEY", "").strip()
        esms_secret = os.getenv("ESMS_SECRET_KEY", "").strip()
        esms_brand = os.getenv("ESMS_BRANDNAME", "").strip()
        is_sandbox = os.getenv("ESMS_SANDBOX", "1").strip() # 1 là chế độ Sandbox an toàn (0đ) bảo toàn số dư tài khoản

        if not esms_brand:
            raise HTTPException(status_code=503, detail="Chưa cấu hình Brandname eSMS đã đăng ký; chưa gửi tin")

        if esms_api_key and esms_secret:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        "https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/",
                        json={
                            "ApiKey": esms_api_key,
                            "SecretKey": esms_secret,
                            "Phone": norm_phone,
                            "Content": payload.content,
                            "Brandname": esms_brand,
                            "SmsType": "2",
                            "IsUnicode": "1" if any(ord(c) > 127 for c in payload.content) else "0",
                            "RequestId": str(uuid.uuid4()),
                            "Sandbox": is_sandbox
                        }
                    )
                    data = resp.json()
                    if str(data.get("CodeResult")) in ("100", "101"):
                        receipt_str = f"ESMS-ID-{data.get('SMSID') or uuid.uuid4().hex[:8]}"
                        status_str = "simulated" if is_sandbox == "1" else "sent"
                    elif str(data.get("CodeResult")) == "146":
                        status_str = "failed"
                        error_msg = "eSMS Lỗi 146: Nội dung không khớp mẫu đã đăng ký của tài khoản gửi. Kiểm tra cấu hình nhà cung cấp."
                    else:
                        status_str = "failed"
                        error_msg = f"eSMS Lỗi {data.get('CodeResult')}: {data.get('ErrorMessage') or 'Không gửi được'}"
            except Exception as e:
                status_str = "failed"
                error_msg = f"Lỗi kết nối eSMS: {str(e)}"
        else:
            raise HTTPException(status_code=503, detail="Chưa cấu hình nhà cung cấp eSMS; chưa gửi tin")

    # 2. Cổng Gateway viễn thông trực tiếp
    elif provider == SmsProviderType.SANDBOX:
        receipt_str = f"DLR-SIM-{datetime.now().strftime('%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
        status_str = "simulated"
    else:
        raise HTTPException(status_code=501, detail="Nhà cung cấp SMS này chưa được tích hợp")

    # Tạo bản ghi log giao nhận tin nhắn bất biến
    sms_log = SmsDeliveryLog(
        id=now_id,
        patient_id=payload.patient_id,
        patient_name=payload.patient_name,
        recipient_phone=norm_phone,
        message_type=payload.message_type.value,
        content=payload.content,
        characters_count=chars_count,
        sms_segments=segments_count,
        provider=provider.value,
        status=status_str,
        reference_id=payload.reference_id,
        delivery_receipt=receipt_str,
        error_detail=error_msg
    )
    db.add(sms_log)

    # Ghi nhận vào sổ kiểm toán lâm sàng bất biến (Audit Trail)
    await record_audit_event(
        db=db,
        action_type="PATIENT_SMS_DISPATCHED",
        action_title=f"Phát tin nhắn SMS tới bệnh nhân {payload.patient_name} ({norm_phone})",
        target_item=f"Mã: {now_id} · Loại: {payload.message_type.value} · {chars_count} ký tự ({segments_count} tin) - Provider: {provider.value}",
        legal_basis="Thông tư 26/2025/TT-BYT & Nghị định 91/2020/NĐ-CP",
        signer_name="Hệ Thống SMS Viễn Thông Bệnh Viện",
        signer_certificate="SMS-GATEWAY-2026",
        auth_method="SMS_BRANDNAME_DISPATCH",
        payload_data={
            "sms_id": now_id,
            "patient_id": payload.patient_id,
            "phone": norm_phone,
            "provider": provider.value,
            "receipt": receipt_str,
            "segments": segments_count
        }
    )

    await db.refresh(sms_log)
    return sms_log
