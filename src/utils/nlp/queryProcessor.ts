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
import { matchMedicationSafetyIntent, handleMedicationSafetyIntent } from './intents/medicationSafetyIntent';
import { matchBusinessIntent, handleBusinessOverviewIntent } from './intents/businessIntent';
import { matchDrugLookupGuideIntent, handleDrugLookupGuideIntent } from './intents/drugLookupGuideIntent';
import { matchPrescriptionAdviceIntent, handlePrescriptionAdviceIntent } from './intents/prescriptionAdviceIntent';
import { matchCpoeIntent, handleCpoeIntent } from './intents/cpoeIntent';
import { matchDebtSettleIntent, handleDebtSettleIntent } from './intents/debtSettleIntent';

export function processClinicalUserQuery(
  rawInput: string,
  currentState: ClinicalQueryState
): ProcessedQueryResult {
  const text = rawInput.trim();
  const lower = text.toLowerCase();
  const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

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
          `Tôi có thể hỗ trợ bạn thực thi tự động:\n` +
          `1. **Đối soát giao ban ca trực 07:00 AM:** Ví dụ: *'Đối soát ca trực đêm qua và kiểm tra nợ vỏ Morphin'*\n` +
          `2. **Quét kho cạn & lập dự trù Mẫu 01:** Ví dụ: *'Kiểm tra mặt hàng chạm ngưỡng Min và lập dự trù bù thuốc'*\n` +
          `3. **Mượn khẩn thuốc ca đêm & CDSS:** Ví dụ: *'Có 1 bệnh nhân cần dùng gấp 4 lọ morphin'*\n` +
          `4. **Báo hỏng máy thở & TBYT:** Ví dụ: *'Máy thở PB840 phòng mổ 2 bị xì khí nứt bẫy nước'*\n` +
          `5. **Kiểm tra thuốc cận hạn FEFO:** Ví dụ: *'Cho tôi xem danh sách thuốc cận hạn dưới 60 ngày'*\n` +
          `6. **Thị giác AI bóc tách hóa đơn:** Ví dụ: *'Quét hóa đơn dược phẩm và nhập kho tự động'*\n` +
          `7. **Tra cứu phác đồ cấp cứu & luật:** Ví dụ: *'Phác đồ cấp cứu phản vệ Adrenalin theo Thông tư 51'*\n\n` +
          `Hãy chọn gợi ý nhanh bên dưới hoặc bấm nút Micro để ra lệnh bằng giọng nói tiếng Việt!`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 22/2011, TT 20/2017, TT 51/2017 & NĐ 98/2021',
      title: 'Hệ thống quản lý lâm sàng',
      clause: 'Căn cứ áp dụng'
    },
    suggestedChips: [
      'Đối soát giao ban ca trực',
      'Lập phiếu dự trù bù thuốc Mẫu 01',
      'Có 1 người bệnh cần dùng gấp 4 lọ morphin',
      'Báo hỏng máy thở PB840 phòng mổ 2',
      'Quét hóa đơn nhập kho dược phẩm',
      'Phác đồ Adrenalin phản vệ TT 51'
    ]
  };

  return { replyMessage };
}
