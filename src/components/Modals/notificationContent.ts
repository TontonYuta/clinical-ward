import type { SmsMessageType } from '../../types/sms';
import type { ScheduledMedication } from '../../types/medicationSchedule';

export interface NotificationSource {
  patientName: string;
  patientId: string;
  orderId: string;
  orderStatus?: string;
  doctorName?: string;
  facilityName?: string;
  department?: string;
  diagnosis?: string;
  prescribedAt?: string;
  clinicalNotes?: string;
  medications: ScheduledMedication[];
}
export const NOTIFICATION_TEMPLATES: Record<SmsMessageType, { title: string; description: string }> = {
  cpoe_prescription: { title: 'Thông tin hồ sơ đơn thuốc', description: 'Mã nội bộ, trạng thái và nội dung được ghi trên hồ sơ.' },
  medication_advice: { title: 'Thông tin dùng thuốc trên hồ sơ', description: 'Giữ nguyên liều, tần suất, đường dùng và lời dặn đã được cung cấp.' },
  hospital_notice: { title: 'Thông báo khác cho người bệnh', description: 'Nội dung viện phí hoặc lịch hẹn cần được bổ sung từ dữ liệu đã xác nhận.' },
};
export function notificationStatus(status?: string) {
  if (status === 'draft') return 'Bản nháp';
  if (status === 'signed') return 'Trạng thái đã ký trên hồ sơ; chưa xác minh chữ ký';
  if (status === 'dispensed') return 'Trạng thái đã cấp phát trên hồ sơ';
  if (status === 'cancelled') return 'Hồ sơ đã hủy';
  return 'Chưa xác nhận trạng thái';
}
function medicationSummary(medications: ScheduledMedication[], compact: boolean) {
  if (!medications.length) return 'Danh mục thuốc: Chưa có dữ liệu được cung cấp.';
  return medications.map((medication, index) => [
    `${index + 1}. ${medication.medicationName || 'Tên thuốc chưa ghi'}`,
    medication.dosage ? `Liều: ${medication.dosage}` : 'Liều: Chưa ghi',
    medication.frequency ? `Tần suất: ${medication.frequency}` : 'Tần suất: Chưa ghi',
    medication.route ? `Đường dùng: ${medication.route}` : 'Đường dùng: Chưa ghi',
    Number.isFinite(medication.durationDays) && medication.durationDays > 0 ? `${medication.durationDays} ngày` : '',
    medication.specialInstructions || '',
  ].filter(Boolean).join(compact ? '; ' : ' · ')).join('\n');
}
export function notificationSourceSummary(source: NotificationSource, compact = false) {
  return [
    source.facilityName?.trim() || '',
    `Người bệnh: ${source.patientName || 'Chưa ghi'}${source.patientId ? ` (${source.patientId})` : ''}.`,
    source.orderId ? `Mã hồ sơ nội bộ: ${source.orderId}. ${notificationStatus(source.orderStatus)}.` : 'Chưa gắn hồ sơ đơn thuốc.',
    `Người kê đơn trên hồ sơ: ${source.doctorName?.trim() || 'Chưa ghi'}.`,
    !compact && source.department ? `Khoa ghi trên hồ sơ: ${source.department}.` : '',
    !compact && source.diagnosis ? `Chẩn đoán ghi trên hồ sơ: ${source.diagnosis}.` : '',
    !compact && source.prescribedAt ? `Thời điểm ghi trên hồ sơ: ${source.prescribedAt}.` : '',
    medicationSummary(source.medications, compact),
    source.clinicalNotes ? `Lời dặn trên hồ sơ: ${source.clinicalNotes}` : '',
  ].filter(Boolean).join('\n');
}
export function notificationContent(category: SmsMessageType, source: NotificationSource, compact = false) {
  const note = category === 'hospital_notice'
    ? 'Viện phí / lịch hẹn: Chưa có dữ liệu xác nhận trong hồ sơ được cung cấp.'
    : category === 'medication_advice'
      ? 'Kiểm tra lại hồ sơ và xác nhận với người điều trị trước khi thực hiện.'
      : 'Thông tin nội bộ; không xác nhận phát hành hoặc tra cứu trên hệ thống khác.';
  return `${notificationSourceSummary(source, compact)}\n${note}`;
}
