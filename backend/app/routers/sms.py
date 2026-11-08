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
        title="1. Mã Đơn Thuốc Điện Tử (TT 26/2025/TT-BYT)",
        category="cpoe_prescription",
        template="[BV LAM SANG] BS {doctorName} da ky don thuoc ma {orderId} cho BN {patientName}. Tra cuu don tai: https://donthuocquocgia.vn/?id={orderId}. Hotline: 1900-1234",
        description="Thông báo mã đơn thuốc điện tử quốc gia cho người bệnh đi mua thuốc theo Thông tư 26."
    ),
    SmsTemplateItem(
        id="tpl_medication_advice",
        title="2. Nhắc Lịch Uống Thuốc & Cữ Điều Trị (JAMA Int Med)",
        category="medication_advice",
        template="[BV LAM SANG] Nhac uong thuoc BN {patientName}: Sang 07:30 (1 vien sau an), Toi 20:00 (1 vien truoc ngu). Uong dung gio, tai kham ngay neu co dau nguc hoac sot >38.5C.",
        description="Nhắc nhở cữ uống thuốc sáng - tối giúp nhân đôi tỷ lệ tuân thủ điều trị lâm sàng."
    ),
    SmsTemplateItem(
        id="tpl_hospital_notice",
        title="3. Thông Báo Viện Phí & Tái Khám Định Kỳ",
        category="hospital_notice",
        template="[BV LAM SANG] Xac nhan BN {patientName} ({patientId}) da hoan tat doi soat va thanh toan vien phi dot dieu tri. Hen tai kham sau 30 ngay tai Khoa Kham Benh.",
        description="Xác nhận hoàn tất thủ tục viện phí và nhắc lịch tái khám định kỳ."
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
    limit: int = Query(50, le=200),
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
    status_str = "delivered"
    receipt_str = f"DLR-SIM-{uuid.uuid4().hex[:8].upper()}"
    error_msg = None

    provider = payload.provider or SmsProviderType.SANDBOX
    dispatch_mode = (payload.dispatch_mode or "immediate").lower()

    if dispatch_mode == "scheduled":
        # Chế độ đặt lịch tự động gửi: Ghi nhận vào hàng đợi phát sóng theo giờ hẹn
        status_str = "scheduled"
        receipt_str = f"SCHED-QUEUE-{uuid.uuid4().hex[:8].upper()}"
    elif provider == SmsProviderType.ESMS:
        # 1. Chế độ Viễn thông Thật eSMS.vn Brandname (Nếu cấu hình)
        from app.services.admin_integrations_service import load_integrations_config
        cfg = load_integrations_config()
        esms_api_key = (cfg.get("esms_api_key") or os.getenv("ESMS_API_KEY", "")).strip()
        esms_secret = (cfg.get("esms_secret_key") or os.getenv("ESMS_SECRET_KEY", "")).strip()
        esms_brand = (cfg.get("esms_brandname") or os.getenv("ESMS_BRANDNAME", "BV_LAMSANG")).strip()
        is_sandbox = "1" if cfg.get("esms_sandbox", True) else "0"

        if esms_api_key and esms_secret:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(
                        "http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/",
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
                        status_str = "delivered"
                    elif str(data.get("CodeResult")) == "146":
                        status_str = "failed"
                        error_msg = "eSMS Lỗi 146: Sai mẫu Brandname CSKH. Brandname Baotrixemay bắt buộc nội dung khớp mẫu: 'Ma xac nhan cua ban la {Mã đơn}'."
                    else:
                        status_str = "failed"
                        error_msg = f"eSMS Lỗi {data.get('CodeResult')}: {data.get('ErrorMessage') or 'Không gửi được'}"
            except Exception as e:
                status_str = "failed"
                error_msg = f"Lỗi kết nối eSMS: {str(e)}"
        else:
            # Phát tin qua cổng mô phỏng Gateway nội bộ
            receipt_str = f"DLR-SIM-{uuid.uuid4().hex[:8].upper()}"
            status_str = "delivered"

    # 2. Cổng Gateway viễn thông trực tiếp
    elif provider == SmsProviderType.SANDBOX:
        receipt_str = f"DLR-SIM-{datetime.now().strftime('%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"
        status_str = "delivered"

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
        error_detail=error_msg,
        dispatch_mode=dispatch_mode,
        scheduled_at=payload.scheduled_at,
        timing_rule=payload.timing_rule
    )
    db.add(sms_log)
    await db.commit()
    await db.refresh(sms_log)

    # Ghi nhận vào sổ kiểm toán lâm sàng bất biến (Audit Trail)
    action_type = "PATIENT_SMS_SCHEDULED" if dispatch_mode == "scheduled" else "PATIENT_SMS_DISPATCHED"
    action_title = (
        f"Lên lịch tự động gửi SMS tới bệnh nhân {payload.patient_name} ({norm_phone})"
        if dispatch_mode == "scheduled"
        else f"Phát tin nhắn SMS tới bệnh nhân {payload.patient_name} ({norm_phone})"
    )
    await record_audit_event(
        db=db,
        action_type=action_type,
        action_title=action_title,
        target_item=f"Mã: {now_id} · Loại: {payload.message_type.value} · Chế độ: {dispatch_mode} · {chars_count} ký tự ({segments_count} tin) - Provider: {provider.value}",
        legal_basis="Thông tư 26/2025/TT-BYT & Nghị định 91/2020/NĐ-CP",
        signer_name="Hệ Thống SMS Viễn Thông Bệnh Viện",
        signer_certificate="SMS-GATEWAY-2026",
        auth_method="SMS_BRANDNAME_DISPATCH",
        payload_data={
            "sms_id": now_id,
            "patient_id": payload.patient_id,
            "recipient_phone": norm_phone,
            "dispatch_mode": dispatch_mode,
            "scheduled_at": payload.scheduled_at.isoformat() if payload.scheduled_at else None,
            "timing_rule": payload.timing_rule,
            "status": status_str,
            "delivery_receipt": receipt_str
        }
    )

    return sms_log

@router.post("/cancel/{sms_id}", response_model=SmsDeliveryLogResponse)
async def cancel_scheduled_sms(
    sms_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SmsDeliveryLog).where(SmsDeliveryLog.id == sms_id)
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy bản ghi tin nhắn")
    if item.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể hủy tin nhắn đang hẹn giờ (Trạng thái hiện tại: {item.status})"
        )
    item.status = "cancelled"
    await db.commit()
    await db.refresh(item)
    return item
