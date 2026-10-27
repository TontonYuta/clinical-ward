/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Xử lý Ý định: Dặn Dò Bác Sĩ & Lên Lịch Nhắc Uống Thuốc qua Google Apps Script (<=200 LOC)
 */

import { AgentActionCard, ChatMessage } from '../../../types/clinical';
import { anyKeyword, ProcessedQueryResult } from '../types';
import { findMatchedMed } from '../entityCatalog';
import { PatientPrescriptionAdvice, ScheduledMedication, MedicationTimeSlot } from '../../../types/medicationSchedule';
import { buildDefaultTimeSlots, getStoredGasWebhookUrl } from '../../../services/prescriptionAdviceService';

export function matchPrescriptionAdviceIntent(lower: string): boolean {
  return anyKeyword(lower, [
    'dặn dò', 'dặn dò bệnh nhân', 'dặn bệnh nhân', 'dặn dò uống thuốc', 'dặn uống thuốc',
    'nhắc uống thuốc', 'nhắc nhở uống thuốc', 'nhắc thuốc', 'lịch uống thuốc',
    'nhắc bệnh nhân uống thuốc', 'gửi mail nhắc thuốc', 'thông báo qua mail',
    'gửi mail cho bệnh nhân', 'gửi email cho bệnh nhân', 'lên lịch nhắc',
    'uống thuốc hàng ngày', 'dặn dò đơn thuốc', 'lịch nhắc thuốc'
  ]);
}

export function handlePrescriptionAdviceIntent(
  text: string,
  lower: string,
  nowStr: string
): ProcessedQueryResult {
  // 1. Trích xuất Email bệnh nhân (nếu có)
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const patientEmail = emailMatch ? emailMatch[1] : 'an.nv@gmail.com';

  // 2. Trích xuất Tên bệnh nhân
  let patientName = 'Nguyễn Văn An';
  const nameMatch = text.match(/(?:bệnh nhân|cho|dặn dò|nhắc)\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+){1,3})/u);
  if (nameMatch) {
    patientName = nameMatch[1].trim();
  }

  // 3. Trích xuất các mốc giờ uống thuốc (nếu người dùng chỉ định)
  const timeMatches = text.match(/(\d{1,2})\s*(?:h|giờ|g)/gi);
  let customSlots: MedicationTimeSlot[] | null = null;
  if (timeMatches && timeMatches.length >= 2) {
    const t1 = parseInt(timeMatches[0], 10);
    const t2 = parseInt(timeMatches[1], 10);
    customSlots = [
      {
        id: 'morning',
        label: 'Sáng',
        time: `${t1.toString().padStart(2, '0')}:00`,
        dosageText: '1 viên',
        mealRelation: 'Sau khi ăn 15-30 phút'
      },
      {
        id: 'evening',
        label: 'Tối',
        time: `${t2.toString().padStart(2, '0')}:00`,
        dosageText: '1 viên',
        mealRelation: 'Sau khi ăn 15-30 phút'
      }
    ];
  }

  // 4. Trích xuất thuốc từ câu lệnh
  const matchedMeds: ScheduledMedication[] = [];
  const candidateKeywords = [
    { name: 'Paracetamol 500mg', inn: 'Paracetamol', keys: ['paracetamol', 'panadol', 'hạ sốt', 'giảm đau'] },
    { name: 'Augmentin 1g', inn: 'Amoxicillin + Clavulanic', keys: ['augmentin', 'amoxicillin', 'kháng sinh'] },
    { name: 'Ciprofloxacin 500mg', inn: 'Ciprofloxacin', keys: ['cipro', 'ciprofloxacin'] },
    { name: 'Omeprazol 20mg', inn: 'Omeprazol', keys: ['omeprazol', 'dạ dày'] },
    { name: 'Diazepam 5mg', inn: 'Diazepam', keys: ['diazepam', 'an thần'] }
  ];

  for (const c of candidateKeywords) {
    if (anyKeyword(lower, c.keys)) {
      matchedMeds.push({
        id: `med-${matchedMeds.length + 1}`,
        medicationName: c.name,
        activeIngredient: c.inn,
        dosage: c.name.split(' ').pop() || '1 viên',
        route: 'Đường uống',
        durationDays: 7,
        specialInstructions: 'Uống đủ nước, không uống cùng bia rượu hoặc chất kích thích.',
        timeSlots: customSlots || buildDefaultTimeSlots('Ngày 2 lần')
      });
    }
  }

  // Nếu không chỉ định cụ thể, tạo đơn phối hợp mẫu điều trị ngoại trú
  if (matchedMeds.length === 0) {
    matchedMeds.push(
      {
        id: 'med-1',
        medicationName: 'Paracetamol 500mg',
        activeIngredient: 'Paracetamol',
        dosage: '500mg',
        route: 'Đường uống',
        durationDays: 5,
        specialInstructions: 'Uống sau ăn, cách nhau 4-6 giờ. Tối đa 4g/ngày.',
        timeSlots: customSlots || [
          { id: 'morning', label: 'Sáng', time: '07:30', dosageText: '1 viên', mealRelation: 'Sau ăn 15 phút' },
          { id: 'evening', label: 'Tối', time: '19:30', dosageText: '1 viên', mealRelation: 'Sau ăn 15 phút' }
        ]
      },
      {
        id: 'med-2',
        medicationName: 'Augmentin 1g',
        activeIngredient: 'Amoxicillin + Acid Clavulanic',
        dosage: '1g',
        route: 'Đường uống',
        durationDays: 7,
        specialInstructions: 'Uống ngay đầu bữa ăn để giảm kích ứng dạ dày.',
        timeSlots: customSlots || [
          { id: 'morning', label: 'Sáng', time: '08:00', dosageText: '1 viên', mealRelation: 'Đầu bữa ăn' },
          { id: 'evening', label: 'Tối', time: '20:00', dosageText: '1 viên', mealRelation: 'Đầu bữa ăn' }
        ]
      }
    );
  }

  const advice: PatientPrescriptionAdvice = {
    id: `ADV-${Date.now().toString().slice(-6)}`,
    prescriptionId: 'RX-2026-OUTPATIENT',
    patientName,
    patientEmail,
    diagnosis: 'Nhiễm khuẩn hô hấp trên & Điều trị ngoại trú',
    doctorName: 'BS.CKII Trần Văn Hùng',
    doctorHospital: 'Bệnh Viện Đa Khoa Lâm Sàng',
    department: 'Khoa Khám Bệnh',
    createdAt: new Date().toISOString(),
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    generalDoctorAdvice: 'Uống thuốc đúng giờ theo các cữ đã lập. Uống nhiều nước ấm (>= 2 lít/ngày). Kiêng đồ lạnh, rượu bia và đồ cay nóng. Tái khám sau 7 ngày hoặc khi có biểu hiện bất thường.',
    medications: matchedMeds,
    notificationStatus: 'idle',
    gasWebhookUrl: getStoredGasWebhookUrl()
  };

  const hoursNote = customSlots ? `lúc **${customSlots[0].time}** và **${customSlots[1].time}**` : 'hàng ngày theo cữ Sáng - Tối';
  const replyText = `### 📋 ĐÃ THIẾT LẬP LỊCH DẶN DÒ UỐNG THUỐC CHO BỆNH NHÂN\n\n` +
    `• **Bệnh nhân:** **${patientName}**\n` +
    `• **Email nhận lịch:** \`${patientEmail}\`\n` +
    `• **Thời gian uống thuốc:** ${hoursNote}\n` +
    `• **Số loại thuốc:** ${matchedMeds.length} mặt hàng (\`${matchedMeds.map(m => m.medicationName).join(', ')}\`)\n` +
    `• **Phương thức thông báo:** Tự động hóa qua Google Apps Script Webhook & Gmail API.\n\n` +
    `👉 Bác sĩ có thể bấm **[Gửi Email qua Google Script]** trên thẻ bên dưới để chuyển lịch uống thuốc trực tiếp vào hòm thư bệnh nhân, hoặc bấm **[Xem Email]** để xem trước nội dung HTML!`;

  const card: AgentActionCard = {
    cardType: 'medication_schedule',
    title: `Lịch Dặn Dò & Nhắc Uống Thuốc: ${patientName}`,
    summary: `Kê đơn & dặn dò cữ thuốc hàng ngày • Gửi mail qua Google Apps Script`,
    data: advice,
    primaryActionLabel: 'Gửi Email qua Google Script',
    primaryActionType: 'SEND_ADVICE_EMAIL',
    status: 'pending'
  };

  const replyMessage: ChatMessage = {
    id: `msg-agent-advice-${Date.now()}`,
    sender: 'agent',
    text: replyText,
    timestamp: nowStr,
    legalReference: {
      lawCode: 'Thông tư 52/2017/TT-BYT & QĐ 2147/QĐ-BYT',
      title: 'Quy chế kê đơn thuốc ngoại trú & Hướng dẫn sử dụng thuốc an toàn',
      clause: 'Điều 7: Hướng dẫn người bệnh sử dụng thuốc'
    },
    card,
    suggestedChips: [
      `Gửi email nhắc thuốc cho ${patientName}`,
      'Dặn dò bệnh nhân Trần Thị Mai uống Cipro sáng 8h tối 20h gửi mai@hospital.vn',
      'In phiếu dặn dò uống thuốc'
    ]
  };

  return { replyMessage, card };
}
