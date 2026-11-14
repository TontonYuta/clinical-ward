/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Định nghĩa Giao tiếp Hội thoại, Thẻ Tác tử & Cảnh báo CDSS
 */

import { DashboardTab } from './auth';

export interface ChatAttachment {
  type: 'image' | 'voice' | 'document';
  url?: string;
  title: string;
  description?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface ActionPayload {
  type:
    | 'DEBT_ADDED'
    | 'TICKET_CREATED'
    | 'FEFO_DISPATCHED'
    | 'INSPECTION_CHECK'
    | 'OUTAGE_SIMULATION'
    | 'DEBT_REMINDER'
    | 'ASSET_AUDIT'
    | 'AMPOULE_RETURNED'
    | 'RESTOCK_CHECK'
    | 'RESTOCK_APPROVED'
    | 'PRESCRIPTION_CREATED'
    | 'MEDICATION_SCHEDULE_CREATED'
    | 'MEDICATION_REMINDER_SENT';
  data?: any;
  targetTab?: DashboardTab;
}

export interface CdssAlert {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  antidoteRecommendation?: string;
  regulatoryReference?: string;
  substituteDrug?: string;
}

export interface AgentActionCard {
  cardType:
    | 'borrow_confirm'
    | 'incident_confirm'
    | 'fefo_report'
    | 'low_stock_report'
    | 'equipment_report'
    | 'coldchain_status'
    | 'audit_integrity'
    | 'legal_guide'
    | 'shift_handover_report'
    | 'ocr_invoice_confirm'
    | 'biomedical_diagnostics'
    | 'medication_safety'
    | 'medication_schedule'
    | 'cpoe_prescription'
    | 'cpoe_prescription_draft'
    | 'cpoe_navigation'
    | 'debt_settle';
  title: string;
  summary: string;
  data: any;
  primaryActionLabel?: string;
  primaryActionType?: string;
  targetTab?: DashboardTab;
  status?: 'pending' | 'executed' | 'cancelled';
  cdssAlert?: CdssAlert;
}

export interface EvidenceRecord {
  evidence_id: string;
  evidence_type: "document_chunk" | "knowledge_graph";
  source_id: string;
  source_version?: string | null;
  content: string;
  chunk_id?: string | null;
  source_name?: string | null;
  section?: string | null;
}

export interface ClinicalClaim {
  claim_id: string;
  text: string;
  evidence_ids: string[];
  support_status?: 'supported' | 'partial' | 'unsupported' | 'conflicting';
}

export interface RagCitationItem {
  source: string;
  legal_basis: string;
  section?: string;
  title?: string;
  excerpt?: string;
  relevance_score?: number;
  chunk_id?: string;
  url?: string | null;
  document_id?: string | null;
  page?: number | null;
}

export interface ClinicalSummary {
  headline: string;
  key_takeaway: string;
  urgency?: 'routine' | 'warning' | 'emergency';
}

export interface DrugIdentityData {
  brand_name: string;
  inn?: string | null;
  national_code?: string | null;
  sdk?: string | null;
  drug_class?: string | null;
  dosage_form?: string | null;
}

export interface DosageDetailData {
  standard_dose?: string | null;
  frequency?: string | null;
  max_daily?: string | null;
  routes?: string[];
  weight_based?: string | null;
  timing_instruction?: string | null;
  special_notes?: string[];
}

export interface DosageMatrixData {
  adult?: DosageDetailData | null;
  pediatric?: DosageDetailData | null;
}

export interface DdiFindingData {
  drug_a: string;
  drug_b: string;
  severity: 'critical' | 'warning' | 'info';
  mechanism?: string | null;
  clinical_action?: string | null;
  substitute_drug?: string | null;
  regulatory_reference?: string | null;
}

export interface AbstentionDetailsData {
  reason_code: string;
  unresolved_entities: string[];
  professional_recommendations: string[];
}

export interface StructuredClinicalPayload {
  drug_identity?: DrugIdentityData | null;
  dosage_matrix?: DosageMatrixData | null;
  indications?: string[];
  contraindications?: string[];
  adverse_effects?: string[];
  timing_and_administration?: string | null;
  special_warnings?: string[];
  ddi_findings?: DdiFindingData[];
  abstention_details?: AbstentionDetailsData | null;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  clinicalSummary?: ClinicalSummary;
  clinicalData?: StructuredClinicalPayload;
  attachments?: ChatAttachment[];
  legalReference?: {
    lawCode: string;
    title: string;
    clause: string;
  };
  actionPayload?: ActionPayload;
  card?: AgentActionCard;
  suggestedChips?: string[];
  cdssAlert?: CdssAlert;
  pipelineStage?: 'offline_engine' | 'cloud_gemini_vision' | 'cloud_gemini_reasoning';
  citations?: RagCitationItem[];
  evidence?: EvidenceRecord[];
  claims?: ClinicalClaim[];
  evidenceClaimMap?: Record<string, string[]>;
  usageSource?: 'provider' | 'estimated' | 'mixed' | 'none';
  modelCallCount?: number;
  usageCallCount?: number;
  cacheHitCount?: number;
  availabilityMode?: 'online_ai' | 'local_only' | 'offline' | 'checking';
  provider?: string | null;
  ragGrounded?: boolean;
  answerType?: string;
  sourceStatus?: string;
  confidence?: number;
  abstentionReason?: string;
  isStreaming?: boolean;
}

export interface QuickSuggestionChip {
  id: string;
  label: string;
  fullPrompt: string;
  badge: string;
  category: 'cpoe' | 'debt' | 'equipment' | 'fefo' | 'coldchain' | 'inspection' | 'asset_audit';
}
