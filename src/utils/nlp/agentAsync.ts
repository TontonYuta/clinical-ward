/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ActionPayload,
  ChatMessage,
  UserProfile,
  AgentActionCard
} from '../../types/clinical';
import { chatCopilotApi } from '../../services/api';
import { askGeminiClinicalCopilot } from '../../services/geminiService';
import { anyKeyword, AsyncClinicalState, ProcessedQueryResult } from './types';
import { processClinicalUserQuery } from './queryProcessor';

export async function processClinicalAgentQueryAsync(
  rawInput: string,
  currentState: AsyncClinicalState,
  currentUserProfile?: UserProfile
): Promise<ProcessedQueryResult> {
  const role = currentUserProfile?.role || 'nurse';
  const name = currentUserProfile?.name || 'Điều Dưỡng Trực Ca';
  const lower = rawInput.trim().toLowerCase();

  const isShiftHandover = anyKeyword(lower, [
    'đối soát', 'giao ban', 'ca trực', 'ca đêm', 'báo cáo ca', 'chốt ca', 'bàn giao ca', '07:00', 'lệch sổ', 'tổng hợp nợ'
  ]);
  if (isShiftHandover) {
    return processClinicalUserQuery(rawInput, {
      debts: currentState.debts,
      tickets: currentState.tickets,
      batches: currentState.batches,
      coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5
    });
  }

  const isClinicalInquiry = anyKeyword(lower, [
    'phác đồ', 'sốc phản vệ', 'adrenalin', 'liều', 'tiêm thế nào', 'vỡ ống',
    'quy định', 'thông tư', 'nghị định', 'tiêu chuẩn', 'giải thích', 'tại sao',
    'hướng dẫn', 'làm sao', 'xử lý thế nào', 'quy trình', 'căn cứ', 'iec 60601',
    'arrhenius', 'mkt', 'vvm', 'tiêu hủy'
  ]);

  if (isClinicalInquiry) {
    try {
      const geminiAnswer = await askGeminiClinicalCopilot(rawInput, {
        activeDebtsCount: currentState.debts.filter(d => d.status === 'debt').length,
        pendingAmpoulesCount: currentState.debts.filter(d => d.itemType === 'Thuốc gây nghiện' && !d.ampouleReturned).length,
        urgentTicketsCount: currentState.tickets.filter(t => t.urgency === 'urgent' && t.status !== 'resolved').length,
        lowStockBatchesCount: currentState.batches.filter(b => b.isLowStock || b.currentStock <= b.minThreshold).length,
        coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5,
        role
      });

      if (geminiAnswer) {
        const replyMessage: ChatMessage = {
          id: `msg-agent-gemini-${Date.now()}`,
          sender: 'agent',
          text: geminiAnswer,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          suggestedChips: ['Đối soát ca trực 07:00 AM', 'Lập phiếu dự trù Mẫu 01', 'Kiểm tra tồn kho FEFO']
        };
        return { replyMessage };
      }
    } catch (e) {
      console.warn('Gemini query bypassed:', e);
    }
  }

  try {
    const backendData = await chatCopilotApi(rawInput, role, name);
    if (backendData && backendData.reply_text && backendData.intent !== 'GENERAL_CLINICAL_ASSISTANCE') {
      let card: AgentActionCard | undefined = undefined;
      let actionPayload: ActionPayload | undefined = undefined;

      if (backendData.card) {
        card = {
          cardType: backendData.card.card_type as any,
          title: backendData.card.title,
          summary: backendData.card.summary,
          data: backendData.card.data,
          primaryActionLabel: backendData.card.primary_action_label,
          primaryActionType: backendData.card.primary_action_type,
          targetTab: backendData.card.target_tab as any,
          status: 'pending'
        };

        if (card.targetTab) {
          actionPayload = {
            type: card.cardType === 'borrow_confirm' ? 'DEBT_ADDED' : card.cardType === 'incident_confirm' ? 'TICKET_CREATED' : 'FEFO_DISPATCHED',
            targetTab: card.targetTab
          };
        }
      }

      const replyMessage: ChatMessage = {
        id: `msg-agent-${Date.now()}`,
        sender: 'agent',
        text: backendData.reply_text,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        legalReference: backendData.legal_basis ? {
          lawCode: backendData.legal_basis.split('-')[0].trim(),
          title: backendData.legal_basis,
          clause: 'Căn cứ áp dụng'
        } : undefined,
        actionPayload,
        card,
        suggestedChips: backendData.suggested_chips || []
      };

      return { replyMessage, actionPayload };
    }
  } catch (err) {
    // Backend offline / fetch failed -> Fallback to intelligent local NLP Parser
  }

  return processClinicalUserQuery(rawInput, {
    debts: currentState.debts,
    tickets: currentState.tickets,
    batches: currentState.batches,
    coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5
  });
}
