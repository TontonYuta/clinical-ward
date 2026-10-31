"""
Unit & Integration Tests for Clinical DDI & Polypharmacy Engine (<=195 LOC)
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.clinical_ddi_engine import (
    evaluate_prescription, evaluate_pair, normalize_drug_entity,
    DdiSeverity, PatientClinicalContext
)

client = TestClient(app)

def test_hierarchical_normalizer():
    e1 = normalize_drug_entity("Plavix 75mg uống")
    assert e1.canonical_inn == "clopidogrel"
    assert "P2Y12_INHIBITOR" in e1.atc_classes
    assert e1.brand_matched == "plavix"

    e2 = normalize_drug_entity("Nexium 40mg")
    assert e2.canonical_inn == "esomeprazol"
    assert "PPI_CYP2C19" in e2.atc_classes

    e3 = normalize_drug_entity("Cordarone 200mg")
    assert e3.canonical_inn == "amiodaron"
    assert "qt_prolonging" in e3.risk_flags
    assert e3.is_p_gp_inhibitor is True

def test_brand_name_ddi_contraindication():
    # Plavix + Nexium
    alert = evaluate_pair("Plavix 75mg", "Nexium 40mg")
    assert alert is not None
    assert alert.severity == DdiSeverity.CONTRAINDICATED
    assert "CLOPIDOGREL + OMEPRAZOL" in alert.title

    # Nitromint + Viagra
    alert_nitro = evaluate_pair("Nitromint xịt", "Viagra 50mg")
    assert alert_nitro is not None
    assert alert_nitro.severity == DdiSeverity.CONTRAINDICATED

    # Rocephin + Ringer Lactat
    alert_rocephin = evaluate_pair("Rocephin 1g", "Ringer Lactat 500ml")
    assert alert_rocephin is not None
    assert alert_rocephin.severity == DdiSeverity.CONTRAINDICATED

def test_safe_synergy_multimodal():
    alert = evaluate_pair("Morphin 10mg tiêm", "Paracetamol 500mg viên")
    assert alert is not None
    assert alert.severity == DdiSeverity.SAFE_SYNERGY
    assert "HIỆP ĐỒNG GIẢM ĐAU ĐA MÔ THỨC" in alert.title

def test_official_table_3_1_catalog_lookup():
    # Cặp STT 2: Acenocoumarol + Tamoxifen
    alert_stt2 = evaluate_pair("Acenocoumarol 4mg", "Tamoxifen 20mg")
    assert alert_stt2 is not None
    assert alert_stt2.severity == DdiSeverity.CONTRAINDICATED
    assert "Bảng 3.1, STT 2" in alert_stt2.legal_evidence

    # Cặp STT 301: Domperidon + Roxithromycin
    alert_stt301 = evaluate_pair("Domperidon 10mg", "Roxithromycin 150mg")
    assert alert_stt301 is not None
    assert alert_stt301.severity == DdiSeverity.CONTRAINDICATED
    assert "Bảng 3.1, STT 301" in alert_stt301.legal_evidence

def test_patient_context_dynamic_escalation():
    # Amiodarone + Colchicine bình thường -> MAJOR
    normal_alert = evaluate_pair("Amiodaron", "Colchicin", PatientClinicalContext(egfr=90))
    assert normal_alert is not None
    assert normal_alert.severity == DdiSeverity.MAJOR
    assert normal_alert.escalated_by_patient_context is False

    # Amiodarone + Colchicine khi eGFR=25 -> Leo thang CONTRAINDICATED
    renal_alert = evaluate_pair("Amiodaron", "Colchicin", PatientClinicalContext(egfr=25))
    assert renal_alert is not None
    assert renal_alert.severity == DdiSeverity.CONTRAINDICATED
    assert renal_alert.escalated_by_patient_context is True
    assert "eGFR=25" in str(renal_alert.escalation_reason)

    # Metformin + Thuốc cản quang khi eGFR=30 -> CONTRAINDICATED
    contrast_alert = evaluate_pair("Glucophage 850mg", "Xenetix 300", PatientClinicalContext(egfr=30))
    assert contrast_alert is not None
    assert contrast_alert.severity == DdiSeverity.CONTRAINDICATED

def test_polypharmacy_cumulative_risk():
    # Kéo dài QT cộng dồn: Amiodarone + Levofloxacin + Clarithromycin
    rep_qt = evaluate_prescription(["Cordarone", "Cravit 500mg", "Klacid 500mg"])
    assert any(p.syndrome_id == "POLY_QT_PROLONGATION" for p in rep_qt.polypharmacy_alerts)

    # Triple Whammy trên thận: Enalapril + Furosemid + Diclofenac
    rep_tw = evaluate_prescription(["Renitec 10mg", "Lasix 40mg", "Voltaren 75mg"])
    assert any(p.syndrome_id == "POLY_TRIPLE_WHAMMY" for p in rep_tw.polypharmacy_alerts)

def test_clinical_ddi_api_endpoints():
    res_pair = client.post("/api/v1/clinical-ddi/check-pair", json={
        "drug_a": "Plavix 75mg", "drug_b": "Nexium 40mg"
    })
    assert res_pair.status_code == 200
    data = res_pair.json()
    assert data["has_interaction"] is True
    assert data["alert"]["severity"] == "CONTRAINDICATED"

    res_audit = client.post("/api/v1/clinical-ddi/audit", json={
        "drugs": ["Renitec", "Aldactone", "Panadol"],
        "patient_context": {"serum_potassium": 5.4, "egfr": 40}
    })
    assert res_audit.status_code == 200
    audit_data = res_audit.json()
    assert audit_data["total_drugs"] == 3
    assert audit_data["synergy_count"] >= 0
    assert audit_data["has_contraindication"] is True

def test_newly_registered_high_alert_ddis():
    # 1. Cordarone + Sovaldi -> Nhịp chậm nguy kịch
    alt_sofos = evaluate_pair("Cordarone 200mg", "Sovaldi 400mg")
    assert alt_sofos is not None
    assert alt_sofos.severity == DdiSeverity.CONTRAINDICATED
    assert "NHỊP CHẬM" in alt_sofos.title

    # 2. Paxlovid + Lipitor -> Tiêu cơ vân cấp
    alt_pax = evaluate_pair("Paxlovid", "Lipitor 20mg")
    assert alt_pax is not None
    assert alt_pax.severity == DdiSeverity.CONTRAINDICATED
    assert "TIÊU CƠ VÂN" in alt_pax.title

    # 3. Allopurinol + Imuran -> Suy tủy xương
    alt_allo = evaluate_pair("Zyloric 300mg", "Imuran 50mg")
    assert alt_allo is not None
    assert alt_allo.severity == DdiSeverity.CONTRAINDICATED
    assert "SUY TỦY" in alt_allo.title

def test_custom_rule_registration_endpoint():
    # Đăng ký tương tác mới qua API
    res = client.post("/api/v1/clinical-ddi/register-rule", json={
        "drug_a": "ThuocThuNghiemA",
        "drug_b": "ThuocThuNghiemB",
        "mechanism": "Thử nghiệm cơ chế ức chế cạnh tranh",
        "consequence": "Thử nghiệm nguy cơ ngộ độc",
        "action": "Chống chỉ định thử nghiệm",
        "evidence_source": "Quy chế Bệnh viện Đa khoa 2026"
    })
    assert res.status_code == 200
    assert res.json()["status"] == "success"

    # Kiểm tra check-pair phát hiện ngay lập tức
    chk = client.post("/api/v1/clinical-ddi/check-pair", json={
        "drug_a": "ThuocThuNghiemA 100mg",
        "drug_b": "ThuocThuNghiemB 50mg"
    })
    assert chk.status_code == 200
    assert chk.json()["has_interaction"] is True
    assert "Thử nghiệm" in chk.json()["alert"]["mechanism"]
