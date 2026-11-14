/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Điều phối xử lý câu hỏi lâm sàng bất đồng bộ (Action Cards & Gemini AI) (<200 LOC)
 */

import { ActionPayload, UserProfile, AgentActionCard } from '../../types/clinical';
import { chatCopilotApiStream } from '../../services/api';
import { AsyncClinicalState, ProcessedQueryResult } from './types';
import { validateClientInputGuardrail, validateClientOutputGuardrail } from '../security/clinicalGuardrails';

let _clientSessionId: string = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

export function setClientSessionId(sessionId: string): void {
  if (sessionId) _clientSessionId = sessionId;
}

export function getClientSessionId(): string {
  return _clientSessionId;
}

export async function processClinicalAgentQueryAsync(
  rawInput: string,
  _currentState: AsyncClinicalState,
  currentUserProfile?: UserProfile,
  onToken?: (token: string, currentFullText: string) => void,
  sessionId?: string,
  attachment?: any
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

  // Tạm thời comment interceptor DDI cục bộ theo yêu cầu để chuyển toàn bộ câu hỏi sang backend SOTA RAG Copilot API
  // if (matchDrugInteractionIntent(lower)) {
  //   const pair = extractDrugPair(lower);
  //   const ddiChips = ['Kiểm tra Clopidogrel + Omeprazol', 'Kiểm tra Nitroglycerin + Sildenafil', 'Kiểm tra Ceftriaxone + Calci', 'Kiểm tra Warfarin + Aspirin'];
  //   if (pair) {
  //     try {
  //       const ddi = await checkPairDdiApi(pair[0], pair[1]);
  //       const isCrit = ddi.alert?.severity?.toUpperCase().includes('CONTRAINDICATED') || ddi.alert?.severity?.toLowerCase().includes('chống chỉ định');
  //       const cdssAlert = ddi.has_interaction && ddi.alert ? {
  //         level: (isCrit ? 'critical' : 'warning') as 'critical' | 'warning',
  //         title: ddi.alert.title || `CẢNH BÁO TƯƠNG TÁC: ${pair[0].toUpperCase()} + ${pair[1].toUpperCase()}`,
  //         message: `${ddi.alert.consequence} (${ddi.alert.mechanism || ''})`,
  //         antidoteRecommendation: ddi.alert.action,
  //         regulatoryReference: ddi.alert.source || 'QĐ 5948/QĐ-BYT'
  //       } : undefined;
  //       const replyText = ddi.has_interaction && ddi.alert
  //         ? `### ⚠️ Cảnh Báo Tương Tác Thuốc (QĐ 5948/QĐ-BYT)\n\n**${ddi.alert.title}**\n\n- **Hậu quả lâm sàng:** ${ddi.alert.consequence}\n- **Cơ chế dược lý:** ${ddi.alert.mechanism}\n- **Hướng xử trí:** ${ddi.alert.action}\n- **Mức độ:** **${ddi.alert.severity}**\n- **Căn cứ pháp lý:** ${ddi.alert.source}`
  //         : `### Chưa ghi nhận cảnh báo trong chỉ mục: ${pair[0]} + ${pair[1]}\n\n${ddi.coverage_note || 'Chưa tìm thấy trong danh mục đã lập chỉ mục; điều này không khẳng định phối hợp an toàn.'}`;
  //       return { replyMessage: {
  //         id: `msg-agent-ddi-api-${Date.now()}`, sender: 'agent', text: replyText,
  //         timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  //         legalReference: { lawCode: 'QĐ 5948/QĐ-BYT', title: 'Danh mục tương tác thuốc Bộ Y Tế', clause: 'Sàng lọc tương tác thuốc' },
  //         cdssAlert, suggestedChips: ddiChips, ragGrounded: true
  //       } };
  //     } catch {
  //       return { replyMessage: {
  //         id: `msg-agent-ddi-offline-${Date.now()}`, sender: 'agent',
  //         text: `### Chưa thể kết luận về tương tác thuốc\n\nKhông truy cập được bộ máy DDI nên cặp **${pair[0]} + ${pair[1]}** chưa được kiểm tra. Đây không phải kết quả âm tính hay xác nhận an toàn. Hãy thử lại khi kết nối backend hoạt động hoặc nhờ dược sĩ lâm sàng rà soát.`,
  //         timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), suggestedChips: ddiChips,
  //         cdssAlert: { level: 'warning', title: 'CHƯA HOÀN TẤT KIỂM TRA TƯƠNG TÁC', message: 'Nguồn DDI không truy cập được; chưa thể đưa ra kết luận cho cặp thuốc này.' }
  //       } };
  //     }
  //   }
  // }

  // 1. Luồng chính: Chuyển 100% câu hỏi trực tiếp lên FastAPI Copilot Backend (SOTA Vector RAG + Gemini NLU)
  try {
    const activeSessionId = sessionId || _clientSessionId;
    const imageBase64 = attachment?.imageBase64;
    const imageMimeType = attachment?.mimeType || 'image/jpeg';
    const backendData = await chatCopilotApiStream(cleanInput, role, name, activeSessionId, onToken, imageBase64, imageMimeType);
    if (backendData && backendData.reply_text) {
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
          actionPayload = { type: card.cardType === 'borrow_confirm' ? 'DEBT_ADDED' : 'TICKET_CREATED', targetTab: card.targetTab };
        }
      }
      return {
        replyMessage: {
          id: `msg-agent-${Date.now()}`,
          sender: 'agent',
          text: validateClientOutputGuardrail(backendData.reply_text, cleanInput),
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          clinicalSummary: backendData.clinical_summary || undefined,
          clinicalData: backendData.clinical_data || undefined,
          legalReference: backendData.legal_basis ? {
            lawCode: backendData.legal_basis.split('-')[0].trim(),
            title: backendData.legal_basis,
            clause: 'Căn cứ áp dụng'
          } : undefined,
          actionPayload,
          card,
          suggestedChips: backendData.suggested_chips || [],
          citations: backendData.citations || [],
          evidence: backendData.evidence || [],
          ragGrounded: backendData.rag_grounded,
          answerType: backendData.answer_type,
          sourceStatus: backendData.source_status,
          confidence: backendData.confidence,
          abstentionReason: backendData.abstention_reason,
          usageSource: backendData.usage_source,
          modelCallCount: backendData.model_call_count,
          usageCallCount: backendData.usage_call_count,
          cacheHitCount: backendData.cache_hit_count,
          provider: backendData.provider,
          availabilityMode: backendData.availability_mode,
          cdssAlert: backendData.cdss_alert ? {
            level: backendData.cdss_alert.level || 'critical',
            title: backendData.cdss_alert.title,
            message: backendData.cdss_alert.message,
            antidoteRecommendation: backendData.cdss_alert.antidoteRecommendation,
            regulatoryReference: backendData.cdss_alert.regulatoryReference,
            substituteDrug: backendData.cdss_alert.substituteDrug,
          } : undefined
        },
        actionPayload,
        card
      };
    }
  } catch (err) {
    console.warn('[AgentAsync] Backend stream call failed; returning unavailable state:', err);
  }

  return { replyMessage: {
    id: `msg-agent-unavailable-${Date.now()}`,
    sender: 'agent',
    text: 'Không thể truy cập backend chatbot lúc này. Yêu cầu chưa được xử lý và không có kết luận lâm sàng nào được tạo. Vui lòng kiểm tra kết nối rồi thử lại.',
    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    answerType: 'unavailable',
    sourceStatus: 'unavailable',
    ragGrounded: false,
  } };
}
