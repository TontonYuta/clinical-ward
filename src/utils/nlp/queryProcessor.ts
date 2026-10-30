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
  currentState: ClinicalQueryState
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

  // Pairwise drug interaction questions need a dedicated path before generic
  // medication lookup can answer about a single product.
  if (matchDrugInteractionIntent(lower)) {
    return handleDrugInteractionIntent(text, lower, nowStr);
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
    return handlePrescriptionAdviceIntent(text, lower, nowStr);
  }

  // 0d. Electronic Prescription CPOE (Kê đơn thuốc điện tử & duyệt đơn)
  if (matchCpoeIntent(lower)) {
    return handleCpoeIntent(text, lower, nowStr);
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
    text: `Tôi là **Trợ lý Agent Lâm Sàng Thông Minh**, đồng hành hỗ trợ kíp trực bệnh viện theo đúng quy chế Bộ Y tế.\n\n` +
          `Tôi có thể hỗ trợ bạn thực thi tự động các nghiệp vụ chính:\n` +
          `1. **Dặn dò bác sĩ & Lịch uống thuốc:** Ví dụ: *'Gửi thông báo cho bệnh nhân Võ Minh Trí uống thuốc'*\n` +
          `2. **Kê đơn thuốc điện tử CPOE:** Ví dụ: *'Kê đơn cho bệnh nhân Trần Thị Mai dùng Augmentin 1g'*\n` +
          `3. **Thu hồi vỏ nợ thuốc gây nghiện:** Ví dụ: *'Hoàn trả vỏ morphin cho ca trực'*\n` +
          `4. **Đối soát giao ban ca trực 07:00 AM:** Ví dụ: *'Đối soát ca trực đêm qua và kiểm tra nợ vỏ Morphin'*\n` +
          `5. **Báo hỏng máy thở & TBYT:** Ví dụ: *'Máy thở PB840 phòng mổ 2 bị xì khí nứt bẫy nước'*\n` +
          `6. **Kiểm tra thuốc cận hạn FEFO:** Ví dụ: *'Cho tôi xem danh sách thuốc cận hạn dưới 60 ngày'*\n` +
          `7. **Quét kho cạn & lập dự trù Mẫu 01:** Ví dụ: *'Kiểm tra mặt hàng chạm ngưỡng Min và lập dự trù bù thuốc'*\n` +
          `8. **Tra cứu Cổng Dược Quốc Gia & Dược Thư:** Ví dụ: *'Thông tin thuốc Hadunalin'*\n\n` +
          `Hãy chọn gợi ý nhanh bên dưới hoặc bấm nút Micro để ra lệnh bằng giọng nói!`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'NĐ 98 · TT 22 · TT 20 · TT 52 · TT 36 GSP',
      title: 'Hệ thống quản lý lâm sàng & Dược viện',
      clause: 'Căn cứ áp dụng'
    },
    suggestedChips: [
      'Gửi thông báo cho bệnh nhân Võ Minh Trí uống thuốc',
      'Đối soát ca trực 07:00 AM',
      'Kê đơn cho bệnh nhân Trần Thị Mai dùng Augmentin 1g',
      'Hoàn trả vỏ morphin cho ca trực',
      'Báo hỏng máy thở PB840 phòng mổ 2',
      'Thuốc nào cận hạn dưới 60 ngày'
    ]
  };

  return { replyMessage };
}
