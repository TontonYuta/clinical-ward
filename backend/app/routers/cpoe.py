from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime
import json
import uuid
from typing import List, Optional

from app.database import get_db
from app.models.cpoe import CpoePrescription
from app.schemas.cpoe import CpoeOrderCreate, CpoeOrderResponse, CpoeItemSchema
from app.services.audit_service import record_audit_event
from app.services.cpoe_service import (
    validate_cpoe_ddi, map_prescription_to_response, build_cpoe_prescription_model
)
from app.services.auto_dispatcher import auto_dispatch_cpoe_notifications

router = APIRouter(prefix="/cpoe", tags=["Đơn thuốc điện tử CPOE"])

@router.get("", response_model=List[CpoeOrderResponse])
async def get_cpoe_orders(
    patient_id: Optional[str] = Query(None, description="Lọc theo ID bệnh nhân"),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    query = select(CpoePrescription).order_by(desc(CpoePrescription.created_at)).limit(limit)
    if patient_id:
        query = select(CpoePrescription).where(CpoePrescription.patient_id == patient_id).order_by(desc(CpoePrescription.created_at)).limit(limit)

    result = await db.execute(query)
    prescriptions = result.scalars().all()

    response_list = []
    for p in prescriptions:
        items = []
        if p.items_json:
            try:
                raw_items = json.loads(p.items_json)
                items = [CpoeItemSchema(**it) for it in raw_items]
            except Exception:
                items = []

        response_list.append(map_prescription_to_response(p, items))

    return response_list

@router.post("", response_model=CpoeOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_cpoe_order(
    payload: CpoeOrderCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    if payload.status not in ("draft", "signed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Trạng thái đơn không hợp lệ")

    validate_cpoe_ddi(payload.items)

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    order_id = payload.id or f"RX-2026-{uuid.uuid4().hex[:6].upper()}"
    signature = payload.digitalSignature if payload.status == "signed" else None

    items_dict = [it.model_dump() for it in payload.items]
    items_json = json.dumps(items_dict, ensure_ascii=False)

    prescription = build_cpoe_prescription_model(payload, order_id, signature, now_str, items_json)
    db.add(prescription)
    await db.commit()
    await db.refresh(prescription)

    if payload.status == "signed":
        med_summary = ", ".join([f"{it.medicationName} ({it.quantity} {it.unit})" for it in payload.items])
        await record_audit_event(
            db=db,
            action_type="CPOE_PRESCRIPTION_SIGNED",
            action_title=f"Ký y lệnh đơn thuốc điện tử {order_id} ({payload.prescriptionType})",
            target_item=f"{payload.patientName} ({payload.diagnosisIcd10}) - {med_summary}",
            legal_basis="Thông tư 26/2025/TT-BYT & Nghị định 130/2018/NĐ-CP",
            signer_name=payload.doctorName,
            signer_certificate=payload.doctorCertificate,
            auth_method="DIGITAL_CERT_BYT",
            payload_data={
                "order_id": order_id,
                "patient_cccd": payload.patientCccd,
                "icd10": payload.diagnosisIcd10,
                "items_count": len(payload.items)
            }
        )
        # Phát tin thời gian thực tự động qua tiến trình nền
        background_tasks.add_task(
            auto_dispatch_cpoe_notifications,
            order_id=order_id,
            patient_id=payload.patientId,
            patient_name=payload.patientName,
            patient_phone=payload.patientPhone,
            patient_email=payload.patientEmail,
            doctor_name=payload.doctorName,
            diagnosis_text=payload.diagnosisText or "",
            items_summary=items_json
        )

    return map_prescription_to_response(prescription, payload.items)

@router.post("/{order_id}/sign", response_model=CpoeOrderResponse)
async def sign_cpoe_order(
    order_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Ký số y lệnh đơn thuốc CPOE và tự động gửi SMS & Email thời gian thực cho người bệnh."""
    res = await db.execute(select(CpoePrescription).where(CpoePrescription.id == order_id))
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn thuốc để ký số")

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    p.status = "signed"
    p.digital_signature = f"SHA256-RSA:{uuid.uuid4().hex[:16]}:{now_str}"
    await db.commit()
    await db.refresh(p)

    items = []
    if p.items_json:
        try:
            items = [CpoeItemSchema(**it) for it in json.loads(p.items_json)]
        except Exception:
            items = []

    med_summary = ", ".join([f"{it.medicationName} ({it.quantity} {it.unit})" for it in items])
    await record_audit_event(
        db=db,
        action_type="CPOE_PRESCRIPTION_SIGNED",
        action_title=f"Ký số y lệnh đơn thuốc điện tử {order_id}",
        target_item=f"{p.patient_name} ({p.diagnosis_icd10}) - {med_summary}",
        legal_basis="Thông tư 26/2025/TT-BYT & Nghị định 130/2018/NĐ-CP",
        signer_name=p.doctor_name,
        signer_certificate=p.doctor_certificate or "CERT-BYT-2026-ACTIVE",
        auth_method="DIGITAL_CERT_BYT",
        payload_data={"order_id": order_id, "patient_cccd": p.patient_cccd}
    )

    # Tự động gửi SMS & Email thời gian thực
    background_tasks.add_task(
        auto_dispatch_cpoe_notifications,
        order_id=p.id,
        patient_id=p.patient_id,
        patient_name=p.patient_name,
        patient_phone=p.patient_phone,
        patient_email=p.patient_email,
        doctor_name=p.doctor_name,
        diagnosis_text=p.diagnosis_text or "",
        items_summary=p.items_json
    )

    return map_prescription_to_response(p, items)
