/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Hoàn Trả Vỏ Thuốc Độc Gây Nghiện & Thanh Toán Sổ Nợ (<=150 LOC)
 */

import { AgentActionCard, ChatMessage, DebtRecord } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';

export function matchDebtSettleIntent(lower: string): boolean {
  if (lower.includes('?') || lower.includes('tại sao') || lower.includes('quy định') || lower.includes('thông tư') || lower.includes('nghị định') || lower.includes('luật')) {
    return false;
  }
  return anyKeyword(lower, [
    'xác nhận trả vỏ', 'thực hiện trả vỏ', 'xóa nợ phiếu', 'thanh toán phiếu nợ', 'nộp vỏ morphin', 'thu hồi vỏ ống'
  ]);
}

export function handleDebtSettleIntent(
  text: string,
  lower: string,
  nowStr: string,
  debts: DebtRecord[]
): ProcessedQueryResult {
  const isAmpouleReturn = anyKeyword(lower, ['trả vỏ', 'tra vo', 'vỏ', 'vo', 'thu hồi vỏ', 'morphin', 'fentanyl']);

  // 1. Tìm bản ghi cần xử lý
  let targetDebt: DebtRecord | undefined;
  if (isAmpouleReturn) {
    targetDebt = debts.find(d => d.itemType === 'Thuốc gây nghiện' && !d.ampouleReturned);
  }
  if (!targetDebt) {
    targetDebt = debts.find(d => d.status === 'debt');
  }

  // Nếu không còn nợ nào cần xử lý
  if (!targetDebt) {
    const emptyMsg: ChatMessage = {
      id: `msg-agent-debt-empty-${Date.now()}`,
      sender: 'agent',
      text: `### ✅ TẤT CẢ VỎ THUỐC & SỔ NỢ ĐÃ ĐƯỢC ĐỐI SOÁT HOÀN TẤT!\n\n` +
            `• Hiện tại **không có vỏ thuốc gây nghiện nào đang tồn đọng** chưa thu hồi.\n` +
            `• Sổ nợ cơ số tủ trực cấp cứu đạt chuẩn an toàn 100% theo Điều 15 Thông tư 20/2017/TT-BYT.`,
      timestamp: nowStr,
      suggestedChips: ['Đối soát ca trực 07:00 AM', 'Lập phiếu dự trù bù thuốc Mẫu 01', 'Kê đơn thuốc CPOE']
    };
    return { replyMessage: emptyMsg };
  }

  const isNarcotic = targetDebt.itemType === 'Thuốc gây nghiện';
  const actionType = isNarcotic && !targetDebt.ampouleReturned ? 'EXECUTE_RETURN_AMPOULE' : 'EXECUTE_SETTLE_DEBT';
  const actionLabel = isNarcotic && !targetDebt.ampouleReturned ? 'Xác nhận thu hồi vỏ ống thuốc' : 'Thanh toán hoàn tất phiếu nợ';

  const replyText = `### 📋 XÁC THỰC NGHIỆP VỤ SỔ NỢ & VỎ THUỐC GÂY NGHIỆN\n\n` +
    `• **Mã phiếu**: \`${targetDebt.code}\`\n` +
    `• **Mặt hàng**: **${targetDebt.itemName}** (SL: \`${targetDebt.quantity}\`)\n` +
    `• **Bệnh nhân sử dụng**: **${targetDebt.patientName}** (${targetDebt.patientRoom})\n` +
    `• **Người mượn**: ${targetDebt.borrowerName}\n` +
    `• **Thời gian xuất**: ${targetDebt.borrowTime} - ${targetDebt.borrowDate}\n` +
    `• **Trạng thái vỏ**: ${targetDebt.ampouleReturned ? '✅ Đã trả vỏ' : '⚠️ **Chưa thu hồi vỏ ống**'}\n\n` +
    `⚖️ **Căn cứ pháp lý:** Điều 15 Thông tư 20/2017/TT-BYT & Thông tư 22/2011/TT-BYT: *"Bắt buộc thu hồi nguyên vẹn vỏ thuốc gây nghiện, đối chiếu số sê-ri lô và lưu giữ niêm phong trước khi thành lập hội đồng hủy."*\n\n` +
    `👉 Điều dưỡng/Dược sĩ bấm **[${actionLabel}]** bên dưới để hoàn tất thủ tục ký xác thực điện tử!`;

  const card: AgentActionCard = {
    cardType: 'debt_settle',
    title: `${actionLabel}: ${targetDebt.code}`,
    summary: `${targetDebt.itemName} (${targetDebt.quantity}) • BN: ${targetDebt.patientName}`,
    data: {
      debtId: targetDebt.id,
      code: targetDebt.code,
      itemName: targetDebt.itemName,
      quantity: targetDebt.quantity,
      patientName: targetDebt.patientName,
      patientRoom: targetDebt.patientRoom,
      borrowerName: targetDebt.borrowerName,
      isNarcotic
    },
    primaryActionLabel: actionLabel,
    primaryActionType: actionType,
    targetTab: 'debt',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-debt-${Date.now()}`,
    sender: 'agent',
    text: replyText,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 20/2017/TT-BYT',
      title: 'Quy chế quản lý thuốc phải kiểm soát đặc biệt',
      clause: 'Điều 15: Thu hồi, bảo quản và tiêu hủy vỏ thuốc gây nghiện'
    },
    card,
    suggestedChips: [
      'Xem sổ nợ cơ số tủ trực',
      'Lập biên bản tiêu hủy vỏ thuốc Mẫu 09',
      'Giao ban ca trực 07:00 AM'
    ]
  };

  return { replyMessage, card };
}
