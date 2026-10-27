/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Định nghĩa Lịch Uống Thuốc & Dặn Dò Của Bác Sĩ Kê Đơn (<=200 LOC)
 */

export interface MedicationTimeSlot {
  id: 'morning' | 'noon' | 'afternoon' | 'evening' | string;
  label: 'Sáng' | 'Trưa' | 'Chiều' | 'Tối' | string;
  time: string; // VD: '07:00', '11:30', '18:00', '21:00'
  dosageText: string; // VD: '1 viên', '2 viên', '1 gói'
  mealRelation: 'Trước ăn 30 phút' | 'Sau ăn 15-30 phút' | 'Cùng bữa ăn' | 'Trước khi ngủ' | 'Bụng đói' | string;
  note?: string; // VD: 'Uống nhiều nước (>=200ml)', 'Không dùng cùng sữa'
}

export interface ScheduledMedication {
  id: string;
  medicationName: string;
  activeIngredient?: string;
  dosage: string; // VD: '500mg'
  route: string; // VD: 'Đường uống'
  durationDays: number; // Số ngày điều trị (VD: 5, 7, 14 ngày)
  timeSlots: MedicationTimeSlot[];
  specialInstructions?: string; // Hướng dẫn đặc biệt từ Dược Thư & Bác sĩ
}

export interface PatientPrescriptionAdvice {
  id: string; // ADV-2026-xxxx
  prescriptionId?: string; // RX-2026-xxxx
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  patientAge?: number | string;
  patientGender?: 'Nam' | 'Nữ';
  diagnosis?: string;
  doctorName: string;
  doctorHospital?: string;
  department?: string;
  createdAt: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  generalDoctorAdvice: string; // Lời dặn dò chung của bác sĩ
  medications: ScheduledMedication[];
  notificationStatus: 'idle' | 'loading' | 'success' | 'error';
  gasWebhookUrl?: string; // Google Apps Script Webhook URL
  emailSentAt?: string;
  channel?: 'email_gas' | 'zalo' | 'sms';
  feedbackMessage?: string;
}

export interface SendAdviceEmailPayload {
  advice: PatientPrescriptionAdvice;
  webhookUrl?: string;
}

export interface SendAdviceEmailResponse {
  success: boolean;
  message: string;
  timestamp: string;
  emailSentTo: string;
  provider: 'google_apps_script' | 'backend_relay' | 'local_preview';
}
