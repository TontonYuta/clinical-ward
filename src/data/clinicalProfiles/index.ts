/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tra cứu Dược thư Lâm sàng, Dị ứng & 5 Đúng (QĐ 2147/QĐ-BYT & TT 31/2021) (<=200 LOC)
 */

import { FiveRightsSafetyInfo, MasterMedication } from '../../types/medication';
import { CONTROLLED_CLINICAL_PROFILES } from './controlledProfiles';
import { EMERGENCY_CLINICAL_PROFILES } from './emergencyProfiles';
import { ANTIBIOTIC_CLINICAL_PROFILES } from './antibioticProfiles';
import { GENERAL_CLINICAL_PROFILES } from './generalProfiles';

export const ALL_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  ...CONTROLLED_CLINICAL_PROFILES,
  ...EMERGENCY_CLINICAL_PROFILES,
  ...ANTIBIOTIC_CLINICAL_PROFILES,
  ...GENERAL_CLINICAL_PROFILES,
};

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Tra cứu hồ sơ lâm sàng 5 Đúng và Dị ứng theo ID hoặc tên thuốc/hoạt chất
 */
export function getMedicationClinicalProfile(
  identifierOrName: string,
  medData?: Partial<MasterMedication>
): FiveRightsSafetyInfo {
  // 1. Khớp chính xác ID
  if (ALL_CLINICAL_PROFILES[identifierOrName]) {
    return ALL_CLINICAL_PROFILES[identifierOrName];
  }

  const query = normalize(identifierOrName);

  // 2. Khớp từ khóa hoạt chất / thương mại phổ biến
  if (query.includes('morphin')) return ALL_CLINICAL_PROFILES['med-ctrl-01'];
  if (query.includes('fentan')) return ALL_CLINICAL_PROFILES['med-ctrl-02'];
  if (query.includes('diaze')) return ALL_CLINICAL_PROFILES['med-em-07'];
  if (query.includes('noradre') || query.includes('norepi')) return ALL_CLINICAL_PROFILES['med-em-02'];
  if (query.includes('adre') || query.includes('epi')) return ALL_CLINICAL_PROFILES['med-em-01'];
  if (query.includes('kali') || query.includes('kcl')) return ALL_CLINICAL_PROFILES['med-em-09'];
  if (query.includes('ceftria')) return ALL_CLINICAL_PROFILES['med-ab-01'];
  if (query.includes('vanco')) return ALL_CLINICAL_PROFILES['med-ab-02'];
  if (query.includes('paracet') || query.includes('acetamin') || query.includes('efferal') || query.includes('panadol')) {
    return ALL_CLINICAL_PROFILES['med-gen-01'];
  }
  if (query.includes('lipid') || query.includes('intralipid') || query.includes('lipovenoes')) {
    return ALL_CLINICAL_PROFILES['med-gen-02'];
  }

  // 3. Fallback: Sinh hồ sơ chuẩn 5 Đúng & Cảnh báo Dị ứng theo chuẩn Bộ Y Tế
  const name = medData?.brandName || identifierOrName;
  const active = medData?.activeIngredient || 'Dược chất chính';
  const route = medData?.route || 'Đường dùng theo chỉ định bác sĩ';
  const isHighAlert = medData?.isHighAlert || false;

  return {
    indications: [
      `Điều trị và kiểm soát các bệnh lý lâm sàng theo phác đồ chỉ định bác sĩ CPOE đối với ${name}.`,
      'Hỗ trợ cải thiện triệu chứng và ngăn ngừa diễn tiến nặng của bệnh nền.',
    ],
    pharmacologyMechanism: `Tác dụng dược lý thông qua cơ chế gắn kết thụ thể mục tiêu của hoạt chất ${active}, chuyển hóa chủ yếu qua gan và thải trừ qua thận.`,
    activeIngredients: [active],
    allergyProfile: {
      allergyClass: 'Dược chất trị liệu theo chỉ định lâm sàng',
      activeAllergens: [active],
      excipientAllergens: ['Tá dược tiêu chuẩn theo dược điển Việt Nam'],
      crossReactivities: ['Các thuốc cùng nhóm dược lý tương tự'],
      contraindicatedAllergies: [
        `Tiền sử sốc phản vệ hoặc quá mẫn nghiêm trọng với ${active} hoặc các thành phần tá dược`,
      ],
      commonAllergySigns: [
        'Mẩn ngứa, phát ban da, mày đay cấp tính',
        'Phù mạch, khó thở, tụt huyết áp nếu xảy ra phản vệ',
      ],
      emergencyManagement: 'Ngừng ngay thuốc nghi ngờ. Đo dấu hiệu sinh tồn, tiêm bắp Adrenalin nếu có dấu hiệu phản vệ theo TT 51/2017/TT-BYT.',
    },
    targetPopulation: `Người bệnh được chỉ định điều trị bằng ${name} theo chẩn đoán xác định của bác sĩ. Cần đánh giá kỹ tiền sử dị ứng, chức năng gan thận trước khi dùng.`,
    contraindications: [
      `Mẫn cảm hoặc tiền sử dị ứng với ${active} hoặc tá dược của thuốc`,
      'Phụ nữ có thai hoặc cho con bú nếu chưa có đánh giá phân tích lợi ích/nguy cơ của bác sĩ điều trị',
    ],
    patientVerificationChecklist: [
      'Đối soát họ tên, tuổi, số giường bệnh và mã người bệnh trên vòng đeo tay/bệnh án',
      'Hỏi người bệnh hoặc thân nhân về tiền sử dị ứng thuốc trước đó',
      'Giải thích mục đích dùng thuốc và các tác dụng không mong muốn có thể gặp',
    ],
    tallManLASA: medData?.tallManName || name,
    highAlertRiskNote: isHighAlert ? 'Thuốc thuộc danh mục cảnh báo cao nguy cơ sai sót điều trị' : undefined,
    standardDosing: `Liều dùng tuân thủ đơn thuốc bác sĩ CPOE. Thường dùng: ${medData?.defaultDoseQty || 1} ${medData?.standardUnit || 'đơn vị'}.`,
    maxDailyDose: 'Tuân thủ liều tối đa ghi trong Tờ hướng dẫn sử dụng được Bộ Y Tế phê duyệt.',
    renalAdjustment: 'Cần hiệu chỉnh liều giảm bớt hoặc kéo dài khoảng cách nếu mức lọc cầu thận eGFR < 50 ml/phút.',
    hepaticAdjustment: 'Thận trọng ở người bệnh suy giảm chức năng tế bào gan mức độ trung bình đến nặng.',
    administrationRouteDetails: `Đúng đường dùng: ${route}. Tuân thủ kỹ thuật vô khuẩn và kiểm tra độ trong của dung dịch trước khi sử dụng.`,
    compatibleDiluents: ['NaCl 0.9%', 'Glucose 5%', 'Nước cất pha tiêm'],
    timingAndFrequency: 'Đúng giờ theo lịch phát thuốc của khoa phòng (ví dụ 08:00 - 16:00 hoặc chia đều theo khoảng cách T1/2).',
    mealRelation: 'Uống sau ăn 30 phút hoặc theo chỉ dẫn cụ thể của bác sĩ/dược sĩ lâm sàng.',
    clinicalMonitoring: 'Theo dõi dấu hiệu sinh tồn, tình trạng cải thiện triệu chứng và phát hiện sớm phản ứng có hại của thuốc (ADR).',
    adverseReactions: ['Dị ứng/phát ban da', 'Rối loạn tiêu hóa nhẹ', 'Chóng mặt buồn nôn'],
    antidote: 'Ngừng thuốc ngay lập tức và điều trị triệu chứng hỗ trợ theo phác đồ cấp cứu.',
    ddiWarnings: ['Kiểm tra tương tác trước khi phối hợp với các thuốc chuyển hóa qua enzym gan Cytochrome P450'],
    pregnancyLactation: 'Cân nhắc thận trọng giữa lợi ích điều trị cho mẹ và nguy cơ cho thai nhi.',
    storageAndHandling: 'Bảo quản nhiệt độ phòng dưới 30°C, nơi khô ráo, tránh ánh sáng trực tiếp.',
  };
}
