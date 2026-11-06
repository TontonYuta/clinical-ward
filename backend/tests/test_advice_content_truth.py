import pytest
from email import message_from_string
from fastapi import HTTPException
from app.routers.prescription_advice import PatientPrescriptionAdviceModel
from app.services import advice_notifier

@pytest.mark.asyncio
async def test_smtp_keeps_full_explicit_regimen_and_no_fabricated_facility(monkeypatch):
    import smtplib
    sent=[]
    class SMTP:
        def __init__(self,*args,**kwargs): pass
        def starttls(self): pass
        def login(self,*args): pass
        def sendmail(self,sender,recipients,message): sent.append(message)
        def quit(self): pass
    monkeypatch.setattr(smtplib,'SMTP',SMTP)
    monkeypatch.setenv('GAS_WEBHOOK_URL','')
    monkeypatch.setenv('SMTP_USER','local@example.invalid')
    monkeypatch.setenv('SMTP_PASSWORD','synthetic')
    p=PatientPrescriptionAdviceModel(id='A',patientId='P',patientName='Test patient',patientEmail='test@example.invalid',medications=[{'medicationName':'Source medicine','dosage':'1.5 mL','route':'Hít','frequency':'3 lần/ngày','durationDays':5,'specialInstructions':'Lời dặn nguồn','timeSlots':[{'id':'morning','label':'Sáng','time':'09:35','dosageText':'1.5 mL','note':'SLOT-NOTE'}]}])
    channels=[]
    await advice_notifier.dispatch_email_notification(p,channels)
    msg=message_from_string(sent[0]);body=msg.get_payload()[0].get_payload(decode=True).decode('utf-8')
    for text in ['Source medicine','1.5 mL','Hít','3 lần/ngày','5 ngày','Lời dặn nguồn','SLOT-NOTE','09:35']:
        assert text in body
    assert 'Lâm Sàng' not in body and 'Bệnh Viện' not in msg['From']
    assert channels==['smtp']


def test_advice_sms_uses_source_reference_without_invented_hospital_or_signed_claim():
    p=PatientPrescriptionAdviceModel(id='A',patientId='P',patientName='Test patient',patientEmail='test@example.invalid')
    body=advice_notifier.build_advice_sms_content(p)
    assert 'BV LAM SANG' not in body and 'BS da cap nhat' not in body
    assert 'A' in body and 'Test patient' in body

@pytest.mark.asyncio
async def test_advice_esms_requires_registered_brand_before_provider(monkeypatch):
    for key in ['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','ESMS_BRANDNAME']:
        monkeypatch.delenv(key,raising=False)
    monkeypatch.setenv('ESMS_API_KEY','synthetic');monkeypatch.setenv('ESMS_SECRET_KEY','synthetic');monkeypatch.setenv('ESMS_SANDBOX','0')
    class NeverClient:
        def __init__(self,*args,**kwargs): raise AssertionError('Missing brand must be rejected before provider')
    monkeypatch.setattr(advice_notifier.httpx,'AsyncClient',NeverClient)
    p=PatientPrescriptionAdviceModel(id='A',patientId='P',patientName='Test',patientEmail='',patientPhone='0910000000')
    with pytest.raises(HTTPException) as e:
        await advice_notifier.dispatch_sms_notification(p,None,[])
    assert e.value.status_code==503
