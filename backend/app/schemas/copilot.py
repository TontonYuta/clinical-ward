from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class CopilotQuery(BaseModel):
    query: str = Field(..., min_length=1, max_length=1500)
    user_role: str = "nurse"
    user_name: str = "ĐD. Lê Thị Thu"
    session_id: str | None = None

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

class CopilotResponse(BaseModel):
    intent: str
    reply_text: str
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
    rag_grounded: bool = False
    answer_type: str | None = None
    source_status: str | None = None
    confidence: float | None = None
    abstention_reason: str | None = None
    factuality_score: float | None = None
    critique_verdict: str | None = None
    cdss_alert: CopilotCdssAlert | None = None

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
    confidence_score: float = 0.95
    legal_basis: str = ""
    rag_grounded: bool = True
    factuality_score: float = 1.0
    critique_verdict: str = "PASS"

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
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
