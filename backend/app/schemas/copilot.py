from pydantic import BaseModel

class CopilotQuery(BaseModel):
    query: str
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

class RagQuery(BaseModel):
    query: str
    user_role: str = "nurse"
    user_name: str = "ĐD. Lê Thị Thu"
    patient_info: dict | None = None
    top_k: int = 4

class RagResponse(BaseModel):
    query: str
    answer: str
    citations: list[dict] = []
    kg_entities: list[str] = []
    confidence_score: float = 0.95
    legal_basis: str = ""
    rag_grounded: bool = True
