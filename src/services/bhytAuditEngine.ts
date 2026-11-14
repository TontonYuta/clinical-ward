/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BHYT Claims Audit & Adjudication Engine
 * Căn cứ: Thông tư 20/2022/TT-BYT, Quyết định 130/QĐ-BYT, Quyết định 3618/QĐ-BHXH
 */

import {
  BhytPrescriptionPayload,
  BhytAuditReport,
  BhytViolationItem,
  BhytAuditSeverity,
  HospitalRank
} from '../types/bhyt';
import {
  findBhytRule,
  detectRouteCategory,
  HOSPITAL_RANK_LABELS
} from '../data/bhytDrugRules';

const TT20_PDF_PATH = '/pdf/bhyt/Thong_Tu_20_2022_TT_BYT_Danh_Muc_Thanh_Toan_Thuoc_BHYT.pdf';
const QD3618_PDF_PATH = '/pdf/bhyt/Quyet_Dinh_3618_QD_BHXH_2022_Quy_Trinh_Giam_Dinh_BHYT.pdf';
const TT26_PDF_PATH = '/pdf/Thong_Tu_26_2025_TT_BYT_Ke_Don_Thuoc.pdf';
const TT36_PDF_PATH = '/pdf/Thong_Tu_36_2018_TT_BYT_GSP.pdf';

/**
 * So khớp mã ICD-10 chuẩn hóa không phân biệt dấu chấm
 * Ví dụ: K21.0 khớp K21, E11.9 khớp E11, E119 khớp E11
 */
export function isIcd10Matching(candidateCode: string, rulePrefix: string): boolean {
  if (!candidateCode || !rulePrefix) return false;
  const cNorm = candidateCode.trim().toUpperCase();
  const pNorm = rulePrefix.trim().toUpperCase();

  if (cNorm.startsWith(pNorm)) return true;

  const cNoDot = cNorm.replace(/\./g, '');
  const pNoDot = pNorm.replace(/\./g, '');
  if (cNoDot.startsWith(pNoDot)) return true;

  const cBase = cNorm.split('.')[0];
  const pBase = pNorm.split('.')[0];
  if (cBase === pBase || cBase.startsWith(pBase)) return true;

  return false;
}

/**
 * Bảng cấu hình quy tắc phân nhóm tác dụng điều trị (Declarative Rules - Chuẩn hóa từ CSDL QĐ 3618)
 */
export interface BhytTherapeuticClassConfig {
  id: string;
  name: string;
  atcPrefixes: string[];
  maxAllowed: number;
  rejectionTitle: string;
  rejectionRationale: string;
}

export interface BhytIncompatiblePairConfig {
  id: string;
  atcPrefixA: string;
  atcPrefixB: string;
  rejectionTitle: string;
  rejectionRationale: string;
}

export type BhytAuditMode = 'bhyt' | 'prescription';

export interface BhytAuditOptions {
  /** BHYT mode evaluates payment eligibility; prescription mode checks only medication data. */
  mode?: BhytAuditMode;
}

export const DECLARATIVE_THERAPEUTIC_CLASSES: BhytTherapeuticClassConfig[] = [
  {
    id: 'PPI',
    name: 'PPI dạ dày',
    atcPrefixes: ['A02BC'],
    maxAllowed: 1,
    rejectionTitle: 'Trùng lặp nhóm tác dụng (PPI dạ dày)',
    rejectionRationale: 'Cơ quan BHXH từ chối thanh toán 2 thuốc ức chế bơm proton cùng cơ chế tác dụng trong 1 đợt khám.'
  },
  {
    id: 'NSAID',
    name: 'NSAID kháng viêm',
    atcPrefixes: ['M01A'],
    maxAllowed: 1,
    rejectionTitle: 'Trùng lặp nhóm tác dụng (NSAID kháng viêm)',
    rejectionRationale: 'Cơ quan BHXH từ chối thanh toán 2 thuốc chống viêm không steroid (NSAID) cùng cơ chế tác dụng trong 1 đợt khám.'
  },
  {
    id: 'STATIN',
    name: 'Statin hạ lipid máu',
    atcPrefixes: ['C10AA'],
    maxAllowed: 1,
    rejectionTitle: 'Trùng lặp nhóm tác dụng (Statin hạ lipid máu)',
    rejectionRationale: 'Cơ quan BHXH từ chối thanh toán 2 thuốc nhóm Statin hạ lipid máu trong cùng 1 đơn ngoại trú do tăng nguy cơ tiêu cơ vân.'
  },
  {
    id: 'CORTICOID',
    name: 'Corticoid toàn thân',
    atcPrefixes: ['H02AB'],
    maxAllowed: 1,
    rejectionTitle: 'Trùng lặp nhóm tác dụng (Corticoid toàn thân)',
    rejectionRationale: 'Cơ quan BHXH từ chối thanh toán 2 glucocorticoid đường toàn thân đồng thời.'
  }
];

export const DECLARATIVE_INCOMPATIBLE_CLASSES: BhytIncompatiblePairConfig[] = [
  {
    id: 'INC-RAAS-DUAL',
    atcPrefixA: 'C09A',
    atcPrefixB: 'C09C',
    rejectionTitle: 'Trùng lặp nhóm tác dụng (Ức chế hệ Renin-Angiotensin (ACEI/ARB))',
    rejectionRationale: 'Bộ Y Tế và BHXH nghiêm cấm phối hợp đồng thời thuốc ức chế men chuyển (ACEI) và chẹn thụ thể angiotensin (ARB) do làm tăng nguy cơ suy thận cấp, hạ huyết áp quá mức và tăng kali máu.'
  }
];

/**
 * Phân loại nhóm tác dụng điều trị động từ bảng cấu hình khai báo (Zero Hardcode)
 */
export function getTherapeuticGroup(atcGroup: string): { key: string; name: string } | null {
  if (!atcGroup) return null;
  const upper = atcGroup.trim().toUpperCase();

  const matched = DECLARATIVE_THERAPEUTIC_CLASSES.find(tc =>
    tc.atcPrefixes.some(p => upper.startsWith(p))
  );
  if (matched) {
    return { key: matched.id, name: matched.name };
  }

  const incomp = DECLARATIVE_INCOMPATIBLE_CLASSES.find(ic =>
    upper.startsWith(ic.atcPrefixA) || upper.startsWith(ic.atcPrefixB)
  );
  if (incomp) {
    return { key: incomp.id, name: 'Ức chế hệ Renin-Angiotensin (ACEI/ARB)' };
  }

  return null;
}

/**
 * Thẩm định toàn diện đơn thuốc theo chuẩn pháp lý BHYT
 */
export function auditBhytPrescription(payload: BhytPrescriptionPayload, options: BhytAuditOptions = {}): BhytAuditReport {
  const mode: BhytAuditMode = options.mode || 'bhyt';
  const isBhytAudit = mode === 'bhyt';
  const violations: BhytViolationItem[] = [];
  const evaluatedAt = new Date().toISOString();
  const missingFields = new Set<import('../types/bhyt').BhytMissingField>();

  let totalCostVnd = 0;
  let atRiskCostVnd = 0;
  let patientCoPayCostVnd = 0;

  // Thu thập tất cả các mã ICD-10 trong đơn
  const allIcd10s = [payload.primaryIcd10, ...(payload.secondaryIcd10s || [])]
    .filter(Boolean)
    .map(c => c.trim().toUpperCase());

  // Theo dõi các nhóm thuốc đã kê để phát hiện trùng lặp nhóm tác dụng
  const seenAtcGroups = new Map<string, { drugName: string; index: number }>();

  payload.items.forEach((item, index) => {
    const itemCost = (item.quantity || 0) * (item.unitPrice || 0);
    totalCostVnd += itemCost;
    if (isBhytAudit && !item.quantity) missingFields.add('quantity');

    const rule = findBhytRule(item.activeIngredient || item.drugName, item.route);

    // 1. Kiểm tra thuốc có trong danh mục BHYT không
    if (!rule) {
      if (isBhytAudit) missingFields.add('catalogMatch');
      return;
    }

    if (isBhytAudit && rule.routeCategory && !item.route) missingFields.add('route');
    if (isBhytAudit && rule.allowedRanks.length > 0 && rule.allowedRanks.length < Object.keys(HOSPITAL_RANK_LABELS).length && !payload.hospitalRank) {
      missingFields.add('hospitalRank');
    }
    if (isBhytAudit && rule.approvedIcd10Prefixes?.length && !allIcd10s.length) missingFields.add('primaryIcd10');
    if (isBhytAudit && rule.contraindicatedIcd10Prefixes?.length && !allIcd10s.length) missingFields.add('primaryIcd10');
    if (isBhytAudit && (rule.isOutpatientRestricted || rule.maxOutpatientDays || rule.requiresConsultation) && !payload.treatmentType) {
      missingFields.add('treatmentType');
    }
    if (isBhytAudit && rule.maxOutpatientDays && payload.treatmentType === 'NGOAI_TRU' && !item.daysSupply) {
      missingFields.add('daysSupply');
    }

    // Chế độ kê đơn chỉ thu thập dữ liệu thuốc; không áp dụng các quy tắc
    // thanh toán BHYT khi hồ sơ không phải là một ca giám định BHYT.
    if (!isBhytAudit) return;

    if (rule.paymentRatio === 0) {
      const risk = itemCost;
      atRiskCostVnd += risk;
      violations.push({
        id: `v-not-catalog-${index}-${item.id || index}`,
        drugCode: item.drugCode,
        drugName: item.drugName,
        activeIngredient: item.activeIngredient || item.drugName,
        severity: 'REJECT',
        category: 'NOT_IN_BHYT_CATALOG',
        title: 'Thuốc ngoài danh mục BHYT',
        detail: `Hoạt chất "${item.activeIngredient || item.drugName}" không thuộc danh mục thanh toán của Quỹ BHYT (Căn cứ TT 20/2022/TT-BYT).`,
        legalRef: {
          docCode: '20/2022/TT-BYT',
          docTitle: 'Thông tư 20/2022/TT-BYT',
          section: 'Điều 2 (Phạm vi được hưởng)',
          pageNumber: 2,
          localPdfPath: TT20_PDF_PATH
        },
        rejectionRiskVnd: risk,
        action: 'Chuyển sang nguồn bệnh nhân tự chi trả hoặc thay thế bằng thuốc tương đương trong danh mục BHYT.'
      });
      return; // Không cần kiểm tra các quy tắc tiếp theo nếu ngoài danh mục
    }

    // 2. Kiểm tra Tuyến kỹ thuật / Hạng bệnh viện (TT 20/2022)
    const isRankAllowed = payload.hospitalRank ? rule.allowedRanks.includes(payload.hospitalRank) : true;
    if (isBhytAudit && payload.hospitalRank && !isRankAllowed) {
      const risk = itemCost;
      atRiskCostVnd += risk;
      const allowedStr = rule.allowedRanks.map(r => HOSPITAL_RANK_LABELS[r] || r).join(', ');
      const currentRankStr = HOSPITAL_RANK_LABELS[payload.hospitalRank] || payload.hospitalRank || 'Không xác định';
      violations.push({
        id: `v-rank-${index}-${item.id || index}`,
        drugCode: item.drugCode,
        drugName: item.drugName,
        activeIngredient: rule.activeIngredient,
        severity: 'REJECT',
        category: 'HOSPITAL_RANK_MISMATCH',
        title: 'Vượt tuyến / Hạng BV không được dùng',
        detail: `Thuốc chỉ được thanh toán tại: ${allowedStr}. Cơ sở hiện tại (${currentRankStr}) không thuộc phạm vi thanh toán.`,
        legalRef: {
          docCode: '20/2022/TT-BYT',
          docTitle: 'Thông tư 20/2022/TT-BYT',
          section: `Phụ lục I (${rule.atcGroupName})`,
          pageNumber: rule.pdfPage,
          localPdfPath: TT20_PDF_PATH
        },
        rejectionRiskVnd: risk,
        action: 'Chuyển tuyến bệnh nhân hoặc thay thế bằng hoạt chất được phân hạng cho tuyến cơ sở.'
      });
    }

    // 2b. Kiểm tra thuốc hạn chế/cấm kê ngoại trú (VD: Kháng sinh dự trữ tiêm truyền)
    if (isBhytAudit && payload.treatmentType === 'NGOAI_TRU' && rule.isOutpatientRestricted) {
      const risk = itemCost;
      atRiskCostVnd += risk;
      violations.push({
        id: `v-outpatient-restricted-${index}-${item.id || index}`,
        drugCode: item.drugCode,
        drugName: item.drugName,
        activeIngredient: rule.activeIngredient,
        severity: 'REJECT',
        category: 'RESTRICTED_OUTPATIENT',
        title: 'Kháng sinh dự trữ không được kê đơn ngoại trú',
        detail: `Hoạt chất "${rule.activeIngredient}" là kháng sinh nhóm dự trữ ưu tiên cao (Carbapenem/Glycopeptide), không được kê đơn ngoại trú thông thường theo Hướng dẫn sử dụng kháng sinh của Bộ Y tế (QĐ 5631/QĐ-BYT).`,
        legalRef: {
          docCode: '5631/QĐ-BYT',
          docTitle: 'Hướng dẫn sử dụng kháng sinh trong bệnh viện',
          section: 'Phần 4: Quản lý sử dụng kháng sinh',
          pageNumber: rule.pdfPage,
          localPdfPath: TT20_PDF_PATH
        },
        rejectionRiskVnd: risk,
        action: 'Chỉ định nhập viện điều trị nội trú hoặc thay thế bằng kháng sinh uống/ngoại trú thích hợp.'
      });
    }

    // 3. Kiểm tra chẩn đoán ICD-10 (QĐ 3618 Điều 14 & Điều kiện thanh toán riêng Cột 8 TT 20)
    // Nếu là Hóa đơn mua hàng / Phiếu xuất kho không gắn ca bệnh cụ thể -> Bỏ qua kiểm tra ICD-10 để tránh phạt sai
    const isInvoiceDoc = ['HOA_DON_VAT', 'PHIEU_XUAT_KHO', 'HOA_DON_BAN_LE'].includes(payload.documentType || '');
    if (!isInvoiceDoc || allIcd10s.length > 0) {
      if (isBhytAudit && rule.approvedIcd10Prefixes && rule.approvedIcd10Prefixes.length > 0) {
        const matchesIcd = allIcd10s.some(icd => 
          rule.approvedIcd10Prefixes!.some(prefix => isIcd10Matching(icd, prefix))
        );
        if (allIcd10s.length > 0 && !matchesIcd) {
          const risk = itemCost;
          atRiskCostVnd += risk;
          const conditionDetail = rule.specialConditions || `Quỹ BHYT chỉ thanh toán cho nhóm bệnh lý [${rule.approvedIcd10Prefixes.join(', ')}]`;
          violations.push({
            id: `v-icd-${index}-${item.id || index}`,
            drugCode: item.drugCode,
            drugName: item.drugName,
            activeIngredient: rule.activeIngredient,
            severity: 'REJECT',
            category: 'ICD10_UNSUPPORTED',
            title: `Chẩn đoán không khớp điều kiện BHYT (${rule.activeIngredient})`,
            detail: `Mã chẩn đoán hiện tại [${allIcd10s.join(', ') || 'Chưa có chẩn đoán'}] không khớp với điều kiện thanh toán BHYT của ${rule.activeIngredient} (${conditionDetail}).`,
            legalRef: {
              docCode: '3618/QĐ-BHXH',
              docTitle: 'Quyết định 3618/QĐ-BHXH',
              section: 'Điều 14 (Giám định chỉ định điều trị và thuốc)',
              pageNumber: 18,
              localPdfPath: QD3618_PDF_PATH
            },
            rejectionRiskVnd: risk,
            action: `Bổ sung mã chẩn đoán ICD-10 phù hợp (${rule.approvedIcd10Prefixes.join(', ')}) nếu bệnh nhân có bệnh lý kèm theo, hoặc thay thế bằng thuốc tương đương.`
          });
        }
      }

      // Kiểm tra chống chỉ định mã bệnh nếu có
      if (rule.contraindicatedIcd10Prefixes && rule.contraindicatedIcd10Prefixes.length > 0) {
        const isContraindicated = allIcd10s.some(icd =>
          rule.contraindicatedIcd10Prefixes!.some(prefix => isIcd10Matching(icd, prefix))
        );
        if (allIcd10s.length > 0 && isContraindicated) {
          const risk = itemCost;
          atRiskCostVnd += risk;
          violations.push({
            id: `v-contra-icd-${index}-${item.id || index}`,
            drugCode: item.drugCode,
            drugName: item.drugName,
            activeIngredient: rule.activeIngredient,
            severity: 'REJECT',
            category: 'ICD10_UNSUPPORTED',
            title: 'Chống chỉ định theo mã ICD-10',
            detail: `Chẩn đoán [${allIcd10s.join(', ')}] thuộc nhóm chống chỉ định quỹ BHYT không thanh toán cho hoạt chất này.`,
            legalRef: {
              docCode: '3618/QĐ-BHXH',
              docTitle: 'Quyết định 3618/QĐ-BHXH',
              section: 'Điều 14 (Giám định chỉ định điều trị và thuốc)',
              pageNumber: 18,
              localPdfPath: QD3618_PDF_PATH
            },
            rejectionRiskVnd: risk,
            action: 'Ngưng chỉ định thuốc này đối với nhóm bệnh chống chỉ định.'
          });
        }
      }
    }

    // 3b. Kiểm tra thuốc cận hạn (< 6 tháng) đối với Hóa đơn / Bảng kê nhập xuất dược phẩm
    if (isInvoiceDoc && item.expiryDate) {
      try {
        let expDate: Date | null = null;
        if (item.expiryDate.includes('/')) {
          const parts = item.expiryDate.split('/');
          if (parts.length === 3) expDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        } else if (item.expiryDate.includes('-')) {
          expDate = new Date(item.expiryDate);
        }
        if (expDate && !isNaN(expDate.getTime())) {
          const daysDiff = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysDiff >= 0 && daysDiff < 180) {
            violations.push({
              id: `v-expiry-${index}-${item.id || index}`,
              drugCode: item.drugCode,
              drugName: item.drugName,
              activeIngredient: item.activeIngredient || item.drugName,
              severity: 'WARNING',
              category: 'PARTIAL_PAYMENT_ALERT',
              title: 'Cảnh báo thuốc cận hạn dùng (< 6 tháng)',
              detail: `Lô thuốc "${item.batchNumber || 'N/A'}" có hạn dùng (${item.expiryDate}) còn ${daysDiff} ngày. Cần giám sát và ưu tiên xuất kho FEFO theo Thông tư 36/2018/TT-BYT GSP.`,
              legalRef: {
                docCode: '36/2018/TT-BYT',
                docTitle: 'Thông tư 36/2018/TT-BYT (GSP)',
                section: 'Mục 12 Phụ lục I (Quản lý hạn dùng FEFO)',
                pageNumber: 14,
                localPdfPath: TT36_PDF_PATH
              },
              rejectionRiskVnd: 0,
              action: 'Gắn nhãn cận hạn, bảo quản khu vực riêng và ưu tiên cấp phát trước.'
            });
          }
        }
      } catch {}
    }

    // 4. Kiểm tra trùng lặp nhóm điều trị (QĐ 3618 Mục 3.2)
    // Thuốc dùng ngoài / tại chỗ (TOPICAL, OPHTHALMIC_OTIC) không kích hoạt trùng lặp với thuốc toàn thân
    const routeCategory = item.routeCategory || detectRouteCategory(item.route);
    const isTopicalOrOphthalmic = routeCategory === 'TOPICAL' || routeCategory === 'OPHTHALMIC_OTIC';

    if (!isTopicalOrOphthalmic) {
      const thGroup = getTherapeuticGroup(rule.atcGroup);
      if (thGroup) {
        if (seenAtcGroups.has(thGroup.key)) {
          const prev = seenAtcGroups.get(thGroup.key)!;
          const risk = itemCost;
          atRiskCostVnd += risk;
          violations.push({
            id: `v-dup-${index}-${item.id || index}`,
            drugCode: item.drugCode,
            drugName: item.drugName,
            activeIngredient: rule.activeIngredient,
            severity: 'REJECT',
            category: 'THERAPEUTIC_DUPLICATION',
            title: `Trùng lặp nhóm tác dụng (${thGroup.name})`,
            detail: `Đơn đã có "${prev.drugName}". Cơ quan BHXH từ chối thanh toán 2 thuốc cùng cơ chế tác dụng trong 1 đợt khám.`,
            legalRef: {
              docCode: '3618/QĐ-BHXH',
              docTitle: 'Quyết định 3618/QĐ-BHXH',
              section: 'Mục 3.2.b (Kiểm tra trùng lặp chỉ định thuốc)',
              pageNumber: 22,
              localPdfPath: QD3618_PDF_PATH
            },
            rejectionRiskVnd: risk,
            action: `Lược bỏ "${item.drugName}", chỉ giữ lại một loại thuốc đại diện cho nhóm điều trị.`
          });
        } else {
          seenAtcGroups.set(thGroup.key, { drugName: item.drugName, index });
        }
      }
    }

    // 5. Kiểm tra biên bản hội chẩn đối với thuốc kháng sinh dự trữ / thuốc hạn chế (Chỉ áp dụng khi nội trú)
    if (isBhytAudit && rule.requiresConsultation && payload.treatmentType === 'NOI_TRU' && item.hasConsultationForm === false) {
      const risk = itemCost;
      atRiskCostVnd += risk;
      violations.push({
        id: `v-consult-${index}-${item.id || index}`,
        drugCode: item.drugCode,
        drugName: item.drugName,
        activeIngredient: rule.activeIngredient,
        severity: 'REJECT',
        category: 'MISSING_CONSULTATION_FORM',
        title: 'Thiếu biên bản hội chẩn thuốc kiểm soát đặc biệt',
        detail: `Hoạt chất "${rule.activeIngredient}" là kháng sinh dự trữ / thuốc đặc trị yêu cầu phải có Biên bản Hội chẩn đính kèm hồ sơ thanh toán nội trú.`,
        legalRef: {
          docCode: '20/2022/TT-BYT',
          docTitle: 'Thông tư 20/2022/TT-BYT',
          section: 'Điều 5 & Hướng dẫn sử dụng kháng sinh BYT',
          pageNumber: rule.pdfPage,
          localPdfPath: TT26_PDF_PATH
        },
        rejectionRiskVnd: risk,
        action: 'Ký duyệt Biên bản Hội chẩn chuyên khoa và lưu trữ kèm bệnh án trước khi xuất viện.'
      });
    }

    // 6. Kiểm tra số ngày điều trị ngoại trú tối đa (>30 ngày hoặc quy định riêng)
    const maxDays = rule.maxOutpatientDays || 30;
    if (isBhytAudit && payload.treatmentType === 'NGOAI_TRU' && item.daysSupply && item.daysSupply > maxDays) {
      const excessDays = item.daysSupply - maxDays;
      const excessRisk = Math.round((excessDays / item.daysSupply) * itemCost);
      atRiskCostVnd += excessRisk;
      violations.push({
        id: `v-days-${index}-${item.id || index}`,
        drugCode: item.drugCode,
        drugName: item.drugName,
        activeIngredient: rule.activeIngredient,
        severity: 'WARNING',
        category: 'OVER_MAX_OUTPATIENT_DAYS',
        title: `Kê vượt số ngày ngoại trú (${item.daysSupply}/${maxDays} ngày)`,
        detail: `Số ngày kê đơn (${item.daysSupply} ngày) vượt ngưỡng tối đa ${maxDays} ngày theo quy định kê đơn ngoại trú.`,
        legalRef: {
          docCode: '26/2025/TT-BYT',
          docTitle: 'Thông tư 26/2025/TT-BYT',
          section: 'Điều 6 (Kê đơn thuốc ngoại trú)',
          pageNumber: 5,
          localPdfPath: TT20_PDF_PATH
        },
        rejectionRiskVnd: excessRisk,
        action: `Điều chỉnh số ngày dùng xuống tối đa ${maxDays} ngày hoặc hẹn bệnh nhân tái khám.`
      });
    }

    // 7. Cảnh báo thuốc thanh toán theo tỷ lệ (50% hoặc 30%) - Đồng chi trả theo luật
    if (rule.paymentRatio > 0 && rule.paymentRatio < 1.0) {
      const patientShareRisk = Math.round(itemCost * (1 - rule.paymentRatio));
      patientCoPayCostVnd += patientShareRisk;
      violations.push({
        id: `v-ratio-${index}-${item.id || index}`,
        drugCode: item.drugCode,
        drugName: item.drugName,
        activeIngredient: rule.activeIngredient,
        severity: 'WARNING',
        category: 'PARTIAL_PAYMENT_ALERT',
        title: `Thuốc thanh toán theo tỷ lệ ${(rule.paymentRatio * 100).toFixed(0)}% BHYT`,
        detail: `Quỹ BHYT thanh toán ${(rule.paymentRatio * 100).toFixed(0)}% chi phí (${(itemCost * rule.paymentRatio).toLocaleString('vi-VN')} đ). Bệnh nhân đồng chi trả ${(patientShareRisk).toLocaleString('vi-VN')} đ theo quy định Thông tư 20/2022/TT-BYT.`,
        legalRef: {
          docCode: '20/2022/TT-BYT',
          docTitle: 'Thông tư 20/2022/TT-BYT',
          section: `Ghi chú Phụ lục I`,
          pageNumber: rule.pdfPage,
          localPdfPath: TT20_PDF_PATH
        },
        rejectionRiskVnd: 0, // Không phải xuất toán mà là đồng chi trả
        patientCoPayVnd: patientShareRisk,
        action: 'Giải thích rõ tỷ lệ đồng chi trả cho bệnh nhân trước khi kê đơn; đơn thuốc hợp pháp không bị xuất toán.'
      });
    }
  });

  // Tính toán kết quả tổng thể
  const rejectCount = violations.filter(v => v.severity === 'REJECT').length;
  const warningCount = violations.filter(v => v.severity === 'WARNING').length;
  // Một dòng thuốc có thể sinh nhiều cảnh báo; chỉ tính dòng đó một lần.
  const violationsForItem = (item: BhytPrescriptionPayload['items'][number], index: number) => {
    const itemKey = `${index}-${item.id || index}`;
    return violations.filter((violation) => violation.id.endsWith(`-${itemKey}`));
  };
  const passCount = payload.items.reduce(
    (count, item, index) => count + (violationsForItem(item, index).length === 0 ? 1 : 0),
    0,
  );
  // Tổng nguy cơ của một dòng không thể vượt quá giá trị dòng thuốc, dù có
  // nhiều quy tắc cùng phát hiện lỗi trên dòng đó.
  atRiskCostVnd = payload.items.reduce((total, item, index) => {
    const lineCost = Math.max(0, item.quantity * item.unitPrice);
    const itemRisk = violationsForItem(item, index).reduce(
      (sum, violation) => sum + Math.max(0, violation.rejectionRiskVnd || 0),
      0,
    );
    return total + Math.min(lineCost, itemRisk);
  }, 0);

  let overallStatus: BhytAuditSeverity = 'PASS';
  if (rejectCount > 0) {
    overallStatus = 'REJECT';
  } else if (warningCount > 0) {
    overallStatus = 'WARNING';
  } else if (missingFields.size > 0) {
    overallStatus = 'NEEDS_REVIEW';
  }

  return {
    status: overallStatus,
    evaluatedAt,
    hospitalRank: payload.hospitalRank,
    treatmentType: payload.treatmentType,
    primaryIcd10: payload.primaryIcd10,
    primaryDiagnosis: payload.primaryDiagnosis,
    totalCostVnd,
    atRiskCostVnd,
    patientCoPayCostVnd,
    itemsCount: payload.items.length,
    passCount: Math.max(0, passCount),
    warningCount,
    rejectCount,
    violations,
    missingFields: [...missingFields]
  };
}
