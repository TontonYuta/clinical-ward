import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models.registry import DavNationalDrug
from sqlalchemy import select

@pytest.mark.asyncio
async def test_clinical_drug_enrichment_and_empty_handling():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with AsyncSessionLocal() as session:
            # 1. Enriched drug (Paracetamol)
            para_stmt = select(DavNationalDrug).where(DavNationalDrug.active_ingredient.like('%Paracetamol%')).limit(1)
            para_drug = (await session.execute(para_stmt)).scalar_one()
            
            # 2. Unmatched herbal drug
            herbal_stmt = select(DavNationalDrug).where(DavNationalDrug.active_ingredient.like('%Cao đặc Nấm linh chi%')).limit(1)
            herbal_drug = (await session.execute(herbal_stmt)).scalar_one_or_none()

        # Test enriched drug endpoint (ensuring 100% complete clinical data)
        res_para = await client.get(f"/api/v1/registry/{para_drug.national_code}")
        assert res_para.status_code == 200
        data_para = res_para.json()
        assert data_para["atc_code"] is not None
        assert "N02BE01" in data_para["atc_code"]
        assert data_para["indications"] is not None
        assert len(data_para["indications"]) > 50
        assert data_para["contraindications"] is not None
        assert "quá mẫn" in data_para["contraindications"].lower()
        assert data_para["adult_dosage"] is not None
        assert data_para["pediatric_dosage"] is not None
        assert "mg/kg" in data_para["pediatric_dosage"]
        assert data_para["renal_adjustment"] is not None
        assert data_para["hepatic_adjustment"] is not None
        assert data_para["pregnancy_warning"] is not None
        assert data_para["precautions"] is not None
        assert data_para["adverse_effects"] is not None
        assert data_para["drug_interactions"] is not None
        assert "Dược thư Quốc gia Việt Nam" in data_para["clinical_source"]

        # Test unmatched herbal drug endpoint (must safely be None / empty)
        if herbal_drug:
            res_herbal = await client.get(f"/api/v1/registry/{herbal_drug.national_code}")
            assert res_herbal.status_code == 200
            data_herbal = res_herbal.json()
            assert data_herbal["contraindications"] is None
            assert data_herbal["adult_dosage"] is None
            assert data_herbal["clinical_source"] is None

        # Test standalone monograph endpoint
        res_mono = await client.get("/api/v1/registry/monograph/Paracetamol")
        assert res_mono.status_code == 200
        mono_data = res_mono.json()
        assert mono_data["inn"] == "Paracetamol"
        assert "Giảm đau" in mono_data["drug_class"]
