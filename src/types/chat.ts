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
    | 'medication_schedule';
  title: string;
  summary: string;
  data: any;
  primaryActionLabel?: string;
  primaryActionType?: string;
  targetTab?: DashboardTab;
  status?: 'pending' | 'executed' | 'cancelled';
  cdssAlert?: CdssAlert;
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
}

export interface QuickSuggestionChip {
  id: string;
  label: string;
  fullPrompt: string;
  badge: string;
  category: 'cpoe' | 'debt' | 'equipment' | 'fefo' | 'coldchain' | 'inspection' | 'asset_audit';
}
