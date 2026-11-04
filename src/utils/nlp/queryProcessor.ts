/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChatMessage } from '../../types/clinical';
import { ClinicalQueryState, ProcessedQueryResult } from './types';
import { matchLegalIntent, handleLegalIntent } from './intents/legalIntent';
import { matchNavigationIntent, handleNavigationIntent } from './intents/navigationIntent';
import { matchShiftIntent, handleShiftIntent } from './intents/shiftIntent';
import { matchEquipmentIntent, handleEquipmentIntent } from './intents/incidentIntent';
import { matchFefoIntent, handleFefoIntent, matchRestockIntent, handleRestockIntent } from './intents/inventoryIntent';
import {
  matchColdChainIntent,
  handleColdChainIntent,
  matchAuditIntent,
  handleAuditIntent,
  matchOcrIntent,
  handleOcrIntent
} from './intents/utilityIntent';
import { matchBorrowIntent, handleBorrowIntent } from './intents/borrowIntent';
import { matchMedicationSafetyIntent, handleMedicationSafetyIntent, matchDrugInteractionIntent, handleDrugInteractionIntent } from './intents/medicationSafetyIntent';
import { matchBusinessIntent, handleBusinessOverviewIntent } from './intents/businessIntent';
import { matchDrugLookupGuideIntent, handleDrugLookupGuideIntent } from './intents/drugLookupGuideIntent';
import { matchPrescriptionAdviceIntent, handlePrescriptionAdviceIntent } from './intents/prescriptionAdviceIntent';
import { matchCpoeIntent, handleCpoeIntent } from './intents/cpoeIntent';
import { matchDebtSettleIntent, handleDebtSettleIntent } from './intents/debtSettleIntent';
import { validateClientInputGuardrail } from '../security/clinicalGuardrails';

export function processClinicalUserQuery(
  rawInput: string,
  currentState: ClinicalQueryState,
  userRole?: string
): ProcessedQueryResult {
  const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // 0a. Lớp Guardrail bảo vệ: Chặn tức thì Prompt Injection & SQL Injection
  const guardCheck = validateClientInputGuardrail(rawInput);
  if (!guardCheck.isSafe) {
    return {
      replyMessage: {
        id: `msg-${Date.now()}`,
        sender: 'agent',
        text: guardCheck.safeResponse || '🛡️ Yêu cầu bị chặn do vi phạm an toàn.',
        timestamp: nowStr,
        cdssAlert: {
          level: guardCheck.violationType === 'sql_injection' || guardCheck.violationType === 'clinical_bypass' ? 'critical' : 'warning',
          title: 'CẢNH BÁO AN TOÀN HỆ THỐNG',
          message: guardCheck.threatDescription || 'Yêu cầu không an toàn bị chặn.',
        },
        suggestedChips: ['Tra cứu Dược Thư 2015', 'Thông tư 20/2017/TT-BYT', 'Hướng dẫn an toàn hệ thống']
      }
    };
  }

  const text = guardCheck.sanitizedQuery;
  const lower = text.toLowerCase();

  if (/\b(tôi|em|mình)\b.{0,45}\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b|\b(sốt|đau đầu|đau bụng|khó thở|ho|buồn nôn)\b.{0,45}\b(tôi|em|mình)\b/i.test(lower) && !/bệnh nhân|người bệnh|ca bệnh|hồ sơ|bn[- ]/i.test(lower)) {
    return { replyMessage: {
      id: `msg-case-clarification-${Date.now()}`, sender: 'agent',
      text: 'Trợ lý phục vụ tra cứu và nghiệp vụ chuyên môn. Nếu bác sĩ đang xử trí một ca bệnh, vui lòng chọn hồ sơ hoặc nêu thông tin người bệnh và dữ liệu lâm sàng liên quan; nếu cần thông tin tham khảo chung, hãy nêu rõ chủ đề cần tra cứu.',
      timestamp: nowStr,
      suggestedChips: ['Tra cứu thông tin thuốc có nguồn', 'Mở hồ sơ người bệnh để rà soát ca']
    } };
  }

  // Pairwise drug interaction questions need a dedicated path before generic
  // medication lookup can answer about a single product.
  if (matchDrugInteractionIntent(lower)) {
    return handleDrugInteractionIntent(text, lower, nowStr);
  }

  const normalizedGreeting = text.toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  const isBareGreeting = ['hi', 'hello', 'alo', 'hey', 'chào', 'xin chào', 'chào bạn', 'chào bot', 'chào em', 'chào bác sĩ'].includes(normalizedGreeting);
  if (isBareGreeting) {
    return { replyMessage: {
      id: 'msg-agent-greeting-' + Date.now(), sender: 'agent',
      text: 'Chào bác sĩ. Tôi hỗ trợ tra cứu thông tin thuốc và quy định có nguồn, rà soát ca bệnh đã xác định, và chuẩn bị nghiệp vụ để bác sĩ kiểm tra trong biểu mẫu.',
      timestamp: nowStr,
    } };
  }

  // 0. Hospital Business Operations & 10 Core Workflows
  if (matchBusinessIntent(lower)) {
    return handleBusinessOverviewIntent(nowStr);
  }

  // 0b. National Drug Registry Lookup Guide (Khi người dùng muốn tra cứu nhưng chưa nhập tên thuốc)
  if (matchDrugLookupGuideIntent(lower)) {
    return handleDrugLookupGuideIntent(nowStr);
  }

  // 0c. Doctor Prescription Advice & Daily Medication Schedule (GAS Webhook / Email Reminder)
  if (matchPrescriptionAdviceIntent(lower)) {
    return handlePrescriptionAdviceIntent(text, lower, nowStr, userRole);
  }

  // 0d. Electronic Prescription CPOE (Kê đơn thuốc điện tử & duyệt đơn)
  if (matchCpoeIntent(lower)) {
    return handleCpoeIntent(text, lower, nowStr, userRole);
  }

  // 0e. Settle Debt & Return Narcotic Ampoules (Hoàn trả vỏ thuốc độc gây nghiện & xóa nợ)
  if (matchDebtSettleIntent(lower)) {
    return handleDebtSettleIntent(text, lower, nowStr, currentState.debts);
  }

  // 1. Legal Protocols & Guides
  if (matchLegalIntent(lower)) {
    return handleLegalIntent(lower, nowStr);
  }

  // 1b. Medication Safety & Five Rights (QĐ 2147/BYT)
  if (matchMedicationSafetyIntent(lower)) {
    return handleMedicationSafetyIntent(text, lower, nowStr);
  }

  // 2. Tab Navigation
  if (matchNavigationIntent(lower)) {
    return handleNavigationIntent(lower, nowStr, currentState);
  }

  // 3. Shift Handover & Reconciliation 07:00 AM
  if (matchShiftIntent(lower)) {
    return handleShiftIntent(lower, nowStr, currentState);
  }

  // 4. Equipment Incident (NĐ 98/2021)
  if (matchEquipmentIntent(lower)) {
    return handleEquipmentIntent(text, lower, nowStr);
  }

  // 5. FEFO Expiry (TT 36/2018 GSP)
  if (matchFefoIntent(lower)) {
    return handleFefoIntent(lower, nowStr, currentState);
  }

  // 6. Restock Proposal (TT 22 Mẫu 01)
  if (matchRestockIntent(lower)) {
    return handleRestockIntent(lower, nowStr, currentState);
  }

  // 7. Cold Chain Monitoring (WHO PQS)
  if (matchColdChainIntent(lower)) {
    return handleColdChainIntent(lower, nowStr, currentState);
  }

  // 8. Audit Ledger Integrity (HMAC-SHA256)
  if (matchAuditIntent(lower)) {
    return handleAuditIntent(nowStr);
  }

  // 9. Vision OCR Invoice
  if (matchOcrIntent(lower)) {
    return handleOcrIntent(nowStr);
  }

  // 10. Medication Borrowing / CPOE
  if (matchBorrowIntent(lower)) {
    return handleBorrowIntent(text, lower, nowStr);
  }

  // 11. General Clinical Guidance Fallback
  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `Trợ lý này phục vụ bác sĩ tra cứu thông tin và thao tác nghiệp vụ trên dữ liệu đã chọn.\n\n` +
          `Có thể hỗ trợ các việc như:\n` +
          `1. **Tra cứu thuốc, liều dùng, chống chỉ định và tương tác** từ nguồn có căn cứ.\n` +
          `2. **Rà soát hồ sơ/ca bệnh** khi bác sĩ xác định người bệnh và cung cấp dữ liệu cần thiết.\n` +
          `3. **Mở biểu mẫu nghiệp vụ** như kê đơn CPOE, dặn dò từ đơn đã chọn, đối soát ca trực và FEFO.\n` +
          `4. **Thao tác nghiệp vụ kho, thiết bị và ca trực** trên dữ liệu trong hệ thống.\n\n` +
          `Mọi nội dung cần được đối chiếu với hồ sơ và xác nhận trong biểu mẫu tương ứng.`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'NĐ 98 · TT 22 · TT 20 · TT 52 · TT 36 GSP',
      title: 'Hệ thống quản lý lâm sàng & Dược viện',
      clause: 'Căn cứ áp dụng'
    },
    suggestedChips: [
      'Tra cứu tương tác giữa Clopidogrel và Omeprazol',
      'Tra cứu thông tin thuốc',
      'Mở đơn CPOE',
      'Hoàn trả vỏ morphin cho ca trực',
      'Báo hỏng máy thở PB840 phòng mổ 2',
      'Thuốc nào cận hạn dưới 60 ngày'
    ]
  };

  return { replyMessage };
}
