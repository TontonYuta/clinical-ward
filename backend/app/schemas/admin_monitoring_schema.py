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
    quota_status: str = "15 RPM / Normal"
    is_active: bool = True
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

class TestKeyResponse(BaseModel):
    success: bool
    status: str
    message: str
    latency_ms: float
    available_models: List[str]

class BudgetCapConfig(BaseModel):
    daily_token_limit: int = Field(default=500000, ge=10000)
    monthly_token_limit: int = Field(default=10000000, ge=100000)
    auto_offline_fallback: bool = True
    alert_on_threshold_pct: int = 80

class BudgetCapResponse(BaseModel):
    config: BudgetCapConfig
    today_tokens_used: int
    month_tokens_used: int
    today_usage_pct: float
    estimated_cost_vnd: float
    saved_cost_vnd: float
    throttling_status: str = "normal"

class TelemetryEventItem(BaseModel):
    id: str
    timestamp: str
    event_type: str        # "CACHE_HIT", "ADAPTIVE_RAG", "BHYT_SUBSTITUTION", "GUARDRAIL_BLOCKED"
    query: str
    user_role: str
    latency_ms: float
    tokens: int
    status: str            # "success", "blocked", "fallback"
    reply_text: Optional[str] = None
    intent: Optional[str] = None
    user_name: Optional[str] = None
    session_id: Optional[str] = None
    grounded_source: Optional[str] = None
    quality_category: Optional[str] = None

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
    recent_events: List[TelemetryEventItem]
    intent_distribution: List[Dict[str, Any]]
    timeline_trend: List[Dict[str, Any]]
