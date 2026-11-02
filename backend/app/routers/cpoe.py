from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from app.services.cpoe_service import validate_cpoe_ddi, map_prescription_to_response

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
    db: AsyncSession = Depends(get_db)
):
    if payload.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tạo mới hiện chỉ hỗ trợ lưu bản nháp; chữ ký và phát hành cần workflow tích hợp")

    validate_cpoe_ddi(payload.items)

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    order_id = payload.id or f"RX-2026-{uuid.uuid4().hex[:6].upper()}"
    signature = payload.digitalSignature if payload.status == "signed" else None

    items_dict = [it.model_dump() for it in payload.items]
    items_json = json.dumps(items_dict, ensure_ascii=False)

    prescription = CpoePrescription(
        id=order_id,
        prescription_type=payload.prescriptionType,
        patient_id=payload.patientId,
        patient_name=payload.patientName,
        patient_cccd=payload.patientCccd,
        patient_insurance_id=payload.patientInsuranceId,
        patient_weight=payload.patientWeight,
        patient_phone=payload.patientPhone,
        patient_email=payload.patientEmail,
        patient_address=payload.patientAddress,
        guardian_name=payload.guardianName,
        department=payload.department,
        patient_dob=payload.patientDob,
        patient_gender=payload.patientGender,
        diagnosis_icd10=payload.diagnosisIcd10,
        diagnosis_text=payload.diagnosisText,
        is_chronic_disease=payload.isChronicDisease,
        days_prescribed=payload.daysPrescribed,
        doctor_name=payload.doctorName,
        doctor_certificate=payload.doctorCertificate,
        prescribed_at=payload.prescribedAt or now_str,
        digital_signature=signature,
        status=payload.status,
        tt26_form_type=payload.tt26FormType,
        receiver_cccd=payload.receiverCccd,
        receiver_name=payload.receiverName,
        treatment_batch_1=payload.treatmentBatch1,
        treatment_batch_2=payload.treatmentBatch2,
        treatment_batch_3=payload.treatmentBatch3,
        facility_name=payload.facilityName,
        facility_address=payload.facilityAddress,
        facility_phone=payload.facilityPhone,
        items_json=items_json
    )
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

    return map_prescription_to_response(prescription, payload.items)
