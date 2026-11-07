"""
Unit Tests for CDSS Safety Sentinel Engine (Technique 7).
FDA CDSS 2022 & ISMP High-Alert Medication Protocol.
"""
import pytest
from app.services.cdss.sentinel_engine import (
    evaluate_cdss_safety,
    CDSSSentinelResult,
    DYNAMIC_CDSS_RULES
)

def test_safe_medication_dispense_passes_cleanly():
    """Y lệnh bình thường nằm trong liều điều trị phải được thông qua."""
    res = evaluate_cdss_safety(med_name="Morphin sulfat 10mg", quantity=1.0)
    assert isinstance(res, CDSSSentinelResult)
    assert res.is_safe is True
    assert res.alert_level == "clear"

def test_opioid_overdose_sentinel_blocks():
    """Liều Morphin vượt quá 3 ống (>= 40mg) phải bị Sentinel chặn cấp phát."""
    res = evaluate_cdss_safety(med_name="Morphin sulfat 10mg", quantity=4.0)
    assert res.is_safe is False
    assert res.alert_level == "critical"
    assert "OPIOID" in res.title
    assert "Naloxon" in res.antidote

def test_fatal_opioid_benzodiazepine_combination_blocks():
    """Phối hợp Morphin + Diazepam phải bị chặn với cảnh báo Black Box."""
    res = evaluate_cdss_safety(
        med_name="Morphin 10mg",
        quantity=1.0,
        context_text="tiêm cùng diazepam cho bệnh nhân đau"
    )
    assert res.is_safe is False
    assert res.alert_level == "critical"
    assert "OPIOID + BENZODIAZEPINE" in res.title

def test_kcl_direct_iv_blocks_and_diluted_passes():
    """KCl 10% tiêm trực tiếp bị chặn, nhưng pha loãng truyền tĩnh mạch thì an toàn."""
    # 1. Tiêm trực tiếp -> Chặn tử vong
    res_direct = evaluate_cdss_safety(
        med_name="Kali Clorid 10%",
        quantity=1.0,
        context_text="tiêm trực tiếp tĩnh mạch 1 ống"
    )
    assert res_direct.is_safe is False
    assert "KALI CLORID" in res_direct.title

    # 2. Pha loãng truyền tĩnh mạch -> An toàn
    res_diluted = evaluate_cdss_safety(
        med_name="Kali Clorid 10%",
        quantity=1.0,
        context_text="pha loãng vào 500ml NaCl 0.9% truyền tĩnh mạch"
    )
    assert res_diluted.is_safe is True
