export type AdminTab = 'telemetry' | 'key_vault' | 'budget_cap' | 'safety_audit';

export interface ApiKeyItem {
  key_id: string;
  name: string;
  masked_key: string;
  provider: string;
  status: 'active' | 'rate_limited' | 'invalid' | 'standby';
  quota_status: string;
  is_active: boolean;
  created_at: number;
  latency_ms?: number;
  last_checked_at?: number;
  tokens_used_today?: number;
  requests_count?: number;
  error_429_count?: number;
  last_used_at?: string;
}

export interface BudgetCapConfig {
  daily_token_limit: number;
  monthly_token_limit: number;
  auto_offline_fallback: boolean;
  alert_on_threshold_pct: number;
}

export interface BudgetCapResponse {
  config: BudgetCapConfig;
  today_tokens_used: number;
  month_tokens_used: number;
  today_usage_pct: number;
  estimated_cost_vnd: number;
  saved_cost_vnd: number;
  throttling_status?: 'normal' | 'adaptive_throttling' | 'offline_fallback';
}

export interface TelemetryEventItem {
  id: string;
  timestamp: string;
  event_type: 'CACHE_HIT' | 'ADAPTIVE_RAG' | 'BHYT_SUBSTITUTION' | 'DDI_BLOCKED' | 'GUARDRAIL_BLOCKED';
  query: string;
  user_role: string;
  latency_ms: number;
  tokens: number;
  status: 'success' | 'blocked' | 'fallback';
  reply_text?: string;
  intent?: string;
  user_name?: string;
  session_id?: string;
  grounded_source?: string;
  quality_category?: string;
}

export interface TelemetryOverviewResponse {
  total_queries: number;
  cache_hit_rate_pct: number;
  exact_hits: number;
  semantic_hits: number;
  tokens_consumed: number;
  tokens_saved: number;
  cost_saved_vnd: number;
  p95_latency_ms: number;
  bhyt_audited: number;
  bhyt_rejection_saved_vnd: number;
  ddi_blocks_count: number;
  guardrail_blocks_count: number;
  recent_events: TelemetryEventItem[];
  intent_distribution: Array<{
    intent: string;
    count: number;
    pct: number;
    color: string;
  }>;
  timeline_trend: Array<{
    day: string;
    consumed_k: number;
    saved_k: number;
  }>;
}

export interface TestKeyResponse {
  success: boolean;
  status: string;
  message: string;
  latency_ms: number;
  available_models: string[];
}
