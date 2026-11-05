"""
Pydantic V2 Schemas for Zero-Hardcode Dynamic Intent & Clinical Entity Extraction.
Replaces brittle regex and static keyword dictionaries with structured LLM / DB Grounded schemas.
"""
from typing import List, Optional, Set
from pydantic import BaseModel, Field


class ExtractedMedication(BaseModel):
    canonical_id: str = Field(description="Tên hoạt chất chuẩn hoá (lowercase, vd: paracetamol, metformin)")
    surface_form: str = Field(description="Từ ngữ nguyên văn xuất hiện trong câu hỏi của người dùng")
    role: str = Field(
        default="primary_medication",
        description="Vai trò: primary_medication (thuốc chính), interacting_drug (thuốc tương tác), contextual_exposure (thủ thuật/phơi nhiễm như thuoc_can_quang)"
    )
    resolution: str = Field(default="extracted", description="Nguồn phân giải: llm, database_trie, session_context")


class PatientContextSchema(BaseModel):
    age_group: Optional[str] = Field(default=None, description="Nhóm tuổi: adult, pediatric, neonate, elderly")
    age_years: Optional[float] = Field(default=None, description="Tuổi bệnh nhân tính theo năm")
    weight_kg: Optional[float] = Field(default=None, description="Cân nặng bệnh nhân (kg)")
    renal_impairment: bool = Field(default=False, description="Có suy giảm chức năng thận không")
    crcl_ml_min: Optional[float] = Field(default=None, description="Độ thanh thải Creatinin (ml/min)")
    egfr: Optional[float] = Field(default=None, description="Mức lọc cầu thận eGFR (ml/min/1.73m2)")
    hepatic_impairment: bool = Field(default=False, description="Có suy giảm chức năng gan không")
    pregnancy: bool = Field(default=False, description="Phụ nữ mang thai")
    lactation: bool = Field(default=False, description="Phụ nữ đang cho con bú")


class ClinicalExtractionAnalysis(BaseModel):
    primary_intent: str = Field(
        description=(
            "Ý định lâm sàng chính: "
            "monograph_field_lookup (tra cứu thông tin 1 thuốc), "
            "dosage_adjustment (liều dùng, hiệu chỉnh liều suy gan thận, trẻ em), "
            "interaction_assessment (tương tác, tương kỵ 2 hoặc nhiều thuốc), "
            "clinical_consultation (tư vấn ca bệnh, thủ thuật, phản ứng có hại, xử trí), "
            "disease_guideline (phác đồ điều trị bệnh lý theo Bộ Y tế), "
            "conversational (chào hỏi, cảm ơn, xã giao), "
            "out_of_scope (ngoài y tế hoặc vô nghĩa)"
        )
    )
    medications: List[ExtractedMedication] = Field(
        default_factory=list,
        description="Danh sách các thuốc/hoạt chất được phát hiện trong câu"
    )
    requested_fields: List[str] = Field(
        default_factory=list,
        description="Các khía cạnh lâm sàng được hỏi: dosage, contraindications, adverse_effects, indications, ingredients, interactions, monitoring"
    )
    diseases_or_symptoms: List[str] = Field(
        default_factory=list,
        description="Các bệnh lý, hội chứng hoặc triệu chứng được nhắc tới (vd: đái tháo đường, suy tim, sốt cao, nổi ban)"
    )
    patient_context: Optional[PatientContextSchema] = Field(
        default=None,
        description="Thông tin cá thể hoá của bệnh nhân nếu được đề cập"
    )
    references_previous_entity: bool = Field(
        default=False,
        description="True nếu câu hỏi dùng đại từ tham chiếu ngữ cảnh trước đó (nó, thuốc đó, thuốc vừa nói...)"
    )
    switches_subject: bool = Field(
        default=False,
        description="True nếu người dùng chuyển đề tài sang thuốc khác (đổi sang..., chuyển sang...)"
    )
    ambiguities: List[str] = Field(
        default_factory=list,
        description="Các điểm mập mờ: missing_interaction_partner, unresolved_medication, insufficient_clinical_data"
    )
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Độ tin cậy của việc bóc tách (0.0 - 1.0)")
    reasoning: Optional[str] = Field(default="", description="Lý do ngắn gọn cho quyết định phân loại")
