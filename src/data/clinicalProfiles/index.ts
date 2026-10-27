/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tra cứu Dược thư Lâm sàng, Dị ứng & 5 Đúng (QĐ 2147/QĐ-BYT & TT 31/2021) (<=200 LOC)
 */

import { FiveRightsSafetyInfo, MasterMedication } from '../../types/medication';
import { CONTROLLED_CLINICAL_PROFILES } from './controlledProfiles';
import { SEDATIVE_CLINICAL_PROFILES } from './sedativeProfiles';
import { EMERGENCY_CLINICAL_PROFILES } from './emergencyProfiles';
import { ELECTROLYTE_CLINICAL_PROFILES } from './electrolyteProfiles';
import { ANTIBIOTIC_CLINICAL_PROFILES } from './antibioticProfiles';
import { GENERAL_CLINICAL_PROFILES } from './generalProfiles';
import { HOSPITAL_SPECIALTY_CLINICAL_PROFILES } from './hospitalSpecialtyProfiles';

export const ALL_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  ...CONTROLLED_CLINICAL_PROFILES,
  ...SEDATIVE_CLINICAL_PROFILES,
  ...EMERGENCY_CLINICAL_PROFILES,
  ...ELECTROLYTE_CLINICAL_PROFILES,
  ...ANTIBIOTIC_CLINICAL_PROFILES,
  ...GENERAL_CLINICAL_PROFILES,
  ...HOSPITAL_SPECIALTY_CLINICAL_PROFILES,

  // Direct mapping by Batch / Master IDs for instant O(1) resolution
  'b-1': GENERAL_CLINICAL_PROFILES['med-gen-01'],
  'b-2': ANTIBIOTIC_CLINICAL_PROFILES['med-ab-01'],
  'b-3': CONTROLLED_CLINICAL_PROFILES['med-ctrl-01'],
  'b-4': EMERGENCY_CLINICAL_PROFILES['med-em-01'],
  'b-5': ELECTROLYTE_CLINICAL_PROFILES['med-em-09'],
  'b-6': ANTIBIOTIC_CLINICAL_PROFILES['med-ab-02'],
  'b-7': SEDATIVE_CLINICAL_PROFILES['med-em-07'],
  'b-18': HOSPITAL_SPECIALTY_CLINICAL_PROFILES['med-aml-01'],
  'b-19': HOSPITAL_SPECIALTY_CLINICAL_PROFILES['med-met-01'],
  'b-20': HOSPITAL_SPECIALTY_CLINICAL_PROFILES['med-ato-01'],
};

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Tra cứu hồ sơ lâm sàng Dược Thư Quốc Gia 5 Đúng và Dị ứng theo ID hoặc tên thuốc/hoạt chất
 */
export function getMedicationClinicalProfile(
  identifierOrName: string,
  medData?: Partial<MasterMedication>
): FiveRightsSafetyInfo {
  if (!identifierOrName) {
    return { ...ALL_CLINICAL_PROFILES['med-ctrl-01'], isVerifiedMonograph: true };
  }

  // 1. Khớp chính xác ID
  if (ALL_CLINICAL_PROFILES[identifierOrName]) {
    return { ...ALL_CLINICAL_PROFILES[identifierOrName], isVerifiedMonograph: true };
  }

  // 2. Tìm kiếm đa chiều: ID, Biệt dược, Hoạt chất, SĐK
  const query = normalize(`${identifierOrName} ${medData?.brandName || ''} ${medData?.activeIngredient || ''} ${medData?.nationalCode || ''}`);

  if (query.includes('b-3') || query.includes('893111093823') || query.includes('dp-mp-01') || query.includes('morphin')) {
    return { ...ALL_CLINICAL_PROFILES['med-ctrl-01'], isVerifiedMonograph: true };
  }
  if (query.includes('b-4') || query.includes('893110151100') || query.includes('dp-ad-01') || query.includes('adrenalin') || query.includes('hadunalin') || query.includes('epinephrin')) {
    return { ...ALL_CLINICAL_PROFILES['med-em-01'], isVerifiedMonograph: true };
  }
  if (query.includes('b-5') || query.includes('893110375223') || query.includes('dp-kc-01') || query.includes('kali') || query.includes('kcl')) {
    return { ...ALL_CLINICAL_PROFILES['med-em-09'], isVerifiedMonograph: true };
  }
  if (query.includes('b-2') || query.includes('840110304425') || query.includes('dp-cf-01') || query.includes('ceftria') || query.includes('rocephin') || query.includes('normon')) {
    return { ...ALL_CLINICAL_PROFILES['med-ab-01'], isVerifiedMonograph: true };
  }
  if (query.includes('b-7') || query.includes('890112769224') || query.includes('dp-dz-01') || query.includes('diaze') || query.includes('seduxen')) {
    return { ...ALL_CLINICAL_PROFILES['med-em-07'], isVerifiedMonograph: true };
  }
  if (query.includes('b-6') || query.includes('890110595324') || query.includes('dp-vc-01') || query.includes('vanco')) {
    return { ...ALL_CLINICAL_PROFILES['med-ab-02'], isVerifiedMonograph: true };
  }
  if (query.includes('b-1') || query.includes('893100110026') || query.includes('dp-pc-01') || query.includes('paracet') || query.includes('panadol') || query.includes('efferal') || query.includes('acetamin')) {
    return { ...ALL_CLINICAL_PROFILES['med-gen-01'], isVerifiedMonograph: true };
  }
  if (query.includes('b-19') || query.includes('890110197726') || query.includes('panfor') || query.includes('metformin')) {
    return { ...ALL_CLINICAL_PROFILES['med-met-01'], isVerifiedMonograph: true };
  }
  if (query.includes('b-18') || query.includes('890110197826') || query.includes('safeesem') || query.includes('amlodipin')) {
    return { ...ALL_CLINICAL_PROFILES['med-aml-01'], isVerifiedMonograph: true };
  }
  if (query.includes('b-20') || query.includes('590110192126') || query.includes('atorvastatin') || query.includes('atorva') || query.includes('lipitor')) {
    return { ...ALL_CLINICAL_PROFILES['med-ato-01'], isVerifiedMonograph: true };
  }
  if (query.includes('enoxaparin') || query.includes('enox') || query.includes('lovenox')) {
    return { ...ALL_CLINICAL_PROFILES['med-enox-01'], isVerifiedMonograph: true };
  }
  if (query.includes('naloxon') || query.includes('nalox')) {
    return { ...ALL_CLINICAL_PROFILES['med-nalox-01'], isVerifiedMonograph: true };
  }
  if (query.includes('fentan')) {
    return { ...ALL_CLINICAL_PROFILES['med-ctrl-02'], isVerifiedMonograph: true };
  }
  if (query.includes('noradre') || query.includes('norepi')) {
    return { ...ALL_CLINICAL_PROFILES['med-em-02'], isVerifiedMonograph: true };
  }
  if (query.includes('lipid') || query.includes('intralipid') || query.includes('lipovenoes')) {
    return { ...ALL_CLINICAL_PROFILES['med-gen-02'], isVerifiedMonograph: true };
  }

  // 3. Không có chuyên luận trong Dược Thư 2015: Trả về trạng thái trung thực, minh bạch nguồn gốc
  const name = medData?.brandName || identifierOrName;
  const active = medData?.activeIngredient || 'Theo hồ sơ công bố';
  const sdk = medData?.nationalCode;

  return {
    isVerifiedMonograph: false,
    officialSource: {
      documentName: 'Chưa có chuyên luận trong Dược thư Quốc gia 2015 (QĐ 2033/QĐ-BYT)',
      registrationNumber: sdk ? `SĐK: ${sdk}` : undefined,
      standardPharmacopeia: medData?.standardPharmacopeia || 'Theo hồ sơ công bố NSX',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
      pdfDocument: undefined,
      pdfPage: undefined,
      citationUrl: sdk ? `https://dichvucong.dav.gov.vn/congbothuoc/index?search=${encodeURIComponent(sdk)}` : undefined,
    },
    composition: {
      activeIngredients: [{ innName: active, chemicalSalt: active, strength: medData?.concentration || 'Theo nhãn thuốc' }],
      excipients: [],
      dosageForm: medData?.dosageForm || 'Theo hồ sơ công bố',
      appearance: 'Theo tiêu chuẩn cơ sở của nhà sản xuất',
      packagingSpec: medData?.standardUnit || 'Đơn vị tiêu chuẩn',
      pharmacopeiaStandard: medData?.standardPharmacopeia || 'Tiêu chuẩn NSX',
    },
    indications: [],
    pharmacologyMechanism: undefined,
    activeIngredients: [active],
    allergyProfile: {
      allergyClass: 'Theo dõi tiền sử dị ứng người bệnh trước khi dùng',
      activeAllergens: [active],
      excipientAllergens: [],
      crossReactivities: [],
      contraindicatedAllergies: [
        `Tiền sử quá mẫn hoặc dị ứng với ${active} hoặc bất kỳ tá dược nào của thuốc.`,
      ],
      commonAllergySigns: [
        'Mẩn ngứa, phát ban da, mày đay cấp tính',
        'Phù mạch, khó thở nếu xảy ra phản vệ (xử trí cấp cứu theo TT 51/2017/TT-BYT)',
      ],
      emergencyManagement: 'Ngừng ngay thuốc khi nghi ngờ dị ứng. Xử trí phản vệ theo Thông tư 51/2017/TT-BYT.',
    },
    targetPopulation: `Người bệnh được bác sĩ chỉ định điều trị bằng ${name}. Tuân thủ đơn thuốc và hướng dẫn của bác sĩ điều trị.`,
    contraindications: [],
    patientVerificationChecklist: [
      'Đối soát họ tên, tuổi, số giường bệnh và mã người bệnh trên vòng đeo tay/bệnh án',
      'Hỏi người bệnh hoặc thân nhân về tiền sử dị ứng thuốc trước đó',
      'Kiểm tra tính nguyên vẹn của bao bì, hạn dùng và độ trong của thuốc trước khi cấp phát',
    ],
    tallManLASA: medData?.tallManName || name,
    highAlertRiskNote: medData?.isHighAlert ? 'Thuốc thuộc danh mục cảnh báo cao nguy cơ sai sót điều trị' : undefined,
    standardDosing: `Tuân thủ theo đơn thuốc của bác sĩ điều trị và Tờ hướng dẫn sử dụng (HDSD) được Bộ Y Tế phê duyệt.`,
    maxDailyDose: 'Theo liều tối đa ghi trên nhãn và Tờ hướng dẫn sử dụng.',
    renalAdjustment: undefined,
    hepaticAdjustment: undefined,
    administrationRouteDetails: `Đúng đường dùng theo y lệnh: ${medData?.route || 'Theo chỉ định bác sĩ'}.`,
    compatibleDiluents: [],
    timingAndFrequency: 'Đúng giờ theo lịch phát thuốc của khoa phòng hoặc đơn ngoại trú.',
    mealRelation: 'Theo hướng dẫn ghi trên nhãn thuốc hoặc chỉ dẫn của dược sĩ/bác sĩ.',
    clinicalMonitoring: 'Theo dõi đáp ứng lâm sàng và các tác dụng không mong muốn (ADR) có thể xảy ra.',
    adverseReactions: [],
    antidote: undefined,
    ddiWarnings: [],
    pregnancyLactation: 'Tham khảo kỹ phần Phụ nữ có thai và cho con bú trong Tờ Hướng Dẫn Sử Dụng được Bộ Y Tế phê duyệt.',
    storageAndHandling: 'Bảo quản nơi khô ráo, tránh ánh sáng trực tiếp, nhiệt độ theo nhãn thuốc quy định.',
  };
}
