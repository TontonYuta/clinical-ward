"""Isolated regressions: patient identity, truthful delivery and audit integrity."""
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.database import Base, get_db
from app.models.patient import PatientProfile
from app.routers import patients, sms
from app.services.audit_service import record_audit_event, verify_ledger_integrity


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:')
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as session:
        yield session
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db):
    app = FastAPI()
    app.include_router(patients.router, prefix='/api/v1')
    app.include_router(sms.router, prefix='/api/v1')
    async def override_db():
        yield db
    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://test') as value:
        yield value


@pytest.mark.asyncio
async def test_patient_detail_never_resolves_wildcard_or_ambiguous_name(client, db):
    db.add_all([PatientProfile(id='P1', full_name='Nguyen Van A', email='a@example.test'),
                PatientProfile(id='P2', full_name='Nguyen Van Anh', email='b@example.test')])
    await db.commit()
    assert (await client.get('/api/v1/patients/P1')).json()['id'] == 'P1'
    assert (await client.get('/api/v1/patients/Nguyen%20Van%20A')).json()['id'] == 'P1'
    for query in ('%25', '_', 'Nguyen'):
        assert (await client.get('/api/v1/patients/' + query)).status_code == 404


@pytest.mark.asyncio
async def test_duplicate_exact_name_requires_explicit_patient_id(client, db):
    db.add_all([PatientProfile(id='P1', full_name='Same Name', email='a@example.test'),
                PatientProfile(id='P2', full_name='Same Name', email='b@example.test')])
    await db.commit()
    assert (await client.get('/api/v1/patients/Same%20Name')).status_code == 409


def message(provider):
    return dict(recipientPhone='0912345678', patientId='P1', patientName='Demo',
                content='Test only', provider=provider)


@pytest.mark.asyncio
@pytest.mark.parametrize('provider', ['esms', 'twilio', 'speedsms'])
async def test_unconfigured_or_unsupported_sms_never_claims_delivery(client, monkeypatch, provider):
    for name in ('ESMS_API_KEY', 'ESMS_SECRET_KEY'):
        monkeypatch.delenv(name, raising=False)
    response = await client.post('/api/v1/sms/send', json=message(provider))
    assert response.status_code in (400, 501, 503)


@pytest.mark.asyncio
async def test_sandbox_sms_is_explicitly_simulated(client):
    response = await client.post('/api/v1/sms/send', json=message('sandbox'))
    assert response.status_code == 201
    assert response.json()['status'] == 'simulated'


async def event(db):
    return await record_audit_event(db, 'TEST', 'Original title', 'Target', 'Demo', 'Signer', 'CERT')


@pytest.mark.asyncio
async def test_rapid_audit_events_form_one_valid_chain(db):
    records = [await event(db) for _ in range(4)]
    assert len({record.id for record in records}) == 4
    assert records[2].previous_hash == records[1].integrity_hash
    assert (await verify_ledger_integrity(db))['is_valid'] is True


@pytest.mark.asyncio
async def test_audit_detects_changed_action_title(db):
    record = await event(db)
    record.action_title = 'Tampered title'
    await db.commit()
    assert (await verify_ledger_integrity(db))['is_valid'] is False


def test_advice_requires_explicit_patient_identity():
    from pydantic import ValidationError
    from app.routers.prescription_advice import PatientPrescriptionAdviceModel
    with pytest.raises(ValidationError):
        PatientPrescriptionAdviceModel(id='ADV1', patientName='Other', patientEmail='x@example.test')


@pytest.mark.asyncio
async def test_advice_id_cannot_be_reassigned_to_another_patient(db):
    from fastapi import HTTPException
    from app.routers.prescription_advice import PatientPrescriptionAdviceModel, save_prescription_advice
    original = PatientPrescriptionAdviceModel(id='ADV1', patientId='P1', patientName='First', patientEmail='a@example.test')
    await save_prescription_advice(original, db)
    other = original.model_copy(update={'patient_id':'P2', 'patient_name':'Second'})
    with pytest.raises(HTTPException) as error:
        await save_prescription_advice(other, db)
    assert error.value.status_code == 409


@pytest.mark.asyncio
async def test_advice_updates_all_document_fields(db):
    from app.routers.prescription_advice import PatientPrescriptionAdviceModel, save_prescription_advice
    from app.models.patient import PrescriptionAdviceRecord
    original = PatientPrescriptionAdviceModel(id='ADV2', patientId='P1', patientName='First', patientEmail='a@example.test', startDate='2026-01-01')
    await save_prescription_advice(original, db)
    updated = original.model_copy(update={'start_date':'2026-11-05', 'prescription_id':'RX2', 'department':'New'})
    await save_prescription_advice(updated, db)
    record = await db.get(PrescriptionAdviceRecord, 'ADV2')
    assert record.start_date == '2026-11-05'
    assert record.prescription_id == 'RX2'
    assert record.department == 'New'


@pytest.mark.asyncio
async def test_patient_demographic_update_preserves_omitted_safety_history(client, db):
    db.add(PatientProfile(id='P1', full_name='Person', email='a@example.test', allergies='Penicillin', egfr=25, weight_kg=48))
    await db.commit()
    response = await client.post('/api/v1/patients', json=dict(id='P1', fullName='Updated Person', email='b@example.test'))
    assert response.status_code == 201
    record = await db.get(PatientProfile, 'P1')
    assert record.allergies == 'Penicillin'
    assert record.egfr == 25
    assert record.weight_kg == 48


@pytest.mark.asyncio
async def test_concurrent_audit_appends_do_not_fork(tmp_path):
    import asyncio
    engine = create_async_engine(f'sqlite+aiosqlite:///{tmp_path / "ledger.db"}')
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async def append():
        async with sessions() as session:
            return await event(session)
    try:
        await asyncio.gather(*(append() for _ in range(6)))
        async with sessions() as session:
            result = await verify_ledger_integrity(session)
        assert result['is_valid'], result
        assert result['total_records'] == 6
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_advice_send_checks_identity_before_contacting_provider(db, monkeypatch):
    from app.routers import prescription_advice as advice
    from fastapi import HTTPException
    original = advice.PatientPrescriptionAdviceModel(id='ADV1', patientId='P1', patientName='First', patientEmail='a@example.test')
    await advice.save_prescription_advice(original, db)
    calls = []
    async def fake_provider(*args, **kwargs):
        calls.append(True)
        args[1].append('test')
    monkeypatch.setattr(advice, 'dispatch_email_notification', fake_provider)
    other = original.model_copy(update={'patient_id':'P2', 'patient_name':'Second'})
    with pytest.raises(HTTPException) as error:
        await advice.send_medication_advice_email(other, db)
    assert error.value.status_code == 409
    assert calls == []
