from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Literal

class CopilotQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=1500)
    user_role: str = "nurse"
    user_name: str = "ĐD. Lê Thị Thu"
    session_id: str | None = None
    image_base64: str | None = None
    image_mime_type: str | None = "image/jpeg"

class CopilotActionCard(BaseModel):
    card_type: str
    title: str
    summary: str
    data: dict
    primary_action_label: str | None = None
    primary_action_type: str | None = None
    target_tab: str | None = None

class CopilotCdssAlert(BaseModel):
    level: str = "critical"  # "critical", "warning", "info"
    title: str
    message: str
    antidoteRecommendation: str | None = None
    regulatoryReference: str | None = None
    substituteDrug: str | None = None

class ClinicalSummary(BaseModel):
    headline: str = Field(..., description="Tiêu đề lâm sàng ngắn gọn, rõ ràng")
    key_takeaway: str = Field(..., description="Tóm tắt 1-2 câu cốt lõi (TL;DR) cho thầy thuốc")
    urgency: str = Field(default="routine", description="Mức độ khẩn cấp: routine, warning, emergency")

class DrugIdentitySchema(BaseModel):
    brand_name: str
    inn: str | None = None
    national_code: str | None = None
    sdk: str | None = None
    drug_class: str | None = None
    dosage_form: str | None = None

class DosageDetailSchema(BaseModel):
    standard_dose: str | None = None
    frequency: str | None = None
    max_daily: str | None = None
    routes: list[str] = Field(default_factory=list)
    weight_based: str | None = None
    timing_instruction: str | None = None
    special_notes: list[str] = Field(default_factory=list)

class DosageMatrixSchema(BaseModel):
    adult: DosageDetailSchema | None = None
    pediatric: DosageDetailSchema | None = None

class DdiFindingSchema(BaseModel):
    drug_a: str
    drug_b: str
    severity: str = "warning"  # critical, warning, info
    mechanism: str | None = None
    clinical_action: str | None = None
    substitute_drug: str | None = None
    regulatory_reference: str | None = None

class AbstentionDetailsSchema(BaseModel):
    reason_code: str = Field(default="DRUG_NOT_IN_INDEXED_SOURCES")
    unresolved_entities: list[str] = Field(default_factory=list)
    professional_recommendations: list[str] = Field(default_factory=list)

class StructuredClinicalPayload(BaseModel):
    drug_identity: DrugIdentitySchema | None = None
    dosage_matrix: DosageMatrixSchema | None = None
    indications: list[str] = Field(default_factory=list)
    contraindications: list[str] = Field(default_factory=list)
    adverse_effects: list[str] = Field(default_factory=list)
    timing_and_administration: str | None = None
    special_warnings: list[str] = Field(default_factory=list)
    ddi_findings: list[DdiFindingSchema] = Field(default_factory=list)
    abstention_details: AbstentionDetailsSchema | None = None

class AnswerClaim(BaseModel):
    """A factual or inferred statement linked to its source evidence records."""
    model_config = ConfigDict(extra="forbid")

    claim_id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)
    claim_type: Literal["source_fact", "evidence_inference"]
    evidence_ids: list[str] = Field(..., min_length=1)
    support_status: Literal["supported", "unsupported", "contradicted", "insufficient_evidence"]

    @model_validator(mode="after")
    def validate_support_has_evidence(self):
        if self.support_status == "supported" and not self.evidence_ids:
            raise ValueError("supported claims require at least one evidence ID")
        return self

class CopilotResponse(BaseModel):
    intent: str
    reply_text: str
    clinical_summary: ClinicalSummary | None = None
    clinical_data: StructuredClinicalPayload | None = None
    card: CopilotActionCard | None = None
    suggested_action: dict | None = None
    legal_basis: str | None = None
    suggested_chips: list[str] = []
    session_id: str | None = None
    active_patient_id: str | None = None
    active_patient_name: str | None = None
    active_medication_name: str | None = None
    active_medication_stock: str | None = None
    active_medication_location: str | None = None
    citations: list[dict] = []
    evidence: list[dict] = []
    rag_grounded: bool = False
    answer_type: str | None = None
    source_status: str | None = None
    confidence: float | None = None
    abstention_reason: str | None = None
    factuality_score: float | None = None
    critique_verdict: str | None = None
    cdss_alert: CopilotCdssAlert | None = None
    prompt_tokens: int | None = 0
    completion_tokens: int | None = 0
    total_tokens: int | None = 0
    usage_source: str | None = "none"
    model_call_count: int | None = 0
    usage_call_count: int | None = 0
    cache_hit_count: int | None = 0
    availability_mode: str | None = None
    provider: str | None = None
    claims: list[AnswerClaim] = Field(default_factory=list)
    evidence_claim_map: dict[str, list[str]] = Field(default_factory=dict)
    model_name: str | None = "gemini-3.5-flash-lite"
    has_image: bool | None = False
    image_tokens: int | None = 0

class RagQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=1500)
    user_role: str = "nurse"
    user_name: str = "ĐD. Lê Thị Thu"
    patient_info: dict | None = None
    top_k: int = Field(default=4, ge=1, le=8)

class RagResponse(BaseModel):
    query: str
    answer: str
    citations: list[dict] = []
    kg_entities: list[str] = []
    confidence_score: float = 0.0
    legal_basis: str = ""
    rag_grounded: bool = False
    factuality_score: float = 0.0
    critique_verdict: str = "NOT_RUN"
    evidence: list[dict] = []

class CopilotChatLogResponse(BaseModel):
    id: str
    session_id: str
    user_name: str
    user_role: str
    query: str
    reply_text: str
    intent: str | None = None
    answer_type: str | None = None
    utility_score: float | None = None
    is_useful: bool = True
    quality_category: str | None = None
    grounded_source: str | None = None
    usage_source: str | None = None
    model_call_count: int | None = None
    usage_call_count: int | None = None
    cache_hit_count: int | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
