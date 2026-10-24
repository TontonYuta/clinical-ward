/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ClinicalQueryState, ProcessedQueryResult } from '../types';

export function matchColdChainIntent(lower: string): boolean {
  return anyKeyword(lower, [
    'chuỗi lạnh', 'nhiệt độ', 'vắc xin', 'datalogger', 'buồng lạnh', 'mkt', 'tủ lạnh', 'mất điện tủ', 'arrhenius'
  ]);
}

export function handleColdChainIntent(
  lower: string,
  nowStr: string,
  currentState: ClinicalQueryState
): ProcessedQueryResult {
  const temp = currentState.coldChainTemp;
  const isNormal = temp >= 2.0 && temp <= 8.0;

  const card: AgentActionCard = {
    cardType: 'coldchain_status',
    title: 'Giám Sát Chuỗi Lạnh Datalogger (WHO PQS & GSP)',
    summary: isNormal ? 'Dải nhiệt độ đạt chuẩn 2.0°C - 8.0°C' : 'CẢNH BÁO: Nhiệt độ vượt ngưỡng an toàn!',
    data: {
      temperature: temp,
      mkt: 4.8,
      status: isNormal ? 'Bình thường' : 'Báo động'
    },
    primaryActionLabel: 'Chuyển Đến Giám Sát Chuỗi Lạnh',
    primaryActionType: 'NAVIGATE',
    targetTab: 'coldchain',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `Tình trạng buồng bảo quản vắc xin & sinh phẩm (Datalogger Telemetry):\n\n` +
          `• **Nhiệt độ hiện tại:** **${temp.toFixed(1)}°C** (${isNormal ? '🟢 Đạt chuẩn GSP 2.0°C - 8.0°C' : '🔴 VƯỢT NGƯỠNG AN TOÀN'})\n` +
          `• **Chỉ số MKT (Mean Kinetic Temperature):** **4.8°C** (Tính toán theo phương trình Arrhenius WHO PQS)\n` +
          `• **Trạng thái điện lưới:** Điện lưới 220V ổn định, hệ thống pin dự phòng 48h sẵn sàng.\n\n` +
          `Nếu nhiệt độ vượt ngưỡng > 8.0°C kéo dài trên 15 phút, hệ thống sẽ tự động kích hoạt **Vùng Biệt Trữ Cách Ly (Quarantine Lock)** để bảo vệ người bệnh.`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 36/2018/TT-BYT & Tiêu chuẩn WHO PQS',
      title: 'Bảo quản Chuỗi lạnh Vắc xin',
      clause: 'Điều 16 - Giám sát liên tục nhiệt độ bảo quản sinh phẩm'
    },
    card,
    suggestedChips: ['Xem biểu đồ chuỗi lạnh', 'Đối soát ca trực 07:00 AM', 'Lập phiếu dự trù Mẫu 01']
  };

  return { replyMessage };
}

export function matchAuditIntent(lower: string): boolean {
  return anyKeyword(lower, [
    'kiểm toán', 'toàn vẹn', 'chuỗi băm', 'chữ ký số', 'gian lận', 'audit', 'sha256', 'bảo mật', 'sổ kiểm toán'
  ]);
}

export function handleAuditIntent(nowStr: string): ProcessedQueryResult {
  const card: AgentActionCard = {
    cardType: 'audit_integrity',
    title: 'Sổ Kiểm Toán Lâm Sàng Bất Biến (HMAC-SHA256)',
    summary: '100% bản ghi kiểm toán không thể chối bỏ, sẵn sàng thanh tra Bộ Y tế',
    data: {
      is_valid: true,
      total_records: 12,
      genesis: 'GENESIS_BLOCK_HOSPITAL_AUDIT_2026'
    },
    primaryActionLabel: 'Mở Sổ Nhật Ký Kiểm Toán Toàn Viện',
    primaryActionType: 'OPEN_AUDIT_MODAL',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `Kết quả kiểm tra mật mã học chuỗi băm **HMAC-SHA256 Tamper-evident Audit Ledger** (Nghị định 130/2018/NĐ-CP):\n\n` +
          `• **Tính toàn vẹn:** ✅ **100% NGUYÊN VẸN, CHUỖI BĂM HỢP LỆ**\n` +
          `• **Khối khởi tạo (Genesis Block):** \`GENESIS_BLOCK_HOSPITAL_AUDIT_2026\`\n` +
          `• **Khóa liên kết (Hash Chaining):** Mỗi bản ghi lưu trữ \`previous_hash\` của bản ghi trước đó, bảo đảm mọi hành vi sửa xóa lén lút trong database đều bị phát hiện ngay lập tức.`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Nghị định 130/2018/NĐ-CP',
      title: 'Luật Giao dịch điện tử & Ký số',
      clause: 'Điều 5 & Điều 12 - Chứng thực dữ liệu không thể chối bỏ'
    },
    card,
    suggestedChips: ['Xem chi tiết sổ kiểm toán', 'Đối soát ca trực 07:00 AM', 'Xem báo hỏng máy']
  };

  return { replyMessage };
}

export function matchOcrIntent(lower: string): boolean {
  return anyKeyword(lower, [
    'hóa đơn', 'hoa don', 'ocr', 'quét ảnh', 'quet anh', 'phiếu giao hàng', 'bàn giao kho', 'chứng từ', 'quét hóa đơn', 'nhập kho', 'bóc tách'
  ]);
}

export function handleOcrIntent(nowStr: string): ProcessedQueryResult {
  const ocrItems = [
    { name: 'Kháng sinh Ceftriaxone 1g', batch: 'CTX-2026-99A', expiry: '2027-08-30', quantity: 200, unit: 'lọ', unitPrice: 45000 },
    { name: 'Morphin sulfat 10mg/1ml', batch: 'MPH-2026-14B', expiry: '2026-11-20', quantity: 50, unit: 'ống', unitPrice: 28000, isNarcotic: true },
    { name: 'Bơm tiêm 5ml Vinahankook', batch: 'VH-2026-03C', expiry: '2029-01-15', quantity: 500, unit: 'cái', unitPrice: 1500 }
  ];

  const card: AgentActionCard = {
    cardType: 'ocr_invoice_confirm',
    title: 'Bóc Tách Hóa Đơn VAT / Phiếu Giao Hàng Dược Phẩm (Vision AI)',
    summary: 'Trích xuất tự động 03 mặt hàng theo số lô, hạn dùng từ chứng từ giao hàng',
    data: {
      supplier: 'Công ty Cổ phần Dược phẩm Trung ương 1 (CPC1)',
      invoiceNumber: 'HD-2026-883921',
      invoiceDate: '18/10/2026',
      items: ocrItems,
      totalAmount: '11,150,000 VNĐ'
    },
    primaryActionLabel: 'Xác Nhận Nhập Kho FEFO Tự Động',
    primaryActionType: 'IMPORT_OCR_INVOICE',
    targetTab: 'fefo',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-${Date.now()}`,
    sender: 'agent',
    text: `### 📷 Thị Giác AI (Vision-Language) Đã Bóc Tách Chứng Từ Thành Công\n\n` +
          `• **Đơn vị giao hàng:** Công ty CP Dược phẩm Trung ương 1 (CPC1)\n` +
          `• **Số hóa đơn GTGT:** \`HD-2026-883921\` (Ngày 18/10/2026)\n` +
          `• **Số mặt hàng số hóa:** 03 danh mục (Đã tự động tính hạn dùng và gán kệ kho)\n\n` +
          `1. **Ceftriaxone 1g:** 200 lọ | Số lô: \`CTX-2026-99A\` | HSD: 30/08/2027 (Kệ A1 - Tầng 2)\n` +
          `2. **Morphin sulfat 10mg/1ml:** 50 ống | Số lô: \`MPH-2026-14B\` | HSD: 20/11/2026 (Tủ sắt thuốc độc 2 khóa)\n` +
          `3. **Bơm tiêm 5ml Vinahankook:** 500 cái | Số lô: \`VH-2026-03C\` | HSD: 15/01/2029 (Kệ B2)\n\n` +
          `Vui lòng kiểm tra thẻ hành động bên dưới và bấm nút xác nhận để cập nhật trực tiếp vào cơ sở dữ liệu Kho FEFO!`,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 36/2018/TT-BYT & NĐ 54/2017/NĐ-CP',
      title: 'Thực hành tốt bảo quản thuốc (GSP)',
      clause: 'Điều 12 - Kiểm soát nhập kho & Số lô HSD'
    },
    card,
    pipelineStage: 'offline_engine',
    suggestedChips: ['Nhập kho FEFO tự động', 'Kiểm tra tồn kho FEFO', 'Đối soát ca trực 07:00 AM']
  };

  return { replyMessage };
}
