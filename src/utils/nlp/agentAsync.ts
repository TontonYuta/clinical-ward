/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Điều phối xử lý câu hỏi lâm sàng bất đồng bộ (Action Cards & Gemini AI) (<200 LOC)
 */

import { ActionPayload, ChatMessage, UserProfile, AgentActionCard } from '../../types/clinical';
import { chatCopilotApi, checkPairDdiApi } from '../../services/api';
import { askGeminiClinicalCopilot, isCloudAIAvailable } from '../../services/geminiService';
import { processGeminiClinicalScenario, isClinicalScenarioQuery } from '../../services/gemini/clinicalScenarios';
import { AsyncClinicalState, ProcessedQueryResult } from './types';
import { processClinicalUserQuery } from './queryProcessor';
import { matchDrugInteractionIntent, extractDrugPair } from './intents/drugInteractionIntent';
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
    return {
      replyMessage: {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: guardCheck.safeResponse || '🛡️ Yêu cầu bị chặn do vi phạm chính sách bảo mật hệ thống.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        cdssAlert: {
          level: guardCheck.violationType === 'sql_injection' || guardCheck.violationType === 'clinical_bypass' ? 'critical' : 'warning',
          title: 'CẢNH BÁO AN TOÀN HỆ THỐNG',
          message: guardCheck.threatDescription || 'Yêu cầu không an toàn bị chặn.',
        },
        suggestedChips: ['Tra cứu Dược Thư Quốc Gia', 'Quy định bảo quản Morphin TT 20', 'Hướng dẫn sử dụng hệ thống']
      }
    };
  }

  const cleanInput = guardCheck.sanitizedQuery;
  const lower = cleanInput.toLowerCase();

  // DDI queries: pair check via authoritative FastAPI catalog.
  if (matchDrugInteractionIntent(lower)) {
    const pair = extractDrugPair(lower);
    const ddiChips = ['Kiểm tra Clopidogrel + Omeprazol', 'Kiểm tra Nitroglycerin + Sildenafil', 'Kiểm tra Ceftriaxone + Calci', 'Kiểm tra Warfarin + Aspirin'];
    if (pair) {
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
          : `### Chưa ghi nhận cảnh báo trong chỉ mục: ${pair[0]} + ${pair[1]}\n\n${ddi.coverage_note || 'Chưa tìm thấy trong danh mục đã lập chỉ mục; điều này không khẳng định phối hợp an toàn.'}`;
        return { replyMessage: {
          id: `msg-agent-ddi-api-${Date.now()}`, sender: 'agent', text: replyText,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          legalReference: { lawCode: 'QĐ 5948/QĐ-BYT', title: 'Danh mục tương tác thuốc Bộ Y Tế', clause: 'Sàng lọc tương tác thuốc' },
          cdssAlert, suggestedChips: ddiChips, ragGrounded: true
        } };
      } catch {
        return { replyMessage: {
          id: `msg-agent-ddi-offline-${Date.now()}`, sender: 'agent',
          text: `### Chưa thể kết luận về tương tác thuốc\n\nKhông truy cập được bộ máy DDI nên cặp **${pair[0]} + ${pair[1]}** chưa được kiểm tra. Đây không phải kết quả âm tính hay xác nhận an toàn. Hãy thử lại khi kết nối backend hoạt động hoặc nhờ dược sĩ lâm sàng rà soát.`,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), suggestedChips: ddiChips,
          cdssAlert: { level: 'warning', title: 'CHƯA HOÀN TẤT KIỂM TRA TƯƠNG TÁC', message: 'Nguồn DDI không truy cập được; chưa thể đưa ra kết luận cho cặp thuốc này.' }
        } };
      }
    }
  }

  // 1. Phân tích kịch bản nghiệp vụ có Action Card (Mượn thuốc, Báo hỏng, Giao ban, Kho FEFO...)
  const localResult = processClinicalUserQuery(cleanInput, {
    debts: currentState.debts, tickets: currentState.tickets, batches: currentState.batches,
    coldChainTemp: currentState.coldChainState?.currentTemp ?? 4.5
  }, role);

  const isSpecificMedicationField = Boolean(
    /(?:chỉ định|chi dinh|thành phần|thanh phan|liều dùng|liều lượng|chống chỉ định|tác dụng phụ|cơ chế|đường dùng|tần suất|tương tác)/i.test(lower) &&
    /paracetamol|acetaminophen|thuốc|thuoc|hoạt chất|hoat chat/i.test(lower)
  );
  const isDdi = matchDrugInteractionIntent(lower);
  const isDeepPharmacology = isDdi || /thời gian bán thải|huyết tương|dược động học|cơ chế tác dụng|tương tác|chống chỉ định|liều tối đa/i.test(lower);
  if ((localResult.replyMessage?.card || localResult.actionPayload) && !isClinicalScenarioQuery(lower) && !isDeepPharmacology && !isSpecificMedicationField) {
    return localResult;
  }

  // 2. Gọi qua FastAPI Copilot Backend (CSDL 54.885 thuốc DAV & tồn kho thực tế)
  try {
    const backendData = await chatCopilotApi(cleanInput, role, name, _clientSessionId);
    if (backendData && backendData.reply_text) {
      let card: AgentActionCard | undefined = undefined;
      let actionPayload: ActionPayload | undefined = undefined;
      if (backendData.card) {
        card = {
          cardType: backendData.card.card_type as any, title: backendData.card.title,
          summary: backendData.card.summary, data: backendData.card.data,
          primaryActionLabel: backendData.card.primary_action_label,
          primaryActionType: backendData.card.primary_action_type,
          targetTab: backendData.card.target_tab as any, status: 'pending'
        };
        if (card.targetTab && (card.cardType === 'borrow_confirm' || card.cardType === 'incident_confirm')) {
          actionPayload = { type: card.cardType === 'borrow_confirm' ? 'DEBT_ADDED' : 'TICKET_CREATED', targetTab: card.targetTab };
        }
      }
      return {
        replyMessage: {
          id: `msg-agent-${Date.now()}`, sender: 'agent',
          text: validateClientOutputGuardrail(backendData.reply_text, cleanInput),
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          legalReference: backendData.legal_basis ? {
            lawCode: backendData.legal_basis.split('-')[0].trim(), title: backendData.legal_basis, clause: 'Căn cứ áp dụng'
          } : undefined,
          actionPayload, card,
          suggestedChips: backendData.suggested_chips || [],
          citations: backendData.citations || [],
          ragGrounded: backendData.rag_grounded,
          answerType: backendData.answer_type,
          sourceStatus: backendData.source_status,
          confidence: backendData.confidence,
          abstentionReason: backendData.abstention_reason
        },
        actionPayload, card
      };
    }
  } catch {}

  if (isSpecificMedicationField) {
    return { replyMessage: {
      id: `msg-agent-medication-field-unavailable-${Date.now()}`, sender: 'agent',
      text: 'Hiện chưa truy cập được nguồn tra cứu để xác minh trường thông tin thuốc này. Vui lòng thử lại khi kết nối backend hoạt động.',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      answerType: 'abstention', sourceStatus: 'backend_unavailable'
    } };
  }

  // 3. Xử lý 8 Kịch Bản Lâm Sàng Chuyên Sâu Tác Tử Gemini AI & Hồ Sơ Bệnh Nhân
  const scenarioResult = await processGeminiClinicalScenario(
    rawInput, new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), currentState.coldChainState
  );
  if (scenarioResult) {
    if (scenarioResult.replyMessage) {
      scenarioResult.replyMessage.text = validateClientOutputGuardrail(scenarioResult.replyMessage.text, cleanInput);
    }
    return scenarioResult;
  }

  // 4. Với các câu hỏi lâm sàng tự do, dược lý: Gemini Flash-Lite
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
        return { replyMessage: {
          id: `msg-agent-gemini-${Date.now()}`, sender: 'agent',
          text: validateClientOutputGuardrail(geminiAnswer, cleanInput),
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          suggestedChips: ['Đối soát ca trực 07:00 AM', 'Lập phiếu dự trù Mẫu 01', 'Kiểm tra tồn kho FEFO']
        } };
      }
    } catch (e) {
      console.warn('Gemini query bypassed:', e);
    }
  }

  // 5. Fallback cuối cùng
  if (localResult.replyMessage) {
    localResult.replyMessage.text = validateClientOutputGuardrail(localResult.replyMessage.text, cleanInput);
  }
  return localResult;
}
