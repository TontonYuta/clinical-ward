"""
Pydantic V2 Schema for Gemini Structured NLU Router (Zero Hardcode Clinical Intent & Entity Resolution).
Enforces strict Literal types for 8 clinical intents and standardized extraction slots.
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field


class ClinicalNluExtraction(BaseModel):
    intent: Literal[
        "GREETING_WELLBEING",
        "CAPABILITY_OPENING",
        "CONVERSATIONAL_FEEDBACK",
        "MEDICATION_LOOKUP",
        "MEDICATION_LOOKUP_GUIDE",
        "MEDICATION_INTERACTION_CHECK",
        "MEDICATION_INTERACTION_CLARIFICATION",
        "PATIENT_CASE_REASONING",
        "PATIENT_MEDICATION_COUNSELING",
        "SPECIALTY_CLINICAL_PROTOCOL",
        "CLINICAL_CASE_CLARIFICATION",
        "OUT_OF_SCOPE"
    ] = Field(
        ...,
        description="Ý định lâm sàng duy nhất được phân loại nghiêm ngặt"
    )
    primary_drug: Optional[str] = Field(
        None,
        description="Tên thuốc chính (biệt dược hoặc hoạt chất) sau khi đã phân giải đại từ 'thuốc đó', 'nó'"
    )
    secondary_drug: Optional[str] = Field(
        None,
        description="Tên thuốc thứ hai nếu là câu hỏi kiểm tra cặp tương tác thuốc"
    )
    additional_drugs: List[str] = Field(
        default_factory=list,
        description="Danh sách các thuốc phụ nếu hỏi đơn thuốc từ 3 loại trở lên"
    )
    sub_queries: List[str] = Field(
        default_factory=list,
        description="Danh sách các câu hỏi con độc lập nếu người dùng hỏi câu hỏi kép/đa ý định"
    )
    is_prescription_block: bool = Field(
        False,
        description="True nếu prompt là một đơn thuốc thô gồm danh sách nhiều dòng thuốc cần thẩm định"
    )
    prescription_lines: List[str] = Field(
        default_factory=list,
        description="Danh sách từng dòng thuốc thô trích xuất từ khối đơn thuốc"
    )
    requested_field: Optional[Literal[
        "summary", "detailed_profile", "dosage", "contraindications",
        "adverse_effects", "interactions", "pregnancy", "timing", "stock",
        "renal", "hepatic", "pediatric", "administration", "counseling", "guideline"
    ]] = Field(
        None,
        description="Khía cạnh thông tin cụ thể người dùng yêu cầu"
    )
    is_deictic_referent: bool = Field(
        False,
        description="True nếu câu hỏi kế thừa từ 'thuốc đó', 'thuốc này', 'nó' từ lịch sử"
    )
    is_topic_shift: bool = Field(
        False,
        description="True nếu người dùng đổi sang thuốc mới hoặc chủ đề mới khác hoàn toàn so với active_med"
    )
    depth_preference: Literal["SUMMARY", "DETAILED", "COUNSELING"] = Field(
        "SUMMARY",
        description="Mức độ sâu mong muốn của câu trả lời (tóm tắt định hướng, chuyên sâu toàn văn, hoặc dặn dò người bệnh)"
    )
    out_of_scope_type: Optional[Literal["MATH_LOGIC", "GENERAL_CHITCHAT", "DISALLOWED_DOMAIN"]] = Field(
        None,
        description="Phân loại chi tiết dạng câu hỏi ngoài phạm vi chuyên môn y tế"
    )
    user_sentiment: Literal["positive", "neutral", "complaint"] = Field(
        "neutral",
        description="Thái độ của người dùng (khen, bình thường, hoặc chê bai/góp ý cứng nhắc/sai sót)"
    )
    confidence: float = Field(
        1.0,
        description="Độ tự tin phân loại của mô hình từ 0.0 đến 1.0"
    )
    clarification_prompt: Optional[str] = Field(
        None,
        description="Gợi ý câu hỏi lại nếu câu hỏi của người dùng còn mập mờ hoặc thiếu thuốc"
    )
    patient_age: Optional[float] = Field(
        None,
        description="Tuổi của bệnh nhân"
    )
    patient_age_unit: Optional[Literal["year", "month", "day"]] = Field(
        "year",
        description="Đơn vị tuổi (year, month, day)"
    )
    patient_gender: Optional[Literal["male", "female"]] = Field(
        None,
        description="Giới tính bệnh nhân (male hoặc female)"
    )
    patient_weight_kg: Optional[float] = Field(
        None,
        description="Cân nặng bệnh nhân theo kilogram (kg)"
    )
    patient_creatinine_val: Optional[float] = Field(
        None,
        description="Chỉ số nồng độ Creatinin huyết thanh (Scr/Cr)"
    )
    patient_creatinine_unit: Optional[Literal["umol_l", "mg_dl"]] = Field(
        "umol_l",
        description="Đơn vị Creatinin máu (umol_l hoặc mg_dl)"
    )
    is_pediatric: bool = Field(
        False,
        description="True nếu là trẻ em (< 18 tuổi hoặc nêu rõ bé/trẻ/sơ sinh). BẮT BUỘC False nếu tuổi >= 18."
    )
    is_geriatric: bool = Field(
        False,
        description="True nếu là người cao tuổi (>= 65 tuổi)"
    )
    is_renal_inquiry: bool = Field(
        False,
        description="True nếu hỏi suy thận, hiệu chỉnh liều chức năng thận, ClCr/eGFR hoặc có chỉ số creatinin"
    )
