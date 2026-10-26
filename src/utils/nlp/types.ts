/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ActionPayload,
  ChatMessage,
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  ColdChainMonitorState,
  AssetAuditRecord,
  UserProfile
} from '../../types/clinical';
import { AgentActionCard } from '../../types/chat';

export interface ProcessedQueryResult {
  replyMessage: ChatMessage;
  actionPayload?: ActionPayload;
  card?: AgentActionCard;
}

export interface ClinicalQueryState {
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  coldChainTemp: number;
}

export interface AsyncClinicalState {
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  coldChainState: ColdChainMonitorState;
  assets: AssetAuditRecord[];
}

export function anyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some(k => text.includes(k.toLowerCase()));
}
