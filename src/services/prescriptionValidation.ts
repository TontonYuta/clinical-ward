export interface PrescriptionDraftMedication {
  medicationName?: string; dosage?: string; frequency?: string; route?: string; quantity?: number; durationDays?: number;
}
export interface PrescriptionDraftInput { patientName?: string; diagnosisText?: string; items?: PrescriptionDraftMedication[] }

export function validatePrescriptionDraft(draft: PrescriptionDraftInput): string[] {
  const errors: string[] = [];
  if (!draft.patientName?.trim()) errors.push('Cần có họ tên người bệnh.');
  if (!draft.diagnosisText?.trim()) errors.push('Cần có chẩn đoán.');
  if (!draft.items?.length) errors.push('Cần kê ít nhất một thuốc.');
  for (const [index, item] of (draft.items || []).entries()) {
    const label = `Thuốc ${index + 1}`;
    if (!item.medicationName?.trim()) errors.push(`${label}: cần chọn tên thuốc.`);
    if (!item.dosage?.trim()) errors.push(`${label}: cần ghi liều mỗi lần.`);
    if (!item.frequency?.trim()) errors.push(`${label}: cần ghi số lần dùng.`);
    if (!item.route?.trim()) errors.push(`${label}: cần ghi đường dùng.`);
    if (!Number.isFinite(item.quantity) || Number(item.quantity) <= 0) errors.push(`${label}: số lượng phải lớn hơn 0.`);
    if (!Number.isFinite(item.durationDays) || Number(item.durationDays) <= 0) errors.push(`${label}: số ngày sử dụng phải lớn hơn 0.`);
  }
  return errors;
}
