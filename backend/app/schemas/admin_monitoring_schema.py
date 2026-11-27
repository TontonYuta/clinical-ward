"""
Pydantic Schemas for Admin Monitoring, API Key Management & Token Budgeting.
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ApiKeyItem(BaseModel):
    key_id: str
    name: str
    masked_key: str
    provider: str = "gemini"
    status: str = "active"          # "active", "rate_limited", "invalid", "standby"
    quota_status: str = "15 RPM · 1.000.000 TPM · 1.500 RPD"
    is_active: bool = True
    is_system_env: bool = False
    created_at: float
    tokens_used_today: int = 0
    requests_count: int = 0
    error_429_count: int = 0
    latency_ms: Optional[float] = None
    last_used_at: Optional[str] = None

class AddApiKeyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    api_key: str = Field(min_length=10, max_length=256)
    provider: str = Field(default="gemini")

class TestKeyRequest(BaseModel):
    key_id: Optional[str] = None
    api_key: Optional[str] = None
    provider: Optional[str] = "gemini"

class TestKeyResponse(BaseModel):
    success: bool
    status: str
    message: str
    latency_ms: float
    available_models: List[str]

class BudgetCapConfig(BaseModel):
    daily_token_limit: int = Field(default=500000, ge=10000)
    monthly_token_limit: int = Field(default=10000000, ge=100000)
    daily_cost_limit_vnd: float = Field(default=500000.0, ge=0.0)
    monthly_cost_limit_vnd: float = Field(default=10000000.0, ge=0.0)
    daily_search_query_limit: int = Field(default=200, ge=10)
    monthly_search_query_limit: int = Field(default=5000, ge=50)
    auto_offline_fallback: bool = True
    alert_on_threshold_pct: int = 80

class BudgetCapResponse(BaseModel):
    config: BudgetCapConfig
    today_tokens_used: int
    month_tokens_used: int
    today_usage_pct: float
    today_search_queries_used: int = 0
    month_search_queries_used: int = 0
    daily_search_query_limit: int = 200
    today_search_usage_pct: float = 0.0
    search_budget_gate_open: bool = True
    search_throttling_status: str = "normal"
    estimated_cost_vnd: float
    month_cost_vnd: float = 0.0
    daily_cost_limit_vnd: float = 500000.0
    saved_cost_vnd: float
    throttling_status: str = "normal"

class TelemetryEventItem(BaseModel):
    id: str
    timestamp: str
    event_type: str        # "CACHE_HIT", "ADAPTIVE_RAG", "BHYT_SUBSTITUTION", "GUARDRAIL_BLOCKED", "VISION_OCR_BHYT", "MULTIMODAL_CLINICAL_VISION"
    query: str
    user_role: str
    latency_ms: float
    tokens: int
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    usage_source: str = "none"
    cache_hit_count: int = 0
    model_name: Optional[str] = "gemini-2.5-flash"
    provider: Optional[str] = "gemini"
    has_image: bool = False
    image_tokens: int = 0
    status: str            # "success", "blocked", "fallback"
    created_at_date: Optional[str] = None
    created_at_full: Optional[str] = None
    created_at_iso: Optional[str] = None
    reply_text: Optional[str] = None
    intent: Optional[str] = None
    user_name: Optional[str] = None
    session_id: Optional[str] = None
    grounded_source: Optional[str] = None
    quality_category: Optional[str] = None
    availability_mode: Optional[str] = None
    rag_grounded: bool = False
    evidence_count: int = 0
    status_reason: Optional[str] = None
    telemetry_version: Optional[str] = None

class BhytAuditLogItem(BaseModel):
    id: str
    prescription_id: str
    patient_name: str
    insurance_card_number: str
    hospital_rank: str
    treatment_type: str
    primary_icd10: str
    status: str
    total_cost_vnd: float
    at_risk_cost_vnd: float
    violations_count: int
    violations_json: Optional[str] = "[]"
    created_at: Optional[str] = None

class PaginatedTelemetryResponse(BaseModel):
    total_items: int
    total_pages: int
    current_page: int
    page_size: int
    items: List[TelemetryEventItem]

class FeatureFlagItem(BaseModel):
    key: str
    label: str
    description: str
    enabled: bool

class FeatureFlagResponse(BaseModel):
    version: int
    flags: List[FeatureFlagItem]

class FeatureFlagUpdateItem(BaseModel):
    key: str
    enabled: bool

class FeatureFlagUpdate(BaseModel):
    version: int = Field(ge=0)
    flags: List[FeatureFlagUpdateItem]

class TelemetryOverviewResponse(BaseModel):
    total_queries: int
    cache_hit_rate_pct: float
    exact_hits: int
    semantic_hits: int
    tokens_consumed: int
    tokens_saved: int
    cost_saved_vnd: float
    p95_latency_ms: float
    bhyt_audited: int
    bhyt_rejection_saved_vnd: float
    ddi_blocks_count: int
    guardrail_blocks_count: int
    web_search_queries_today: int = 0
    internal_pharmacopoeia_ratio_pct: float = 0.0
    web_fallback_ratio_pct: float = 0.0
    avg_serper_latency_ms: float = 0.0
    avg_llm_latency_ms: float = 0.0
    top_unindexed_fallback_queries: List[Dict[str, Any]] = Field(default_factory=list)
    recent_events: List[TelemetryEventItem]
    intent_distribution: List[Dict[str, Any]]
    timeline_trend: List[Dict[str, Any]]
    bhyt_logs: List[BhytAuditLogItem] = Field(default_factory=list)
