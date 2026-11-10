export type AdminTab = 'telemetry' | 'key_vault' | 'integrations' | 'budget_cap' | 'safety_audit';

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
  event_type: 'CACHE_HIT' | 'ADAPTIVE_RAG' | 'BHYT_SUBSTITUTION' | 'DDI_BLOCKED' | 'GUARDRAIL_BLOCKED' | 'VISION_OCR_BHYT' | 'MULTIMODAL_CLINICAL_VISION' | string;
  query: string;
  user_role: string;
  latency_ms: number;
  tokens: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  model_name?: string;
  provider?: string;
  has_image?: boolean;
  image_tokens?: number;
  status: 'success' | 'blocked' | 'fallback';
  reply_text?: string;
  intent?: string;
  user_name?: string;
  session_id?: string;
  grounded_source?: string;
  quality_category?: string;
}

export interface BhytViolationDetail {
  id: string;
  drug_code?: string;
  drug_name?: string;
  active_ingredient?: string;
  severity: string;
  category: string;
  title: string;
  detail: string;
  rejection_risk_vnd?: number;
  action?: string;
  legal_ref?: {
    doc_code?: string;
    doc_title?: string;
    section?: string;
    page_number?: number;
  };
}

export interface BhytAuditLogItem {
  id: string;
  prescription_id: string;
  patient_name: string;
  insurance_card_number: string;
  hospital_rank: string;
  treatment_type: string;
  primary_icd10: string;
  status: 'PASS' | 'WARNING' | 'REJECT' | 'ERROR' | string;
  total_cost_vnd: number;
  at_risk_cost_vnd: number;
  violations_count: number;
  violations_json?: string;
  violations?: BhytViolationDetail[];
  created_at?: string;
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
  bhyt_logs?: BhytAuditLogItem[];
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

export interface EsmsLogItem {
  id: string;
  patient_id?: string;
  patient_name: string;
  recipient_phone: string;
  message_type: string;
  content: string;
  characters_count: number;
  sms_segments: number;
  provider: string;
  status: string;
  delivery_receipt?: string;
  error_detail?: string;
  created_at: string;
}

export interface EsmsStatusResponse {
  configured: boolean;
  api_key_masked: string;
  secret_key_masked: string;
  brandname: string;
  is_sandbox: boolean;
  balance_vnd?: number;
  user_id?: number;
  status: 'connected' | 'error' | 'unconfigured';
  total_sms: number;
  delivered_count: number;
  failed_count: number;
  last_sent_at?: string;
  recent_logs: EsmsLogItem[];
}

export interface GasLogItem {
  id: string;
  prescription_id?: string;
  patient_name: string;
  patient_email: string;
  patient_phone?: string;
  diagnosis?: string;
  doctor_name?: string;
  notification_status: string;
  email_sent_at?: string;
  created_at: string;
}

export interface GasStatusResponse {
  configured: boolean;
  webhook_url_masked: string;
  raw_webhook_url?: string;
  status: 'ready' | 'unconfigured';
  total_advices: number;
  sent_count: number;
  last_sent_at?: string;
  recent_logs: GasLogItem[];
}
