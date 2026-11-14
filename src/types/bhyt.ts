/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BHYT (Health Insurance) Claims Adjudication & Audit Types
 * Căn cứ: Thông tư 20/2022/TT-BYT, Quyết định 130/QĐ-BYT, Quyết định 3618/QĐ-BHXH
 */

export type HospitalRank = 'HANG_DAC_BIET' | 'HANG_I' | 'HANG_II' | 'HANG_III' | 'HANG_IV';

export type TreatmentType = 'NGOAI_TRU' | 'NOI_TRU';

export type BhytAuditSeverity = 'PASS' | 'WARNING' | 'REJECT' | 'NEEDS_REVIEW';

export type BhytViolationCategory =
  | 'HOSPITAL_RANK_MISMATCH'     // Vượt tuyến / Hạng bệnh viện không được thanh toán
  | 'ICD10_UNSUPPORTED'          // Chẩn đoán ICD-10 không khớp chỉ định thanh toán (Cột 8 TT 20)
  | 'THERAPEUTIC_DUPLICATION'    // Trùng hoạt chất hoặc trùng nhóm tác dụng điều trị
  | 'INCOMPATIBLE_CLASS_COMBINATION' // Phối hợp nhóm thuốc không tương thích
  | 'OVER_MAX_OUTPATIENT_DAYS'   // Kê quá số ngày tối đa điều trị ngoại trú
  | 'MISSING_CONSULTATION_FORM'  // Kháng sinh dự trữ / thuốc ung thư thiếu biên bản hội chẩn
  | 'RESTRICTED_OUTPATIENT'      // Kháng sinh dự trữ / thuốc cấm kê đơn điều trị ngoại trú
  | 'UNAPPROVED_ROUTE'           // Đường dùng không thuộc phạm vi thanh toán BHYT
  | 'NOT_IN_BHYT_CATALOG'        // Thuốc ngoài danh mục Thông tư 20/2022
  | 'PARTIAL_PAYMENT_ALERT';     // Thuốc có tỷ lệ thanh toán 50% hoặc 30% (Đồng chi trả theo luật)

export type BhytMissingField = 'quantity' | 'unitPrice' | 'dosage' | 'route' | 'daysSupply' | 'insuranceCardNumber' | 'patientAge' | 'primaryIcd10' | 'primaryDiagnosis' | 'hospitalRank' | 'treatmentType' | 'catalogMatch';

export interface BhytLegalRef {
  docCode: string;               // VD: '20/2022/TT-BYT'
  docTitle: string;
  section: string;               // VD: 'Phụ lục I, Nhóm 6'
  pageNumber: number;            // Số trang trong file PDF gốc
  localPdfPath: string;          // Đường dẫn file PDF local
}

export interface BhytViolationItem {
  id: string;
  drugId?: string;
  drugCode: string;
  drugName: string;
  activeIngredient: string;
  severity: BhytAuditSeverity;
  category: BhytViolationCategory | 'MISSING_DATA';
  violationType?: string;
  title: string;                 // Tên lỗi ngắn gọn
  ruleTitle?: string;
  detail: string;                // Mô tả súc tích (1-2 câu)
  description?: string;
  legalRef: BhytLegalRef;
  rejectionRiskVnd: number;      // Số tiền có nguy cơ xuất toán (phạt vi phạm)
  patientCoPayVnd?: number;      // Số tiền người bệnh cùng chi trả theo luật (50% hoặc 30%)
  action: string;                // Khuyến nghị hành động khắc phục
  legalAdvice?: string;
}

export type BhytRouteCategory = 'ORAL' | 'INJECTION' | 'TOPICAL' | 'OPHTHALMIC_OTIC' | 'INHALATION';

export interface BhytPrescriptionItem {
  id: string;
  drugCode?: string;
  drugName: string;
  activeIngredient: string;
  dosage: string;
  route: string;
  routeCategory?: BhytRouteCategory;
  quantity: number;
  daysSupply?: number;
  unitPrice: number;
  totalPrice?: number;
  unit?: string;
  batchNumber?: string;
  expiryDate?: string;
  vatRate?: number;
  instructions?: string;
  hasConsultationForm?: boolean;
}

export interface BhytPrescriptionPayload {
  prescriptionId?: string;
  documentType?: 'DON_THUOC' | 'HOA_DON_VAT' | 'PHIEU_XUAT_KHO' | 'HOA_DON_BAN_LE' | string;
  sellerName?: string;
  sellerTaxId?: string;
  invoiceNumber?: string;
  patientName: string;
  patientAge: number;
  insuranceCardNumber: string;
  hospitalRank: HospitalRank | '';
  treatmentType: TreatmentType | '';
  primaryIcd10: string;
  primaryDiagnosis: string;
  secondaryIcd10s?: string[];
  items: BhytPrescriptionItem[];
}

export interface BhytAuditReport {
  status: BhytAuditSeverity;
  evaluatedAt: string;
  hospitalRank: HospitalRank | '';
  treatmentType: TreatmentType | '';
  primaryIcd10: string;
  primaryDiagnosis: string;
  totalCostVnd: number;
  atRiskCostVnd: number;
  patientCoPayCostVnd?: number;
  itemsCount: number;
  passCount: number;
  warningCount: number;
  rejectCount: number;
  violations: BhytViolationItem[];
  missingFields?: BhytMissingField[];
}

export interface DavDrugCandidate {
  id: string;
  national_code: string;
  brand_name: string;
  active_ingredient: string;
  concentration?: string;
  dosage_form?: string;
  route?: string;
  atc_code?: string;
}

export interface BhytDrugRuleSummary {
  stt_thong_tu_20?: number;
  atc_code: string;
  active_ingredient: string;
  payment_ratio: number;
  allowed_ranks: string[];
  requires_consultation: boolean;
  max_outpatient_days: number;
  special_conditions?: string;
  allowed_icd10: string[];
  forbidden_icd10: string[];
}

export interface DrugResolutionResult {
  raw_query: string;
  cleaned_name: string;
  detected_concentration?: string;
  confidence_score: number;
  match_status: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNRESOLVED';
  match_strategy: string;
  matched_dav?: DavDrugCandidate;
  matched_bhyt?: BhytDrugRuleSummary;
  alternatives: DavDrugCandidate[];
}

export interface DrugBatchResolutionResponse {
  total: number;
  resolved_count: number;
  results: DrugResolutionResult[];
}

