"""Persist notification claims before side effects; never silently retry unknown outcomes."""
import hashlib
import json
from fastapi import HTTPException
from sqlalchemy import select, update
from app.models.patient import AdviceDeliveryAttempt
from app.services.advice_notifier import normalize_advice_phone, build_advice_sms_content


async def deliver_once(payload, channel, db, sender):
    if channel == 'sms':
        content = {'patient_id': payload.patient_id, 'recipient': normalize_advice_phone(payload.patient_phone),
                   'body': build_advice_sms_content(payload)}
    else:
        # Correcting an SMS contact during a partial retry must not resend email.
        # Email deduplication follows its own recipient and clinical document.
        fields = {'patient_id', 'patient_name', 'diagnosis', 'doctor_name', 'doctor_hospital',
                  'department', 'start_date', 'end_date', 'general_doctor_advice', 'medications'}
        content = payload.model_dump(include=fields)
        content['recipient'] = payload.patient_email.strip().casefold()
        content['reference'] = payload.prescription_id or payload.id
    job_id = hashlib.sha256((channel + ':' + json.dumps(content, sort_keys=True, ensure_ascii=False)).encode()).hexdigest()
    dialect = db.get_bind().dialect.name
    if dialect == 'sqlite':
        from sqlalchemy.dialects.sqlite import insert
    elif dialect == 'postgresql':
        from sqlalchemy.dialects.postgresql import insert
    else:
        raise HTTPException(503, 'Database chưa hỗ trợ xác nhận gửi an toàn')
    inserted = await db.execute(insert(AdviceDeliveryAttempt).values(
        id=job_id, advice_id=payload.id, channel=channel, status='pending',
    ).on_conflict_do_nothing(index_elements=['id']).returning(AdviceDeliveryAttempt.id))
    claimed = inserted.scalar_one_or_none() is not None
    if not claimed:
        existing = (await db.execute(select(AdviceDeliveryAttempt).where(AdviceDeliveryAttempt.id == job_id))).scalar_one()
        if existing.status == 'sent':
            return existing.provider or channel, False
        if existing.status != 'failed':
            raise HTTPException(409, f'Kênh {channel} đang gửi hoặc chưa rõ kết quả. Kiểm tra trạng thái trước khi gửi lại để tránh trùng.')
        retry = await db.execute(update(AdviceDeliveryAttempt).where(
            AdviceDeliveryAttempt.id == job_id, AdviceDeliveryAttempt.status == 'failed',
        ).values(status='pending', error_detail=None).returning(AdviceDeliveryAttempt.id))
        if retry.scalar_one_or_none() is None:
            raise HTTPException(409, f'Kênh {channel} đã được xử lý ở yêu cầu khác')
    await db.commit()
    providers = []
    try:
        await sender(providers)
        if not providers:
            raise HTTPException(502, 'Provider chưa xác nhận tiếp nhận thông báo')
    except Exception as error:
        # Configuration/input rejection is retryable; timeouts/connection failures
        # can occur after remote acceptance, so they need explicit reconciliation.
        retryable = isinstance(error, HTTPException) and error.status_code in {400, 401, 403, 404, 422, 503}
        await db.execute(update(AdviceDeliveryAttempt).where(AdviceDeliveryAttempt.id == job_id).values(
            status='failed' if retryable else 'unconfirmed',
            error_detail='Provider chưa xác nhận kết quả' if not retryable else str(error.detail),
        ))
        await db.commit()
        raise
    provider = '+'.join(providers)
    await db.execute(update(AdviceDeliveryAttempt).where(AdviceDeliveryAttempt.id == job_id).values(status='sent', provider=provider))
    await db.commit()
    return provider, True
