from typing import List, Optional
from pydantic import BaseModel, Field

class BhytDrugRuleResponse(BaseModel):
    id: str
    stt_thong_tu_20: Optional[int] = None
    atc_code: str
    active_ingredient: str
    brand_names: List[str] = Field(default_factory=list)
    route: str = "Uống"
    allowed_ranks: List[str] = Field(default_factory=list)
    payment_ratio: float = 1.0
    requires_consultation: bool = False
    max_outpatient_days: int = 30
    approved_icd10_prefixes: Optional[List[str]] = None
    forbidden_icd10_prefixes: Optional[List[str]] = None
    special_conditions: Optional[str] = None
    pdf_page: int = 1

class BhytPrescriptionItemPayload(BaseModel):
    id: str
    drug_code: Optional[str] = ""
    drug_name: str
    active_ingredient: Optional[str] = ""
    dosage: Optional[str] = ""
    route: Optional[str] = "Uống"
    quantity: float = 1.0
    days_supply: int = 7
    unit_price: float = 0.0
    total_price: Optional[float] = 0.0
    unit: Optional[str] = "Viên"
    batch_number: Optional[str] = ""
    expiry_date: Optional[str] = ""
    vat_rate: Optional[float] = 0.0
    instructions: Optional[str] = ""
    has_consultation_form: Optional[bool] = False

class BhytPrescriptionPayload(BaseModel):
    prescription_id: Optional[str] = "RX-BHYT-NEW"
    document_type: Optional[str] = "DON_THUOC"
    seller_name: Optional[str] = ""
    seller_tax_id: Optional[str] = ""
    invoice_number: Optional[str] = ""
    patient_name: str = "Bệnh nhân"
    patient_age: int = 50
    insurance_card_number: str = "GD4790000000000"
    hospital_rank: str = "HANG_I"
    treatment_type: str = "NGOAI_TRU"
    primary_icd10: str = "I10"
    primary_diagnosis: str = "Tăng huyết áp"
    secondary_icd10s: List[str] = Field(default_factory=list)
    items: List[BhytPrescriptionItemPayload] = Field(default_factory=list)

class BhytLegalRefSchema(BaseModel):
    doc_code: str
    doc_title: str
    section: str
    page_number: int
    local_pdf_path: str

class BhytViolationItemSchema(BaseModel):
    id: str
    drug_code: str
    drug_name: str
    active_ingredient: str
    severity: str  # REJECT, WARNING, PASS
    category: str
    title: str
    detail: str
    legal_ref: BhytLegalRefSchema
    rejection_risk_vnd: float
    action: str

class BhytAuditReportSchema(BaseModel):
    status: str
    evaluated_at: str
    hospital_rank: str
    treatment_type: str
    primary_icd10: str
    primary_diagnosis: str
    total_cost_vnd: float
    at_risk_cost_vnd: float
    items_count: int
    pass_count: int
    warning_count: int
    reject_count: int
    violations: List[BhytViolationItemSchema]

class BhytCatalogQueryResponse(BaseModel):
    total: int
    items: List[BhytDrugRuleResponse]

class DavDrugCandidate(BaseModel):
    id: str
    national_code: str
    brand_name: str
    active_ingredient: str
    concentration: Optional[str] = ""
    dosage_form: Optional[str] = ""
    route: Optional[str] = "Uống"
    atc_code: Optional[str] = ""

class BhytDrugRuleSummary(BaseModel):
    stt_thong_tu_20: Optional[int] = None
    atc_code: str
    active_ingredient: str
    payment_ratio: float = 1.0
    allowed_ranks: List[str] = Field(default_factory=list)
    requires_consultation: bool = False
    max_outpatient_days: int = 30
    special_conditions: Optional[str] = None
    allowed_icd10: List[str] = Field(default_factory=list)
    forbidden_icd10: List[str] = Field(default_factory=list)

class DrugResolutionResult(BaseModel):
    raw_query: str
    cleaned_name: str
    detected_concentration: Optional[str] = None
    confidence_score: float
    match_status: str  # HIGH, MEDIUM, LOW, UNRESOLVED
    match_strategy: str  # EXACT_FTS, FUZZY_BHYT, ATC_LOOKUP, DIRECT_DAV
    matched_dav: Optional[DavDrugCandidate] = None
    matched_bhyt: Optional[BhytDrugRuleSummary] = None
    alternatives: List[DavDrugCandidate] = Field(default_factory=list)

class DrugResolutionRequest(BaseModel):
    raw_query: str

class DrugBatchResolutionRequest(BaseModel):
    raw_drugs: List[str]

class DrugBatchResolutionResponse(BaseModel):
    total: int
    resolved_count: int
    results: List[DrugResolutionResult]

class BhytOcrPrescriptionRequest(BaseModel):
    image_base64: Optional[str] = None
    mime_type: Optional[str] = "image/jpeg"
    raw_text: Optional[str] = None
    hospital_rank: Optional[str] = "HANG_I"
    treatment_type: Optional[str] = "NGOAI_TRU"

class BhytOcrPrescriptionResponse(BaseModel):
    success: bool = True
    is_valid_document: bool = True
    document_classification: Optional[str] = "DON_THUOC"
    warning_code: Optional[str] = None
    provider: str = "gemini"
    model_used: Optional[str] = None
    prescription: BhytPrescriptionPayload
    resolved_count: int = 0
    total_items: int = 0
    message: Optional[str] = None

