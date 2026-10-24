/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hồ Sơ Dược Thư Lâm Sàng & Quy Chuẩn 5 Đúng: Thuốc Gây Nghiện & Hướng Thần (TT 18/2026) (<=200 LOC)
 */

import { FiveRightsSafetyInfo } from '../../types/medication';

export const CONTROLLED_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  // Morphin hydroclorid
  'med-ctrl-01': {
    targetPopulation: 'Người lớn bị đau cấp tính dữ dội (chấn thương, sau mổ, nhồi máu cơ tim) hoặc đau ung thư giai đoạn muộn. Thận trọng đặc biệt ở người cao tuổi, trẻ em và suy hô hấp.',
    contraindications: [
      'Suy hô hấp cấp tính, hen phế quản nặng',
      'Tắc ruột cơ học hoặc nghi ngờ thủng tạng rỗng',
      'Chấn thương sọ não hoặc tăng áp lực nội sọ',
      'Đang dùng thuốc ức chế MAO (hoặc trong vòng 14 ngày)',
    ],
    patientVerificationChecklist: [
      'Đối soát họ tên, ngày sinh, số giường và mã người bệnh',
      'Đo nhịp thở (SpO2): Hoãn dùng nếu nhịp thở < 10 lần/phút',
      'Kiểm tra tiền sử nghiện chất và dị ứng opioid',
    ],
    tallManLASA: 'Morphin hydroclorid (Tránh nhầm với Hydromorphone)',
    highAlertRiskNote: 'Thuốc gây nghiện bảng A - Nguy cơ ức chế trung tâm hô hấp gây tử vong',
    standardDosing: 'Người lớn: 5-10 mg SC/IM mỗi 4 giờ khi cần. Tiêm IV: 2.5-5 mg pha loãng, tiêm chậm 4-5 phút.',
    maxDailyDose: 'Không quá 100 mg/24h (trừ trường hợp đau mạn tính ung thư dưới giám sát chuyên khoa).',
    renalAdjustment: 'eGFR 10-50 ml/ph: dùng 75% liều; eGFR < 10 ml/ph: dùng 50% liều hoặc kéo dài khoảng cách.',
    hepaticAdjustment: 'Thận trọng cao, giảm 50% liều do độ thanh thải qua gan giảm mạnh, dễ hôn mê gan.',
    administrationRouteDetails: 'Tiêm dưới da (SC), tiêm bắp (IM), hoặc tiêm tĩnh mạch (IV) chậm. Bắt buộc pha loãng trong NaCl 0.9% hoặc Glucose 5%. KHÔNG tiêm tĩnh mạch nhanh.',
    compatibleDiluents: ['NaCl 0.9%', 'Glucose 5%', 'Nước cất pha tiêm'],
    infusionRateLimit: 'Tiêm IV chậm tối thiểu 4-5 phút cho mỗi liều 5mg.',
    routeWarning: 'Cấm tiêm tĩnh mạch nhanh vì nguy cơ co thắt phế quản và ngừng thở đột ngột.',
    timingAndFrequency: 'Mỗi 4 đến 6 giờ khi có cơn đau. Đánh giá lại thang điểm đau VAS/NRS sau 30-60 phút.',
    mealRelation: 'Có thể dùng không phụ thuộc vào bữa ăn.',
    stabilityAfterPrep: 'Sử dụng ngay sau khi bẻ ống. Dung dịch pha loãng bảo quản tối đa 24h ở 2-8°C.',
    clinicalMonitoring: 'Theo dõi liên tục nhịp thở, độ bão hòa oxy SpO2, tri giác (Glasgow) và huyết áp trong 1 giờ đầu sau tiêm.',
    adverseReactions: ['Ức chế hô hấp', 'Tụt huyết áp tư thế', 'Táo bón nặng', 'Buồn nôn/nôn', 'Bí tiểu cấp'],
    antidote: 'Naloxone hydroclorid 0.4mg - 2mg tiêm tĩnh mạch, nhắc lại mỗi 2-3 phút nếu cần.',
    blackBoxWarning: 'CẢNH BÁO HỘP ĐEN: Nguy cơ phụ thuộc thuốc, lạm dụng và ức chế hô hấp đe dọa tính mạng.',
    ddiWarnings: ['Phối hợp Benzodiazepin làm tăng nguy cơ an thần sâu và tử vong', 'Rượu và thuốc ức chế TKTW'],
    pregnancyLactation: 'FDA thai kỳ: Nhóm C (Nhóm D nếu dùng kéo dài sát ngày sinh). Bài tiết qua sữa mẹ.',
    storageAndHandling: 'Bảo quản nhiệt độ < 30°C trong tủ thuốc gây nghiện có khóa kép. Bắt buộc thu hồi vỏ ống rỗng và ký sổ theo TT 18/2026/TT-BYT.',
  },

  // Fentanyl
  'med-ctrl-02': {
    targetPopulation: 'Người lớn và trẻ em cần giảm đau mạnh trong phẫu thuật, gây mê hồi sức, bệnh nhân thở máy tại ICU.',
    contraindications: [
      'Bệnh nhân không có hỗ trợ hô hấp/thông khí nhân tạo (trừ liều giảm đau chuyên khoa)',
      'Nhược cơ nặng',
      'Mẫn cảm với các dẫn xuất morphinomimetic',
    ],
    patientVerificationChecklist: [
      'Xác thực người bệnh và cam kết thủ thuật',
      'Sẵn sàng bóng Ambu, máy thở và thuốc đối kháng Naloxone tại giường',
      'Đang có monitor theo dõi ECG và SpO2 liên tục',
    ],
    tallManLASA: 'FentanYL (Tránh nhầm với Sufentanil, Alfentanil)',
    highAlertRiskNote: 'Hoạt lực mạnh gấp 80-100 lần morphin. Nguy cơ co cứng lồng ngực (Wooden Chest Syndrome).',
    standardDosing: 'Giảm đau phẫu thuật: 1 - 2 mcg/kg IV chậm. Duy trì thở máy: 1 - 3 mcg/kg/h truyền qua bơm tiêm điện.',
    maxDailyDose: 'Chuẩn độ theo đáp ứng lâm sàng của chuyên gia GMHS.',
    renalAdjustment: 'eGFR < 50 ml/ph: Giảm 25% liều duy trì do tích lũy chất chuyển hóa.',
    hepaticAdjustment: 'Giảm liều và kéo dài khoảng cách tiêm ở bệnh nhân xơ gan nặng.',
    administrationRouteDetails: 'Tiêm hoặc truyền tĩnh mạch liên tục qua bơm tiêm điện chuyên dụng (Syringe Pump).',
    compatibleDiluents: ['NaCl 0.9%', 'Glucose 5%'],
    infusionRateLimit: 'Tiêm IV chậm trong ít nhất 1-2 phút; tiêm nhanh gây co cứng cơ hô hấp.',
    routeWarning: 'Cấm tiêm IV đẩy nhanh; nguy cơ co cứng cơ hoành và cơ thành ngực khiến không bóp bóng được.',
    timingAndFrequency: 'Truyền liên tục hoặc tiêm nhắc mỗi 30-60 phút tùy đáp ứng huyết động và an thần.',
    mealRelation: 'Bệnh nhân nhịn ăn trước phẫu thuật.',
    stabilityAfterPrep: 'Dung dịch pha trong bơm tiêm điện ổn định trong 24 giờ ở nhiệt độ phòng.',
    clinicalMonitoring: 'Theo dõi liên tục: ECG, SpO2, EtCO2, huyết áp động mạch xâm lấn, mức độ an thần RASS.',
    adverseReactions: ['Co cứng thành ngực', 'Ngừng thở', 'Nhịp tim chậm', 'Tụt huyết áp', 'Cứng cơ'],
    antidote: 'Naloxone hydroclorid 0.1 - 0.2 mg IV nhắc lại; có thể cần giãn cơ nếu có co cứng lồng ngực.',
    blackBoxWarning: 'CẢNH BÁO HỘP ĐEN: Chỉ sử dụng ở môi trường hồi sức có đầy đủ phương tiện kiểm soát đường thở.',
    ddiWarnings: ['Ức chế CYP3A4 (Clarithromycin, Ketoconazole) làm tăng nồng độ Fentanyl', 'Thuốc an thần gây mê'],
    pregnancyLactation: 'FDA thai kỳ: Nhóm C. Không khuyến cáo trong lúc chuyển dạ tự nhiên trừ mổ bắt con.',
    storageAndHandling: 'Tủ gây nghiện khóa 2 lớp. Đếm số lượng đầu ca và cuối ca trực (TT 18/2026/TT-BYT).',
  },

  // Diazepam
  'med-em-07': {
    targetPopulation: 'Người lớn và trẻ em cắt cơn co giật (động kinh, sốt cao co giật), hội chứng cai rượu cấp, tiền mê.',
    contraindications: [
      'Nhược cơ (Myasthenia Gravis)',
      'Glaucoma góc đóng cấp tính',
      'Suy hô hấp mạn tính nặng',
      'Hội chứng ngưng thở khi ngủ',
    ],
    patientVerificationChecklist: [
      'Xác nhận họ tên và nguyên nhân co giật',
      'Đảm bảo thông thoáng đường thở, đặt canul ngáng miệng chống cắn lưỡi',
      'Đo SpO2 và chuẩn bị sẵn oxy mask',
    ],
    tallManLASA: 'DiazePAM (Tránh nhầm với Lorazepam)',
    highAlertRiskNote: 'Thuốc hướng thần - Nguy cơ suy hô hấp khi tiêm tĩnh mạch',
    standardDosing: 'Người lớn cắt cơn giật: 5 - 10 mg IV chậm (tốc độ không quá 2-5 mg/phút). Có thể lặp lại sau 10-15 phút.',
    maxDailyDose: 'Không quá 30 mg/24h đối với điều trị cấp cứu.',
    renalAdjustment: 'Không cần chỉnh liều ở suy thận nhẹ/vừa; suy thận nặng dùng liều thấp hơn.',
    hepaticAdjustment: 'Chống chỉ định ở bệnh não gan / suy gan nặng do tăng nguy cơ hôn mê gan.',
    administrationRouteDetails: 'Tiêm tĩnh mạch chậm vào tĩnh mạch lớn hoặc tiêm bắp sâu. Có thể thụt hậu môn ở trẻ nhỏ.',
    compatibleDiluents: ['Nên tiêm trực tiếp không pha loãng hoặc pha trong Glucose 5% thể tích lớn dùng ngay'],
    infusionRateLimit: 'Tốc độ tiêm IV tối đa: 5 mg/phút ở người lớn, 1 mg/phút ở trẻ em.',
    routeWarning: 'Dung dịch chứa Propylene glycol có thể gây viêm tĩnh mạch; cấm tiêm vào động mạch.',
    timingAndFrequency: 'Tiêm khi có cơn co giật; có thể nhắc lại sau 15-30 phút nếu cơn chưa dứt.',
    mealRelation: 'Không phụ thuộc bữa ăn.',
    stabilityAfterPrep: 'Dung dịch rất dễ bị tủa nếu pha với dịch truyền thông thường; ưu tiên tiêm tĩnh mạch chậm nguyên chất.',
    clinicalMonitoring: 'Theo dõi nhịp thở, độ thông thoáng đường thở, SpO2 và tri giác sau cắt cơn.',
    adverseReactions: ['Ức chế hô hấp', 'Buồn ngủ lú lẫn', 'Tụt huyết áp', 'Hạ trương lực cơ', 'Viêm tắc tĩnh mạch'],
    antidote: 'Flumazenil (Anexate) 0.2mg IV trong 15 giây, nhắc lại liều 0.1mg mỗi 60 giây (tối đa 1mg).',
    blackBoxWarning: 'CẢNH BÁO HỘP ĐEN: Tương tác nguy kịch khi phối hợp Opioid, có thể dẫn tới hôn mê sâu và tử vong.',
    ddiWarnings: ['Opioids (Morphin, Fentanyl)', 'Rượu và thuốc kháng Histamin H1 thế hệ 1'],
    pregnancyLactation: 'FDA thai kỳ: Nhóm D (nguy cơ dị tật thai nhi, hội chứng cai sơ sinh).',
    storageAndHandling: 'Bảo quản nhiệt độ < 25°C, tránh ánh sáng. Quản lý theo quy chế thuốc hướng thần TT 18/2026/TT-BYT.',
  },
};
