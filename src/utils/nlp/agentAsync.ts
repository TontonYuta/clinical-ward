/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Điều phối xử lý câu hỏi lâm sàng bất đồng bộ (Action Cards & Gemini AI) (<=120 LOC)
 */

import { ActionPayload, ChatMessage, UserProfile, AgentActionCard } from '../../types/clinical';
import { chatCopilotApi } from '../../services/api';
import { askGeminiClinicalCopilot, isCloudAIAvailable } from '../../services/geminiService';
import { AsyncClinicalState, ProcessedQueryResult } from './types';
import { processClinicalUserQuery } from './queryProcessor';

export async function processClinicalAgentQueryAsync(
  rawInput: string,
  currentState: AsyncClinicalState,
  currentUserProfile?: UserProfile
): Promise<ProcessedQueryResult> {
  const role = currentUserProfile?.role || 'nurse';
  const name = currentUserProfile?.name || 'Điều Dưỡng Trực Ca';

  // 1. Phân tích kịch bản nghiệp vụ có Action Card (Mượn thuốc, Báo hỏng, Giao ban, Kho FEFO...)
  const localResult = processClinicalUserQuery(rawInput, {
    debts: currentState.debts,
    tickets: currentState.tickets,
    batches: currentState.batches,
    coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5
  });

  // Nếu câu lệnh tạo thẻ tương tác (Action Card) hoặc hành động dữ liệu -> Phản hồi ngay (0ms, 0 tokens)
  if (localResult.card || localResult.actionPayload) {
    return localResult;
  }

  // 2. Với các câu hỏi lâm sàng tự do, dược lý, tra cứu: Sử dụng Gemini Flash-Lite tối ưu chi phí
  if (isCloudAIAvailable()) {
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

  // 3. Nếu chưa kích hoạt Cloud AI, thử gọi qua FastAPI Copilot Backend
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
  } catch {}

  // 4. Fallback cuối cùng: Trả về hướng dẫn lâm sàng
  return localResult;
}
