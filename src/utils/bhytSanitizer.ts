/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BHYT Data Sanitizer & Schema Coercion
 * Phòng vệ 100% trước các dị thường dữ liệu từ Vision OCR, API ngoại vi và tệp tải lên
 */

import {
  BhytPrescriptionPayload,
  BhytPrescriptionItem,
  BhytViolationItem,
  HospitalRank,
  TreatmentType,
  BhytLegalRef
} from '../types/bhyt';

export const VALID_HOSPITAL_RANKS: HospitalRank[] = [
  'HANG_DAC_BIET',
  'HANG_I',
  'HANG_II',
  'HANG_III',
  'HANG_IV'
];

export const DEFAULT_LEGAL_REF: BhytLegalRef = {
  docCode: '20/2022/TT-BYT',
  docTitle: 'Thông tư 20/2022/TT-BYT Danh mục Thuốc BHYT',
  section: 'Quy định thanh toán thuốc BHYT',
  pageNumber: 1,
  localPdfPath: '/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf'
};

/**
 * Chuẩn hóa hạng bệnh viện, tự động ánh xạ các biến thể text sang Enum chuẩn
 */
export function sanitizeHospitalRank(rawRank: any, fallback: HospitalRank | '' = ''): HospitalRank | '' {
  if (!rawRank) return fallback;
  const str = String(rawRank).trim().toUpperCase();

  if (VALID_HOSPITAL_RANKS.includes(str as HospitalRank)) {
    return str as HospitalRank;
  }

  // Ánh xạ các biến thể OCR thường gặp (hỗ trợ cả có dấu và không dấu)
  if (str.includes('DAC_BIET') || str.includes('DAC BIET') || str.includes('ĐẶC BIỆT') || str.includes('TW') || str.includes('TRUNG ƯƠNG') || str.includes('TRUNG UONG')) {
    return 'HANG_DAC_BIET';
  }
  if (str.includes('HANG_1') || str.includes('HANG_I') || str.includes('HẠNG 1') || str.includes('HẠNG I') || str.includes('TINH') || str.includes('TỈNH')) {
    return 'HANG_I';
  }
  if (str.includes('HANG_2') || str.includes('HANG_II') || str.includes('HẠNG 2') || str.includes('HẠNG II') || str.includes('KHU VUC') || str.includes('KHU VỰC')) {
    return 'HANG_II';
  }
  if (str.includes('HANG_3') || str.includes('HANG_III') || str.includes('HẠNG 3') || str.includes('HẠNG III') || str.includes('HUYEN') || str.includes('HUYỆN')) {
    return 'HANG_III';
  }
  if (str.includes('HANG_4') || str.includes('HANG_IV') || str.includes('HẠNG 4') || str.includes('HẠNG IV') || str.includes('XA') || str.includes('XÃ') || str.includes('TRAM') || str.includes('TRẠM')) {
    return 'HANG_IV';
  }

  return fallback;
}

/**
 * Chuẩn hóa loại hình điều trị
 */
export function sanitizeTreatmentType(rawType: any, fallback: TreatmentType | '' = ''): TreatmentType | '' {
  if (!rawType) return fallback;
  const str = String(rawType).trim().toUpperCase();
  if (str === 'NOI_TRU' || str.includes('NỘI TRÚ')) return 'NOI_TRU';
  if (str === 'NGOAI_TRU' || str.includes('NGOẠI TRÚ')) return 'NGOAI_TRU';
  return fallback;
}

/**
 * Chuẩn hóa một dòng thuốc đơn lẻ, đảm bảo không bao giờ ném TypeError khi truy cập thuộc tính
 */
export function sanitizePrescriptionItem(rawItem: any, index: number = 0): BhytPrescriptionItem {
  const it = rawItem && typeof rawItem === 'object' ? rawItem : {};

  const q = Number(it.quantity ?? it.quantity_val ?? 0);
  const quantity = !isNaN(q) && q > 0 ? q : 0;

  const p = Number(it.unitPrice ?? it.unit_price ?? 0);
  const unitPrice = !isNaN(p) && p >= 0 ? p : 0;

  const t = Number(it.totalPrice ?? it.total_price ?? 0);
  const totalPrice = !isNaN(t) && t > 0 ? t : undefined;

  const ds = Number(it.daysSupply ?? it.days_supply ?? 0);
  const daysSupply = !isNaN(ds) && ds > 0 ? Math.round(ds) : undefined;

  const vr = Number(it.vatRate ?? it.vat_rate ?? 0);
  const vatRate = !isNaN(vr) && vr >= 0 ? vr : 0;

  return {
    id: String(it.id || it.item_id || `ITEM-${index + 1}`),
    drugCode: String(it.drugCode || it.drug_code || ''),
    drugName: String(it.drugName || it.drug_name || '').trim(),
    activeIngredient: String(it.activeIngredient || it.active_ingredient || '').trim(),
    dosage: String(it.dosage || '').trim(),
    unit: String(it.unit || it.dvt || '').trim() || undefined,
    batchNumber: String(it.batchNumber || it.batch_number || it.lot_no || it.lot || '').trim(),
    expiryDate: String(it.expiryDate || it.expiry_date || it.hsd || '').trim(),
    route: String(it.route || '').trim(),
    quantity,
    daysSupply,
    unitPrice,
    totalPrice,
    vatRate,
    instructions: String(it.instructions || it.lieu_dung || '').trim(),
    hasConsultationForm: typeof (it.hasConsultationForm ?? it.has_consultation_form) === 'boolean' ? (it.hasConsultationForm ?? it.has_consultation_form) : undefined
  };
}

/**
 * Chuẩn hóa toàn bộ cấu trúc đơn thuốc / kết quả OCR
 */
export function sanitizeOcrPrescriptionPayload(
  raw: any,
  defaultRank: HospitalRank | '' = '',
  defaultType: TreatmentType | '' = ''
): BhytPrescriptionPayload {
  const p = raw && typeof raw === 'object' ? raw : {};

  // Xử lý secondaryIcd10s an toàn 100%
  let rawSecondary = p.secondaryIcd10s ?? p.secondary_icd10s ?? [];
  if (typeof rawSecondary === 'string') {
    rawSecondary = rawSecondary.split(/[,;\s]+/).filter(Boolean);
  }
  const secondaryIcd10s = Array.isArray(rawSecondary)
    ? rawSecondary.map(c => String(c).trim().toUpperCase()).filter(Boolean)
    : [];

  // Xử lý danh sách items
  const rawItems = Array.isArray(p.items) ? p.items : [];
  const items = rawItems.map((it, idx) => sanitizePrescriptionItem(it, idx));

  // Tuổi bệnh nhân
  const rawAge = Number(p.patientAge ?? p.patient_age ?? 0);
  const patientAge = !isNaN(rawAge) && rawAge > 0 && rawAge < 150 ? rawAge : 0;

  return {
    prescriptionId: String(p.prescriptionId || p.prescription_id || `RX-${Date.now()}`),
    documentType: String(p.documentType || p.document_type || 'DON_THUOC'),
    sellerName: String(p.sellerName || p.seller_name || '').trim(),
    sellerTaxId: String(p.sellerTaxId || p.seller_tax_id || '').trim(),
    invoiceNumber: String(p.invoiceNumber || p.invoice_number || '').trim(),
    patientName: String(p.patientName || p.patient_name || '').trim(),
    patientAge,
    insuranceCardNumber: String(p.insuranceCardNumber || p.insurance_card_number || '').trim(),
    hospitalRank: sanitizeHospitalRank(p.hospitalRank || p.hospital_rank, defaultRank),
    treatmentType: sanitizeTreatmentType(p.treatmentType || p.treatment_type, defaultType),
    primaryIcd10: String(p.primaryIcd10 || p.primary_icd10 || '').trim().toUpperCase(),
    primaryDiagnosis: String(p.primaryDiagnosis || p.primary_diagnosis || '').trim(),
    secondaryIcd10s,
    items
  };
}

/**
 * Chuẩn hóa một vi phạm BHYT, đảm bảo legalRef không bao giờ undefined
 */
export function sanitizeViolationItem(rawV: any, index: number = 0): BhytViolationItem {
  const v = rawV && typeof rawV === 'object' ? rawV : {};
  const legal = v.legalRef || v.legal_ref || {};

  const legalRef: BhytLegalRef = {
    docCode: String(legal.docCode || legal.doc_code || DEFAULT_LEGAL_REF.docCode),
    docTitle: String(legal.docTitle || legal.doc_title || DEFAULT_LEGAL_REF.docTitle),
    section: String(legal.section || DEFAULT_LEGAL_REF.section),
    pageNumber: Number(legal.pageNumber || legal.page_number || DEFAULT_LEGAL_REF.pageNumber),
    localPdfPath: String(legal.localPdfPath || legal.local_pdf_path || DEFAULT_LEGAL_REF.localPdfPath)
  };

  const risk = Number(v.rejectionRiskVnd ?? v.rejection_risk_vnd ?? 0);
  const copay = Number(v.patientCoPayVnd ?? v.patient_copay_vnd ?? 0);

  return {
    id: String(v.id || `v-${index + 1}`),
    drugCode: String(v.drugCode || v.drug_code || ''),
    drugName: String(v.drugName || v.drug_name || 'Thuốc vi phạm'),
    activeIngredient: String(v.activeIngredient || v.active_ingredient || ''),
    severity: (v.severity === 'REJECT' || v.severity === 'WARNING' || v.severity === 'PASS' || v.severity === 'NEEDS_REVIEW') ? v.severity : 'WARNING',
    category: v.category || 'NOT_IN_BHYT_CATALOG',
    title: String(v.title || 'Cảnh báo thanh toán BHYT'),
    detail: String(v.detail || ''),
    legalRef,
    rejectionRiskVnd: !isNaN(risk) && risk >= 0 ? risk : 0,
    patientCoPayVnd: !isNaN(copay) && copay >= 0 ? copay : undefined,
    action: String(v.action || 'Kiểm tra lại chỉ định theo quy định BHYT.')
  };
}
