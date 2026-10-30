/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Điều phối xử lý câu hỏi lâm sàng bất đồng bộ (Action Cards & Gemini AI) (<=120 LOC)
 */

import { ActionPayload, ChatMessage, UserProfile, AgentActionCard } from '../../types/clinical';
import { chatCopilotApi } from '../../services/api';
import { askGeminiClinicalCopilot, isCloudAIAvailable } from '../../services/geminiService';
import { processGeminiClinicalScenario, isClinicalScenarioQuery } from '../../services/gemini/clinicalScenarios';
import { AsyncClinicalState, ProcessedQueryResult } from './types';
import { processClinicalUserQuery } from './queryProcessor';
import { matchDrugInteractionIntent } from './intents/medicationSafetyIntent';
import { validateClientInputGuardrail, validateClientOutputGuardrail } from '../security/clinicalGuardrails';

let _clientSessionId: string = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

export async function processClinicalAgentQueryAsync(
  rawInput: string,
  currentState: AsyncClinicalState,
  currentUserProfile?: UserProfile
): Promise<ProcessedQueryResult> {
  const role = currentUserProfile?.role || 'nurse';
  const name = currentUserProfile?.name || 'Điều Dưỡng Trực Ca';

  // 0. Client Guardrail: Quét và chặn tức thì SQL Injection / Prompt Injection
  const guardCheck = validateClientInputGuardrail(rawInput);
  if (!guardCheck.isSafe) {
    const blockedMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'agent',
      text: guardCheck.safeResponse || '🛡️ Yêu cầu bị chặn do vi phạm chính sách bảo mật hệ thống.',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      cdssAlert: {
        level: guardCheck.violationType === 'sql_injection' || guardCheck.violationType === 'clinical_bypass' ? 'critical' : 'warning',
        title: 'CẢNH BÁO AN TOÀN HỆ THỐNG',
        message: guardCheck.threatDescription || 'Yêu cầu không an toàn bị chặn.',
      },
      suggestedChips: ['Tra cứu Dược Thư 2015', 'Thông tư 20/2017/TT-BYT', 'Hướng dẫn an toàn hệ thống']
    };
    return { replyMessage: blockedMsg };
  }

  const cleanInput = guardCheck.sanitizedQuery;

  // 1. Phân tích kịch bản nghiệp vụ có Action Card (Mượn thuốc, Báo hỏng, Giao ban, Kho FEFO...)
  const localResult = processClinicalUserQuery(cleanInput, {
    debts: currentState.debts,
    tickets: currentState.tickets,
    batches: currentState.batches,
    coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5
  });

  const lower = cleanInput.toLowerCase();
  if (matchDrugInteractionIntent(lower)) {
    if (localResult.replyMessage) {
      localResult.replyMessage.text = validateClientOutputGuardrail(localResult.replyMessage.text, cleanInput);
    }
    return localResult;
  }
  // Nếu câu lệnh tạo thẻ tương tác (Action Card) -> Phản hồi ngay (0ms, 0 tokens)
  // Ngoại trừ kịch bản lâm sàng chuyên sâu (Allergy, Renal, ADR...) và dược lý sâu cần RAG phân tích
  const isDeepPharmacology = /thời gian bán thải|huyết tương|dược động học|cơ chế tác dụng|tương tác|chống chỉ định|liều tối đa/i.test(lower);
  if ((localResult.replyMessage?.card || localResult.actionPayload) && !isClinicalScenarioQuery(lower) && !isDeepPharmacology) {
    return localResult;
  }

  // 2. Thử gọi qua FastAPI Copilot Backend (nắm giữ 54.885 CSDL Cục QLD & tồn kho thực tế)
  try {
    const backendData = await chatCopilotApi(cleanInput, role, name, _clientSessionId);
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
        if (card.targetTab && (card.cardType === 'borrow_confirm' || card.cardType === 'incident_confirm')) {
          actionPayload = {
            type: card.cardType === 'borrow_confirm' ? 'DEBT_ADDED' : 'TICKET_CREATED',
            targetTab: card.targetTab
          };
        }
      }

      const replyMessage: ChatMessage = {
        id: `msg-agent-${Date.now()}`,
        sender: 'agent',
        text: validateClientOutputGuardrail(backendData.reply_text, cleanInput),
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        legalReference: backendData.legal_basis ? {
          lawCode: backendData.legal_basis.split('-')[0].trim(),
          title: backendData.legal_basis,
          clause: 'Căn cứ áp dụng'
        } : undefined,
        actionPayload,
        card,
        suggestedChips: backendData.suggested_chips || [],
        citations: backendData.citations,
        ragGrounded: backendData.rag_grounded
      };

      return { replyMessage, actionPayload, card };
    }
  } catch {}

  // 3. Xử lý 8 Kịch Bản Lâm Sàng Chuyên Sâu Tác Tử Gemini AI & Hồ Sơ Bệnh Nhân (Allergy, Renal, ADR...)
  const scenarioResult = await processGeminiClinicalScenario(
    rawInput,
    new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    currentState.coldChainState
  );
  if (scenarioResult) {
    if (scenarioResult.replyMessage) {
      scenarioResult.replyMessage.text = validateClientOutputGuardrail(scenarioResult.replyMessage.text, cleanInput);
    }
    return scenarioResult;
  }

  // 4. Với các câu hỏi lâm sàng tự do, dược lý: Sử dụng Gemini Flash-Lite tối ưu chi phí
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
          text: validateClientOutputGuardrail(geminiAnswer, cleanInput),
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          suggestedChips: ['Đối soát ca trực 07:00 AM', 'Lập phiếu dự trù Mẫu 01', 'Kiểm tra tồn kho FEFO']
        };
        return { replyMessage };
      }
    } catch (e) {
      console.warn('Gemini query bypassed:', e);
    }
  }

  // 5. Fallback cuối cùng: Trả về hướng dẫn lâm sàng
  if (localResult.replyMessage) {
    localResult.replyMessage.text = validateClientOutputGuardrail(localResult.replyMessage.text, cleanInput);
  }
  return localResult;
}
