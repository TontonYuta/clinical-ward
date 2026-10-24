/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ClinicalQueryState, ProcessedQueryResult } from '../types';

export function matchNavigationIntent(lower: string): boolean {
  return anyKeyword(lower, [
    'xem tủ trực', 'mở tủ trực', 'vào tủ trực', 'chuyển sang tủ trực', 'tôi muốn xem tủ trực', 'xem sổ nợ', 'mở sổ nợ'
  ]);
}

export function handleNavigationIntent(
  lower: string,
  nowStr: string,
  currentState: ClinicalQueryState
): ProcessedQueryResult {
  const activeDebts = currentState.debts.filter(d => d.status === 'debt');
  const narcoticDebts = activeDebts.filter(d => d.isNarcotic || d.itemType === 'Thuốc gây nghiện');
  const pendingAmpoules = narcoticDebts.filter(d => !d.ampouleReturned);

  const card: AgentActionCard = {
    cardType: 'shift_handover_report',
    title: 'Tủ Trực Cấp Cứu & Sổ Nợ Thuốc Lâm Sàng',
    summary: `Hiện đang quản lý ${activeDebts.length} phiếu nợ trực, ${pendingAmpoules.length} vỏ ống Morphin chờ hoàn bù`,
    data: {
      active_debts_count: activeDebts.length,
      narcotic_count: narcoticDebts.length,
      pending_ampoules_count: pendingAmpoules.length,
      formType: 'EMERGENCY_BORROW_TICKET'
    },
    primaryActionLabel: 'Chuyển Đến Sổ Nợ Tủ Trực',
    primaryActionType: 'NAVIGATE',
    targetTab: 'debt',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `Đang mở phân hệ **Tủ Trực Lâm Sàng & Sổ Nợ Mượn Khẩn** (Điều 10 Thông tư 22/2011/TT-BYT):\n\n` +
          `• **Phiếu mượn đang lưu hành:** **${activeDebts.length} phiếu**\n` +
          `• **Thuốc gây nghiện đã rút:** **${narcoticDebts.length} ống**\n` +
          `• **Vỏ ống chưa hoàn nộp:** **${pendingAmpoules.length} vỏ** ${pendingAmpoules.length > 0 ? '🔴 (Yêu cầu thu hồi)' : '🟢'}\n\n` +
          `Bạn có thể kiểm tra trực tiếp danh sách phiếu nợ hoặc thao tác hoàn nộp vỏ ống tại tab Sổ nợ.`,
    timestamp: nowStr,
    legalReference: { lawCode: 'Thông tư 22/2011/TT-BYT', title: 'Quy chế Tủ trực lâm sàng', clause: 'Điều 10 - Quản lý cơ số thuốc trực' },
    card,
    suggestedChips: ['Đối soát ca trực 07:00 AM', 'Lập phiếu dự trù Mẫu 01', 'Xem bảng kho FEFO']
  };

  return { replyMessage };
}
