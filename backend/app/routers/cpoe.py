import json
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.cpoe import CpoePrescription
from app.schemas.cpoe import CpoeOrderCreate, CpoeOrderResponse, CpoeItemSchema
from app.services.audit_service import record_audit_event
from app.services.clinical_ddi_engine import evaluate_prescription

router = APIRouter(prefix="/cpoe", tags=["Chỉ Định & Kê Đơn CPOE (TT 26/2025/TT-BYT)"])

@router.get("", response_model=list[CpoeOrderResponse])
async def get_cpoe_orders(
    prescription_type: str | None = Query(None, description="outpatient hoặc inpatient_daily"),
    search: str | None = Query(None, description="Tìm tên bệnh nhân hoặc mã đơn"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CpoePrescription).order_by(CpoePrescription.created_at.desc())
    res = await db.execute(stmt)
    records = res.scalars().all()

    orders: list[CpoeOrderResponse] = []
    for r in records:
        if prescription_type and r.prescription_type != prescription_type:
            continue
        if search:
            q = search.lower()
            if q not in r.patient_name.lower() and q not in r.id.lower() and q not in r.diagnosis_icd10.lower():
                continue

        try:
            items_raw = json.loads(r.items_json)
            items = [CpoeItemSchema(**it) for it in items_raw]
        except Exception:
            items = []

        orders.append(
            CpoeOrderResponse(
                id=r.id,
                prescriptionType=r.prescription_type,
                patientId=r.patient_id,
                patientName=r.patient_name,
                patientCccd=r.patient_cccd,
                patientInsuranceId=getattr(r, "patient_insurance_id", None),
                patientWeight=getattr(r, "patient_weight", None),
                patientPhone=getattr(r, "patient_phone", None),
                patientEmail=getattr(r, "patient_email", None),
                patientAddress=getattr(r, "patient_address", None),
                guardianName=getattr(r, "guardian_name", None),
                patientDob=getattr(r, "patient_dob", None),
                patientGender=getattr(r, "patient_gender", None),
                department=getattr(r, "department", None),
                diagnosisIcd10=r.diagnosis_icd10,
                diagnosisText=r.diagnosis_text,
                isChronicDisease=r.is_chronic_disease,
                daysPrescribed=r.days_prescribed,
                doctorName=r.doctor_name,
                doctorCertificate=r.doctor_certificate,
                prescribedAt=r.prescribed_at,
                digitalSignature=r.digital_signature,
                status=r.status,
                items=items,
                createdAt=r.created_at
            )
        )
    return orders

@router.post("", response_model=CpoeOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_cpoe_order(
    payload: CpoeOrderCreate,
    db: AsyncSession = Depends(get_db)
):
    if payload.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tạo mới hiện chỉ hỗ trợ lưu bản nháp; chữ ký và phát hành cần workflow tích hợp")

    ddi_report = evaluate_prescription([item.activeIngredient or item.medicationName for item in payload.items])
    if ddi_report.has_contraindication:
        pair_alerts = [
            {
                "severity": alert.severity.value,
                "title": alert.title,
                "drug_a": alert.drug_a,
                "drug_b": alert.drug_b,
                "mechanism": alert.mechanism,
                "consequence": alert.clinical_consequence,
                "action": alert.action_recommendation,
                "source": alert.legal_evidence,
            }
            for alert in ddi_report.pair_alerts
            if alert.severity.value == "CONTRAINDICATED"
        ]
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CPOE_CONTRAINDICATED_DDI",
                "source_status": "contraindicated_pair",
                "message": "Không thể lưu đơn nháp vì phát hiện cặp thuốc chống chỉ định. Điều chỉnh danh sách thuốc và rà soát lại.",
                "pair_alerts": pair_alerts,
            },
        )

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

    return CpoeOrderResponse(
        id=prescription.id,
        prescriptionType=prescription.prescription_type,
        patientId=prescription.patient_id,
        patientName=prescription.patient_name,
        patientCccd=prescription.patient_cccd,
        patientInsuranceId=prescription.patient_insurance_id,
        patientWeight=prescription.patient_weight,
        patientPhone=prescription.patient_phone,
        patientEmail=prescription.patient_email,
        patientAddress=prescription.patient_address,
        guardianName=prescription.guardian_name,
        patientDob=prescription.patient_dob,
        patientGender=prescription.patient_gender,
        department=prescription.department,
        diagnosisIcd10=prescription.diagnosis_icd10,
        diagnosisText=prescription.diagnosis_text,
        isChronicDisease=prescription.is_chronic_disease,
        daysPrescribed=prescription.days_prescribed,
        doctorName=prescription.doctor_name,
        doctorCertificate=prescription.doctor_certificate,
        prescribedAt=prescription.prescribed_at,
        digitalSignature=prescription.digital_signature,
        status=prescription.status,
        items=payload.items,
        createdAt=prescription.created_at
    )
