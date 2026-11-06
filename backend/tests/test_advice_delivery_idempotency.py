import asyncio
import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.database import Base
from app.routers import prescription_advice as advice


@pytest_asyncio.fixture
async def sessions(tmp_path):
    engine=create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "delivery.sqlite"}')
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory=async_sessionmaker(engine,expire_on_commit=False)
    yield factory
    await engine.dispose()


def payload(**updates):
    return advice.PatientPrescriptionAdviceModel(id='ADVICE',patientId='P1',patientName='Test',patientEmail='test@example.invalid',patientPhone='0910000000',generalDoctorAdvice='Original',**updates)


@pytest.mark.asyncio
async def test_partial_retry_does_not_send_successful_channel_twice(sessions,monkeypatch):
    calls=[]
    async def email(p,channels,**kw): calls.append('email');channels.append('email')
    async def sms(p,db,channels): calls.append('sms');raise HTTPException(503,'SMS not configured')
    monkeypatch.setattr(advice,'dispatch_email_notification',email)
    monkeypatch.setattr(advice,'dispatch_sms_notification',sms)
    for _ in range(2):
        async with sessions() as db:
            with pytest.raises(HTTPException): await advice.send_medication_advice_email(payload(sendSms=True),db)
    assert calls.count('email')==1
    assert calls.count('sms')==2


@pytest.mark.asyncio
async def test_concurrent_identical_requests_dispatch_only_once(sessions,monkeypatch):
    calls=[]
    async def email(p,channels,**kw):
        calls.append('email');await asyncio.sleep(.05);channels.append('email')
    monkeypatch.setattr(advice,'dispatch_email_notification',email)
    async def send():
        async with sessions() as db: return await advice.send_medication_advice_email(payload(),db)
    outcomes=await asyncio.gather(send(),send(),return_exceptions=True)
    assert len(calls)==1
    assert any(not isinstance(value,Exception) for value in outcomes)


@pytest.mark.asyncio
async def test_unknown_delivery_outcome_is_not_automatically_retried(sessions,monkeypatch):
    calls=[]
    async def email(p,channels,**kw): calls.append('email');raise HTTPException(502,'Provider connection lost')
    monkeypatch.setattr(advice,'dispatch_email_notification',email)
    for _ in range(2):
        async with sessions() as db:
            with pytest.raises(HTTPException): await advice.send_medication_advice_email(payload(),db)
    assert len(calls)==1


@pytest.mark.asyncio
async def test_fixing_sms_destination_does_not_repeat_successful_email(sessions,monkeypatch):
    calls=[]
    async def email(p,channels,**kw): calls.append('email');channels.append('email')
    async def sms(p,db,channels):
        calls.append('sms')
        if p.patient_phone=='0910000000': raise HTTPException(503,'SMS failed')
        channels.append('sms')
    monkeypatch.setattr(advice,'dispatch_email_notification',email)
    monkeypatch.setattr(advice,'dispatch_sms_notification',sms)
    async with sessions() as db:
        with pytest.raises(HTTPException): await advice.send_medication_advice_email(payload(sendSms=True),db)
    fixed=payload(sendSms=True).model_copy(update={'patient_phone':'0980000000'})
    async with sessions() as db: await advice.send_medication_advice_email(fixed,db)
    assert calls==['email','sms','sms']


@pytest.mark.asyncio
async def test_email_change_does_not_repeat_identical_successful_sms(sessions,monkeypatch):
    calls=[]
    async def email(p,channels,**kw): calls.append('email');channels.append('email')
    async def sms(p,db,channels): calls.append('sms');channels.append('sms')
    monkeypatch.setattr(advice,'dispatch_email_notification',email)
    monkeypatch.setattr(advice,'dispatch_sms_notification',sms)
    async with sessions() as db: await advice.send_medication_advice_email(payload(sendEmail=False,sendSms=True),db)
    changed=payload(sendSms=True).model_copy(update={'patient_email':'updated@example.invalid'})
    async with sessions() as db: await advice.send_medication_advice_email(changed,db)
    assert calls==['sms','email']

@pytest.mark.asyncio
async def test_missing_advice_source_does_not_invent_hospital_doctor_or_diagnosis(sessions):
    from app.models.patient import PrescriptionAdviceRecord
    p=advice.PatientPrescriptionAdviceModel(id='BLANK',patientId='P1',patientName='Test',patientEmail='test@example.invalid')
    med=advice.ScheduledMedicationModel(medicationName='Source medication')
    assert med.dosage=='' and med.route=='' and med.duration_days==0 and med.time_slots==[]
    slot=advice.MedicationTimeSlotModel()
    assert not slot.time and not slot.dosage_text and not slot.meal_relation
    assert not p.doctor_hospital and not p.doctor_name and not p.department and not p.diagnosis
    async with sessions() as db:
        await advice.save_prescription_advice(p,db)
        record=await db.get(PrescriptionAdviceRecord,'BLANK')
        assert record is not None
        assert not record.doctor_hospital and not record.doctor_name and not record.department and not record.diagnosis
