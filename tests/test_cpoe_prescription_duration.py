import pytest
from pydantic import ValidationError
from app.schemas.cpoe import CpoeOrderCreate


def payload(**overrides):
    data = {
        "prescriptionType": "outpatient", "patientId": "BN-1",
        "patientName": "Nguyễn A", "patientCccd": "012345678901",
        "department": "Khám bệnh", "diagnosisIcd10": "I10",
        "diagnosisText": "Tăng huyết áp", "doctorName": "BS A",
        "items": [{"id": "i1", "medicationName": "Thuốc A",
                    "activeIngredient": "A", "dosage": "1 viên",
                    "frequency": "1 lần/ngày", "route": "Uống",
                    "quantity": 30, "unit": "Viên", "instructions": "Sau ăn"}],
    }
    data.update(overrides)
    return data


def test_outpatient_duration_defaults_to_30_days():
    assert CpoeOrderCreate(**payload()).daysPrescribed == 30


def test_outpatient_duration_over_30_requires_chronic_appendix_flag():
    with pytest.raises(ValidationError):
        CpoeOrderCreate(**payload(daysPrescribed=31))


def test_chronic_outpatient_duration_allows_up_to_90_days():
    assert CpoeOrderCreate(**payload(daysPrescribed=90, isChronicDisease=True)).daysPrescribed == 90
    with pytest.raises(ValidationError):
        CpoeOrderCreate(**payload(daysPrescribed=91, isChronicDisease=True))


def test_inpatient_daily_order_requires_one_day():
    data = payload(prescriptionType="inpatient_daily", daysPrescribed=1)
    assert CpoeOrderCreate(**data).daysPrescribed == 1
    with pytest.raises(ValidationError):
        CpoeOrderCreate(**payload(prescriptionType="inpatient_daily", daysPrescribed=7))
