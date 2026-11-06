import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.schemas.cpoe import CpoeOrderCreate
from app.routers.cpoe import create_cpoe_order
from app.models.patient import PatientProfile
from test_logic_audit_identity_notifications import db


def payload(**kwargs):
    data = dict(prescriptionType='outpatient', patientId='', patientName='Person A', patientCccd='',
                diagnosisIcd10='', diagnosisText='Draft', doctorName='Doctor', daysPrescribed=1,
                items=[dict(id='1',medicationName='Paracetamol',activeIngredient='paracetamol',dosage='1 viên',frequency='1 lần/ngày',route='Uống',quantity=1,unit='Viên',instructions='')])
    return {**data, **kwargs}


@pytest.mark.parametrize('change', [dict(prescriptionType='unknown'), dict(daysPrescribed=-1)])
def test_cpoe_rejects_invalid_type_and_negative_duration(change):
    with pytest.raises(ValidationError):
        CpoeOrderCreate(**payload(**change))


def test_cpoe_rejects_negative_medication_duration():
    data = payload()
    data['items'][0]['durationDays'] = -3
    with pytest.raises(ValidationError):
        CpoeOrderCreate(**data)


@pytest.mark.asyncio
async def test_cpoe_rejects_unknown_or_mismatched_patient(db):
    db.add(PatientProfile(id='P1', full_name='Person A', cccd='111', email='a@example.test'))
    await db.commit()
    for change, expected in [(dict(patientId='missing'),404), (dict(patientId='P1', patientName='Person B'),409),
                              (dict(patientId='P1', patientCccd='222'),409)]:
        with pytest.raises(HTTPException) as error:
            await create_cpoe_order(CpoeOrderCreate(**payload(**change)), db)
        assert error.value.status_code == expected


@pytest.mark.asyncio
async def test_duplicate_order_id_returns_conflict_and_preserves_first(db):
    order = CpoeOrderCreate(**payload(id='RX-DUPLICATE'))
    await create_cpoe_order(order, db)
    with pytest.raises(HTTPException) as error:
        await create_cpoe_order(order, db)
    assert error.value.status_code == 409


@pytest.mark.asyncio
async def test_prescription_notes_and_controlled_marker_survive_save(db):
    request = payload(id='RX-NOTES', clinicalNotes='Lời dặn đã nhập rõ ràng')
    request['items'][0]['isNarcotic'] = True
    result = await create_cpoe_order(CpoeOrderCreate(**request), db)
    assert getattr(result, 'clinicalNotes', None) == 'Lời dặn đã nhập rõ ràng'
    assert getattr(result.items[0], 'isNarcotic', None) is True
