/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BHYT Drug Catalog & Adjudication Rules
 * Căn cứ Thông tư 20/2022/TT-BYT & Quyết định 3618/QĐ-BHXH
 */

import { HospitalRank } from '../types/bhyt';

export interface BhytDrugRule {
  activeIngredient: string;
  drugNames: string[];
  atcGroup: string;
  atcGroupName: string;
  allowedRanks: HospitalRank[];
  paymentRatio: number;          // 1.0 = 100%, 0.7 = 70%, 0.5 = 50%, 0 = 0%
  requiresConsultation: boolean; // Bắt buộc biên bản hội chẩn
  isRestricted: boolean;
  routeCategory?: 'ORAL' | 'INJECTION' | 'TOPICAL' | 'OPHTHALMIC_OTIC' | 'INHALATION';
  isOutpatientRestricted?: boolean; // Kháng sinh dự trữ/thuốc cấm kê ngoại trú
  maxOutpatientDays?: number;
  approvedIcd10Prefixes?: string[]; // Tiền tố ICD-10 được phép thanh toán
  contraindicatedIcd10Prefixes?: string[];
  specialConditions?: string;
  pdfPage: number;               // Trang trong PDF TT 20/2022
  stt?: number;
}

export const HOSPITAL_RANK_LABELS: Record<HospitalRank, string> = {
  HANG_DAC_BIET: 'Hạng Đặc Biệt (Tuyến TW)',
  HANG_I: 'Hạng I (Tuyến Tỉnh / TW)',
  HANG_II: 'Hạng II (Tỉnh / Khu vực)',
  HANG_III: 'Hạng III (Tuyến Huyện)',
  HANG_IV: 'Hạng IV (Trạm Y Tế Xã)'
};

/**
 * Nhận diện phân loại đường dùng chuẩn hóa từ text lâm sàng
 */
export function detectRouteCategory(routeText: string): 'ORAL' | 'INJECTION' | 'TOPICAL' | 'OPHTHALMIC_OTIC' | 'INHALATION' {
  if (!routeText) return 'ORAL';
  const norm = normalizeDrugSearchText(routeText).toLowerCase();
  if (norm.includes('mat') || norm.includes('tai') || norm.includes('nho') || norm.includes('ophthalmic') || norm.includes('otic')) {
    return 'OPHTHALMIC_OTIC';
  }
  if (norm.includes('tiem') || norm.includes('truyen') || norm.includes('iv') || norm.includes('im') || norm.includes('sc') || norm.includes('injection')) {
    return 'INJECTION';
  }
  if (norm.includes('boi') || norm.includes('gel') || norm.includes('kem') || norm.includes('dan') || norm.includes('topical')) {
    return 'TOPICAL';
  }
  if (norm.includes('hit') || norm.includes('khi dung') || norm.includes('xịt') || norm.includes('xit') || norm.includes('inhalation')) {
    return 'INHALATION';
  }
  return 'ORAL';
}

/**
 * Chuẩn hóa chuỗi tiếng Việt không dấu, loại bỏ ký tự thừa để so khớp lâm sàng
 */
export function normalizeDrugSearchText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const BHYT_DRUG_RULES: BhytDrugRule[] = [
  // =========================================================================
  // NHÓM 1: THUỐC GÂY MÊ, GÂY TÊ, GIÃN CƠ (TT 20/2022 - Trang 12)
  // =========================================================================
  {
    activeIngredient: 'Propofol',
    drugNames: ['Diprivan', 'Propofol 1%', 'Lipuro', 'Fresofol'],
    atcGroup: 'N01AX10',
    atcGroupName: 'Thuốc gây mê tĩnh mạch',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ sử dụng tại phòng mổ hoặc đơn vị hồi sức cấp cứu có bác sĩ gây mê hồi sức.',
    approvedIcd10Prefixes: ['Z40', 'Z41', 'Z98', 'T81'],
    pdfPage: 12
  },
  {
    activeIngredient: 'Lidocain',
    drugNames: ['Xylocain', 'Lidocain 2%', 'Lidocaine'],
    atcGroup: 'N01BB02',
    atcGroupName: 'Thuốc gây tê tại chỗ & chống loạn nhịp',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I47', 'I49', 'S00', 'T14', 'Z48'],
    pdfPage: 12
  },
  {
    activeIngredient: 'Bupivacain',
    drugNames: ['Marcaine', 'Bupivacain 0.5%', 'Bupivacaine spinal'],
    atcGroup: 'N01BB01',
    atcGroupName: 'Thuốc gây tê tủy sống / dẫn truyền',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Gây tê vùng trong phẫu thuật hoặc giảm đau sau mổ.',
    pdfPage: 12
  },

  // =========================================================================
  // NHÓM 2: GIẢM ĐAU, HẠ SỐT, NSAID, GÚT & BỆNH KHỚP (TT 20/2022 - Trang 13-17)
  // =========================================================================
  {
    activeIngredient: 'Paracetamol',
    drugNames: ['Panadol', 'Efferalgan', 'Hapacol', 'Paracetamol 500mg', 'Perfalgan'],
    atcGroup: 'N02BE01',
    atcGroupName: 'Thuốc hạ sốt, giảm đau Anilin',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    pdfPage: 13
  },
  {
    activeIngredient: 'Tramadol',
    drugNames: ['Tramal', 'Tramadol 50mg', 'Ultracet', 'Zaldiar'],
    atcGroup: 'N02AX02',
    atcGroupName: 'Thuốc giảm đau Opioid trung bình',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    maxOutpatientDays: 14,
    specialConditions: 'Kê đơn kiểm soát theo quy chế đơn thuốc kiểm soát đặc biệt.',
    approvedIcd10Prefixes: ['M54', 'M79', 'R52', 'Z98', 'T14'],
    pdfPage: 13
  },
  {
    activeIngredient: 'Diclofenac',
    drugNames: ['Voltaren', 'Diclofenac 50mg', 'Diclofenac 75mg', 'Cataflam'],
    atcGroup: 'M01AB05',
    atcGroupName: 'Thuốc chống viêm không steroid (NSAID - Acid Acetic)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Không thanh toán đồng thời 2 thuốc nhóm NSAID trong cùng một đơn.',
    approvedIcd10Prefixes: ['M15', 'M16', 'M17', 'M19', 'M45', 'M05', 'M06', 'M54'],
    pdfPage: 14
  },
  {
    activeIngredient: 'Ibuprofen',
    drugNames: ['Brufen', 'Ibuprofen 400mg', 'Alaxan', 'Gofen'],
    atcGroup: 'M01AE01',
    atcGroupName: 'Thuốc chống viêm không steroid (NSAID - Acid Propionic)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Không thanh toán đồng thời 2 thuốc nhóm NSAID trong cùng một đơn.',
    approvedIcd10Prefixes: ['M15', 'M17', 'M06', 'M54', 'M25'],
    pdfPage: 14
  },
  {
    activeIngredient: 'Meloxicam',
    drugNames: ['Mobic', 'Meloxicam 7.5mg', 'Meloxicam 15mg'],
    atcGroup: 'M01AC06',
    atcGroupName: 'Thuốc chống viêm không steroid (NSAID - Oxicam)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Không thanh toán đồng thời 2 thuốc nhóm NSAID trong cùng một đơn.',
    approvedIcd10Prefixes: ['M15', 'M16', 'M17', 'M19', 'M45', 'M05', 'M06', 'M54'],
    pdfPage: 15
  },
  {
    activeIngredient: 'Celecoxib',
    drugNames: ['Celebrex', 'Celecoxib 200mg', 'Cadicelecoxib'],
    atcGroup: 'M01AH01',
    atcGroupName: 'Thuốc chống viêm không steroid (NSAID - Coxib)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Không thanh toán đồng thời 2 thuốc nhóm NSAID trong cùng một đơn.',
    approvedIcd10Prefixes: ['M15', 'M16', 'M17', 'M19', 'M45', 'M05', 'M06'],
    pdfPage: 15
  },
  {
    activeIngredient: 'Colchicin',
    drugNames: ['Colchicin 1mg', 'Colchicine', 'Colchimax'],
    atcGroup: 'M04AC01',
    atcGroupName: 'Thuốc điều trị cơn Gút cấp',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['M10', 'M10.0', 'M10.9'],
    pdfPage: 16
  },
  {
    activeIngredient: 'Allopurinol',
    drugNames: ['Zyloric', 'Allopurinol 300mg', 'Allopurinol 100mg', 'Sadapron'],
    atcGroup: 'M04AA01',
    atcGroupName: 'Thuốc ức chế tổng hợp Acid Uric (Hạ Acid Uric)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['M10', 'E79', 'N20'],
    pdfPage: 16
  },
  {
    activeIngredient: 'Febuxostat',
    drugNames: ['Feburic', 'Febuxostat 40mg', 'Febuxostat 80mg', 'Forxar'],
    atcGroup: 'M04AA03',
    atcGroupName: 'Thuốc ức chế chọn lọc Xanthine Oxidase',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Thanh toán điều trị tăng acid uric máu mạn tính khi bệnh nhân không dung nạp hoặc chống chỉ định với Allopurinol.',
    approvedIcd10Prefixes: ['M10', 'E79'],
    pdfPage: 16
  },
  {
    activeIngredient: 'Diacerein',
    drugNames: ['Artrodar', 'Diacerein 50mg', 'Artroflex'],
    atcGroup: 'M01AX21',
    atcGroupName: 'Thuốc chống thoái hóa khớp tác dụng chậm',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Quỹ BHYT thanh toán điều trị thoái hóa khớp hông hoặc khớp gối.',
    approvedIcd10Prefixes: ['M16', 'M17'],
    pdfPage: 16
  },
  {
    activeIngredient: 'Alpha Chymotrypsin',
    drugNames: ['Alpha Choay', 'Chymotrypsin', 'Alphachymotrypsine 4.2mg'],
    atcGroup: 'M09AB01',
    atcGroupName: 'Enzyme chống phù nề dạng men',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Quỹ BHYT chỉ thanh toán trong điều trị phù nề sau phẫu thuật, chấn thương, bỏng. Không thanh toán cho các bệnh lý viêm hô hấp.',
    approvedIcd10Prefixes: ['S00', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S20', 'S30', 'S40', 'S50', 'S60', 'S70', 'S80', 'S90', 'T00', 'T14', 'T20', 'T30', 'T81', 'Z98'],
    pdfPage: 17
  },

  // =========================================================================
  // NHÓM 3: CHỐNG DỊ ỨNG & QUÁ MẪN (TT 20/2022 - Trang 18)
  // =========================================================================
  {
    activeIngredient: 'Loratadin',
    drugNames: ['Clarityne', 'Loratadin 10mg', 'Allerfre'],
    atcGroup: 'R06AX13',
    atcGroupName: 'Thuốc kháng Histamin H1 thế hệ 2',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J30', 'L20', 'L27', 'L28', 'L29', 'L50', 'T78'],
    pdfPage: 18
  },
  {
    activeIngredient: 'Cetirizin',
    drugNames: ['Zyrtec', 'Cetirizin 10mg', 'Virlix'],
    atcGroup: 'R06AE07',
    atcGroupName: 'Thuốc kháng Histamin H1 thế hệ 2',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J30', 'L20', 'L27', 'L29', 'L50', 'T78'],
    pdfPage: 18
  },
  {
    activeIngredient: 'Adrenalin',
    drugNames: ['Epinephrine', 'Adrenalin 1mg/1ml', 'Adrenaline'],
    atcGroup: 'C01CA24',
    atcGroupName: 'Thuốc chủ vận Adrenergic cấp cứu sốc phản vệ',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Thuốc cấp cứu hàng đầu cho sốc phản vệ và ngừng tuần hoàn.',
    approvedIcd10Prefixes: ['T78.2', 'T78.0', 'T88.6', 'I46', 'R57'],
    pdfPage: 18
  },

  // =========================================================================
  // NHÓM 4: GIẢI ĐỘC & CHỐNG NGỘ ĐỘC (TT 20/2022 - Trang 19)
  // =========================================================================
  {
    activeIngredient: 'Acetylcystein',
    drugNames: ['Acemuc', 'Fluimucil', 'Acetylcystein 200mg', 'Exomuc'],
    atcGroup: 'V03AB23',
    atcGroupName: 'Thuốc giải độc Paracetamol & tiêu nhầy hô hấp',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J06', 'J15', 'J18', 'J20', 'J42', 'J44', 'T39.1'],
    pdfPage: 19
  },
  {
    activeIngredient: 'Naloxon',
    drugNames: ['Naloxon 0.4mg', 'Narcan', 'Naloxone'],
    atcGroup: 'V03AB15',
    atcGroupName: 'Thuốc đối kháng Opioid giải độc morphin',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['T40', 'T40.1', 'T40.2'],
    pdfPage: 19
  },

  // =========================================================================
  // NHÓM 5: CHỐNG CO GIẬT, CHỐNG ĐỘNG KINH (TT 20/2022 - Trang 21)
  // =========================================================================
  {
    activeIngredient: 'Acid valproic',
    drugNames: ['Depakine', 'Depakine Chrono 500mg', 'Valproat natri'],
    atcGroup: 'N03AG01',
    atcGroupName: 'Thuốc chống động kinh phổ rộng',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['G40', 'G41', 'F31'],
    pdfPage: 21
  },
  {
    activeIngredient: 'Carbamazepin',
    drugNames: ['Tegretol', 'Carbamazepin 200mg', 'Tegretol CR'],
    atcGroup: 'N03AF01',
    atcGroupName: 'Thuốc chống động kinh dẫn xuất Carboxamide',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['G40', 'G50.0'],
    pdfPage: 21
  },
  {
    activeIngredient: 'Gabapentin',
    drugNames: ['Neurontin', 'Gabapentin 300mg', 'Gabarone'],
    atcGroup: 'N03AX12',
    atcGroupName: 'Thuốc chống co giật & giảm đau thần kinh',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['G40', 'G53.0', 'E11.4', 'M54.1', 'B02.2'],
    pdfPage: 21
  },
  {
    activeIngredient: 'Pregabalin',
    drugNames: ['Lyrica', 'Pregabalin 75mg', 'Pregabalin 150mg', 'Prebictal'],
    atcGroup: 'N03AX16',
    atcGroupName: 'Thuốc điều trị đau thần kinh & động kinh cục bộ',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Bệnh viện Hạng Đặc biệt, Hạng I, Hạng II. Tuyến huyện (Hạng III/IV) không được quỹ BHYT thanh toán.',
    approvedIcd10Prefixes: ['G53.0', 'E11.4', 'B02.2', 'G40', 'F41.1'],
    pdfPage: 21
  },

  // =========================================================================
  // NHÓM 6: CHỐNG NHIỄM KHUẨN & KHÁNG SINH (TT 20/2022 - Trang 21-29)
  // =========================================================================
  {
    activeIngredient: 'Amoxicillin + Acid clavulanic',
    drugNames: ['Augmentin', 'Curam', 'Amoksiklav', 'Klamentin'],
    atcGroup: 'J01CR02',
    atcGroupName: 'Kháng sinh Penicillin phối hợp ức chế Beta-lactamase',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J01', 'J02', 'J03', 'J04', 'J06', 'J13', 'J14', 'J15', 'J18', 'J20', 'J22', 'N30', 'N39', 'L01', 'L02', 'L03'],
    pdfPage: 22
  },
  {
    activeIngredient: 'Cefuroxim',
    drugNames: ['Zinnat', 'Cefuroxim 500mg', 'Zinacef', 'Cefuroxime'],
    atcGroup: 'J01DC02',
    atcGroupName: 'Kháng sinh Cephalosporin thế hệ 2',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J01', 'J02', 'J03', 'J04', 'J15', 'J18', 'J20', 'N30', 'N39'],
    pdfPage: 22
  },
  {
    activeIngredient: 'Ceftriaxone',
    drugNames: ['Rocephin', 'Ceftriaxone 1g', 'Biotriaxone'],
    atcGroup: 'J01DD04',
    atcGroupName: 'Kháng sinh Cephalosporin thế hệ 3',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Hạng IV không thanh toán điều trị ngoại trú trừ trường hợp cấp cứu.',
    approvedIcd10Prefixes: ['J13', 'J14', 'J15', 'J18', 'A01', 'A02', 'N30', 'N39', 'N10', 'A41'],
    pdfPage: 23
  },
  {
    activeIngredient: 'Ceftazidim',
    drugNames: ['Fortum', 'Ceftazidim 1g', 'Ceftazidime'],
    atcGroup: 'J01DD02',
    atcGroupName: 'Kháng sinh Cephalosporin thế hệ 3 kháng Trực khuẩn mủ xanh',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J15', 'J18', 'A41', 'N10', 'N39', 'T81.4'],
    pdfPage: 23
  },
  {
    activeIngredient: 'Cefepim',
    drugNames: ['Maxipime', 'Cefepim 1g', 'Cefepime'],
    atcGroup: 'J01DE01',
    atcGroupName: 'Kháng sinh Cephalosporin thế hệ 4',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Hạng ĐB, I, II. Hạng III/IV không thanh toán.',
    approvedIcd10Prefixes: ['J15', 'J18', 'A41', 'N10'],
    pdfPage: 23
  },
  {
    activeIngredient: 'Ciprofloxacin',
    drugNames: ['Ciprobay', 'Ciprofloxacin 500mg', 'Cifran'],
    atcGroup: 'J01MA02',
    atcGroupName: 'Kháng sinh nhóm Fluoroquinolon',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['N30', 'N39', 'A09', 'K52', 'J15', 'J18'],
    pdfPage: 25
  },
  {
    activeIngredient: 'Levofloxacin',
    drugNames: ['Cravit', 'Levofloxacin 500mg', 'Tavanic'],
    atcGroup: 'J01MA12',
    atcGroupName: 'Kháng sinh nhóm Hô hấp Quinolon',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J15', 'J18', 'J20', 'J22', 'N30', 'N39'],
    pdfPage: 25
  },
  {
    activeIngredient: 'Moxifloxacin',
    drugNames: ['Avelox', 'Moxifloxacin 400mg', 'Moxiflox'],
    atcGroup: 'J01MA14',
    atcGroupName: 'Kháng sinh Fluoroquinolon phổ rộng',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ định cho viêm phổi cộng đồng nặng hoặc đợt cấp COPD khi thất bại thuốc ban đầu.',
    approvedIcd10Prefixes: ['J15', 'J18', 'J44'],
    pdfPage: 26
  },
  {
    activeIngredient: 'Azithromycin',
    drugNames: ['Zithromax', 'Azithromycin 500mg', 'Azitrocin'],
    atcGroup: 'J01FA10',
    atcGroupName: 'Kháng sinh nhóm Macrolid Azalide',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J01', 'J02', 'J03', 'J15', 'J18', 'J20', 'A56'],
    pdfPage: 25
  },
  {
    activeIngredient: 'Clarithromycin',
    drugNames: ['Klacid', 'Clarithromycin 500mg', 'Klaricid'],
    atcGroup: 'J01FA09',
    atcGroupName: 'Kháng sinh nhóm Macrolid',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J15', 'J18', 'J20', 'K25', 'K26', 'K29'],
    pdfPage: 25
  },
  {
    activeIngredient: 'Amikacin',
    drugNames: ['Amikin', 'Amikacin 500mg', 'Mikan'],
    atcGroup: 'J01GB06',
    atcGroupName: 'Kháng sinh nhóm Aminoglycosid',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ định nhiễm khuẩn nặng Gram âm đa kháng.',
    approvedIcd10Prefixes: ['A41', 'J15', 'N10'],
    pdfPage: 24
  },
  {
    activeIngredient: 'Metronidazol',
    drugNames: ['Flagyl', 'Metronidazol 250mg', 'Klion'],
    atcGroup: 'J01XD01',
    atcGroupName: 'Kháng sinh nhóm Nitroimidazol trị kỵ khí & amip',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['A06', 'A09', 'K25', 'K52', 'K65', 'N76'],
    pdfPage: 25
  },
  {
    activeIngredient: 'Meropenem',
    drugNames: ['Meronem', 'Meropenem 1g', 'Mepem', 'Penem'],
    atcGroup: 'J01DH02',
    atcGroupName: 'Kháng sinh nhóm Carbapenem (Kháng sinh dự trữ)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    routeCategory: 'INJECTION',
    isOutpatientRestricted: true,
    specialConditions: 'Bắt buộc Biên bản Hội chẩn duyệt thuốc kháng sinh dự trữ và kết quả vi sinh/kháng sinh đồ. Tuyến huyện (Hạng III/IV) không được thanh toán.',
    approvedIcd10Prefixes: ['A41', 'J15', 'J18', 'K65', 'N10', 'T81.4'],
    pdfPage: 23
  },
  {
    activeIngredient: 'Imipenem + Cilastatin',
    drugNames: ['Tienam', 'Imipenem 500mg', 'Cilastatin'],
    atcGroup: 'J01DH51',
    atcGroupName: 'Kháng sinh nhóm Carbapenem (Kháng sinh dự trữ)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    routeCategory: 'INJECTION',
    isOutpatientRestricted: true,
    specialConditions: 'Bắt buộc Biên bản Hội chẩn duyệt thuốc kháng sinh dự trữ theo Quyết định 5631/QĐ-BYT.',
    approvedIcd10Prefixes: ['A41', 'J15', 'J18', 'K65'],
    pdfPage: 23
  },
  {
    activeIngredient: 'Doripenem',
    drugNames: ['Finibax', 'Doripenem 500mg'],
    atcGroup: 'J01DH04',
    atcGroupName: 'Kháng sinh Carbapenem dự trữ tuyến TW',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    routeCategory: 'INJECTION',
    isOutpatientRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Tuyến Trung ương (Hạng ĐB & Hạng I) có hội chẩn.',
    approvedIcd10Prefixes: ['A41', 'J15', 'J18'],
    pdfPage: 23
  },
  {
    activeIngredient: 'Vancomycin',
    drugNames: ['Vancocin', 'Vancomycin 500mg', 'Celovan', 'Vancotex'],
    atcGroup: 'J01XA01',
    atcGroupName: 'Kháng sinh Glycopeptide (Kháng sinh kiểm soát đặc biệt)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    routeCategory: 'INJECTION',
    isOutpatientRestricted: true,
    specialConditions: 'Bắt buộc hội chẩn chuyên khoa nhiễm khuẩn hoặc hồi sức. Chỉ định khi nhiễm khuẩn Gram dương nặng (MRSA) hoặc viêm ruột do C.difficile.',
    approvedIcd10Prefixes: ['A41', 'J15.2', 'A04.7', 'M86', 'I33'],
    pdfPage: 27
  },
  {
    activeIngredient: 'Teicoplanin',
    drugNames: ['Targocid', 'Teicoplanin 200mg', 'Teicoplanin 400mg'],
    atcGroup: 'J01XA02',
    atcGroupName: 'Kháng sinh Glycopeptide thế hệ mới',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    routeCategory: 'INJECTION',
    isOutpatientRestricted: true,
    specialConditions: 'Bắt buộc Biên bản Hội chẩn thuốc kháng sinh kiểm soát đặc biệt.',
    approvedIcd10Prefixes: ['A41', 'J15.2', 'M86'],
    pdfPage: 27
  },
  {
    activeIngredient: 'Linezolid',
    drugNames: ['Zyvox', 'Linezolid 600mg', 'Linospan'],
    atcGroup: 'J01XX08',
    atcGroupName: 'Kháng sinh Oxazolidinon (Kháng sinh dự trữ cao cấp)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    routeCategory: 'INJECTION',
    isOutpatientRestricted: true,
    specialConditions: 'Chỉ thanh toán khi có hội chẩn xác nhận vi khuẩn đề kháng Vancomycin (VRE) hoặc MRSA không đáp ứng.',
    approvedIcd10Prefixes: ['A41', 'J15.2', 'L03', 'T81.4'],
    pdfPage: 27
  },
  {
    activeIngredient: 'Colistin',
    drugNames: ['Colistimethate', 'Colistin 1MIU', 'Colimycin'],
    atcGroup: 'J01XB01',
    atcGroupName: 'Kháng sinh Polymyxin (Dự trữ gram âm toàn kháng)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    routeCategory: 'INJECTION',
    isOutpatientRestricted: true,
    specialConditions: 'Bắt buộc hội chẩn vi sinh. Dùng cho nhiễm khuẩn vi khuẩn Gram âm đa kháng (A.baumannii, P.aeruginosa, K.pneumoniae).',
    approvedIcd10Prefixes: ['A41', 'J15', 'J18', 'N10'],
    pdfPage: 26
  },
  {
    activeIngredient: 'Tigecyclin',
    drugNames: ['Tygacil', 'Tigecyclin 50mg'],
    atcGroup: 'J01AA12',
    atcGroupName: 'Kháng sinh Glycylcycline dự trữ',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    routeCategory: 'INJECTION',
    isOutpatientRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Tuyến Trung ương (Hạng ĐB & Hạng I) có hội chẩn duyệt kháng sinh dự trữ.',
    approvedIcd10Prefixes: ['A41', 'K65', 'L03'],
    pdfPage: 26
  },
  {
    activeIngredient: 'Fluconazol',
    drugNames: ['Diflucan', 'Fluconazol 150mg', 'Mycosyst'],
    atcGroup: 'J02AC01',
    atcGroupName: 'Thuốc kháng nấm Triazole',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['B37', 'B35', 'B45'],
    pdfPage: 28
  },
  {
    activeIngredient: 'Voriconazol',
    drugNames: ['Vfend', 'Voriconazol 200mg'],
    atcGroup: 'J02AC03',
    atcGroupName: 'Thuốc kháng nấm xâm lấn Aspergillosis',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    specialConditions: 'Bắt buộc hội chẩn nhiễm trùng / huyết học. Chỉ định nhiễm nấm xâm lấn nặng.',
    approvedIcd10Prefixes: ['B44', 'B37'],
    pdfPage: 28
  },
  {
    activeIngredient: 'Tenofovir disoproxil',
    drugNames: ['Viread', 'Tenofovir 300mg', 'Teno-H', 'TDF'],
    atcGroup: 'J05AF07',
    atcGroupName: 'Thuốc kháng virus viêm gan B & HIV (NRTIs)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['B18', 'B18.1', 'B20'],
    pdfPage: 29
  },
  {
    activeIngredient: 'Sofosbuvir',
    drugNames: ['Sovaldi', 'Sofosbuvir 400mg', 'MyHep'],
    atcGroup: 'J05AP08',
    atcGroupName: 'Thuốc kháng virus viêm gan C trực tiếp (DAA)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 0.5, // 50% thanh toán BHYT
    requiresConsultation: true,
    isRestricted: true,
    specialConditions: 'Quỹ BHYT thanh toán 50% chi phí điều trị Viêm gan C mạn tính theo hướng dẫn BYT.',
    approvedIcd10Prefixes: ['B18.2'],
    pdfPage: 29
  },

  // =========================================================================
  // NHÓM 7: ĐAU NỬA ĐẦU (TT 20/2022 - Trang 35)
  // =========================================================================
  {
    activeIngredient: 'Flunarizin',
    drugNames: ['Sibelium', 'Flunarizin 5mg', 'Flunagen'],
    atcGroup: 'N07CA03',
    atcGroupName: 'Thuốc đối kháng Canxi dự phòng Migraine & chóng mặt',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['G43', 'H81'],
    pdfPage: 35
  },

  // =========================================================================
  // NHÓM 8: UNG THƯ & ĐIỀU HÒA MIỄN DỊCH (TT 20/2022 - Trang 36-41)
  // =========================================================================
  {
    activeIngredient: 'Methotrexat',
    drugNames: ['Methotrexate 2.5mg', 'Metoject', 'Ebewe'],
    atcGroup: 'L01BA01',
    atcGroupName: 'Thuốc kháng Folate chống ung thư & ức chế miễn dịch',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['M05', 'M06', 'L40', 'C00', 'C91'],
    pdfPage: 36
  },
  {
    activeIngredient: 'Capecitabin',
    drugNames: ['Xeloda', 'Capecitabin 500mg'],
    atcGroup: 'L01BC06',
    atcGroupName: 'Thuốc chống chuyển hóa Fluoropyrimidine',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    specialConditions: 'Chỉ định điều trị ung thư đại trực tràng, dạ dày, ung thư vú theo phác đồ chuyên khoa ung bướu.',
    approvedIcd10Prefixes: ['C16', 'C18', 'C19', 'C20', 'C50'],
    pdfPage: 36
  },
  {
    activeIngredient: 'Paclitaxel',
    drugNames: ['Taxol', 'Paclitaxel 30mg', 'Anzatax', 'Paclitaxel liposome'],
    atcGroup: 'L01CD01',
    atcGroupName: 'Thuốc chống ung thư nhóm Taxane',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0, // Dạng thông thường 100%, dạng liposome 50%
    requiresConsultation: true,
    isRestricted: true,
    specialConditions: 'Thanh toán 100% dạng thông thường, thanh toán 50% đối với dạng Liposome theo quy định TT 20/2022.',
    approvedIcd10Prefixes: ['C50', 'C56', 'C34'],
    pdfPage: 37
  },
  {
    activeIngredient: 'Rituximab',
    drugNames: ['MabThera', 'Rituximab 500mg', 'Reditux'],
    atcGroup: 'L01XC02',
    atcGroupName: 'Kháng thể đơn dòng kháng CD20 (Sinh phẩm điều trị)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 0.5, // 50% thanh toán BHYT
    requiresConsultation: true,
    isRestricted: true,
    specialConditions: 'Quỹ BHYT thanh toán 50% chi phí. Bắt buộc có Biên bản hội chẩn chuyên khoa Huyết học hoặc Ung bướu.',
    approvedIcd10Prefixes: ['C82', 'C83', 'C85', 'C91.1', 'M05'],
    pdfPage: 36
  },
  {
    activeIngredient: 'Trastuzumab',
    drugNames: ['Herceptin', 'Trastuzumab 440mg', 'Herzuma'],
    atcGroup: 'L01XC03',
    atcGroupName: 'Kháng thể đơn dòng nhắm trúng đích HER2+',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I'],
    paymentRatio: 0.5, // 50% thanh toán BHYT
    requiresConsultation: true,
    isRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Tuyến Trung ương (Hạng ĐB & I) với tỷ lệ 50% cho ung thư vú hoặc ung thư dạ dày có HER2 dương tính.',
    approvedIcd10Prefixes: ['C50', 'C16'],
    pdfPage: 38
  },
  {
    activeIngredient: 'Adalimumab',
    drugNames: ['Humira', 'Adalimumab 40mg'],
    atcGroup: 'L04AB04',
    atcGroupName: 'Thuốc ức chế TNF-alpha sinh học',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 0.5, // 50% thanh toán BHYT
    requiresConsultation: true,
    isRestricted: true,
    specialConditions: 'Quỹ BHYT thanh toán 50% chi phí điều trị Viêm khớp dạng thấp, Viêm cột sống dính khớp khi kháng DMARDs thông thường.',
    approvedIcd10Prefixes: ['M05', 'M06', 'M45', 'L40.5'],
    pdfPage: 16
  },
  {
    activeIngredient: 'Tamoxifen',
    drugNames: ['Nolvadex', 'Tamoxifen 10mg', 'Tamoxifen 20mg'],
    atcGroup: 'L02BA01',
    atcGroupName: 'Thuốc điều biến chọn lọc thụ thể Estrogen (SERM)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['C50'],
    pdfPage: 40
  },

  // =========================================================================
  // NHÓM 9: TIẾT NIỆU (TT 20/2022 - Trang 41)
  // =========================================================================
  {
    activeIngredient: 'Tamsulosin',
    drugNames: ['Harnal Ocas', 'Tamsulosin 0.4mg', 'Pradif'],
    atcGroup: 'G04CA02',
    atcGroupName: 'Thuốc chẹn thụ thể Alpha-1 điều trị tăng sinh lành tính tuyến tiền liệt',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['N40'],
    pdfPage: 41
  },

  // =========================================================================
  // NHÓM 10: CHỐNG PARKINSON (TT 20/2022 - Trang 42)
  // =========================================================================
  {
    activeIngredient: 'Levodopa + Benserazid',
    drugNames: ['Madopar', 'Madopar HBS', 'Levodopa/Benserazide'],
    atcGroup: 'N04BA02',
    atcGroupName: 'Thuốc tiền chất Dopamin điều trị bệnh Parkinson',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['G20', 'G21'],
    pdfPage: 42
  },

  // =========================================================================
  // NHÓM 11: MÁU & ĐÔNG MÁU (TT 20/2022 - Trang 42-45 & 49)
  // =========================================================================
  {
    activeIngredient: 'Enoxaparin',
    drugNames: ['Lovenox', 'Enoxaparin 40mg', 'Lovenox 60mg'],
    atcGroup: 'B01AB05',
    atcGroupName: 'Heparin trọng lượng phân tử thấp (LMWH)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I20.0', 'I21', 'I26', 'I80', 'I82', 'Z95.5'],
    pdfPage: 43
  },
  {
    activeIngredient: 'Warfarin',
    drugNames: ['Coumadin', 'Sintrom (Acenocoumarol)', 'Warfarin 2mg'],
    atcGroup: 'B01AA03',
    atcGroupName: 'Thuốc chống đông kháng Vitamin K',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Bắt buộc theo dõi chỉ số INR định kỳ trong hồ sơ bệnh án.',
    approvedIcd10Prefixes: ['I48', 'I26', 'I80', 'Z95.2', 'Z95.5'],
    pdfPage: 43
  },
  {
    activeIngredient: 'Rivaroxaban',
    drugNames: ['Xarelto', 'Rivaroxaban 10mg', 'Rivaroxaban 15mg', 'Rivaroxaban 20mg'],
    atcGroup: 'B01AF01',
    atcGroupName: 'Thuốc chống đông đường uống thế hệ mới (DOAC / NOAC)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Tuyến Tỉnh và Trung ương (Hạng ĐB, I, II). Tuyến Huyện (Hạng III/IV) không được thanh toán.',
    approvedIcd10Prefixes: ['I48', 'I26', 'I80', 'I82', 'Z96.6'],
    pdfPage: 49
  },
  {
    activeIngredient: 'Dabigatran',
    drugNames: ['Pradaxa', 'Dabigatran 110mg', 'Dabigatran 150mg'],
    atcGroup: 'B01AE07',
    atcGroupName: 'Thuốc ức chế trực tiếp Thrombin (NOAC)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Tuyến Tỉnh và Trung ương (Hạng ĐB, I, II). Tuyến Huyện (Hạng III/IV) không được thanh toán.',
    approvedIcd10Prefixes: ['I48', 'I26', 'I80'],
    pdfPage: 49
  },
  {
    activeIngredient: 'Clopidogrel',
    drugNames: ['Plavix', 'Clopidogrel 75mg', 'P fertility', 'Freeclo'],
    atcGroup: 'B01AC04',
    atcGroupName: 'Thuốc chống kết tập tiểu cầu P2Y12',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Thanh toán điều trị hội chứng mạch vành cấp, sau can thiệp stent mạch vành hoặc dự phòng đột quỵ thiếu máu não.',
    approvedIcd10Prefixes: ['I20.0', 'I21', 'I22', 'I25.2', 'Z95.5', 'I63'],
    pdfPage: 49
  },
  {
    activeIngredient: 'Ticagrelor',
    drugNames: ['Brilinta', 'Ticagrelor 90mg', 'Ticagrelor 60mg'],
    atcGroup: 'B01AC24',
    atcGroupName: 'Thuốc chống kết tập tiểu cầu ức chế P2Y12 thế hệ mới',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 0.7, // 70% thanh toán BHYT
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Quỹ BHYT thanh toán 70% chi phí cho bệnh nhân hội chứng vành cấp có can thiệp hoặc nguy cơ cao.',
    approvedIcd10Prefixes: ['I20.0', 'I21', 'I22', 'Z95.5'],
    pdfPage: 49
  },
  {
    activeIngredient: 'Albumin',
    drugNames: ['Human Albumin 20%', 'Albutein', 'Kedbumin', 'Zenalb'],
    atcGroup: 'B05AA01',
    atcGroupName: 'Chế phẩm máu & phân đoạn Albumin người',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 0.7, // 70% thanh toán BHYT
    requiresConsultation: true,
    isRestricted: true,
    specialConditions: 'Quỹ BHYT thanh toán 70% trong trường hợp: Nồng độ albumin máu <= 2.5 g/dL hoặc sốc hoặc suy hô hấp tiến triển (ARDS).',
    approvedIcd10Prefixes: ['R57', 'K74', 'N04', 'T81.1', 'J80'],
    pdfPage: 43
  },

  // =========================================================================
  // NHÓM 12: TIM MẠCH (TT 20/2022 - Trang 45-50)
  // =========================================================================
  {
    activeIngredient: 'Amlodipin',
    drugNames: ['Amlor', 'Amlodipin 5mg', 'Amvaz', 'Amlor 10mg'],
    atcGroup: 'C08CA01',
    atcGroupName: 'Thuốc chẹn kênh Canxi Dihydropyridine',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I10', 'I11', 'I12', 'I13', 'I15', 'I20', 'I25'],
    pdfPage: 46
  },
  {
    activeIngredient: 'Nifedipin',
    drugNames: ['Adalat', 'Adalat CC 30mg', 'Nifedipin 20mg'],
    atcGroup: 'C08CA05',
    atcGroupName: 'Thuốc chẹn kênh Canxi Dihydropyridine tác dụng kéo dài',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I10', 'I11', 'I20'],
    pdfPage: 46
  },
  {
    activeIngredient: 'Losartan',
    drugNames: ['Cozaar', 'Losartan 50mg', 'Presartan'],
    atcGroup: 'C09CA01',
    atcGroupName: 'Thuốc đối kháng thụ thể Angiotensin II (ARB)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I10', 'I11', 'I50', 'E11'],
    pdfPage: 47
  },
  {
    activeIngredient: 'Telmisartan',
    drugNames: ['Micardis', 'Telmisartan 40mg', 'Telmisartan 80mg', 'Pritor'],
    atcGroup: 'C09CA07',
    atcGroupName: 'Thuốc đối kháng thụ thể Angiotensin II (ARB)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I10', 'I11', 'I50', 'E11'],
    pdfPage: 47
  },
  {
    activeIngredient: 'Perindopril',
    drugNames: ['Coversyl', 'Perindopril 5mg', 'Coveram'],
    atcGroup: 'C09AA04',
    atcGroupName: 'Thuốc ức chế men chuyển Angiotensin (ACEi)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I10', 'I11', 'I50', 'I20', 'I25'],
    pdfPage: 46
  },
  {
    activeIngredient: 'Enalapril',
    drugNames: ['Renitec', 'Enalapril 5mg', 'Enalapril 10mg'],
    atcGroup: 'C09AA02',
    atcGroupName: 'Thuốc ức chế men chuyển Angiotensin (ACEi)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I10', 'I11', 'I50'],
    pdfPage: 46
  },
  {
    activeIngredient: 'Bisoprolol',
    drugNames: ['Concor', 'Bisoprolol 2.5mg', 'Bisoprolol 5mg'],
    atcGroup: 'C07AB07',
    atcGroupName: 'Thuốc chẹn thụ thể Beta-1 chọn lọc tim',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I10', 'I20', 'I25', 'I50', 'I47'],
    pdfPage: 46
  },
  {
    activeIngredient: 'Metoprolol',
    drugNames: ['Betaloc ZOK', 'Metoprolol 50mg', 'Betaloc'],
    atcGroup: 'C07AB02',
    atcGroupName: 'Thuốc chẹn thụ thể Beta chọn lọc tim phóng thích kéo dài',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I10', 'I20', 'I25', 'I50'],
    pdfPage: 46
  },
  {
    activeIngredient: 'Atorvastatin',
    drugNames: ['Lipitor', 'Atorvastatin 20mg', 'Atorlip', 'Torvast'],
    atcGroup: 'C10AA05',
    atcGroupName: 'Thuốc hạ lipid máu nhóm Statin',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['E78', 'I20', 'I25', 'I63', 'E11'],
    pdfPage: 50
  },
  {
    activeIngredient: 'Rosuvastatin',
    drugNames: ['Crestor', 'Rosuvastatin 10mg', 'Rosuvastatin 20mg', 'Crestor 10mg'],
    atcGroup: 'C10AA07',
    atcGroupName: 'Thuốc hạ lipid máu nhóm Statin tác dụng mạnh',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['E78', 'I20', 'I25', 'I63', 'E11'],
    pdfPage: 50
  },
  {
    activeIngredient: 'Fenofibrat',
    drugNames: ['Lipanthyl', 'Fenofibrat 200mg', 'Lipanthyl Supra 160mg'],
    atcGroup: 'C10AB05',
    atcGroupName: 'Thuốc hạ Triglycerid nhóm Fibrate',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['E78', 'E78.1', 'E78.2'],
    pdfPage: 50
  },
  {
    activeIngredient: 'Digoxin',
    drugNames: ['Lanoxin', 'Digoxin 0.25mg'],
    atcGroup: 'C01AA05',
    atcGroupName: 'Glycosid trợ tim tăng sức co bóp cơ tim',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Trạm Y tế xã chỉ thanh toán cấp cứu.',
    approvedIcd10Prefixes: ['I50', 'I48'],
    pdfPage: 48
  },
  {
    activeIngredient: 'Furosemid',
    drugNames: ['Lasix', 'Furosemid 40mg', 'Furosemide'],
    atcGroup: 'C03CA01',
    atcGroupName: 'Thuốc lợi tiểu quai',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I50', 'N04', 'N18', 'I10', 'R60'],
    pdfPage: 54
  },
  {
    activeIngredient: 'Spironolacton',
    drugNames: ['Aldactone', 'Spironolacton 25mg', 'Verospiron'],
    atcGroup: 'C03DA01',
    atcGroupName: 'Thuốc lợi tiểu kháng Aldosterone tiết kiệm Kali',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['I50', 'K74', 'I10'],
    pdfPage: 54
  },

  // =========================================================================
  // NHÓM 17: ĐƯỜNG TIÊU HÓA (TT 20/2022 - Trang 55-58)
  // =========================================================================
  {
    activeIngredient: 'Omeprazol',
    drugNames: ['Losec', 'Omeprazol 20mg', 'Omez', 'Lomax'],
    atcGroup: 'A02BC01',
    atcGroupName: 'Thuốc ức chế bơm Proton (PPI)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Không thanh toán đồng thời 2 thuốc nhóm PPI trong cùng một đợt khám.',
    approvedIcd10Prefixes: ['K21', 'K25', 'K26', 'K27', 'K29'],
    pdfPage: 55
  },
  {
    activeIngredient: 'Esomeprazol',
    drugNames: ['Nexium', 'Esomeprazol 40mg', 'Inexium', 'Nexium Mups'],
    atcGroup: 'A02BC05',
    atcGroupName: 'Thuốc ức chế bơm Proton (PPI)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Hạng IV không thanh toán dạng tiêm truyền tĩnh mạch. Không kê đồng thời 2 PPI.',
    approvedIcd10Prefixes: ['K21', 'K25', 'K26', 'K27', 'K29'],
    pdfPage: 55
  },
  {
    activeIngredient: 'Pantoprazol',
    drugNames: ['Pantoloc', 'Pantoprazol 40mg', 'Controloc'],
    atcGroup: 'A02BC02',
    atcGroupName: 'Thuốc ức chế bơm Proton (PPI)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Không thanh toán đồng thời 2 thuốc nhóm PPI trong cùng một đợt khám.',
    approvedIcd10Prefixes: ['K21', 'K25', 'K26', 'K27', 'K29'],
    pdfPage: 55
  },
  {
    activeIngredient: 'Rabeprazol',
    drugNames: ['Pariet', 'Rabeprazol 20mg', 'Rabeloc'],
    atcGroup: 'A02BC04',
    atcGroupName: 'Thuốc ức chế bơm Proton (PPI)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Không thanh toán đồng thời 2 thuốc nhóm PPI trong cùng một đợt khám.',
    approvedIcd10Prefixes: ['K21', 'K25', 'K26', 'K27', 'K29'],
    pdfPage: 55
  },
  {
    activeIngredient: 'Famotidin',
    drugNames: ['Quamatel', 'Famotidin 40mg'],
    atcGroup: 'A02BA03',
    atcGroupName: 'Thuốc kháng thụ thể Histamin H2 dạ dày',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['K21', 'K25', 'K26', 'K29'],
    pdfPage: 55
  },
  {
    activeIngredient: 'Sucralfat',
    drugNames: ['Sucralfate 1g', 'Ulcar', 'Carafate', 'Sucrate'],
    atcGroup: 'A02BX02',
    atcGroupName: 'Thuốc bảo vệ niêm mạc dạ dày tá tràng (Sucralfate)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['K21', 'K25', 'K26', 'K27', 'K29'],
    pdfPage: 55
  },
  {
    activeIngredient: 'Nhom phosphat',
    drugNames: ['Phosphalugel', 'Aluminium Phosphate', 'Phosphalugel gói'],
    atcGroup: 'A02AB03',
    atcGroupName: 'Thuốc kháng acid dạ dày chứa nhôm (Antacid)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['K21', 'K25', 'K26', 'K29'],
    pdfPage: 55
  },
  {
    activeIngredient: 'Ondansetron',
    drugNames: ['Zofran', 'Ondansetron 8mg', 'Vomina'],
    atcGroup: 'A04AA01',
    atcGroupName: 'Thuốc chống nôn đối kháng thụ thể 5-HT3',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Dự phòng và điều trị nôn do hóa trị ung thư hoặc sau phẫu thuật.',
    approvedIcd10Prefixes: ['R11', 'T81', 'Z51.1'],
    pdfPage: 56
  },
  {
    activeIngredient: 'Drotaverin',
    drugNames: ['No-Spa', 'Drotaverin 40mg', 'Spasmonavin'],
    atcGroup: 'A03AD02',
    atcGroupName: 'Thuốc chống co thắt cơ trơn',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['K58', 'K80', 'N23', 'R10'],
    pdfPage: 56
  },

  // =========================================================================
  // NHÓM 18: NỘI TIẾT & ĐÁI THÁO ĐƯỜNG (TT 20/2022 - Trang 59-63)
  // =========================================================================
  {
    activeIngredient: 'Metformin',
    drugNames: ['Glucophage', 'Metformin 850mg', 'Panfor SR', 'Glucophage XR'],
    atcGroup: 'A10BA02',
    atcGroupName: 'Thuốc hạ đường huyết Biguanide',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['E11'],
    pdfPage: 62
  },
  {
    activeIngredient: 'Gliclazid',
    drugNames: ['Diamicron MR', 'Gliclazid 30mg', 'Diamicron 60mg', 'Predian'],
    atcGroup: 'A10BB09',
    atcGroupName: 'Thuốc kích thích tiết Insulin nhóm Sulfonylurea',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['E11'],
    pdfPage: 61
  },
  {
    activeIngredient: 'Glimepirid',
    drugNames: ['Amaryl', 'Glimepirid 2mg', 'Glimepirid 4mg'],
    atcGroup: 'A10BB12',
    atcGroupName: 'Thuốc hạ đường huyết Sulfonylurea thế hệ 3',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['E11'],
    pdfPage: 61
  },
  {
    activeIngredient: 'Sitagliptin',
    drugNames: ['Januvia', 'Sitagliptin 100mg', 'Janumet'],
    atcGroup: 'A10BH01',
    atcGroupName: 'Thuốc ức chế Dipeptidyl Peptidase-4 (DPP-4i)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Bệnh viện Hạng Đặc biệt, Hạng I, Hạng II. Tuyến Huyện (Hạng III/IV) không được thanh toán.',
    approvedIcd10Prefixes: ['E11'],
    pdfPage: 62
  },
  {
    activeIngredient: 'Empagliflozin',
    drugNames: ['Jardiance', 'Empagliflozin 10mg', 'Empagliflozin 25mg', 'Jardiance Duo'],
    atcGroup: 'A10BK03',
    atcGroupName: 'Thuốc ức chế đồng vận chuyển Natri-Glucose 2 (SGLT2i)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 0.5, // 50% thanh toán BHYT
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Quỹ BHYT thanh toán 50% chi phí theo Thông tư 20/2022/TT-BYT đối với ĐTĐ type 2 có bệnh tim mạch hoặc suy tim phân suất tống máu giảm.',
    approvedIcd10Prefixes: ['E11', 'I50'],
    pdfPage: 61
  },
  {
    activeIngredient: 'Dapagliflozin',
    drugNames: ['Forxiga', 'Dapagliflozin 10mg', 'Forxiga 5mg', 'Xigduo XR'],
    atcGroup: 'A10BK01',
    atcGroupName: 'Thuốc ức chế đồng vận chuyển Natri-Glucose 2 (SGLT2i)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 0.5, // 50% thanh toán BHYT
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Quỹ BHYT thanh toán 50% chi phí đối với ĐTĐ type 2, bệnh thận mạn hoặc suy tim có giảm phân suất tống máu.',
    approvedIcd10Prefixes: ['E11', 'I50', 'N18'],
    pdfPage: 61
  },
  {
    activeIngredient: 'Insulin người',
    drugNames: ['Mixtard 30', 'Actrapid', 'Insulatard', 'Scilin'],
    atcGroup: 'A10AC01',
    atcGroupName: 'Insulin người tái tổ hợp ADN (Regular / NPH / Trộn)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    specialConditions: 'Được cấp phát quản lý ngoại trú tại trạm y tế xã.',
    approvedIcd10Prefixes: ['E10', 'E11'],
    pdfPage: 61
  },
  {
    activeIngredient: 'Insulin analog',
    drugNames: ['Lantus', 'Novorapid', 'Apidra', 'Toujeo', 'Tresiba', 'Novomix 30'],
    atcGroup: 'A10AE04',
    atcGroupName: 'Insulin analog tác dụng kéo dài hoặc cực nhanh',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0, // Dạng đơn thành phần 100%, dạng hỗn hợp trộn analog 50%
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Thanh toán 100% đối với insulin glargine/aspart đơn thành phần; thanh toán 50% đối với dạng hỗn hợp trộn analog.',
    approvedIcd10Prefixes: ['E10', 'E11'],
    pdfPage: 61
  },
  {
    activeIngredient: 'Methylprednisolon',
    drugNames: ['Medrol', 'Solu-Medrol', 'Methylprednisolon 16mg', 'Methylprednisolon 4mg'],
    atcGroup: 'H02AB04',
    atcGroupName: 'Glucocorticoid chống viêm mạnh & ức chế miễn dịch',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J45', 'J44', 'M05', 'M06', 'L20', 'T78', 'M32'],
    pdfPage: 59
  },
  {
    activeIngredient: 'Levothyroxin',
    drugNames: ['Berlthyrox', 'Levothyrox', 'Euthyrox', 'Levothyroxine 100mcg'],
    atcGroup: 'H03AA01',
    atcGroupName: 'Hormon tuyến giáp điều trị suy giáp',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['E03', 'E02', 'E06', 'E89.0'],
    pdfPage: 59
  },

  // =========================================================================
  // NHÓM 24: TÂM THẦN & THẦN KINH (TT 20/2022 - Trang 69-72)
  // =========================================================================
  {
    activeIngredient: 'Diazepam',
    drugNames: ['Seduxen', 'Diazepam 5mg', 'Valium'],
    atcGroup: 'N05BA01',
    atcGroupName: 'Thuốc an thần gây ngủ Benzodiazepine',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    maxOutpatientDays: 7,
    specialConditions: 'Thuốc hướng tâm thần, kê đơn theo quy chế thuốc kiểm soát đặc biệt tối đa 7-10 ngày.',
    approvedIcd10Prefixes: ['F41', 'G40', 'G47'],
    pdfPage: 69
  },
  {
    activeIngredient: 'Haloperidol',
    drugNames: ['Haldol', 'Haloperidol 1.5mg', 'Haloperidol 2mg'],
    atcGroup: 'N05AD01',
    atcGroupName: 'Thuốc chống loạn thần nhóm Butyrophenon',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['F20', 'F29', 'F05'],
    pdfPage: 70
  },
  {
    activeIngredient: 'Olanzapin',
    drugNames: ['Zyprexa', 'Olanzapin 10mg', 'Olanzapin 5mg', 'Oleanz'],
    atcGroup: 'N05AH03',
    atcGroupName: 'Thuốc chống loạn thần không điển hình thế hệ 2',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['F20', 'F31'],
    pdfPage: 70
  },
  {
    activeIngredient: 'Sertralin',
    drugNames: ['Zoloft', 'Sertralin 50mg', 'Serenata'],
    atcGroup: 'N06AB06',
    atcGroupName: 'Thuốc chống trầm cảm ức chế tái hấp thu Serotonin (SSRI)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Tuyến Tỉnh và Trung ương (Hạng ĐB, I, II).',
    approvedIcd10Prefixes: ['F32', 'F33', 'F41.0', 'F42'],
    pdfPage: 71
  },

  // =========================================================================
  // NHÓM 25: HÔ HẤP (TT 20/2022 - Trang 73-75)
  // =========================================================================
  {
    activeIngredient: 'Salbutamol',
    drugNames: ['Ventolin', 'Salbutamol 2mg', 'Ventolin Nebules', 'Asthalin'],
    atcGroup: 'R03AC02',
    atcGroupName: 'Thuốc chủ vận Beta-2 tác dụng ngắn (SABA) cắt cơn hen',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J45', 'J44'],
    pdfPage: 74
  },
  {
    activeIngredient: 'Salbutamol + Ipratropium',
    drugNames: ['Combivent', 'Combivent Respimat', 'Ipratropium + Salbutamol'],
    atcGroup: 'R03AL02',
    atcGroupName: 'Khí dung phối hợp SABA + SAMA giãn phế quản kép',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J45', 'J44'],
    pdfPage: 74
  },
  {
    activeIngredient: 'Budesonid',
    drugNames: ['Pulmicort', 'Pulmicort Respules 0.5mg', 'Budesonid 1mg'],
    atcGroup: 'R03BA02',
    atcGroupName: 'Corticoid đường hít / khí dung tại chỗ (ICS)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J45', 'J44', 'J05.0'],
    pdfPage: 73
  },
  {
    activeIngredient: 'Budesonid + Formoterol',
    drugNames: ['Symbicort', 'Symbicort Turbuhaler 160/4.5', 'Symbicort 80/4.5'],
    atcGroup: 'R03AK07',
    atcGroupName: 'Thuốc phối hợp ICS + LABA kiểm soát hen và COPD',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J45', 'J44'],
    pdfPage: 73
  },
  {
    activeIngredient: 'Fluticason + Salmeterol',
    drugNames: ['Seretide', 'Seretide Evohaler', 'Seretide Accuhaler 50/250'],
    atcGroup: 'R03AK06',
    atcGroupName: 'Thuốc phối hợp ICS + LABA',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J45', 'J44'],
    pdfPage: 74
  },
  {
    activeIngredient: 'Tiotropium',
    drugNames: ['Spiriva', 'Spiriva Respimat', 'Tiotropium 2.5mcg'],
    atcGroup: 'R03BB04',
    atcGroupName: 'Thuốc kháng Muscarinic tác dụng kéo dài (LAMA) điều trị COPD',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Chỉ thanh toán tại Tuyến Tỉnh và Trung ương (Hạng ĐB, I, II) cho bệnh nhân COPD.',
    approvedIcd10Prefixes: ['J44'],
    pdfPage: 74
  },
  {
    activeIngredient: 'Montelukast',
    drugNames: ['Singulair', 'Montelukast 10mg', 'Singulair 4mg', 'Montelukast 5mg'],
    atcGroup: 'R03DC03',
    atcGroupName: 'Thuốc đối kháng thụ thể Leukotriene (LTRA)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    approvedIcd10Prefixes: ['J45', 'J30'],
    pdfPage: 73
  },

  // =========================================================================
  // NHÓM OPIOID GÂY NGHIỆN KIỂM SOÁT ĐẶC BIỆT (TT 20/2022 - Trang 13-14)
  // =========================================================================
  {
    activeIngredient: 'Morphin',
    drugNames: ['Morphin 10mg', 'Morphine sulfat', 'MST Continus', 'Morphin 30mg'],
    atcGroup: 'N02AA01',
    atcGroupName: 'Thuốc giảm đau Opioid mạnh (Thuốc gây nghiện kiểm soát đặc biệt)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    maxOutpatientDays: 10, // Kê đơn ngoại trú tối đa 10 ngày cho bệnh mạn tính / 7 ngày cho cấp tính theo TT 26/2025
    specialConditions: 'Đơn thuốc gây nghiện phải tuân thủ mẫu riêng, số ngày kê ngoại trú không vượt quá quy định Thông tư 26/2025/TT-BYT.',
    approvedIcd10Prefixes: ['C00', 'C01', 'C02', 'C15', 'C16', 'C18', 'C20', 'C34', 'C50', 'C61', 'C80', 'R52'],
    pdfPage: 13
  },
  {
    activeIngredient: 'Fentanyl',
    drugNames: ['Durogesic', 'Fentanyl 25mcg/h', 'Fentanyl 50mcg/h'],
    atcGroup: 'N02AB03',
    atcGroupName: 'Opioid tổng hợp mạnh dạng miếng dán thẩm thấu qua da',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II'],
    paymentRatio: 1.0,
    requiresConsultation: true,
    isRestricted: true,
    maxOutpatientDays: 15,
    specialConditions: 'Chỉ định giảm đau mạn tính cho bệnh nhân ung thư nặng không đáp ứng với opioid khác.',
    approvedIcd10Prefixes: ['C00', 'C16', 'C18', 'C20', 'C34', 'C50', 'C80', 'R52'],
    pdfPage: 13
  },

  // =========================================================================
  // THUỐC BẢY CHUYÊN KHOA ĐẶC BIỆT & DÙNG NGOÀI (TT 20/2022)
  // =========================================================================
  {
    activeIngredient: 'Tobramycin',
    drugNames: ['Tobrex', 'Tobramycin 0.3%', 'Tobrex nhỏ mắt', 'Tobradex'],
    atcGroup: 'S01AA12',
    atcGroupName: 'Kháng sinh Aminoglycosid dùng tại chỗ (Nhãn khoa/Tai)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    routeCategory: 'OPHTHALMIC_OTIC',
    approvedIcd10Prefixes: ['H10', 'H16', 'H01', 'H04', 'H60'],
    specialConditions: 'Thuốc nhỏ mắt/tai dùng tại chỗ được thanh toán cho các nhiễm khuẩn mắt/tai theo phân tuyến kỹ thuật.',
    pdfPage: 23
  },
  {
    activeIngredient: 'Diclofenac gel',
    drugNames: ['Voltaren Emulgel', 'Diclofenac gel 1%', 'Diclofenac bôi', 'Voltaren gel'],
    atcGroup: 'M02AA15',
    atcGroupName: 'Thuốc chống viêm không steroid dùng tại chỗ (Gel bôi ngoài)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III', 'HANG_IV'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: false,
    routeCategory: 'TOPICAL',
    approvedIcd10Prefixes: ['M15', 'M16', 'M17', 'M19', 'M54', 'S00', 'T14'],
    specialConditions: 'Dạng gel dùng ngoài điều trị giảm đau kháng viêm tại chỗ.',
    pdfPage: 13
  },
  {
    activeIngredient: 'Glucosamin',
    drugNames: ['Viartril-S', 'Glucosamin 500mg', 'Glucosamine sulfate', 'Glucosamin Chondroitin', 'Glucosamin 250mg'],
    atcGroup: 'M01AX05',
    atcGroupName: 'Thuốc chống thoái hóa khớp (Glucosamin)',
    allowedRanks: ['HANG_DAC_BIET', 'HANG_I', 'HANG_II', 'HANG_III'],
    paymentRatio: 1.0,
    requiresConsultation: false,
    isRestricted: true,
    routeCategory: 'ORAL',
    approvedIcd10Prefixes: ['M17'],
    specialConditions: 'Căn cứ Thông tư 20/2022/TT-BYT Cột 8: Quỹ BHYT chỉ thanh toán điều trị thoái hóa khớp gối (M17) mức độ nhẹ và trung bình. Không thanh toán cho thoái hóa khớp khác hoặc viêm khớp khác.',
    pdfPage: 16
  },

  // =========================================================================
  // NHÓM NGOÀI DANH MỤC THANH TOÁN BHYT / TPCN LOẠI TRỪ (TT 20/2022 & Luật BHYT)
  // =========================================================================
  {
    activeIngredient: 'Thực phẩm chức năng',
    drugNames: ['Boganic', 'Ginkgo Biloba TPCN', 'Sụn vi cá mập', 'Viên uống bổ khớp', 'Hoạt huyết TPCN'],
    atcGroup: 'TPCN01',
    atcGroupName: 'Thực phẩm bảo vệ sức khỏe / TPCN không thanh toán BHYT',
    allowedRanks: [],
    paymentRatio: 0,
    requiresConsultation: false,
    isRestricted: true,
    specialConditions: 'Luật BHYT Điều 23 quy định không thanh toán thực phẩm chức năng và sản phẩm dinh dưỡng bổ sung.',
    pdfPage: 0
  }
];

/**
 * Tra cứu quy tắc thanh toán BHYT theo tên thuốc, biệt dược hoặc hoạt chất (Đa chiến lược & Có đối soát Đường dùng)
 */
export function findBhytRule(drugNameOrActive: string, routeText?: string): BhytDrugRule | null {
  if (!drugNameOrActive) return null;
  const rawQuery = drugNameOrActive.toLowerCase().trim();
  const normQuery = normalizeDrugSearchText(drugNameOrActive);

  if (!normQuery) return null;

  const targetRouteCat = routeText ? detectRouteCategory(routeText) : undefined;
  const matchedRules: BhytDrugRule[] = [];

  // 1. Khớp chính xác tên hoạt chất (Raw & Normalized)
  const exactActive = BHYT_DRUG_RULES.filter(r => 
    r.activeIngredient.toLowerCase() === rawQuery ||
    normalizeDrugSearchText(r.activeIngredient) === normQuery
  );
  if (exactActive.length > 0) matchedRules.push(...exactActive);

  // 2. Khớp biệt dược thương mại chính xác hoặc chứa trong query
  if (matchedRules.length === 0) {
    const brandMatch = BHYT_DRUG_RULES.filter(r => 
      r.drugNames.some(brand => {
        const normBrand = normalizeDrugSearchText(brand);
        return normQuery.includes(normBrand) || normBrand.includes(normQuery);
      })
    );
    if (brandMatch.length > 0) matchedRules.push(...brandMatch);
  }

  // 3. Khớp mờ tên hoạt chất (Chứa hoạt chất hoặc hoạt chất chứa query)
  if (matchedRules.length === 0) {
    const partialActive = BHYT_DRUG_RULES.filter(r => {
      const normActive = normalizeDrugSearchText(r.activeIngredient);
      return normQuery.includes(normActive) || normActive.includes(normQuery);
    });
    if (partialActive.length > 0) matchedRules.push(...partialActive);
  }

  // 4. Token overlap (Khớp từ khóa quan trọng)
  if (matchedRules.length === 0) {
    const queryTokens = normQuery.split(' ').filter(t => t.length >= 4);
    if (queryTokens.length > 0) {
      const tokenMatch = BHYT_DRUG_RULES.filter(r => {
        const activeNorm = normalizeDrugSearchText(r.activeIngredient);
        return queryTokens.some(token => activeNorm.includes(token));
      });
      if (tokenMatch.length > 0) matchedRules.push(...tokenMatch);
    }
  }

  if (matchedRules.length === 0) return null;

  // Nếu có truyền đường dùng, ưu tiên rule khớp đúng routeCategory
  if (targetRouteCat) {
    const routeMatched = matchedRules.find(r => r.routeCategory === targetRouteCat);
    if (routeMatched) return routeMatched;
  }

  return matchedRules[0];
}

/**
 * Tìm kiếm danh sách quy tắc theo từ khóa (dùng cho thanh tra cứu danh mục BHYT)
 */
export function searchBhytRules(query: string): BhytDrugRule[] {
  if (!query || query.trim().length === 0) return BHYT_DRUG_RULES;
  const norm = normalizeDrugSearchText(query);
  return BHYT_DRUG_RULES.filter(rule => {
    const activeNorm = normalizeDrugSearchText(rule.activeIngredient);
    const atcNorm = normalizeDrugSearchText(rule.atcGroupName);
    const brandsNorm = rule.drugNames.map(b => normalizeDrugSearchText(b)).join(' ');
    return activeNorm.includes(norm) || atcNorm.includes(norm) || brandsNorm.includes(norm) || rule.atcGroup.toLowerCase().includes(query.toLowerCase());
  });
}

/**
 * Lọc danh sách thuốc BHYT theo hạng bệnh viện
 */
export function getBhytRulesByRank(rank: HospitalRank): BhytDrugRule[] {
  return BHYT_DRUG_RULES.filter(r => r.allowedRanks.includes(rank));
}

/**
 * Lấy danh sách thuốc bắt buộc phải có biên bản hội chẩn
 */
export function getConsultationRequiredRules(): BhytDrugRule[] {
  return BHYT_DRUG_RULES.filter(r => r.requiresConsultation);
}

/**
 * Lấy danh sách thuốc thanh toán theo tỷ lệ (50%, 70%, 30%)
 */
export function getPartialPaymentRules(): BhytDrugRule[] {
  return BHYT_DRUG_RULES.filter(r => r.paymentRatio > 0 && r.paymentRatio < 1.0);
}
