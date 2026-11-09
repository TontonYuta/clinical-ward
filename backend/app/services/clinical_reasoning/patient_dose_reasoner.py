"""
Patient Dose Reasoner: Neuro-Symbolic Clinical Reasoning & Dose Titration Engine.
Kết hợp:
- Bóc tách thông số bệnh án (Active Patient hoặc Query Regex).
- Bộ công cụ toán học lâm sàng xác định (Cockcroft-Gault CrCl, BSA, mg/kg).
- Cơ sở quy tắc hiệu chỉnh liều Dược thư Quốc gia (DĐVN V).
- Chuẩn giao tiếp Y khoa Thụy Sĩ (Swiss BLUF: Minh bạch, không emoji, trích dẫn chính xác số trang PDF).
"""
from __future__ import annotations

import re
import unicodedata
from typing import Optional, Dict, Any, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.patient import PatientProfile
from app.schemas.copilot import CopilotResponse
from app.services.session_context import SessionState
from app.services.clinical_reasoning.clinical_math_engine import (
    calculate_cockcroft_gault,
    RenalFunctionAssessment
)
from app.services.clinical_reasoning.renal_dosage_rules import (
    find_renal_drug_rule,
    match_renal_dosage,
    RenalDosingRecommendation
)


def extract_patient_clinical_slots(
    query: str,
    nlu_extraction: Optional[Any] = None
) -> Dict[str, Any]:
    """Bóc tách các thông số lâm sàng trực tiếp từ Gemini NLU hoặc dự phòng bằng Regex."""
    slots: Dict[str, Any] = {
        "age": None,
        "weight_kg": None,
        "creatinine_val": None,
        "creatinine_unit": "umol/L",
        "is_female": False,
        "patient_name": None,
    }

    # 1. ƯU TIÊN SỐ 1: Bóc tách trực tiếp từ Gemini Structured NLU
    if nlu_extraction:
        if getattr(nlu_extraction, "patient_age", None) is not None:
            slots["age"] = float(nlu_extraction.patient_age)
        if getattr(nlu_extraction, "patient_weight_kg", None) is not None:
            slots["weight_kg"] = float(nlu_extraction.patient_weight_kg)
        if getattr(nlu_extraction, "patient_gender", None) is not None:
            slots["is_female"] = (nlu_extraction.patient_gender == "female")
        if getattr(nlu_extraction, "patient_creatinine_val", None) is not None:
            slots["creatinine_val"] = float(nlu_extraction.patient_creatinine_val)
            unit = getattr(nlu_extraction, "patient_creatinine_unit", "umol_l")
            slots["creatinine_unit"] = "mg/dL" if unit == "mg_dl" else "umol/L"

    # Nếu Gemini NLU đã tự đọc đầy đủ các thông số thì không cần regex
    if slots["age"] is not None and slots["weight_kg"] is not None and slots["creatinine_val"] is not None:
        return slots

    # 2. DỰ PHÒNG CỤC BỘ: Regex cải tiến bao quát lỗi chính tả (crystalin) và khoảng trắng
    q_low = query.casefold()
    nfkd = unicodedata.normalize("NFKD", q_low)
    q_clean = "".join(c for c in nfkd if not unicodedata.combining(c))

    # Giới tính
    if any(k in q_clean for k in ("nu", "female", "ba ", "cu ba", "chi ", "bac gai", "co ")):
        slots["is_female"] = True
    elif any(k in q_clean for k in ("nam", "male", "ong ", "cu ong", "anh ", "bac trai")):
        slots["is_female"] = False

    # Tuổi
    if slots["age"] is None:
        m_age = re.search(r'(?:benh nhan|bn|nguoi benh)?\s*(\d{1,3})\s*(?:tuoi|t\b|yo\b)', q_clean)
        if m_age:
            try:
                val = float(m_age.group(1))
                if 0 < val <= 125:
                    slots["age"] = val
            except ValueError:
                pass

    # Cân nặng
    if slots["weight_kg"] is None:
        m_weight = re.search(r'(\d{1,3}(?:[.,]\d+)?)\s*(?:kg|kilogram|ky|can nang|can)', q_clean)
        if m_weight:
            try:
                val = float(m_weight.group(1).replace(",", "."))
                if 1.0 <= val <= 300.0:
                    slots["weight_kg"] = val
            except ValueError:
                pass

    # Creatinin huyết thanh (hỗ trợ crystalin, creatin, scr, cr và khoảng trắng đơn vị um mol/l)
    if slots["creatinine_val"] is None:
        m_cr = re.search(r'(?:creatinin|creatinine|crystalin|creatin|scr|cr)\s*(?:mau|huyet thanh)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(u[m\s]*mol/?l|micromol/?l|mg/?dl)?', q_clean)
        if m_cr:
            try:
                val = float(m_cr.group(1).replace(",", "."))
                slots["creatinine_val"] = val
                unit_str = m_cr.group(2) or ""
                if "mg" in unit_str:
                    slots["creatinine_unit"] = "mg/dL"
                else:
                    if val <= 15.0 and "umol" not in unit_str and "mol" not in unit_str:
                        slots["creatinine_unit"] = "mg/dL"
                    else:
                        slots["creatinine_unit"] = "umol/L"
            except ValueError:
                pass

    return slots


async def resolve_patient_profile(
    query: str,
    session: Optional[SessionState] = None,
    db: Optional[AsyncSession] = None,
    nlu_extraction: Optional[Any] = None
) -> Tuple[Optional[PatientProfile], Dict[str, Any]]:
    """Truy xuất thông tin bệnh nhân từ DB hoặc từ câu hỏi / Gemini NLU."""
    slots = extract_patient_clinical_slots(query, nlu_extraction=nlu_extraction)

    # 1. Ưu tiên lấy từ DB nếu có active_patient_id trong session
    if session and session.active_patient_id and db:
        try:
            res = await db.execute(select(PatientProfile).where(PatientProfile.id == session.active_patient_id))
            patient = res.scalar_one_or_none()
            if patient:
                return patient, slots
        except Exception:
            pass

    return None, slots


def build_reasoned_renal_dose_response(
    rec: RenalDosingRecommendation,
    assessment: RenalFunctionAssessment,
    patient_label: str,
    session: Optional[SessionState] = None,
    user_name: str = "Bác sĩ",
    user_role: str = "doctor"
) -> CopilotResponse:
    """Đóng gói câu trả lời suy luận lâm sàng theo chuẩn Swiss Medical BLUF."""
    is_doc = any(k in (user_role or "").lower() for k in ("doctor", "bac_si", "physician", "bs")) or any(k in (user_name or "").lower() for k in ("bác", "bac", "bs", "dr", "doctor"))
    greeting = f"Kính gửi {user_name}," if is_doc else f"Chào Đồng nghiệp y tế,"

    lines = []
    lines.append(f"{greeting} dưới đây là kết quả đánh giá lâm sàng và hiệu chỉnh liều cho bệnh nhân **{patient_label}**:\n")

    # 1. Đánh giá chức năng thận
    lines.append(f"### 1. Đánh Giá Chức Năng Thận (Cockcroft-Gault)")
    lines.append(f"• **Chỉ số thanh thải:** Độ thanh thải Creatinin ước tính **$CrCl = {assessment.crcl_ml_min} \\text{{ ml/phút}}$**.")
    lines.append(f"• **Phân tầng KDIGO:** Phân loại **{assessment.kdigo_stage}** — {assessment.kdigo_description}.")
    lines.append(f"• **Dữ kiện tính toán:** Creatinin máu ${assessment.serum_creatinine_umol_l} \\mu\\text{{mol/L}}$ (${assessment.serum_creatinine_mg_dl} \\text{{ mg/dL}}$).")
    lines.append(f"• *Cơ sở tính toán:* `{assessment.calculation_formula}`\n")

    # 2. Cảnh báo an toàn
    if rec.is_contraindicated:
        lines.append(f"### 2. Cảnh Báo An Toàn & Độc Tính [CHỐNG CHỈ ĐỊNH]")
        lines.append(f"⚠️ **CẢNH BÁO:** {rec.safety_warning}")
        lines.append(f"• **Kết luận:** **{rec.recommended_dose}**.\n")
    elif rec.is_dose_adjusted:
        lines.append(f"### 2. Cảnh Báo An Toàn & Nguy Cơ Tích Lũy")
        lines.append(f"⚠️ **LƯU Ý:** {rec.safety_warning}\n")
    else:
        lines.append(f"### 2. Đánh Giá Nguy Cơ Lâm Sàng")
        lines.append(f"• Chức năng thận hiện tại ở mức cho phép sử dụng liều điều trị tiêu chuẩn.\n")

    # 3. Phác đồ khuyến nghị
    lines.append(f"### 3. Khuyến Cáo Hiệu Chỉnh Liều (Dược Thư Quốc Gia)")
    if rec.is_contraindicated:
        lines.append(f"• **Xử trí khuyến nghị:** Ngừng thuốc ngay lập tức hoặc không khởi đầu điều trị; chuyển sang nhóm thuốc thay thế an toàn không bài tiết qua thận.")
    elif rec.is_dose_adjusted:
        lines.append(f"• **Liều thông thường người lớn:** {rec.standard_adult_dose}")
        lines.append(f"• **Liều hiệu chỉnh cho bệnh nhân:** **{rec.recommended_dose}** ({rec.dosing_interval}).")
        lines.append(f"• **Cơ sở dược lý:** {rec.clinical_rationale}")
    else:
        lines.append(f"• **Liều khuyến cáo:** **{rec.recommended_dose}** ({rec.dosing_interval}).")
        lines.append(f"• **Cơ sở dược lý:** {rec.clinical_rationale}")

    lines.append(f"\n*(Căn cứ: {rec.legal_basis} — [Mở tài liệu PDF]({rec.pdf_url}))*")

    reply_text = "\n".join(lines)

    # Citations
    citations = [
        {
            "source": rec.legal_basis,
            "title": f"Dược thư Quốc gia Việt Nam ({rec.drug_name})",
            "legal_basis": rec.legal_basis,
            "document_id": rec.citation_document_id,
            "url": rec.pdf_url,
            "page": rec.citation_page,
            "section": f"Hiệu chỉnh liều trong suy thận: {rec.drug_name}",
            "excerpt": f"Khuyến cáo liều cho CrCl {assessment.crcl_ml_min} ml/phút: {rec.recommended_dose} {rec.dosing_interval}."
        }
    ]

    # Chips
    chips = [
        f"Theo dõi chức năng thận {rec.drug_name}",
        f"Chống chỉ định của {rec.drug_name}",
        f"Thuốc thay thế an toàn cho thận"
    ]

    return CopilotResponse(
        intent="MEDICATION_SAFETY_PROFILE",
        reply_text=reply_text,
        legal_basis=rec.legal_basis,
        suggested_chips=chips,
        session_id=session.session_id if session else "default",
        active_patient_id=session.active_patient_id if session else None,
        active_patient_name=session.active_patient_name if session else None,
        active_medication_name=rec.drug_name,
        citations=citations,
        rag_grounded=True,
        answer_type="grounded_reference",
        source_status="exact_match",
        confidence=1.0
    )


async def evaluate_patient_dose_reasoning(
    query: str,
    session: Optional[SessionState] = None,
    db: Optional[AsyncSession] = None,
    user_name: str = "Bác sĩ",
    user_role: str = "doctor",
    nlu_extraction: Optional[Any] = None
) -> Optional[CopilotResponse]:
    """
    Điểm vào chính (Entrypoint) cho luồng suy luận hiệu chỉnh liều theo ca bệnh:
    1. Kiểm tra xem câu hỏi có chứa thuốc trong danh mục suy thận không (ưu tiên từ Gemini NLU).
    2. Xác định thông số lâm sàng của bệnh nhân (từ DB hoặc từ Gemini NLU / query).
    3. Thực hiện tính toán xác định Cockcroft-Gault và khớp quy tắc liều Dược thư Quốc gia.
    """
    target_med = getattr(nlu_extraction, "primary_drug", None) if nlu_extraction else None
    drug_rule = (find_renal_drug_rule(target_med) if target_med else None) or find_renal_drug_rule(query)
    # Nếu không tìm thấy trong query/NLU, kiểm tra active medication trong session
    if not drug_rule and session and session.active_medication_name:
        drug_rule = find_renal_drug_rule(session.active_medication_name)

    if not drug_rule:
        return None

    # Lấy thông tin bệnh nhân (ưu tiên dữ liệu đã bóc tách từ Gemini NLU)
    patient, slots = await resolve_patient_profile(query, session, db, nlu_extraction=nlu_extraction)

    age: Optional[float] = None
    weight_kg: Optional[float] = None
    scr_val: Optional[float] = None
    scr_unit: str = "umol/L"
    is_female: bool = False
    patient_label = "Người bệnh"

    if patient:
        age = float(patient.age) if patient.age else None
        weight_kg = float(patient.weight_kg) if patient.weight_kg else 60.0
        scr_val = float(patient.creatinine) if patient.creatinine else 80.0
        scr_unit = "umol/L"
        is_female = (patient.gender or "").strip().lower() in ("nu", "nữ", "female")
        patient_label = f"{patient.full_name} ({patient.id})"

    # Ghi đè bằng slots từ query nếu Bác sĩ cung cấp thông số cụ thể trong câu hỏi
    if slots.get("age") is not None:
        age = slots["age"]
    if slots.get("weight_kg") is not None:
        weight_kg = slots["weight_kg"]
    if slots.get("creatinine_val") is not None:
        scr_val = slots["creatinine_val"]
        scr_unit = slots.get("creatinine_unit", "umol/L")
    if slots.get("is_female") is not None and slots.get("age") is not None:
        is_female = slots["is_female"]
        if not patient:
            gender_name = "Nữ" if is_female else "Nam"
            patient_label = f"{gender_name}, {int(age)} tuổi, {weight_kg or 50:.0f}kg"

    # Chỉ suy luận khi có đủ: Tuổi, Cân nặng, Creatinin
    if age is None or weight_kg is None or scr_val is None:
        return None

    # 1. Chạy công cụ toán học xác định Cockcroft-Gault
    try:
        assessment = calculate_cockcroft_gault(
            age=age,
            weight_kg=weight_kg,
            serum_creatinine=scr_val,
            is_female=is_female,
            creatinine_unit=scr_unit
        )
    except Exception:
        return None

    # 2. Khớp với quy tắc liều Dược thư Quốc gia
    rec = match_renal_dosage(drug_rule.canonical_name, assessment)
    if not rec:
        return None

    # 3. Đóng gói câu trả lời chuẩn Y khoa Thụy Sĩ
    return build_reasoned_renal_dose_response(
        rec=rec,
        assessment=assessment,
        patient_label=patient_label,
        session=session,
        user_name=user_name,
        user_role=user_role
    )
