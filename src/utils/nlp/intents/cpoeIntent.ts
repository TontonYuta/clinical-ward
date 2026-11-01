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
  const nameMatch = text.match(/(?:bệnh nhân|cho|bn)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})/u);
  const hasPatientIdentity = Boolean(nameMatch || /\b(?:bn|cccd|căn cước|hộ chiếu)\s*[:#]?\s*[\w-]+/iu.test(text));
  const hasMedication = anyKeyword(lower, ['augmentin', 'amoxicillin', 'paracetamol', 'panadol', 'cipro', 'ciprofloxacin']);
  const hasDiagnosis = anyKeyword(lower, ['viêm họng', 'viêm phế quản', 'viêm phổi', 'sốt']);
  const missing = [
    ...(!hasPatientIdentity ? ['định danh người bệnh'] : []),
    ...(!hasDiagnosis ? ['chẩn đoán'] : []),
    ...(!hasMedication ? ['tên thuốc'] : [])
  ];
  if (missing.length) {
    return { replyMessage: {
      id: `msg-agent-cpoe-clarify-${Date.now()}`,
      sender: 'agent',
      text: `Để chuẩn bị bản nháp đơn thuốc theo Điều 6 Thông tư 26/2025/TT-BYT, vui lòng bổ sung: ${missing.join(', ')}. Chưa tạo đơn vì thông tin hiện tại chưa đủ để lập đơn an toàn.`,
      timestamp: nowStr,
      legalReference: { lawCode: 'Thông tư 26/2025/TT-BYT', title: 'Yêu cầu chung với nội dung kê đơn thuốc', clause: 'Điều 6' }
    } };
  }

  // 1. Trích xuất Tên bệnh nhân
  const patientName = nameMatch?.[1].trim() || 'Người bệnh đã chọn';

  // 2. Trích xuất Chẩn đoán
  let diagnosisText = '';
  let diagnosisIcd10 = '';
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
      route: 'Uống',
      quantity: 14,
      unit: 'Viên',
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
      route: 'Uống',
      quantity: 10,
      unit: 'Viên',
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
      route: 'Uống',
      quantity: 14,
      unit: 'Viên',
      instructions: 'Uống xa bữa ăn và tránh uống cùng sữa hoặc chế phẩm chứa canxi'
    });
  }

  const replyText = `Có thể mở form CPOE để nhập dữ liệu, nhưng chatbot chưa tạo đơn. Vui lòng chọn hồ sơ người bệnh và nhập xác nhận chẩn đoán, liều, tần suất, đường dùng, số lượng và thời gian sử dụng trong form.`;

  const card: AgentActionCard = {
    cardType: 'cpoe_prescription_draft',
    title: `Đơn Thuốc CPOE: ${patientName}`,
    summary: `Bản nháp cần hoàn thiện và rà soát Điều 6 • Chẩn đoán: ${diagnosisIcd10} - ${diagnosisText}`,
    data: {},
    primaryActionLabel: 'Mở bản nháp CPOE để rà soát',
    primaryActionType: 'NAVIGATE_TAB',
    targetTab: 'cpoe',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-cpoe-${Date.now()}`,
    sender: 'agent',
    text: replyText,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 26/2025/TT-BYT & QĐ 2147/QĐ-BYT',
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
