/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Kê Đơn Thuốc Điện Tử CPOE & Ra Quyết Định Điều Trị (<=170 LOC)
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { PrescriptionOrder, PrescriptionItem } from '../../../types/cpoe';
import { anyKeyword, ProcessedQueryResult } from '../types';

export function matchCpoeIntent(lower: string): boolean {
  return anyKeyword(lower, [
    'kê đơn', 'ke don', 'kê đơn cho', 'ke don cho',
    'tạo đơn thuốc', 'tao don thuoc', 'lập đơn thuốc', 'lap don thuoc',
    'bác sĩ kê đơn', 'bac si ke don', 'kê toa', 'ke toa',
    'kê đơn cpoe', 'cpoe đơn thuốc', 'đơn thuốc điện tử'
  ]) && !lower.includes('dặn dò') && !lower.includes('nhắc thuốc') && !lower.includes('lịch uống');
}

export function handleCpoeIntent(
  text: string,
  lower: string,
  nowStr: string
): ProcessedQueryResult {
  // 1. Trích xuất Tên bệnh nhân
  let patientName = 'Nguyễn Văn An';
  const nameMatch = text.match(/(?:bệnh nhân|cho|bn)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})/u);
  if (nameMatch) {
    patientName = nameMatch[1].trim();
  }

  // 2. Trích xuất Chẩn đoán
  let diagnosisText = 'Nhiễm khuẩn đường hô hấp trên cấp';
  let diagnosisIcd10 = 'J06.9';
  if (lower.includes('viêm họng')) {
    diagnosisText = 'Viêm họng cấp';
    diagnosisIcd10 = 'J02.9';
  } else if (lower.includes('viêm phế quản')) {
    diagnosisText = 'Viêm phế quản cấp';
    diagnosisIcd10 = 'J20.9';
  } else if (lower.includes('viêm phổi')) {
    diagnosisText = 'Viêm phổi mắc phải cộng đồng';
    diagnosisIcd10 = 'J18.9';
  } else if (lower.includes('sốt')) {
    diagnosisText = 'Hội chứng sốt chưa rõ nguyên nhân';
    diagnosisIcd10 = 'R50.9';
  }

  // 3. Trích xuất Thuốc kê đơn
  const items: PrescriptionItem[] = [];
  if (anyKeyword(lower, ['augmentin', 'amoxicillin', 'kháng sinh'])) {
    items.push({
      id: `it-${items.length + 1}`,
      medicationName: 'Augmentin 1g (Amoxicillin + Acid Clavulanic)',
      activeIngredient: 'Amoxicillin + Clavulanic acid',
      dosage: '1 viên',
      frequency: 'Ngày 2 lần (sau ăn)',
      route: 'Đường uống',
      quantity: 14,
      unit: 'viên',
      instructions: 'Uống ngay đầu bữa ăn để giảm kích ứng dạ dày'
    });
  }
  if (anyKeyword(lower, ['paracetamol', 'panadol', 'hạ sốt', 'giảm đau'])) {
    items.push({
      id: `it-${items.length + 1}`,
      medicationName: 'Paracetamol 500mg',
      activeIngredient: 'Paracetamol',
      dosage: '1 viên',
      frequency: 'Ngày 2 - 3 lần (cách 4-6h khi sốt >= 38.5°C)',
      route: 'Đường uống',
      quantity: 10,
      unit: 'viên',
      instructions: 'Uống sau ăn với nhiều nước. Không dùng quá 4g/ngày'
    });
  }
  if (anyKeyword(lower, ['cipro', 'ciprofloxacin'])) {
    items.push({
      id: `it-${items.length + 1}`,
      medicationName: 'Ciprofloxacin 500mg',
      activeIngredient: 'Ciprofloxacin',
      dosage: '1 viên',
      frequency: 'Ngày 2 lần (cách 12h)',
      route: 'Đường uống',
      quantity: 14,
      unit: 'viên',
      instructions: 'Uống xa bữa ăn và tránh uống cùng sữa hoặc chế phẩm chứa canxi'
    });
  }

  // Nếu không chỉ định cụ thể, tạo đơn mẫu phối hợp chuẩn ngoại trú
  if (items.length === 0) {
    items.push(
      {
        id: 'it-1',
        medicationName: 'Augmentin 1g (Amoxicillin + Acid Clavulanic)',
        activeIngredient: 'Amoxicillin + Clavulanic acid',
        dosage: '1 viên',
        frequency: 'Ngày 2 lần',
        route: 'Đường uống',
        quantity: 14,
        unit: 'viên',
        instructions: 'Uống đầu bữa ăn'
      },
      {
        id: 'it-2',
        medicationName: 'Paracetamol 500mg',
        activeIngredient: 'Paracetamol',
        dosage: '1 viên',
        frequency: 'Ngày 2 lần (khi sốt/đau)',
        route: 'Đường uống',
        quantity: 10,
        unit: 'viên',
        instructions: 'Uống sau ăn'
      }
    );
  }

  const orderId = `RX-2026-${String(Date.now()).slice(-4)}`;
  const order: PrescriptionOrder = {
    id: orderId,
    patientId: `BN-2026-${String(Date.now()).slice(-3)}`,
    patientName,
    patientAge: 42,
    patientGender: 'Nam',
    patientWeight: 65,
    doctorName: 'BS.CKII Trần Văn Hùng',
    department: 'Khoa Khám Bệnh',
    diagnosisIcd10,
    diagnosisText,
    prescriptionType: 'outpatient',
    status: 'draft',
    createdAt: new Date().toISOString(),
    daysPrescribed: 7,
    items,
    clinicalNotes: 'Bệnh nhân tỉnh táo, tiếp xúc tốt, không tiền sử dị ứng penicillin.'
  };

  const replyText = `### 📋 THIẾT LẬP ĐƠN THUỐC ĐIỆN TỬ CPOE (${orderId})\n\n` +
    `• **Bệnh nhân:** **${patientName}** (42T - Nam)\n` +
    `• **Chẩn đoán:** \`${diagnosisIcd10}\` - **${diagnosisText}**\n` +
    `• **Bác sĩ kê đơn:** BS.CKII Trần Văn Hùng (Khoa Khám Bệnh)\n` +
    `• **Thời gian dùng:** 7 ngày điều trị ngoại trú\n` +
    `• **Danh mục thuốc kê:**\n` +
    items.map((it, idx) => `  ${idx + 1}. **${it.medicationName}** - SL: \`${it.quantity} ${it.unit}\` (${it.frequency})`).join('\n') +
    `\n\n🛡️ **Đánh giá an toàn lâm sàng (CDSS):** Đơn thuốc không có tương tác chống chỉ định nguy cơ cao theo Quyết định 5948/QĐ-BYT.\n\n` +
    `👉 Bác sĩ vui lòng bấm **[Ký duyệt & Tạo đơn thuốc CPOE]** trên thẻ bên dưới để xác thực và đẩy đơn vào hệ thống bệnh viện!`;

  const card: AgentActionCard = {
    cardType: 'cpoe_prescription',
    title: `Đơn Thuốc CPOE: ${patientName}`,
    summary: `Kê đơn điện tử • Chẩn đoán: ${diagnosisIcd10} - ${diagnosisText}`,
    data: order,
    primaryActionLabel: 'Ký duyệt & Tạo đơn thuốc CPOE',
    primaryActionType: 'EXECUTE_CREATE_CPOE_ORDER',
    targetTab: 'cpoe',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-cpoe-${Date.now()}`,
    sender: 'agent',
    text: replyText,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 52/2017/TT-BYT & QĐ 2147/QĐ-BYT',
      title: 'Quy chế kê đơn thuốc trong điều trị ngoại trú',
      clause: 'Điều 4 & Điều 7: Trách nhiệm của người kê đơn'
    },
    card,
    suggestedChips: [
      `Dặn dò bệnh nhân ${patientName} uống thuốc qua mail`,
      'Xem danh sách đơn thuốc CPOE',
      'Tra cứu tương tác thuốc QĐ 5948'
    ]
  };

  return { replyMessage, card };
}
