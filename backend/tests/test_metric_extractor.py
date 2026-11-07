"""
Unit Tests for Structured Lab Metric & Demographic Extractor (Technique 9).
IRCoT Multihop Paradigm (Trivedi et al., ACL 2023).
"""
import pytest
from app.services.rag.metric_extractor import (
    extract_clcr_or_egfr,
    extract_clinical_metrics,
    partition_current_and_proposed_meds,
    LabMetrics
)

def test_extract_clcr_and_egfr():
    """Kiểm tra trích xuất độ thanh thải thận ClCr và eGFR."""
    t1 = "Bệnh nhân suy thận mạn ClCr 25 ml/phút đang dùng Coversyl"
    assert extract_clcr_or_egfr(t1) == 25.0

    t2 = "eGFR dưới 30 ml/phút/1.73m2 kèm tăng huyết áp"
    assert extract_clcr_or_egfr(t2) == 30.0

    t3 = "Bệnh nhân bình thường ClCr = 85.5 ml/min"
    assert extract_clcr_or_egfr(t3) == 85.5

def test_extract_comprehensive_lab_metrics():
    """Kiểm tra trích xuất đa chỉ số cận lâm sàng (Kali, INR, Creatinine)."""
    case_note = "Bệnh nhân ClCr 28 ml/phút, K+ 5.6 mmol/L, INR 2.8, Creatinine 180"
    metrics = extract_clinical_metrics(case_note)
    assert isinstance(metrics, LabMetrics)
    assert metrics.clcr == 28.0
    assert metrics.potassium == 5.6
    assert metrics.inr == 2.8
    assert metrics.creatinine == 180.0

def test_partition_current_and_proposed_meds():
    """Kiểm tra phân tách danh mục thuốc đang dùng và thuốc mới định kê thêm."""
    case_text = (
        "Bệnh nhân đang dùng Coversyl 4mg và Metformin 500mg. "
        "Định kê thêm Meloxicam 7.5mg"
    )
    curr, prop = partition_current_and_proposed_meds(case_text)
    assert any(m in curr for m in ["coversyl", "perindopril"])
    assert any(m in curr for m in ["metformin"])
    assert "meloxicam" in prop
