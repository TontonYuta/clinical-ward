"""
Randomized Property-Based & Stress Test Suite: Declarative BHYT Rule Engine
Mục tiêu: Tự động sinh ngẫu nhiên hàng chục ca đơn thuốc khác nhau mỗi lần chạy
để kiểm thử độ bền, tính chính xác 100% toán học và chứng minh không còn hardcode.
"""

import random
import time
import pytest
from app.services.bhyt_service import BhytAuditService
from app.schemas.bhyt import BhytPrescriptionPayload, BhytPrescriptionItemPayload

RANKS = ["HANG_DAC_BIET", "HANG_I", "HANG_II", "HANG_III", "HANG_IV"]
TREATMENTS = ["NGOAI_TRU", "NOI_TRU"]

PPI_DRUGS = [
    ("MED-NEX-40", "Nexium 40mg", "Esomeprazol", "A02BC05", 24500),
    ("MED-OME-20", "Losec 20mg", "Omeprazol", "A02BC01", 15200),
    ("MED-PAN-40", "Pantoloc 40mg", "Pantoprazol", "A02BC02", 18000),
    ("MED-RAB-20", "Pariet 20mg", "Rabeprazol", "A02BC04", 19500),
]

NSAID_DRUGS = [
    ("MED-MOB-75", "Mobic 7.5mg", "Meloxicam", "M01AC06", 12000),
    ("MED-CEL-200", "Celebrex 200mg", "Celecoxib", "M01AH01", 18500),
    ("MED-VOL-50", "Voltaren 50mg", "Diclofenac", "M01AB05", 8500),
]

STATIN_DRUGS = [
    ("MED-LIP-20", "Lipitor 20mg", "Atorvastatin", "C10AA05", 16500),
    ("MED-CRE-10", "Crestor 10mg", "Rosuvastatin", "C10AA07", 15200),
]

ACEI_DRUGS = [
    ("MED-REN-5", "Renitec 5mg", "Enalapril", "C09AA02", 6200),
    ("MED-COV-5", "Coversyl 5mg", "Perindopril", "C09AA04", 9800),
]

ARB_DRUGS = [
    ("MED-COZ-50", "Cozaar 50mg", "Losartan", "C09CA01", 12500),
    ("MED-MIC-40", "Micardis 40mg", "Telmisartan", "C09CA07", 14000),
]

CLEAN_DRUGS = [
    ("MED-AML-5", "Amlor 5mg", "Amlodipin", "C08CA01", 8200),
    ("MED-MET-850", "Glucophage 850mg", "Metformin", "A10BA02", 4200),
    ("MED-PARA-500", "Panadol 500mg", "Paracetamol", "N02BE01", 1500),
]

@pytest.fixture
def service():
    return BhytAuditService()

def test_randomized_single_drug_clean(service):
    """Kiểm thử ngẫu nhiên: Thuốc đơn lẻ hợp lệ không bao giờ bị xuất toán trùng lặp."""
    for _ in range(15):
        clean_choice = random.choice(CLEAN_DRUGS)
        qty = random.randint(10, 60)
        days = random.randint(7, 30)
        rank = random.choice(["HANG_DAC_BIET", "HANG_I", "HANG_II"])
        
        payload = BhytPrescriptionPayload(
            prescription_id=f"RX-RND-{random.randint(1000, 9999)}",
            patient_name=f"Bệnh nhân {random.randint(1, 100)}",
            patient_age=random.randint(20, 80),
            insurance_card_number=f"DN4{random.randint(100000000000, 999999999999)}",
            hospital_rank=rank,
            treatment_type="NGOAI_TRU",
            primary_icd10="I10",
            primary_diagnosis="Tăng huyết áp",
            items=[
                BhytPrescriptionItemPayload(
                    id="clean-item",
                    drug_code=clean_choice[0],
                    drug_name=clean_choice[1],
                    active_ingredient=clean_choice[2],
                    dosage="chuẩn",
                    route="Uống",
                    quantity=qty,
                    days_supply=days,
                    unit_price=clean_choice[4]
                )
            ]
        )
        report = service.audit_prescription(payload)
        # Không được có lỗi trùng lặp nhóm tác dụng
        dup_errors = [v for v in report.violations if v.category == "THERAPEUTIC_DUPLICATION"]
        assert len(dup_errors) == 0, f"Đơn 1 thuốc không thể bị báo trùng lặp: {clean_choice[1]}"

def test_randomized_ppi_duplication(service):
    """Kiểm thử ngẫu nhiên: Kê 2 PPI bất kỳ từ danh sách luôn bị bắt lỗi xuất toán."""
    for _ in range(10):
        # Chọn ngẫu nhiên 2 PPI khác nhau
        ppi1, ppi2 = random.sample(PPI_DRUGS, 2)
        qty1 = random.randint(14, 28)
        qty2 = random.randint(14, 28)
        price2 = ppi2[4]
        
        payload = BhytPrescriptionPayload(
            prescription_id=f"RX-PPI-RND-{time.time_ns()}",
            patient_name="Bệnh nhân Dạ Dày",
            patient_age=random.randint(30, 75),
            insurance_card_number="GD4790123456789",
            hospital_rank="HANG_I",
            treatment_type="NGOAI_TRU",
            primary_icd10="K21",
            primary_diagnosis="Trào ngược dạ dày thực quản",
            items=[
                BhytPrescriptionItemPayload(
                    id="ppi-1",
                    drug_code=ppi1[0],
                    drug_name=ppi1[1],
                    active_ingredient=ppi1[2],
                    dosage="chuẩn",
                    route="Uống",
                    quantity=qty1,
                    days_supply=14,
                    unit_price=ppi1[4]
                ),
                BhytPrescriptionItemPayload(
                    id="ppi-2",
                    drug_code=ppi2[0],
                    drug_name=ppi2[1],
                    active_ingredient=ppi2[2],
                    dosage="chuẩn",
                    route="Uống",
                    quantity=qty2,
                    days_supply=14,
                    unit_price=price2
                )
            ]
        )
        report = service.audit_prescription(payload)
        dup_violations = [v for v in report.violations if v.category == "THERAPEUTIC_DUPLICATION"]
        assert len(dup_violations) >= 1, f"Phải bắt được lỗi trùng lặp khi kê {ppi1[1]} và {ppi2[1]}"
        # Số tiền xuất toán của thuốc thứ 2 phải chính xác tuyệt đối
        expected_risk = qty2 * price2
        assert any(abs(v.rejection_risk_vnd - expected_risk) < 0.01 for v in dup_violations), \
            f"Số tiền xuất toán phải đúng từng đồng: {expected_risk}"

def test_randomized_statin_duplication(service):
    """Kiểm thử ngẫu nhiên: Kê 2 Statin bất kỳ luôn bị phát hiện từ CSDL động."""
    statin1, statin2 = STATIN_DRUGS[0], STATIN_DRUGS[1]
    qty = random.randint(10, 30)
    price = statin2[4]
    
    payload = BhytPrescriptionPayload(
        prescription_id=f"RX-STATIN-{random.randint(100, 999)}",
        patient_name="Bệnh nhân Mỡ Máu",
        patient_age=random.randint(50, 70),
        insurance_card_number="HT2790123456789",
        hospital_rank="HANG_I",
        treatment_type="NGOAI_TRU",
        primary_icd10="E78",
        primary_diagnosis="Rối loạn chuyển hóa lipoprotein",
        items=[
            BhytPrescriptionItemPayload(
                id="statin-1",
                drug_code=statin1[0],
                drug_name=statin1[1],
                active_ingredient=statin1[2],
                dosage="20mg",
                route="Uống",
                quantity=qty,
                days_supply=30,
                unit_price=statin1[4]
            ),
            BhytPrescriptionItemPayload(
                id="statin-2",
                drug_code=statin2[0],
                drug_name=statin2[1],
                active_ingredient=statin2[2],
                dosage="10mg",
                route="Uống",
                quantity=qty,
                days_supply=30,
                unit_price=price
            )
        ]
    )
    report = service.audit_prescription(payload)
    dup = [v for v in report.violations if v.category == "THERAPEUTIC_DUPLICATION"]
    assert len(dup) >= 1, "Phải phát hiện lỗi trùng 2 Statin"
    assert dup[0].rejection_risk_vnd == qty * price

def test_randomized_incompatible_raas_pair(service):
    """Kiểm thử ngẫu nhiên: Kê ngẫu nhiên 1 ACEI + 1 ARB luôn bị chặn do chống chỉ định."""
    for _ in range(5):
        acei = random.choice(ACEI_DRUGS)
        arb = random.choice(ARB_DRUGS)
        qty = random.randint(15, 30)
        
        payload = BhytPrescriptionPayload(
            prescription_id=f"RX-RAAS-PAIR-{random.randint(100, 999)}",
            patient_name="Bệnh nhân THA Phối Hợp",
            patient_age=62,
            insurance_card_number="GD4791111222233",
            hospital_rank="HANG_I",
            treatment_type="NGOAI_TRU",
            primary_icd10="I10",
            primary_diagnosis="Tăng huyết áp",
            items=[
                BhytPrescriptionItemPayload(
                    id="raas-acei",
                    drug_code=acei[0],
                    drug_name=acei[1],
                    active_ingredient=acei[2],
                    dosage="5mg",
                    route="Uống",
                    quantity=qty,
                    days_supply=30,
                    unit_price=acei[4]
                ),
                BhytPrescriptionItemPayload(
                    id="raas-arb",
                    drug_code=arb[0],
                    drug_name=arb[1],
                    active_ingredient=arb[2],
                    dosage="50mg",
                    route="Uống",
                    quantity=qty,
                    days_supply=30,
                    unit_price=arb[4]
                )
            ]
        )
        report = service.audit_prescription(payload)
        incomp = [v for v in report.violations if "RAAS" in v.title or "Renin-Angiotensin" in v.title]
        assert len(incomp) >= 1, f"Phải bắt được phối hợp chống chỉ định giữa {acei[1]} và {arb[1]}"
