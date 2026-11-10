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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
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
