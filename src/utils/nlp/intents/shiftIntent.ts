/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ClinicalQueryState, ProcessedQueryResult } from '../types';

export function matchShiftIntent(lower: string): boolean {
  return anyKeyword(lower, [
    'đối soát', 'giao ban', 'ca trực', 'ca đêm', 'báo cáo ca', 'chốt ca', 'bàn giao ca', '07:00',
    'lệch sổ', 'tổng hợp nợ', 'nợ vỏ', 'kiểm tra nợ', 'sổ nợ', 'phiếu nợ', 'vỏ morphin', 'vỏ ống',
    'chưa nộp vỏ', 'thu hồi vỏ'
  ]);
}

export function handleShiftIntent(
  lower: string,
  nowStr: string,
  currentState: ClinicalQueryState
): ProcessedQueryResult {
  const activeDebts = currentState.debts.filter(d => d.status === 'debt');
  const narcoticDebts = activeDebts.filter(d => d.isNarcotic || d.itemType === 'Thuốc gây nghiện');
  const pendingAmpoules = narcoticDebts.filter(d => !d.ampouleReturned);
  const returnedAmpoules = narcoticDebts.filter(d => d.ampouleReturned);

  const itemMap: Record<string, { count: number; unit: string }> = {};
  activeDebts.forEach(d => {
    const qtyNum = parseInt(d.quantity, 10) || 1;
    const unit = d.quantity.split(' ')[1] || 'ống';
    if (!itemMap[d.itemName]) {
      itemMap[d.itemName] = { count: 0, unit };
    }
    itemMap[d.itemName].count += qtyNum;
  });

  const replenishmentItems = Object.entries(itemMap).map(([name, val]) => ({
    name,
    needed: `${val.count} ${val.unit}`
  }));

  const card: AgentActionCard = {
    cardType: 'shift_handover_report',
    title: `Biên Bản Đối Soát Giao Ban Ca Trực (07:00 AM)`,
    summary: pendingAmpoules.length > 0
      ? `CẢNH BÁO: Còn ${pendingAmpoules.length} ca nợ vỏ ống Morphin chưa nộp vào khay niêm phong!`
      : `Hoàn tất: Toàn bộ ${narcoticDebts.length} ống thuốc gây nghiện đã thu hồi vỏ rỗng.`,
    data: {
      total_debts: activeDebts.length,
      narcotic_count: narcoticDebts.length,
      pending_ampoules_count: pendingAmpoules.length,
      returned_count: returnedAmpoules.length,
      pending_list: pendingAmpoules.map(d => ({
        patient: d.patientName,
        room: d.patientRoom,
        item: d.itemName,
        quantity: d.quantity,
        code: d.code
      })),
      replenishment: replenishmentItems,
      formType: 'EMERGENCY_BORROW_TICKET'
    },
    primaryActionLabel: 'Xem & In Phiếu Đối Soát Ca Trực',
    primaryActionType: 'OPEN_PRINTABLE_FORM',
    targetTab: 'debt',
    status: 'pending'
  };

  let pendingWarningText = '';
  if (pendingAmpoules.length > 0) {
    pendingWarningText = `⚠️ **DANH SÁCH VI PHẠM THU HỒI VỎ ỐNG (ĐIỀU 15 TT 20/2017):**\n` +
      pendingAmpoules.map(d => `• 🔴 **${d.patientName}** (${d.patientRoom}): Nợ **${d.quantity} ${d.itemName}** (\`${d.code}\`) — *Chưa nộp vỏ ống rỗng!*`).join('\n') + `\n\n`;
  } else {
    pendingWarningText = `✅ **100% vỏ thuốc gây nghiện đã được thu hồi vào khay niêm phong.**\n\n`;
  }

  const replenishListText = replenishmentItems.map(it => `• **${it.name}**: Cần bù **${it.needed}**`).join('\n');

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `### 📋 BÁO CÁO ĐỐI SOÁT GIAO BAN CA TRỰC LÂM SÀNG (07:00 AM)\n` +
          `*Căn cứ: Điều 10 Thông tư 22/2011/TT-BYT & Điều 15 Thông tư 20/2017/TT-BYT*\n\n` +
          `📊 **Tổng kết số liệu ca trực đêm:**\n` +
          `• Tổng số lượt mượn khẩn chưa bù: **${activeDebts.length} ca**\n` +
          `• Thuốc gây nghiện đã rút: **${narcoticDebts.length} ống**\n` +
          `• Vỏ ống đã nộp vào khay: **${returnedAmpoules.length} vỏ**\n` +
          `• Vỏ ống còn nợ: **${pendingAmpoules.length} vỏ** ${pendingAmpoules.length > 0 ? '🔴 (BỊ KHÓA HOÀN BÙ)' : '🟢'}\n\n` +
          `${pendingWarningText}` +
          `📦 **Số lượng cần Kho Dược cấp bù cơ số sáng nay:**\n` +
          `${replenishListText}\n\n` +
          `AI đã đóng gói hồ sơ đối soát. Bạn có thể bấm nút bên dưới để xem và in **Phiếu Mượn Bù Ca Đêm** hoặc chuyển sang tab Sổ nợ.`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 22/2011/TT-BYT & TT 20/2017/TT-BYT',
      title: 'Chế độ giao ban & Kiểm soát thuốc độc',
      clause: 'Điều 10 TT 22 & Điều 15 TT 20'
    },
    card,
    suggestedChips: ['Xem sổ nợ tủ trực', 'Lập phiếu dự trù Mẫu 01', 'In biên bản bàn giao']
  };

  return { replyMessage };
}
