from app.schemas.cpoe import CpoeItemSchema, CpoeOrderCreate

def test_draft_does_not_require_fabricated_patient_and_signature_defaults():
    payload = CpoeOrderCreate(
        prescriptionType='outpatient', patientId='', patientName='Nguyen Van A', patientCccd='',
        diagnosisIcd10='', diagnosisText='Viem hong', isChronicDisease=False, daysPrescribed=5,
        doctorName='BS Test', items=[CpoeItemSchema(id='1', medicationName='A', activeIngredient='', dosage='1', frequency='1/ngay', route='Uong', quantity=2, unit='vien', instructions='')],
    )
    assert payload.patientDob == ''
    assert payload.patientGender == ''
    assert payload.doctorCertificate == ''
    assert payload.status == 'draft'
    assert payload.digitalSignature is None

def test_signed_status_without_signature_is_rejected():
    import pytest
    with pytest.raises(ValueError):
        CpoeOrderCreate(
            prescriptionType='outpatient', patientId='', patientName='Nguyen Van A', patientCccd='',
            diagnosisIcd10='', diagnosisText='Viem hong', isChronicDisease=False, daysPrescribed=5,
            doctorName='BS Test', status='signed', items=[CpoeItemSchema(id='1', medicationName='A', activeIngredient='', dosage='1', frequency='1/ngay', route='Uong', quantity=2, unit='vien', instructions='')],
        )
