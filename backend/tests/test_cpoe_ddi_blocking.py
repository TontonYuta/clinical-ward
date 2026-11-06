import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app
from app.database import AsyncSessionLocal
from app.models.cpoe import CpoePrescription
from app.database import engine, Base
from app.models import cpoe as _cpoe_model

@pytest_asyncio.fixture(autouse=True, scope="module")
async def ensure_cpoe_test_schema():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def payload(items):
    return {
        "prescriptionType": "outpatient", "patientId": "", "patientName": "Nguyễn Văn Test",
        "patientCccd": "012345678901", "diagnosisIcd10": "I25", "diagnosisText": "Bệnh mạch vành",
        "doctorName": "BS. Test", "daysPrescribed": 3, "status": "draft", "items": items,
    }


def item(name, ingredient):
    return {"id": name, "medicationName": name, "activeIngredient": ingredient,
            "dosage": "1 viên", "frequency": "1 lần/ngày", "route": "Uống",
            "quantity": 3, "unit": "Viên", "instructions": "Sau ăn", "durationDays": 3}


@pytest.mark.asyncio
async def test_cpoe_rejects_contraindicated_pair_before_persisting():
    order_id = "RX-DDI-BLOCK-TEST"
    request_payload = payload([item("Plavix", "clopidogrel"), item("Losec", "omeprazol")])
    request_payload["id"] = order_id
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/cpoe", json=request_payload)
    assert response.status_code == 409
    assert response.json()["detail"]["source_status"] == "contraindicated_pair"
    assert "CLOPIDOGREL" in response.json()["detail"]["pair_alerts"][0]["title"]
    async with AsyncSessionLocal() as db:
        persisted = await db.get(CpoePrescription, order_id)
    assert persisted is None


@pytest.mark.asyncio
async def test_cpoe_accepts_multi_drug_draft_without_contraindicated_pair():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/cpoe", json=payload([
            item("Paracetamol", "paracetamol"), item("Amoxicillin", "amoxicillin")
        ]))
    assert response.status_code == 201
    assert len(response.json()["items"]) == 2
