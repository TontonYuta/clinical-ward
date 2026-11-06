import hmac
import hashlib
import json
from datetime import datetime
from uuid import uuid4
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditRecord, AuditAppendLock
from app.config import settings

def calculate_hash(previous_hash: str, payload: dict) -> str:
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    data = f"{previous_hash}:{serialized}".encode("utf-8")
    return hmac.new(settings.SECRET_KEY.encode("utf-8"), data, hashlib.sha256).hexdigest()

async def record_audit_event(
    db: AsyncSession,
    action_type: str,
    action_title: str,
    target_item: str,
    legal_basis: str,
    signer_name: str,
    signer_certificate: str,
    witness_name: str | None = None,
    witness_certificate: str | None = None,
    auth_method: str = "PIN",
    payload_data: dict | None = None
) -> AuditRecord:
    # The lock is held by the database until this transaction commits/rolls back,
    # so appending remains serial across processes, not just within one worker.
    dialect = db.get_bind().dialect.name
    if dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    elif dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        raise RuntimeError("Audit append locking is not implemented for this database")
    await db.execute(insert(AuditAppendLock).values(id=1).on_conflict_do_nothing(index_elements=["id"]))
    await db.execute(update(AuditAppendLock).where(AuditAppendLock.id == 1).values(id=1))

    # Get last audit record to chain previous_hash
    stmt = select(AuditRecord).order_by(AuditRecord.created_at.desc(), AuditRecord.id.desc()).limit(1)
    result = await db.execute(stmt)
    last_record = result.scalar_one_or_none()

    previous_hash = last_record.integrity_hash if last_record else "GENESIS_BLOCK_HOSPITAL_AUDIT_2026"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Avoid collisions with imported/non-contiguous ledger IDs.
    event_id = f"AUD-{datetime.now().year}-{uuid4().hex}"
    payload_data = {**(payload_data or {}), "_audit_schema": 2}

    hash_payload = {
        "event_id": event_id,
        "timestamp": now_str,
        "action_type": action_type,
        "target_item": target_item,
        "signer_certificate": signer_certificate,
        "witness_certificate": witness_certificate or "",
        "auth_method": auth_method,
        "data": payload_data or {}
    }

    hash_payload.update(action_title=action_title, legal_basis=legal_basis,
                        signer_name=signer_name, witness_name=witness_name or "")
    current_hash = calculate_hash(previous_hash, hash_payload)

    new_record = AuditRecord(
        id=event_id,
        timestamp=now_str,
        action_type=action_type,
        action_title=action_title,
        target_item=target_item,
        legal_basis=legal_basis,
        signer_name=signer_name,
        signer_certificate=signer_certificate,
        witness_name=witness_name,
        witness_certificate=witness_certificate,
        auth_method=auth_method,
        previous_hash=previous_hash,
        integrity_hash=current_hash,
        payload_data=payload_data,
        created_at=datetime.now(),
    )

    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    return new_record

async def verify_ledger_integrity(db: AsyncSession) -> dict:
    stmt = select(AuditRecord).order_by(AuditRecord.created_at.asc(), AuditRecord.id.asc())
    result = await db.execute(stmt)
    records = result.scalars().all()

    if not records:
        return {"is_valid": True, "total_records": 0, "broken_at_id": None, "message": "Sổ kiểm toán trống"}

    expected_prev = "GENESIS_BLOCK_HOSPITAL_AUDIT_2026"
    for r in records:
        if r.previous_hash != expected_prev:
            return {
                "is_valid": False,
                "total_records": len(records),
                "broken_at_id": r.id,
                "message": f"Phát hiện sai lệch previous_hash tại bản ghi {r.id}"
            }

        hash_payload = {
            "event_id": r.id,
            "timestamp": r.timestamp,
            "action_type": r.action_type,
            "target_item": r.target_item,
            "signer_certificate": r.signer_certificate,
            "witness_certificate": r.witness_certificate or "",
            "auth_method": r.auth_method,
            "data": r.payload_data or {}
        }
        if (r.payload_data or {}).get("_audit_schema") == 2:
            hash_payload.update(action_title=r.action_title, legal_basis=r.legal_basis,
                                signer_name=r.signer_name, witness_name=r.witness_name or "")
        recomputed = calculate_hash(expected_prev, hash_payload)
        if recomputed != r.integrity_hash:
            return {
                "is_valid": False,
                "total_records": len(records),
                "broken_at_id": r.id,
                "message": f"Phát hiện chữ ký băm bị sửa đổi trái phép tại bản ghi {r.id}"
            }

        expected_prev = r.integrity_hash

    return {
        "is_valid": True,
        "total_records": len(records),
        "broken_at_id": None,
        "message": "100% bản ghi kiểm toán nguyên vẹn, chuỗi băm HMAC-SHA256 hợp lệ"
    }
