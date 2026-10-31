/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Điều phối xử lý câu hỏi lâm sàng bất đồng bộ (Action Cards & Gemini AI) (<=120 LOC)
 */

import { ActionPayload, ChatMessage, UserProfile, AgentActionCard } from '../../types/clinical';
import { chatCopilotApi, checkPairDdiApi } from '../../services/api';
import { askGeminiClinicalCopilot, isCloudAIAvailable } from '../../services/geminiService';
import { processGeminiClinicalScenario, isClinicalScenarioQuery } from '../../services/gemini/clinicalScenarios';
import { AsyncClinicalState, ProcessedQueryResult } from './types';
import { processClinicalUserQuery } from './queryProcessor';
import { matchDrugInteractionIntent, extractDrugPair, handleDrugInteractionIntent } from './intents/drugInteractionIntent';
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

  // DDI queries use the authoritative FastAPI catalog. A backend failure is
  // reported explicitly instead of being rendered as "no interaction".
  const lower = cleanInput.toLowerCase();
  if (matchDrugInteractionIntent(lower)) {
    const pair = extractDrugPair(lower);
    const ddiChips = ['Kiểm tra Clopidogrel + Omeprazol', 'Kiểm tra Nitroglycerin + Sildenafil', 'Kiểm tra Ceftriaxone + Calci', 'Kiểm tra Warfarin + Aspirin'];
    if (!pair) {
      return { replyMessage: {
        id: `msg-ddi-pair-${Date.now()}`, sender: 'agent',
        text: 'Để rà soát tương tác thuốc (QĐ 5948/QĐ-BYT), vui lòng nêu tên hai thuốc hoặc hoạt chất (ví dụ: *Clopidogrel và Omeprazol*). Bác sĩ có thể bấm chọn nhanh các cặp kiểm tra bên dưới:',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        suggestedChips: ddiChips
      } };
    }
    try {
      const ddi = await checkPairDdiApi(pair[0], pair[1]);
      const isCrit = ddi.alert?.severity?.toUpperCase().includes('CONTRAINDICATED') || ddi.alert?.severity?.toLowerCase().includes('chống chỉ định');
      const cdssAlert = ddi.has_interaction && ddi.alert ? {
        level: (isCrit ? 'critical' : 'warning') as 'critical' | 'warning',
        title: ddi.alert.title || `CẢNH BÁO TƯƠNG TÁC: ${pair[0].toUpperCase()} + ${pair[1].toUpperCase()}`,
        message: `${ddi.alert.consequence} (${ddi.alert.mechanism || ''})`,
        antidoteRecommendation: ddi.alert.action,
        regulatoryReference: ddi.alert.source || 'QĐ 5948/QĐ-BYT'
      } : undefined;

      const replyText = ddi.has_interaction && ddi.alert
        ? `### ⚠️ Cảnh Báo Tương Tác Thuốc (QĐ 5948/QĐ-BYT)\n\n**${ddi.alert.title}**\n\n- **Hậu quả lâm sàng:** ${ddi.alert.consequence}\n- **Cơ chế dược lý:** ${ddi.alert.mechanism}\n- **Hướng xử trí:** ${ddi.alert.action}\n- **Mức độ:** **${ddi.alert.severity}**\n- **Căn cứ pháp lý:** ${ddi.alert.source}`
        : `### Kết quả tra cứu tương tác: ${pair[0]} + ${pair[1]}\n\nChưa tìm thấy tương tác chống chỉ định trong danh mục QĐ 5948/QĐ-BYT cho **${pair[0]} + ${pair[1]}**. Lưu ý kết quả này không khẳng định hoàn toàn phối hợp an toàn; cần theo dõi sát chức năng gan thận và các chỉ số sinh tồn của người bệnh.`;

      return { replyMessage: {
        id: `msg-ddi-api-${Date.now()}`, sender: 'agent', text: replyText,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        legalReference: { lawCode: 'QĐ 5948/QĐ-BYT', title: 'Danh mục tương tác thuốc Bộ Y Tế', clause: 'Sàng lọc tương tác thuốc' },
        cdssAlert, suggestedChips: ddiChips, ragGrounded: true
      } };
    } catch {
      return handleDrugInteractionIntent(cleanInput, lower, new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
    }
  }

  // 1. Phân tích kịch bản nghiệp vụ có Action Card (Mượn thuốc, Báo hỏng, Giao ban, Kho FEFO...)
  const localResult = processClinicalUserQuery(cleanInput, {
    debts: currentState.debts,
    tickets: currentState.tickets,
    batches: currentState.batches,
    coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5
  });

  const isDdi = matchDrugInteractionIntent(lower);
  const isDeepPharmacology = isDdi || /thời gian bán thải|huyết tương|dược động học|cơ chế tác dụng|tương tác|chống chỉ định|liều tối đa/i.test(lower);
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
        ragGrounded: backendData.rag_grounded,
        answerType: backendData.answer_type,
        sourceStatus: backendData.source_status,
        confidence: backendData.confidence,
        abstentionReason: backendData.abstention_reason
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
