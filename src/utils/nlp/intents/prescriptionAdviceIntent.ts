/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Dặn Dò Bác Sĩ & Lên Lịch Nhắc Uống Thuốc qua Google Apps Script (<=200 LOC)
 */

import { ChatMessage } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';
import { findPatientByNameOrQuery, INITIAL_PATIENTS } from '../../../services/patientService';

export function matchPrescriptionAdviceIntent(lower: string): boolean {
  const trimmed = lower.trim();
  if (['gửi mail', 'gửi gmail', 'gửi email', 'gmail', 'email', 'xem email', 'in phiếu dặn dò'].includes(trimmed)) return true;
  const hasDirect = anyKeyword(lower, [
    'dặn dò', 'dặn bệnh nhân', 'dặn uống', 'nhắc uống', 'nhắc thuốc', 'lịch uống', 'lên lịch nhắc',
    'uống thuốc hàng ngày', 'thông báo uống', 'gửi mail cho bệnh nhân', 'gửi email cho bệnh nhân',
    'gửi gmail', 'thông báo qua mail', 'dặn dò đơn thuốc', 'lịch nhắc thuốc', 'nhắc nhở uống thuốc'
  ]);
  if (hasDirect) return true;
  return anyKeyword(lower, ['thông báo', 'nhắc', 'dặn', 'gửi', 'báo']) &&
         anyKeyword(lower, ['uống thuốc', 'lịch thuốc', 'cữ thuốc', 'giờ uống']);
}

export function handlePrescriptionAdviceIntent(
  text: string,
  lower: string,
  nowStr: string
): ProcessedQueryResult {
  const clarification = (text: string): ProcessedQueryResult => ({
    replyMessage: {
      id: `msg-agent-advice-clarify-${Date.now()}`, sender: 'agent', text,
      timestamp: nowStr,
      suggestedChips: ['Mở đơn CPOE đang chọn để lập lời dặn', 'Chọn người bệnh và đơn thuốc trong hồ sơ']
    }
  });

  const patient = findPatientByNameOrQuery(lower, INITIAL_PATIENTS);
  const name = patient ? ` cho ${patient.fullName} (${patient.id})` : '';
  const replyMessage: ChatMessage = {
    id: `msg-agent-advice-clarify-${Date.now()}`, sender: 'agent',
    text: `Để lập lời dặn${name}, hãy mở hồ sơ và chọn đơn thuốc đã kê. Trợ lý chỉ chuyển thông tin từ đơn thực tế sang biểu mẫu; không suy ra liều, thời điểm hoặc thời gian dùng từ nội dung chat.`,
    timestamp: nowStr,
    suggestedChips: ['Mở hồ sơ người bệnh', 'Mở biểu mẫu lời dặn từ đơn đã chọn']
  };
  return { replyMessage };
}
