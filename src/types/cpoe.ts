/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ bác sĩ CPOE: Kê đơn thuốc điện tử & chỉ định điều trị (TT 26/2025/TT-BYT)
 */

export type PrescriptionType = 'outpatient' | 'inpatient_daily';

export interface PrescriptionItem {
  id: string;
  medicationName: string;
  activeIngredient: string;
  dosage: string;
  frequency: string;
  route: 'Uống' | 'Tiêm bắp' | 'Tiêm tĩnh mạch' | 'Truyền tĩnh mạch' | 'Đặt' | 'Hít';
  quantity: number;
  unit: 'Hộp' | 'Vỉ' | 'Viên' | 'Ống' | 'Lọ' | 'Chai';
  instructions: string;
  durationDays?: number;
  isNarcotic?: boolean;
}

export interface PrescriptionOrder {
  id: string; // RX-2026-xxxx
  prescriptionType: PrescriptionType;
  patientId: string;
  patientName: string;
  patientCccd: string; // Bắt buộc theo TT 26/2025/TT-BYT
  patientInsuranceId?: string;
  patientAddress?: string;
  guardianName?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientDob: string;
  patientGender: 'Nam' | 'Nữ' | '';
  department: string;
  roomBed?: string;
  diagnosisIcd10: string; // Mã bệnh ICD-10
  diagnosisText: string;
  isChronicDisease: boolean; // Danh mục 252 bệnh mạn tính kê tối đa 90 ngày
  daysPrescribed: number; // Tối đa 90 ngày với bệnh mạn tính, 30 ngày thông thường
  doctorName: string;
  doctorCertificate: string;
  prescribedAt: string;
  items: PrescriptionItem[];
  digitalSignature?: string;
  status: 'draft' | 'signed' | 'dispensed' | 'cancelled';
  patientAge?: number;
  patientWeight?: number;
  clinicalNotes?: string;
}
