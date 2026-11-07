import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_bhyt_catalog_endpoint():
    res = client.get("/api/v1/bhyt/catalog?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "total" in data
    assert data["total"] >= 100
    assert len(data["items"]) <= 10

def test_bhyt_catalog_filter_by_query():
    res = client.get("/api/v1/bhyt/catalog?q=Meropenem")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    found = any("Meropenem" in item["active_ingredient"] for item in data["items"])
    assert found is True

def test_bhyt_catalog_filter_by_rank():
    # Hạng IV (Trạm y tế xã) có ít thuốc hơn Hạng Đặc biệt
    res_iv = client.get("/api/v1/bhyt/catalog?rank=HANG_IV")
    assert res_iv.status_code == 200
    data_iv = res_iv.json()

    res_all = client.get("/api/v1/bhyt/catalog?rank=ALL")
    assert res_all.status_code == 200
    data_all = res_all.json()

    assert data_iv["total"] < data_all["total"]

def test_bhyt_audit_rank_mismatch_and_duplication():
    payload = {
        "prescription_id": "RX-TEST-MERO-PPI",
        "patient_name": "Nguyễn Văn Test",
        "patient_age": 60,
        "insurance_card_number": "GD4790123456789",
        "hospital_rank": "HANG_III",  # Huyện không được kê Meropenem
        "treatment_type": "NGOAI_TRU",
        "primary_icd10": "K21",
        "primary_diagnosis": "Trào ngược dạ dày",
        "items": [
            {
                "id": "i1",
                "drug_name": "Nexium 40mg",
                "active_ingredient": "Esomeprazol",
                "dosage": "40mg",
                "quantity": 14,
                "days_supply": 14,
                "unit_price": 24500
            },
            {
                "id": "i2",
                "drug_name": "Omeprazol 20mg",
                "active_ingredient": "Omeprazol",
                "dosage": "20mg",
                "quantity": 14,
                "days_supply": 14,
                "unit_price": 3500
            },
            {
                "id": "i3",
                "drug_name": "Meronem 1g",
                "active_ingredient": "Meropenem",
                "dosage": "1g",
                "quantity": 4,
                "days_supply": 2,
                "unit_price": 420000,
                "has_consultation_form": False
            }
        ]
    }
    res = client.post("/api/v1/bhyt/audit", json=payload)
    assert res.status_code == 200
    report = res.json()
    assert report["status"] == "REJECT"
    assert report["at_risk_cost_vnd"] > 0
    categories = [v["category"] for v in report["violations"]]
    assert "HOSPITAL_RANK_MISMATCH" in categories
    assert "THERAPEUTIC_DUPLICATION" in categories
    assert "MISSING_CONSULTATION_FORM" in categories

def test_bhyt_audit_clean_prescription():
    payload = {
        "prescription_id": "RX-CLEAN",
        "patient_name": "Lê Văn Hợp Lệ",
        "patient_age": 45,
        "insurance_card_number": "DN4791112223334",
        "hospital_rank": "HANG_I",
        "treatment_type": "NGOAI_TRU",
        "primary_icd10": "I10",
        "primary_diagnosis": "Tăng huyết áp",
        "items": [
            {
                "id": "c1",
                "drug_name": "Amlodipin 5mg",
                "active_ingredient": "Amlodipin",
                "dosage": "5mg",
                "quantity": 30,
                "days_supply": 30,
                "unit_price": 1200
            }
        ]
    }
    res = client.post("/api/v1/bhyt/audit", json=payload)
    assert res.status_code == 200
    report = res.json()
    assert report["status"] == "PASS"
    assert report["at_risk_cost_vnd"] == 0
    assert len(report["violations"]) == 0

def test_bhyt_audit_logs_retrieval():
    res = client.get("/api/v1/bhyt/logs?limit=5")
    assert res.status_code == 200
    logs = res.json()
    assert isinstance(logs, list)
    assert len(logs) >= 1
    assert "prescription_id" in logs[0]
