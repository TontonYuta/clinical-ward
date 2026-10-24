/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ClinicalQueryState, ProcessedQueryResult } from '../types';

export function matchFefoIntent(lower: string): boolean {
  return anyKeyword(lower, ['hết hạn', 'cận hạn', 'fefo', 'date', 'hạn dùng', 'sắp hết hạn']);
}

export function handleFefoIntent(
  lower: string,
  nowStr: string,
  currentState: ClinicalQueryState
): ProcessedQueryResult {
  const sorted = [...currentState.batches].sort((a, b) => a.daysLeft - b.daysLeft);
  const nearExpiry = sorted.filter(b => b.daysLeft <= 60);

  const card: AgentActionCard = {
    cardType: 'fefo_report',
    title: `Báo Cáo Lô Cận Hạn FEFO (${nearExpiry.length} Lô < 60 Ngày)`,
    summary: 'Tuân thủ nguyên tắc First Expired, First Out theo Thông tư 36/2018/TT-BYT GSP',
    data: {
      batches: nearExpiry.map(b => ({
        name: b.itemName,
        batch: b.batchNumber,
        expiry: b.expiryDate,
        days_left: b.daysLeft,
        stock: b.currentStock,
        unit: b.unit
      }))
    },
    primaryActionLabel: 'Chuyển Đến Bảng Kho FEFO',
    primaryActionType: 'NAVIGATE',
    targetTab: 'fefo',
    status: 'pending'
  };

  const lines = nearExpiry.slice(0, 4).map(
    b => `• 🔴 **${b.itemName}** (Lô: \`${b.batchNumber}\`): Còn **${b.daysLeft} ngày** (Hạn: ${b.expiryDate}, Tồn: ${b.currentStock} ${b.unit})`
  ).join('\n');

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `Theo nguyên tắc **FEFO (First Expired, First Out)** của Thông tư 36/2018/TT-BYT GSP, hệ thống phát hiện **${nearExpiry.length} lô thuốc/vật tư cận hạn** cần ưu tiên xuất trước:\n\n` +
          `${lines}\n\n` +
          `Hệ thống khuyến nghị Dược sĩ điều chuyển các lô thuốc cận hạn sang các khoa phòng có lưu lượng sử dụng cao để tiêu thụ kịp thời, chống lãng phí ngân sách y tế.`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 36/2018/TT-BYT',
      title: 'Thực hành tốt bảo quản thuốc (GSP)',
      clause: 'Điều 14 - Nguyên tắc xuất kho FEFO'
    },
    card,
    suggestedChips: ['Lập phiếu dự trù Mẫu 01', 'Xem bảng kho FEFO', 'Đối soát ca trực 07:00 AM']
  };

  return { replyMessage };
}

export function matchRestockIntent(lower: string): boolean {
  return anyKeyword(lower, [
    'cạn kho', 'thiếu thuốc', 'dự trù', 'mẫu 01', 'bù cơ số', 'hết hàng', 'sắp hết',
    'chạm ngưỡng', 'ngưỡng min', 'dưới min', 'bù thuốc', 'cần bù', 'hết thuốc', 'cạn tồn', 'tồn kho thấp', 'tồn min'
  ]);
}

export function handleRestockIntent(
  lower: string,
  nowStr: string,
  currentState: ClinicalQueryState
): ProcessedQueryResult {
  const lowBatches = currentState.batches.filter(b => b.currentStock <= b.minThreshold);
  let totalNeeded = 0;
  const items = lowBatches.map(b => {
    const needed = b.maxThreshold - b.currentStock;
    totalNeeded += needed;
    return {
      id: b.id,
      name: b.itemName,
      stock: b.currentStock,
      min: b.minThreshold,
      max: b.maxThreshold,
      needed,
      unit: b.unit
    };
  });

  const lines = items.slice(0, 5).map(
    it => `• **${it.name}**: Tồn ${it.stock}/${it.min} ${it.unit} (Đề xuất bù: +${it.needed} ${it.unit})`
  ).join('\n');

  const card: AgentActionCard = {
    cardType: 'low_stock_report',
    title: `Phiếu Dự Trù Cơ Số Kho Dược Mẫu 01/TT22 (${lowBatches.length} Mặt Hàng)`,
    summary: `Cần bổ sung tổng cộng ${totalNeeded} đơn vị thuốc/vật tư chạm đáy an toàn`,
    data: {
      items,
      batch_ids: lowBatches.map(b => b.id),
      total_needed: totalNeeded,
      formType: 'TT22_RESTOCK_PROPOSAL'
    },
    primaryActionLabel: 'Mở & In Phiếu Dự Trù Mẫu 01/TT22',
    primaryActionType: 'OPEN_PRINTABLE_FORM',
    targetTab: 'fefo',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `### 📦 ĐỀ XUẤT DỰ TRÙ CƠ SỐ TỦ TRỰC (MẪU 01/TT22)\n` +
          `*Căn cứ: Mẫu số 01 Thông tư 22/2011/TT-BYT - Quy chế Khoa Dược*\n\n` +
          `Hệ thống phát hiện **${lowBatches.length} mặt hàng** chạm hoặc dưới định mức an toàn (Min Threshold):\n\n` +
          `${lines}\n\n` +
          `AI đã tự động tính toán số lượng cấp bù cần thiết để đạt mức trần an toàn (Max Threshold): **Tổng cộng +${totalNeeded} đơn vị**.\n\n` +
          `Bấm nút bên dưới để mở ngay **Phiếu Dự Trù Mẫu 01/TT22** đã được điền sẵn đầy đủ thông tin để in ấn trình Trưởng khoa Dược ký duyệt.`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 22/2011/TT-BYT',
      title: 'Quy chế Khoa Dược',
      clause: 'Điều 7 & Mẫu số 01/TT22 - Dự trù cơ số thuốc'
    },
    card,
    suggestedChips: ['Mở phiếu dự trù Mẫu 01', 'Xem bảng kho FEFO', 'Đối soát ca trực 07:00 AM']
  };

  return { replyMessage };
}
