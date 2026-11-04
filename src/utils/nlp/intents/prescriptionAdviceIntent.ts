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
  if (['gửi mail', 'gửi gmail', 'gửi email', 'gmail', 'email', 'xem email', 'in phiếu dặn dò', 'gửi sms', 'sms'].includes(trimmed)) return true;
  const hasDirect = anyKeyword(lower, [
    'dặn dò', 'dặn bệnh nhân', 'dặn uống', 'nhắc uống', 'nhắc thuốc', 'lịch uống', 'lên lịch nhắc',
    'uống thuốc hàng ngày', 'thông báo uống', 'gửi mail cho bệnh nhân', 'gửi email cho bệnh nhân',
    'gửi gmail', 'thông báo qua mail', 'dặn dò đơn thuốc', 'lịch nhắc thuốc', 'nhắc nhở uống thuốc',
    'gửi sms', 'nhắn tin', 'mở form gửi', 'mở form email', 'mở form sms', 'email/sms', 'mở form dặn dò'
  ]);
  if (hasDirect) return true;
  return anyKeyword(lower, ['thông báo', 'nhắc', 'dặn', 'gửi', 'báo']) &&
         anyKeyword(lower, ['uống thuốc', 'lịch thuốc', 'cữ thuốc', 'giờ uống', 'email', 'sms']);
}

export function handlePrescriptionAdviceIntent(
  text: string,
  lower: string,
  nowStr: string,
  userRole?: string
): ProcessedQueryResult {
  const isOpenAdviceForm = anyKeyword(lower, [
    'mở form', 'mo form', 'mở biểu mẫu', 'mo bieu mau', 'mở giao diện', 'vào form', 'mở modal'
  ]);

  if (isOpenAdviceForm) {
    const card = {
      cardType: 'prescription_advice_navigation' as any,
      title: 'Biểu Mẫu Dặn Dò & Gửi Email/SMS',
      summary: 'Mở biểu mẫu lập lịch dùng thuốc và gửi hướng dẫn cho người bệnh qua Email/SMS',
      data: { targetTab: 'cpoe', target_tab: 'cpoe', openModal: 'prescription_advice' },
      primaryActionLabel: 'Mở Form Gửi Email/SMS',
      primaryActionType: 'OPEN_SEND_EMAIL_SMS',
      targetTab: 'cpoe' as any,
      status: 'pending' as any
    };
    return {
      replyMessage: {
        id: `msg-agent-advice-open-${Date.now()}`,
        sender: 'agent',
        text: 'Dạ hệ thống đã sẵn sàng mở biểu mẫu dặn dò và gửi Email/SMS. Bác sĩ/Điều dưỡng vui lòng kiểm tra danh sách cữ thuốc, thông tin liên lạc và bấm xác nhận gửi trực tiếp trên biểu mẫu; chatbot chỉ hỗ trợ mở form theo phân quyền, không tự ý gửi email/sms từ nội dung chat.',
        timestamp: nowStr,
        card,
        suggestedChips: ['Mở form gửi email/sms', 'Mở hồ sơ người bệnh', 'Xem danh sách đơn thuốc CPOE']
      },
      card
    };
  }

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
