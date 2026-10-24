/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dược Thư Lâm Sàng & Thành Phần Thuốc: Cấp Cứu Phản Vệ & Vận Mạch Hồi Sức (<=200 LOC)
 */

import { FiveRightsSafetyInfo } from '../../types/medication';

export const EMERGENCY_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  // Adrenalin (Epinephrine) 1mg/1ml
  'med-em-01': {
    officialSource: {
      documentName: 'Dược thư Quốc gia Việt Nam 2022 & Thông tư 51/2017/TT-BYT Phác đồ phản vệ',
      registrationNumber: 'VD-22874-15',
      manufacturer: 'Công ty Cổ phần Dược phẩm Vĩnh Phúc (Vinphaco)',
      standardPharmacopeia: 'Dược điển Việt Nam V (DĐVN V)',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
    },
    composition: {
      activeIngredients: [{ innName: 'Adrenalin (Epinephrine)', chemicalSalt: 'Epinephrin bitartrat', strength: '1 mg / 1 ml (tương đương 1:1000)' }],
      excipients: [
        { name: 'Natri metabisulfit', role: 'Chất chống oxy hóa', safetyNotice: 'Có thể gây dị ứng nhưng KHÔNG được trì hoãn tiêm cấp cứu sốc phản vệ' },
        { name: 'Natri clorid', role: 'Chất làm đẳng trương hóa' },
        { name: 'Acid hydrocloric 10%', role: 'Chất điều chỉnh pH (pH 2.2 - 3.5)' },
        { name: 'Nước cất pha tiêm', role: 'Dung môi vừa đủ 1 ml' },
      ],
      dosageForm: 'Dung dịch tiêm bắp / tiêm truyền tĩnh mạch',
      appearance: 'Dung dịch trong suốt, không màu (loại bỏ nếu dung dịch ngả hồng hoặc nâu)',
      phAndOsmolarity: 'pH: 2.2 - 3.5',
      packagingSpec: 'Hộp 10 ống thủy tinh màu nâu bảo quản tránh ánh sáng 1ml',
      pharmacopeiaStandard: 'Dược điển Việt Nam V (DĐVN V) / USP',
    },
    indications: [
      'Cấp cứu sốc phản vệ từ độ II trở lên (Thông tư 51/2017/TT-BYT) do mọi nguyên nhân (thuốc, thức ăn, côn trùng đốt).',
      'Cấp cứu ngừng tuần hoàn, hồi sinh tim phổi nâng cao (ACLS/PALS).',
      'Cơn co thắt thanh quản/khí phế quản ác tính đe dọa tắc nghẽn đường thở.',
      'Cầm máu niêm mạc tại chỗ trong nội soi hoặc tai mũi họng.',
    ],
    pharmacologyMechanism: 'Đồng vận mạnh mẽ thụ thể alpha-1 (co mạch nâng huyết áp), beta-1 (tăng nhịp tim và sức co bóp cơ tim) và beta-2 (giãn phế quản mạnh mẽ, ức chế phóng thích hóa ứng động dị ứng từ dưỡng bào).',
    activeIngredients: ['Adrenalin (Epinephrine) tartrat 1mg/1ml'],
    allergyProfile: {
      allergyClass: 'Catecholamine / Thuốc cường giao cảm nội sinh',
      activeAllergens: ['Epinephrine (hoạt chất nội sinh, dị ứng thực sự cực kỳ hiếm gặp)'],
      excipientAllergens: ['Natri bisulfit / Metabisulfit (chất chống oxy hóa có thể gây phản ứng dị ứng nhưng KHÔNG được trì hoãn tiêm cấp cứu)'],
      crossReactivities: ['Noradrenaline', 'Isoprenaline', 'Dopamine'],
      contraindicatedAllergies: [
        'KHÔNG CÓ CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI trong cấp cứu sốc phản vệ và ngừng tuần hoàn.',
      ],
      commonAllergySigns: [
        'Run đầu chi, tim đập nhanh hồi hộp, vã mồ hôi, nhợt nhạt (thường là tác dụng dược lý giao cảm, không phải dị ứng)',
        'Hiếm gặp phản ứng quá mẫn với tá dược bisulfite (nổi mẩn đỏ)',
      ],
      emergencyManagement: 'Trong sốc phản vệ, Adrenalin là THUỐC CỨU MẠNG DUY NHẤT. Ngay cả khi nghi ngờ dị ứng tá dược, VẪN BẮT BUỘC TIÊM BẮP THEO PHÁC ĐỒ TT 51/2017.',
    },
    targetPopulation: 'Bệnh nhân sốc phản vệ mọi lứa tuổi, ngừng tuần hoàn, co thắt phế quản ác tính.',
    contraindications: [
      'Không có chống chỉ định trong cấp cứu phản vệ đe dọa tính mạng',
      'Thận trọng ngoài phản vệ: Bệnh mạch vành nặng, cường giáp, glaucom góc đóng',
    ],
    patientVerificationChecklist: [
      'Nhận diện phản vệ: Mày đay, phù mạch, khó thở, tụt HA, đau bụng nôn',
      'Ước tính nhanh cân nặng để chọn liều tiêm bắp theo TT 51',
      'KHÔNG chần chừ tìm ven tĩnh mạch; tiêm bắp đùi ngay lập tức',
    ],
    tallManLASA: 'EPINEPHrine (Adrenalin) - Tránh nhầm với NorEPINEPHrine',
    highAlertRiskNote: 'Thuốc cấp cứu tối khẩn cấp số 1 - Chậm trễ tiêm bắp làm tăng tỷ lệ tử vong',
    standardDosing: 'Người lớn: 0.5 - 1 ống (1/2-1mg) tiêm bắp mặt trước ngoài đùi. Trẻ em: 0.01 mg/kg. Nhắc lại mỗi 3-5 phút nếu HA chưa lên.',
    maxDailyDose: 'Không giới hạn trong cấp cứu phản vệ và ngừng tim.',
    renalAdjustment: 'Không cần chỉnh liều trong cấp cứu.',
    hepaticAdjustment: 'Không cần chỉnh liều trong cấp cứu.',
    administrationRouteDetails: 'Tiêm bắp (IM) mặt trước ngoài đùi là đường đầu tay bắt buộc. Tiêm IV chỉ khi có bác sĩ chuyên khoa và monitor.',
    compatibleDiluents: ['NaCl 0.9%', 'Glucose 5%'],
    infusionRateLimit: 'Truyền IV: Pha 2 ống trong 250ml NaCl 0.9%, truyền 0.1 - 0.5 mcg/kg/phút.',
    routeWarning: 'CẤM TIÊM IV NGUYÊN CHẤT NGOÀI NGỪNG TUẦN HOÀN (Nguy cơ rung thất, xuất huyết não do tăng HA kịch phát).',
    timingAndFrequency: 'Tiêm bắp ngay lập tức khi phát hiện phản vệ độ II. Lặp lại mỗi 3-5 phút.',
    mealRelation: 'Không liên quan bữa ăn.',
    stabilityAfterPrep: 'Dung dịch pha truyền bảo quản tối đa 12h, tránh ánh sáng.',
    clinicalMonitoring: 'Theo dõi mạch, HA, nhịp thở, SpO2 mỗi 3-5 phút trong 1h đầu và mỗi 1-2h trong 24h.',
    adverseReactions: ['Loạn nhịp tim', 'Tăng HA kịch phát', 'Đau thắt ngực', 'Run tay', 'Lo âu'],
    antidote: 'Thuốc chẹn alpha (Phentolamin) hoặc Nitrate nếu tăng huyết áp kịch phát đe dọa vỡ mạch.',
    blackBoxWarning: 'HỘP ĐEN PHẢN VỆ: Tiêm bắp mặt trước ngoài đùi là can thiệp cứu mạng duy nhất giảm tử vong.',
    ddiWarnings: ['Thuốc chẹn beta làm giảm đáp ứng Adrenalin (cần dùng Glucagon hỗ trợ)'],
    pregnancyLactation: 'Được phép dùng trong cấp cứu sốc phản vệ ở phụ nữ có thai (ưu tiên cứu mẹ).',
    storageAndHandling: 'Hộp chống sốc phản vệ và tủ trực cấp cứu. Bảo quản < 25°C, đổi mới nếu dịch đổi màu hồng/nâu.',
    atcCode: 'C01CA24',
    bhytCoverage: 'Thanh toán 100% BHYT cấp cứu sốc',
  },

  // Noradrenalin 4mg/2ml
  'med-em-02': {
    officialSource: {
      documentName: 'Dược thư Quốc gia Việt Nam 2022 (Chuyên luận Norepinephrin, trang 1012-1015)',
      registrationNumber: 'VN-21890-19',
      manufacturer: 'Laboratoire Aguettant (Cộng hòa Pháp) / Vinphaco',
      standardPharmacopeia: 'Dược điển Việt Nam V / Dược điển Mỹ (USP)',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
    },
    composition: {
      activeIngredients: [{ innName: 'Noradrenalin (Norepinephrine)', chemicalSalt: 'Norepinephrin bitartrat', strength: '4 mg / 2 ml (2 mg/ml)' }],
      excipients: [
        { name: 'Natri metabisulfit', role: 'Chất chống oxy hóa' },
        { name: 'Natri clorid', role: 'Chất làm đẳng trương hóa' },
        { name: 'Nước cất pha tiêm', role: 'Dung môi vừa đủ 2 ml' },
      ],
      dosageForm: 'Dung dịch đậm đặc pha tiêm truyền tĩnh mạch',
      appearance: 'Dung dịch trong suốt, không màu',
      phAndOsmolarity: 'pH: 3.0 - 4.5',
      packagingSpec: 'Hộp 10 ống thủy tinh 2ml',
      pharmacopeiaStandard: 'Dược điển Châu Âu (EP) / USP',
    },
    indications: [
      'Sốc nhiễm khuẩn (theo hướng dẫn SSC - Surviving Sepsis Campaign) sau khi đã bù đủ dịch thể tích.',
      'Sốc tim và sốc mất trương lực mạch (sốc thần kinh) có tụt huyết áp nặng.',
      'Duy trì huyết áp động mạch trung bình (MAP >= 65 mmHg) trong phẫu thuật lớn hoặc hồi sức ICU.',
    ],
    pharmacologyMechanism: 'Chủ vận rất mạnh lên thụ thể alpha-1 (co mạch ngoại vi toàn thân mạnh mẽ), tác dụng beta-1 yếu hơn (tăng nhẹ sức co bóp cơ tim), hầu như không kích thích beta-2.',
    activeIngredients: ['Noradrenalin (Norepinephrine) bitartrat 4mg / 2ml'],
    allergyProfile: {
      allergyClass: 'Catecholamine co mạch',
      activeAllergens: ['Norepinephrine (chất dẫn truyền thần kinh nội sinh)'],
      excipientAllergens: ['Natri metabisulfit', 'Natri clorid'],
      crossReactivities: ['Adrenaline', 'Dopamine'],
      contraindicatedAllergies: [
        'Tiền sử dị ứng nặng với tá dược Natri metabisulfit (thận trọng cân nhắc nguy cơ/lợi ích tử vong do sốc)',
      ],
      commonAllergySigns: [
        'Rất hiếm gặp dị ứng thật sự; chủ yếu là biểu hiện quá liều co mạch (tím tái đầu chi, hoại tử mô tại chỗ)',
      ],
      emergencyManagement: 'Nếu thoát mạch gây thiếu máu hoại tử mô: Tiêm thấm tại chỗ Phentolamin 5-10mg pha loãng ngay lập tức.',
    },
    targetPopulation: 'Bệnh nhân sốc giãn mạch tụt huyết áp nặng tại phòng mổ hoặc hồi sức cấp cứu ICU.',
    contraindications: [
      'Tụt huyết áp do giảm thể tích máu chưa được bù dịch đầy đủ (trừ tình thế tạm thời)',
      'Huyết khối mạch ngoại vi hoặc mạc treo ruột',
    ],
    patientVerificationChecklist: [
      'Xác nhận bệnh nhân đã bù dịch tối thiểu 30 ml/kg dung dịch tinh thể',
      'Đã đặt Catheter tĩnh mạch trung tâm (CVC) hoặc đường truyền tĩnh mạch lớn',
      'Monitor đo huyết áp xâm lấn IBP hoặc đo tự động mỗi 3-5 phút',
    ],
    tallManLASA: 'NorEPINEPHrine - Tránh nhầm với EPINEPHrine',
    highAlertRiskNote: 'Vận mạch co mạch cực mạnh - Thoát mạch gây hoại tử ngón chi và mô mềm nặng nề',
    standardDosing: 'Khởi đầu 0.05 - 0.1 mcg/kg/phút qua bơm tiêm điện. Chuẩn độ mỗi 2-5 phút đạt MAP >= 65 mmHg.',
    maxDailyDose: 'Chuẩn độ theo đáp ứng huyết động MAP >= 65 mmHg.',
    renalAdjustment: 'Không cần chỉnh liều; mục tiêu duy trì MAP >= 65 mmHg để tưới máu thận.',
    hepaticAdjustment: 'Không cần chỉnh liều.',
    administrationRouteDetails: 'Bắt buộc truyền tĩnh mạch liên tục qua bơm tiêm điện vào TĨNH MẠCH TRUNG TÂM (CVC).',
    compatibleDiluents: ['Glucose 5% (ưu tiên chống oxy hóa)', 'NaCl 0.9%'],
    infusionRateLimit: 'Truyền bơm tiêm điện tự động. CẤM tiêm tĩnh mạch trực tiếp hoặc tiêm đẩy.',
    routeWarning: 'CẤM TIÊM BẮP HOẶC DƯỚI DA; THOÁT MẠCH GÂY HOẠI TỬ MÔ NẶNG NỀ.',
    timingAndFrequency: 'Duy trì liên tục 24/24 qua bơm tiêm điện; giảm liều từng nấc khi huyết động ổn định.',
    mealRelation: 'Bệnh nhân hồi sức ICU nhịn ăn hoặc nuôi dưỡng qua sonde.',
    stabilityAfterPrep: 'Dung dịch trong bơm tiêm điện dùng trong 24 giờ.',
    clinicalMonitoring: 'Theo dõi MAP, nhịp tim, tưới máu đầu chi (CRT), độ bão hòa ScvO2 và lượng nước tiểu.',
    adverseReactions: ['Thiếu máu ngoại vi', 'Loạn nhịp tim', 'Tăng huyết áp quá mức', 'Thiếu máu ruột'],
    antidote: 'Phentolamin mesylate 5-10mg pha trong 10ml NaCl 0.9% tiêm thấm tại chỗ nếu thoát mạch.',
    blackBoxWarning: 'CẢNH BÁO THOÁT MẠCH: Kiểm tra vị trí truyền tĩnh mạch mỗi 1 giờ để tránh hoại tử chi.',
    ddiWarnings: ['IMAO và thuốc chống trầm cảm 3 vòng gây tăng co mạch kịch phát nguy hiểm'],
    pregnancyLactation: 'FDA: Nhóm C. Dùng khi lợi ích cứu mẹ vượt trội nguy cơ co mạch tử cung.',
    storageAndHandling: 'Bảo quản 15-30°C, tránh ánh sáng. Không dùng dung dịch đổi màu sẫm.',
    atcCode: 'C01CA03',
    bhytCoverage: 'Thanh toán 100% BHYT khoa hồi sức tích cực',
  },
};
