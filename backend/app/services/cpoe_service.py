from fastapi import HTTPException, status
from app.schemas.cpoe import CpoeOrderResponse
from app.models.cpoe import CpoePrescription
from app.services.clinical_ddi_engine import evaluate_prescription

def validate_cpoe_ddi(items) -> None:
    ddi_report = evaluate_prescription([item.activeIngredient or item.medicationName for item in items])
    if not ddi_report.has_contraindication:
        return

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

def map_prescription_to_response(prescription: CpoePrescription, items) -> CpoeOrderResponse:
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
        tt26FormType=prescription.tt26_form_type,
        receiverCccd=prescription.receiver_cccd,
        receiverName=prescription.receiver_name,
        treatmentBatch1=prescription.treatment_batch_1,
        treatmentBatch2=prescription.treatment_batch_2,
        treatmentBatch3=prescription.treatment_batch_3,
        facilityName=prescription.facility_name,
        facilityAddress=prescription.facility_address,
        facilityPhone=prescription.facility_phone,
        items=items,
        createdAt=prescription.created_at
    )
