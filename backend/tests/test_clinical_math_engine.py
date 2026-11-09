"""
Unit Tests for Deterministic Clinical Math Engine (Zero-Hallucination Arithmetic).
Đối soát chuẩn xác số học theo công thức Cockcroft-Gault, KDIGO Staging và Dược thư Quốc gia.
"""
import pytest
from app.services.clinical_reasoning.clinical_math_engine import (
    calculate_cockcroft_gault,
    convert_creatinine_to_mg_dl,
    convert_creatinine_to_umol_l,
    calculate_bsa_mosteller,
    calculate_pediatric_paracetamol_dose
)


def test_convert_creatinine_units():
    # 88.42 µmol/L = 1.0 mg/dL
    assert round(convert_creatinine_to_mg_dl(88.42), 2) == 1.0
    assert round(convert_creatinine_to_umol_l(1.0), 2) == 88.42


def test_cockcroft_gault_female_severe_ckd():
    """
    Ca lâm sàng đối chứng: Bệnh nhân Nữ, 72 tuổi, 42 kg, Creatinin máu 165 µmol/L.
    SCr mg/dL = 165 / 88.42 ≈ 1.866
    CrCl = [(140 - 72) * 42] / [72 * 1.866] * 0.85 = [2856 / 134.35] * 0.85 ≈ 18.1 ml/phút.
    """
    res = calculate_cockcroft_gault(
        age=72,
        weight_kg=42,
        serum_creatinine=165,
        is_female=True,
        creatinine_unit="umol/L"
    )
    assert 17.5 <= res.crcl_ml_min <= 18.5
    assert res.kdigo_stage == "G4"
    assert res.is_impaired is True
    assert res.is_severe_or_end_stage is True
    assert "G4" in res.kdigo_stage
    assert "Cockcroft-Gault" in res.calculation_formula


def test_cockcroft_gault_male_moderate_ckd():
    """
    Ca lâm sàng đối chứng: Bệnh nhân Nam, 65 tuổi, 60 kg, Creatinin 1.8 mg/dL.
    CrCl = [(140 - 65) * 60] / [72 * 1.8] * 1.0 = 4500 / 129.6 ≈ 34.7 ml/phút.
    """
    res = calculate_cockcroft_gault(
        age=65,
        weight_kg=60,
        serum_creatinine=1.8,
        is_female=False,
        creatinine_unit="mg/dL"
    )
    assert res.crcl_ml_min == 34.7
    assert res.kdigo_stage == "G3b"
    assert res.is_impaired is True
    assert res.is_severe_or_end_stage is False


def test_cockcroft_gault_normal_renal_function():
    """
    Ca lâm sàng đối chứng: Bệnh nhân Nam trẻ tuổi, 25 tuổi, 70 kg, Creatinin 80 µmol/L.
    SCr mg/dL = 80 / 88.42 ≈ 0.905
    CrCl = [(140 - 25) * 70] / [72 * 0.905] ≈ 123.6 ml/phút.
    """
    res = calculate_cockcroft_gault(
        age=25,
        weight_kg=70,
        serum_creatinine=80,
        is_female=False,
        creatinine_unit="umol/L"
    )
    assert res.crcl_ml_min >= 120.0
    assert res.kdigo_stage == "G1"
    assert res.is_impaired is False
    assert res.is_severe_or_end_stage is False


def test_cockcroft_gault_end_stage_renal():
    """
    Ca lâm sàng lọc máu / suy thận giai đoạn cuối: CrCl < 15 ml/phút.
    """
    res = calculate_cockcroft_gault(
        age=80,
        weight_kg=40,
        serum_creatinine=350,
        is_female=True,
        creatinine_unit="umol/L"
    )
    assert res.crcl_ml_min < 15.0
    assert res.kdigo_stage == "G5"
    assert res.is_severe_or_end_stage is True


def test_calculate_bsa_mosteller():
    # 170cm, 65kg -> sqrt(170*65/3600) = sqrt(3.0694) ≈ 1.75 m2
    bsa = calculate_bsa_mosteller(height_cm=170, weight_kg=65)
    assert bsa == 1.75


def test_pediatric_paracetamol_dose_15kg():
    calc = calculate_pediatric_paracetamol_dose(weight_kg=15.0)
    assert calc.weight_kg == 15.0
    assert calc.single_dose_mg_min == 150.0  # 15 * 10
    assert calc.single_dose_mg_max == 225.0  # 15 * 15
    assert calc.daily_dose_mg_max == 900.0   # 15 * 60
    assert calc.is_dose_capped is False


def test_pediatric_paracetamol_dose_capped_high_weight():
    # Trẻ lớn 75kg -> 75 * 15 = 1125mg -> Bị chặn trần người lớn 1000mg
    calc = calculate_pediatric_paracetamol_dose(weight_kg=75.0)
    assert calc.single_dose_mg_max == 1000.0
    assert calc.is_dose_capped is True
    assert calc.daily_dose_mg_max == 4000.0


def test_invalid_inputs_raise_value_error():
    with pytest.raises(ValueError):
        calculate_cockcroft_gault(age=-5, weight_kg=50, serum_creatinine=80, is_female=False)

    with pytest.raises(ValueError):
        calculate_cockcroft_gault(age=30, weight_kg=-10, serum_creatinine=80, is_female=False)

    with pytest.raises(ValueError):
        calculate_cockcroft_gault(age=30, weight_kg=50, serum_creatinine=0, is_female=False)
