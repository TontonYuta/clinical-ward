import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.database import AsyncSessionLocal
from app.models.registry import DavNationalDrug
from app.models.registry import ClinicalDrugMonograph
from sqlalchemy import select

@pytest.mark.asyncio
async def test_clinical_drug_enrichment_and_empty_handling():
    from app.seed_registry import seed_dav_registry_if_needed
    seed_dav_registry_if_needed()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with AsyncSessionLocal() as session:
            # 1. Enriched drug (Paracetamol)
            para_stmt = select(DavNationalDrug).where(
                DavNationalDrug.active_ingredient.like('%Paracetamol%'),
                DavNationalDrug.clinical_monograph_id.is_not(None),
            ).limit(1)
            para_drug = (await session.execute(para_stmt)).scalar_one()
            para_monograph = (await session.execute(
                select(ClinicalDrugMonograph).where(ClinicalDrugMonograph.inn == "Paracetamol")
            )).scalar_one()
            import json
            section_pages = json.loads(para_monograph.section_pages or "{}")
            assert section_pages["drug_interactions"]["page"] == 1120
            from app.services.copilot_drug_citation_helper import build_drug_citation
            interaction_citation = build_drug_citation(
                para_drug, para_monograph, para_monograph.source, target_field="drug_interactions"
            )
            assert interaction_citation["page"] == 1120
            assert "#page=1120" in interaction_citation["url"]
            interaction_evidence = " ".join(section_pages["drug_interactions"]["evidence"]).casefold()
            assert "isoniazid" in interaction_evidence
            assert "paracetamol" in interaction_evidence
            assert "parafin lỏng" not in interaction_evidence
            
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

def test_curated_registry_seed_refreshes_exact_clinical_records(tmp_path):
    import sqlite3
    from app.seed_registry import seed_dav_registry_if_needed

    db_path = tmp_path / "clinical.db"
    seed_dav_registry_if_needed(str(db_path))
    conn = sqlite3.connect(db_path)
    try:
        row = conn.execute(
            "SELECT indications, adult_dosage, antidote, clinical_monograph_id FROM dav_national_drugs WHERE national_code = ?",
            ("893110151100",),
        ).fetchone()
        assert row and "phản vệ" in row[0].lower()
        assert row[1] and "tiêm bắp" in row[1].lower()
        assert row[2] and "Phentolamin" in row[2]
        assert row[3] == "DTQG-2015-Adrenalin"
    finally:
        conn.close()
