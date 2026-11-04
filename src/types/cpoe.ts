/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ bác sĩ CPOE: Kê đơn thuốc điện tử & phân loại mẫu đơn (TT 26/2025/TT-BYT) (<=200 LOC)
 */

export type PrescriptionType = 'outpatient' | 'inpatient_daily';

export type Tt26FormType = 'PL1_STANDARD' | 'PL2_NARCOTIC' | 'PL3_PSYCHOTROPIC';

export interface PrescriptionItem {
  id: string;
  medicationName: string;
  activeIngredient: string;
  dosage: string;
  frequency: string;
  route: 'Uống' | 'Tiêm bắp' | 'Tiêm tĩnh mạch' | 'Truyền tĩnh mạch' | 'Đặt' | 'Hít' | string;
  quantity: number;
  unit: 'Hộp' | 'Vỉ' | 'Viên' | 'Ống' | 'Lọ' | 'Chai' | string;
  instructions: string;
  durationDays?: number;
  isNarcotic?: boolean;
}

export interface PrescriptionOrder {
  id: string; // Định dạng TT26: xxxxxyyyyyyy-z hoặc RX-2026-xxxx
  prescriptionType: PrescriptionType;
  tt26FormType?: Tt26FormType; // Phụ lục I (-C), Phụ lục II (-N), Phụ lục III (-H)
  patientId: string;
  patientName: string;
  patientCccd: string; // Số định danh / CCCD / Hộ chiếu (Bắt buộc TT 26/2025/TT-BYT)
  patientInsuranceId?: string;
  patientAddress?: string;
  guardianName?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientDob: string;
  patientGender: 'Nam' | 'Nữ' | '';
  department: string;
  roomBed?: string;
  diagnosisIcd10: string; // Mã ICD-10
  diagnosisText: string;
  isChronicDisease: boolean; // Danh mục 252 bệnh mạn tính kê tối đa 90 ngày (Phụ lục VII)
  daysPrescribed: number;
  doctorName: string;
  doctorCertificate: string;
  prescribedAt: string;
  items: PrescriptionItem[];
  digitalSignature?: string;
  status: 'draft' | 'signed' | 'dispensed' | 'cancelled';
  patientAge?: number;
  patientWeight?: number;
  clinicalNotes?: string;
  // Các trường chuyên biệt của Phụ lục II (Đơn "N") & Phụ lục III (Đơn "H")
  receiverCccd?: string; // Số CCCD/Định danh người nhận thuốc
  receiverName?: string; // Họ tên người nhận thuốc
  treatmentBatch1?: string; // Đợt 1 (Đơn N ung thư)
  treatmentBatch2?: string; // Đợt 2 (Đơn N ung thư)
  treatmentBatch3?: string; // Đợt 3 (Đơn N ung thư)
  facilityName?: string;
  facilityAddress?: string;
  facilityPhone?: string;
}

export interface NursingMarSlot {
  slotId: 'morning' | 'noon' | 'afternoon' | 'evening';
  slotLabel: string; // "Sáng (08:00)", "Trưa (12:00)", "Chiều (16:00)", "Tối (20:00)"
  scheduledTime: string;
  status: 'completed' | 'pending' | 'skipped';
  administeredBy?: string; // "ĐD. Hoàng Thị Lan"
  administeredAt?: string; // "08:05 04/11/2026"
  notes?: string; // "Người bệnh hợp tác tốt, mạch 78, huyết áp 120/80"
}

export interface NursingMedicationAdministration {
  orderItemId: string;
  medicationName: string;
  dosage: string;
  route: string;
  slots: NursingMarSlot[];
}

export function resolveTt26FormType(order: {
  tt26FormType?: Tt26FormType;
  id?: string;
  items?: Array<{ isNarcotic?: boolean; medicationName?: string; activeIngredient?: string }>;
}): Tt26FormType {
  if (order.tt26FormType) return order.tt26FormType;
  const id = (order.id || '').toUpperCase();
  if (id.endsWith('-N')) return 'PL2_NARCOTIC';
  if (id.endsWith('-H')) return 'PL3_PSYCHOTROPIC';
  if (id.endsWith('-C')) return 'PL1_STANDARD';

  const hasNarcotic = order.items?.some(
    (i) =>
      i.isNarcotic ||
      /\b(morphin|fentanyl|oxycodon|pethidin|methadon|buprenorphin)\b/i.test(
        (i.medicationName || '') + ' ' + (i.activeIngredient || '')
      )
  );
  if (hasNarcotic) return 'PL2_NARCOTIC';

  const hasPsychotropic = order.items?.some((i) =>
    /\b(diazepam|clonazepam|lorazepam|phenobarbital|zolpidem|midazolam|chlordiazepoxid)\b/i.test(
      (i.medicationName || '') + ' ' + (i.activeIngredient || '')
    )
  );
  if (hasPsychotropic) return 'PL3_PSYCHOTROPIC';

  return 'PL1_STANDARD';
}

export function getTt26FormMetadata(formType: Tt26FormType) {
  switch (formType) {
    case 'PL2_NARCOTIC':
      return {
        code: 'N',
        appendix: 'Phụ lục II',
        title: 'ĐƠN THUỐC “N”',
        subTitle: 'Đơn thuốc gây nghiện',
        colorBadge: 'bg-rose-50 text-rose-800 border-rose-300',
        badgeShort: 'Đơn “N” (Gây nghiện)',
      };
    case 'PL3_PSYCHOTROPIC':
      return {
        code: 'H',
        appendix: 'Phụ lục III',
        title: 'ĐƠN THUỐC “H”',
        subTitle: 'Đơn thuốc hướng thần, thuốc tiền chất',
        colorBadge: 'bg-purple-50 text-purple-800 border-purple-300',
        badgeShort: 'Đơn “H” (Hướng thần)',
      };
    case 'PL1_STANDARD':
    default:
      return {
        code: 'C',
        appendix: 'Phụ lục I',
        title: 'ĐƠN THUỐC',
        subTitle: 'Mẫu đơn thuốc thông thường',
        colorBadge: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        badgeShort: 'Đơn thuốc (PL I)',
      };
  }
}
