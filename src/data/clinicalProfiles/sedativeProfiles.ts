/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dược Thư Lâm Sàng & Thành Phần Thuốc: Hướng Thần & An Thần Cắt Cơn Co Giật (<=200 LOC)
 */

import { FiveRightsSafetyInfo } from '../../types/medication';

export const SEDATIVE_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  // Diazepam 10mg/2ml
  'med-em-07': {
    composition: {
      activeIngredients: [{ innName: 'Diazepam', chemicalSalt: 'Diazepam base', strength: '10 mg / 2 ml (5 mg/ml)' }],
      excipients: [
        { name: 'Propylene glycol 40%', role: 'Đồng dung môi hòa tan', safetyNotice: 'Dễ gây đau buốt và viêm tắc tĩnh mạch tại chỗ' },
        { name: 'Ethanol 96% 10%', role: 'Đồng dung môi' },
        { name: 'Benzyl alcohol 1.5%', role: 'Chất bảo quản', safetyNotice: 'Chống chỉ định ở trẻ sơ sinh (Hội chứng thở dốc Gasping)' },
        { name: 'Natri benzoat / Acid benzoic', role: 'Hệ đệm ổn định' },
        { name: 'Nước cất pha tiêm', role: 'Dung môi vừa đủ 2 ml' },
      ],
      dosageForm: 'Dung dịch tiêm tĩnh mạch / tiêm bắp',
      appearance: 'Dung dịch trong, không màu hoặc ánh vàng lục nhạt, nhớt nhẹ',
      phAndOsmolarity: 'pH: 6.2 - 6.9',
      packagingSpec: 'Hộp 10 ống thủy tinh màu nâu 2ml',
      pharmacopeiaStandard: 'Dược điển Việt Nam V (DĐVN V) / BP',
    },
    indications: [
      'Cắt cơn co giật cấp tính: Trạng thái động kinh (Status Epilepticus), sốt cao co giật ở trẻ em.',
      'Cơn kích động cấp, hội chứng cai rượu cấp tính (Delirium Tremens).',
      'Tiền mê trước phẫu thuật hoặc nội soi can thiệp.',
      'Co thắt cơ vân nặng do chấn thương cột sống hoặc uốn ván.',
    ],
    pharmacologyMechanism: 'Tăng cường tác dụng ức chế của acid gamma-aminobutyric (GABA) qua thụ thể GABA-A tại hệ TKTW, gây an thần, giải lo âu, giãn cơ và chống co giật.',
    activeIngredients: ['Diazepam 10mg / 2ml'],
    allergyProfile: {
      allergyClass: 'Benzodiazepine',
      activeAllergens: ['Diazepam'],
      excipientAllergens: ['Propylene glycol (nguy cơ viêm tắc tĩnh mạch và kích ứng)', 'Ethanol', 'Benzyl alcohol'],
      crossReactivities: ['Midazolam', 'Lorazepam', 'Clonazepam'],
      contraindicatedAllergies: [
        'Tiền sử dị ứng hoặc quá mẫn với Diazepam hoặc nhóm Benzodiazepine',
        'Quá mẫn với Propylene glycol hoặc Benzyl alcohol (chống chỉ định ở trẻ sơ sinh)',
      ],
      commonAllergySigns: [
        'Mày đay, phát ban dạng sởi, ngứa dữ dội',
        'Phù mạch Quincke vùng mặt, mi mắt',
        'Tụt huyết áp, trụy hô hấp',
      ],
      emergencyManagement: 'Ngừng tiêm ngay lập tức. Đặt canul chống cắn lưỡi, hỗ trợ thông khí oxy; dùng Flumazenil nếu quá liều gây ngừng thở; Adrenalin nếu sốc phản vệ.',
    },
    targetPopulation: 'Người lớn và trẻ em cắt cơn co giật cấp, cai rượu, tiền mê. Chống chỉ định ở bệnh nhược cơ.',
    contraindications: [
      'Nhược cơ nặng (Myasthenia Gravis), glaucoma góc đóng cấp tính, suy hô hấp nặng',
      'Hội chứng ngưng thở khi ngủ, suy gan nặng (dễ thúc đẩy hôn mê gan)',
      'Tiền sử mẫn cảm với Benzodiazepin hoặc tá dược propylene glycol/benzyl alcohol',
    ],
    patientVerificationChecklist: [
      'Xác nhận họ tên và nguyên nhân co giật',
      'Đảm bảo thông thoáng đường thở, đặt canul ngáng miệng chống cắn lưỡi',
      'Đo SpO2 và chuẩn bị sẵn oxy mask',
    ],
    tallManLASA: 'DiazePAM (Tránh nhầm với Lorazepam, Clonazepam)',
    highAlertRiskNote: 'Thuốc hướng thần - Nguy cơ suy hô hấp và tụt huyết áp khi tiêm tĩnh mạch',
    standardDosing: 'Người lớn cắt cơn giật: 5 - 10 mg IV chậm (2-5 mg/phút). Có thể nhắc lại sau 10-15 phút.',
    maxDailyDose: 'Không quá 30 mg/24h đối với điều trị cấp cứu.',
    renalAdjustment: 'Thận trọng ở suy thận nặng; giảm liều và theo dõi tri giác.',
    hepaticAdjustment: 'Chống chỉ định ở suy gan nặng / hôn mê gan do thanh thải giảm kéo dài thời gian bán thải.',
    administrationRouteDetails: 'Tiêm IV chậm vào tĩnh mạch lớn hoặc tiêm bắp sâu. Có thể bơm hậu môn ở trẻ nhỏ.',
    compatibleDiluents: ['Ưu tiên tiêm trực tiếp không pha loãng hoặc pha Glucose 5% thể tích lớn dùng ngay'],
    infusionRateLimit: 'Tốc độ tiêm IV tối đa: 5 mg/phút ở người lớn, 1 mg/phút ở trẻ em.',
    routeWarning: 'Dung dịch chứa Propylene glycol dễ gây viêm tĩnh mạch tại chỗ; cấm tiêm vào động mạch.',
    timingAndFrequency: 'Tiêm khi có cơn co giật; có thể nhắc lại sau 15-30 phút nếu cơn chưa dứt.',
    mealRelation: 'Không phụ thuộc bữa ăn.',
    stabilityAfterPrep: 'Rất dễ tủa khi pha với nước muối hay dịch truyền thường; ưu tiên tiêm nguyên chất chậm.',
    clinicalMonitoring: 'Theo dõi nhịp thở, độ thông thoáng đường thở, SpO2 và tri giác sau cắt cơn.',
    adverseReactions: ['Ức chế hô hấp', 'Buồn ngủ lú lẫn', 'Tụt huyết áp', 'Hạ trương lực cơ', 'Viêm tĩnh mạch'],
    antidote: 'Flumazenil (Anexate) 0.2mg IV trong 15 giây, nhắc lại 0.1mg mỗi 60 giây (tối đa 1mg).',
    blackBoxWarning: 'CẢNH BÁO HỘP ĐEN: Tương tác nguy kịch khi phối hợp Opioid, có thể dẫn tới hôn mê sâu và tử vong.',
    ddiWarnings: ['Opioids (Morphin, Fentanyl)', 'Rượu và thuốc kháng Histamin H1 thế hệ 1'],
    pregnancyLactation: 'FDA: Nhóm D (nguy cơ dị tật tim bẩm sinh và hội chứng cai sơ sinh).',
    storageAndHandling: 'Bảo quản < 25°C, tránh ánh sáng. Quản lý theo quy chế thuốc hướng thần TT 18/2026/TT-BYT.',
    atcCode: 'N05BA01',
    bhytCoverage: 'Thanh toán 100% BHYT theo danh mục cấp cứu',
  },
};
