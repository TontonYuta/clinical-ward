"""
Clinical Math Engine: Deterministic, Zero-Hallucination Medical Arithmetic
Paper: MedCalc-Bench: Evaluating Large Language Models for Medical Calculations (NeurIPS 2024 / arXiv:2406.12036)
Repo: ncbi-nlp/MedCalc-Bench

Tuân thủ:
- Công thức Cockcroft-Gault (1976) ước tính độ thanh thải Creatinin (CrCl).
- Hướng dẫn KDIGO (2012 / 2024) phân tầng mức độ suy thận mạn.
- Công thức Mosteller (1987) tính diện tích bề mặt cơ thể (BSA).
- Dược thư Quốc gia Việt Nam (DĐVN V, QĐ 2033/QĐ-BYT) về liều lượng theo thể trọng (mg/kg).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass(frozen=True)
class RenalFunctionAssessment:
    """Kết quả đánh giá chức năng thận xác định (Deterministic)."""
    crcl_ml_min: float
    egfr_ml_min_173m2: Optional[float]
    kdigo_stage: str
    kdigo_description: str
    is_impaired: bool
    is_severe_or_end_stage: bool
    serum_creatinine_umol_l: float
    serum_creatinine_mg_dl: float
    calculation_formula: str
    clinical_note: str


@dataclass(frozen=True)
class PediatricDoseCalculation:
    """Kết quả tính toán liều lượng theo thể trọng nhi khoa xác định."""
    weight_kg: float
    single_dose_mg_min: float
    single_dose_mg_max: float
    daily_dose_mg_max: float
    dosing_frequency: str
    is_dose_capped: bool
    clinical_advisory: str


def convert_creatinine_to_mg_dl(val: float, is_umol_l: bool = True) -> float:
    """
    Quy đổi Creatinin huyết thanh sang mg/dL.
    1 mg/dL = 88.42 µmol/L (theo tiêu chuẩn IFCC/NKDEP).
    """
    if val <= 0:
        raise ValueError("Nồng độ Creatinin phải lớn hơn 0")
    if is_umol_l:
        return val / 88.42
    return val


def convert_creatinine_to_umol_l(val: float, is_mg_dl: bool = True) -> float:
    """Quy đổi Creatinin huyết thanh sang µmol/L."""
    if val <= 0:
        raise ValueError("Nồng độ Creatinin phải lớn hơn 0")
    if is_mg_dl:
        return val * 88.42
    return val


def calculate_cockcroft_gault(
    age: float,
    weight_kg: float,
    serum_creatinine: float,
    is_female: bool,
    creatinine_unit: str = "umol/L"
) -> RenalFunctionAssessment:
    """
    Tính toán độ thanh thải Creatinin (CrCl) theo công thức Cockcroft-Gault chuẩn mực:
    CrCl (Nam) = [(140 - Tuổi) * Cân nặng (kg)] / [72 * SCr (mg/dL)]
    CrCl (Nữ)  = CrCl (Nam) * 0.85

    Quy chuẩn Y văn:
    - Cockcroft DW, Gault MH. Nephron. 1976;16(1):31-41.
    - Dược thư Quốc gia Việt Nam dùng CrCl làm căn cứ chính để hiệu chỉnh liều thuốc.
    """
    if age <= 0 or age > 130:
        raise ValueError(f"Tuổi không hợp lệ: {age}")
    if weight_kg <= 0 or weight_kg > 400:
        raise ValueError(f"Cân nặng không hợp lệ: {weight_kg}")
    if serum_creatinine <= 0:
        raise ValueError(f"Creatinin không hợp lệ: {serum_creatinine}")

    # Chuẩn hóa đơn vị Creatinin
    unit_lower = creatinine_unit.strip().lower()
    if "mg" in unit_lower:
        scr_mg_dl = serum_creatinine
        scr_umol_l = round(convert_creatinine_to_umol_l(scr_mg_dl, is_mg_dl=True), 1)
    else:
        scr_umol_l = serum_creatinine
        scr_mg_dl = convert_creatinine_to_mg_dl(scr_umol_l, is_umol_l=True)

    # Tính toán chính xác
    base_crcl = ((140.0 - float(age)) * float(weight_kg)) / (72.0 * scr_mg_dl)
    gender_factor = 0.85 if is_female else 1.0
    crcl = round(base_crcl * gender_factor, 1)

    # Phân tầng KDIGO dựa trên CrCl
    if crcl >= 90.0:
        stage = "G1"
        desc = "Chức năng thận bình thường hoặc tăng lọc"
        impaired = False
        severe = False
    elif crcl >= 60.0:
        stage = "G2"
        desc = "Giảm nhẹ chức năng thận"
        impaired = False
        severe = False
    elif crcl >= 45.0:
        stage = "G3a"
        desc = "Giảm chức năng thận nhẹ đến trung bình"
        impaired = True
        severe = False
    elif crcl >= 30.0:
        stage = "G3b"
        desc = "Giảm chức năng thận trung bình đến nặng"
        impaired = True
        severe = False
    elif crcl >= 15.0:
        stage = "G4"
        desc = "Suy thận nặng (Nguy cơ tích lũy thuốc cao)"
        impaired = True
        severe = True
    else:
        stage = "G5"
        desc = "Suy thận giai đoạn cuối / Cần lọc máu ngoài thận"
        impaired = True
        severe = True

    gender_str = "Nữ (hệ số 0.85)" if is_female else "Nam (hệ số 1.0)"
    formula_str = (
        f"Cockcroft-Gault: [({140} - {int(age)}) * {weight_kg}kg] / [72 * {scr_mg_dl:.2f} mg/dL]"
        f" * {0.85 if is_female else 1.0} = {crcl} ml/phút"
    )

    return RenalFunctionAssessment(
        crcl_ml_min=crcl,
        egfr_ml_min_173m2=crcl,  # Thực hành dược lâm sàng dùng CrCl để chỉnh liều
        kdigo_stage=stage,
        kdigo_description=desc,
        is_impaired=impaired,
        is_severe_or_end_stage=severe,
        serum_creatinine_umol_l=scr_umol_l,
        serum_creatinine_mg_dl=round(scr_mg_dl, 2),
        calculation_formula=formula_str,
        clinical_note=f"Đánh giá cho bệnh nhân {gender_str}, {int(age)} tuổi, cân nặng {weight_kg} kg."
    )


def assess_renal_function_from_crcl(crcl: float, egfr: Optional[float] = None) -> RenalFunctionAssessment:
    """Đánh giá phân tầng KDIGO khi đã có trực tiếp chỉ số CrCl hoặc eGFR."""
    if crcl < 0 or crcl > 300:
        raise ValueError(f"Chỉ số CrCl không hợp lệ: {crcl}")

    if crcl >= 90.0:
        stage = "G1"
        desc = "Chức năng thận bình thường hoặc tăng lọc"
        impaired = False
        severe = False
    elif crcl >= 60.0:
        stage = "G2"
        desc = "Giảm nhẹ chức năng thận"
        impaired = False
        severe = False
    elif crcl >= 45.0:
        stage = "G3a"
        desc = "Giảm chức năng thận nhẹ đến trung bình"
        impaired = True
        severe = False
    elif crcl >= 30.0:
        stage = "G3b"
        desc = "Giảm chức năng thận trung bình đến nặng"
        impaired = True
        severe = False
    elif crcl >= 15.0:
        stage = "G4"
        desc = "Suy thận nặng (Nguy cơ tích lũy thuốc cao)"
        impaired = True
        severe = True
    else:
        stage = "G5"
        desc = "Suy thận giai đoạn cuối / Cần lọc máu ngoài thận"
        impaired = True
        severe = True

    return RenalFunctionAssessment(
        crcl_ml_min=round(float(crcl), 1),
        egfr_ml_min_173m2=round(float(egfr or crcl), 1),
        kdigo_stage=stage,
        kdigo_description=desc,
        is_impaired=impaired,
        is_severe_or_end_stage=severe,
        serum_creatinine_umol_l=0.0,
        serum_creatinine_mg_dl=0.0,
        calculation_formula=f"CrCl trực tiếp: {crcl} mL/phút (Phân loại KDIGO 2024: {stage})",
        clinical_note=f"Chỉ số CrCl ghi nhận trực tiếp {crcl} mL/phút."
    )


def calculate_bsa_mosteller(height_cm: float, weight_kg: float) -> float:
    """
    Tính diện tích bề mặt cơ thể (BSA) theo công thức Mosteller (1987):
    BSA (m2) = sqrt([Chiều cao (cm) * Cân nặng (kg)] / 3600)
    """
    if height_cm <= 0 or weight_kg <= 0:
        raise ValueError("Chiều cao và cân nặng phải lớn hơn 0")
    return round(math.sqrt((height_cm * weight_kg) / 3600.0), 2)


def calculate_pediatric_paracetamol_dose(weight_kg: float) -> PediatricDoseCalculation:
    """
    Tính liều Paracetamol đường uống cho trẻ em:
    - 10 - 15 mg/kg mỗi liều.
    - Cách nhau 4 - 6 giờ/lần nếu cần.
    - Tối đa không quá 60 mg/kg/ngày (hoặc không vượt quá liều tối đa người lớn 4g/ngày).
    Căn cứ: Dược thư Quốc gia Việt Nam (chuyên luận Paracetamol, tr. 1118).
    """
    if weight_kg <= 0 or weight_kg > 150:
        raise ValueError(f"Cân nặng nhi khoa không hợp lệ: {weight_kg}")

    min_dose = round(weight_kg * 10.0, 1)
    max_dose = round(weight_kg * 15.0, 1)
    max_daily = round(min(weight_kg * 60.0, 4000.0), 1)

    is_capped = False
    if max_dose > 1000.0:
        max_dose = 1000.0
        is_capped = True

    return PediatricDoseCalculation(
        weight_kg=weight_kg,
        single_dose_mg_min=min_dose,
        single_dose_mg_max=max_dose,
        daily_dose_mg_max=max_daily,
        dosing_frequency="Mỗi 4 - 6 giờ/lần khi sốt >= 38.5°C hoặc đau; tối đa không quá 4 lần/24 giờ.",
        is_dose_capped=is_capped,
        clinical_advisory=(
            f"Liều khuyến cáo: {min_dose:.0f} - {max_dose:.0f} mg/lần. "
            f"Tổng liều 24 giờ tuyệt đối không vượt quá {max_daily:.0f} mg."
        )
    )
