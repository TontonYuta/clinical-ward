/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hồ Sơ Dược Thư Lâm Sàng & Quy Chuẩn 5 Đúng: Cấp Cứu, Vận Mạch & Điện Giải Nguy Cơ Cao (<=200 LOC)
 */

import { FiveRightsSafetyInfo } from '../../types/medication';

export const EMERGENCY_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  // Adrenalin
  'med-em-01': {
    targetPopulation: 'Bệnh nhân sốc phản vệ mọi lứa tuổi (từ độ II trở lên theo Thông tư 51/2017/TT-BYT), ngừng tuần hoàn, co thắt phế quản ác tính.',
    contraindications: [
      'Không có chống chỉ định tuyệt đối trong cấp cứu sốc phản vệ đe dọa tính mạng',
      'Thận trọng trong bệnh tim thiếu máu cục bộ, cường giáp, tăng huyết áp nặng (nếu ngoài phản vệ)',
    ],
    patientVerificationChecklist: [
      'Nhận diện phản vệ ngay khi có: Mày đay, phù mạch, khó thở, tụt huyết áp, nôn/đau bụng',
      'Ước tính nhanh cân nặng để chọn liều tiêm bắp theo Thông tư 51',
      'KHÔNG chần chừ tìm tĩnh mạch; tiêm bắp mặt trước ngoài đùi ngay lập tức',
    ],
    tallManLASA: 'EPINEPHrine (Adrenalin) - Tránh nhầm với NorEPINEPHrine',
    highAlertRiskNote: 'Thuốc cấp cứu tối khẩn cấp số 1 - Chậm trễ tiêm bắp có thể dẫn đến tử vong nhanh chóng',
    standardDosing: 'Người lớn: 0.5 - 1 ống (1/2 đến 1mg) tiêm bắp sâu. Trẻ em: 0.01 mg/kg tiêm bắp (tối đa 0.3 - 0.5 mg). Nhắc lại mỗi 3-5 phút nếu huyết áp chưa cải thiện.',
    maxDailyDose: 'Không giới hạn trong hồi sinh tim phổi cấp cứu ngừng tuần hoàn.',
    renalAdjustment: 'Không cần điều chỉnh liều trong cấp cứu sốc phản vệ.',
    hepaticAdjustment: 'Không cần điều chỉnh liều trong cấp cứu sốc phản vệ.',
    administrationRouteDetails: 'Đường tiêm bắp (IM) vào mặt trước ngoài đùi là đường dùng đầu tay bắt buộc. Chỉ tiêm tĩnh mạch khi đã có đường truyền tĩnh mạch và huyết động không đáp ứng sau tiêm bắp 3 lần.',
    compatibleDiluents: ['NaCl 0.9%', 'Glucose 5%'],
    infusionRateLimit: 'Truyền tĩnh mạch cấp cứu: Pha 2 ống vào 250ml NaCl 0.9%, truyền khởi đầu 0.1 - 0.5 mcg/kg/phút.',
    routeWarning: 'CẤM TIÊM TĨNH MẠCH NGUYÊN CHẤT NGOÀI TÌNH HUỐNG NGỪNG TUẦN HOÀN (Nguy cơ loạn nhịp thất chết người).',
    timingAndFrequency: 'Tiêm bắp ngay lập tức khi chẩn đoán phản vệ độ II. Nhắc lại mỗi 3 - 5 phút nếu triệu chứng không thuyên giảm.',
    mealRelation: 'Cấp cứu khẩn cấp, không liên quan bữa ăn.',
    stabilityAfterPrep: 'Dung dịch đã pha truyền bảo quản tối đa 12 giờ ở nhiệt độ phòng, tránh ánh sáng.',
    clinicalMonitoring: 'Theo dõi mạch, huyết áp, nhịp thở, SpO2 mỗi 3-5 phút trong 1 giờ đầu và mỗi 1-2 giờ trong 24 giờ tiếp theo.',
    adverseReactions: ['Loạn nhịp tim', 'Tăng huyết áp kịch phát', 'Cơn đau thắt ngực', 'Run tay', 'Lo âu hồi hộp'],
    antidote: 'Thuốc chẹn alpha (Phentolamin) hoặc Nitrate nếu có biến chứng tăng huyết áp kịch phát đe dọa vỡ mạch.',
    blackBoxWarning: 'HỘP ĐEN PHẢN VỆ: Adrenalin tiêm bắp mặt trước ngoài đùi là can thiệp cứu mạng duy nhất được chứng minh giảm tử vong.',
    ddiWarnings: ['Thuốc chẹn beta giao cảm làm giảm đáp ứng với Adrenalin (cần dùng Glucagon hỗ trợ)'],
    pregnancyLactation: 'Được phép dùng trong phản vệ khẩn cấp ở phụ nữ có thai (ưu tiên cứu mẹ).',
    storageAndHandling: 'Hộp chống sốc phản vệ và tủ trực cấp cứu. Bảo quản < 25°C, tránh ánh sáng. Đổi mới khi dung dịch đổi màu hồng/nâu.',
  },

  // Noradrenalin
  'med-em-02': {
    targetPopulation: 'Bệnh nhân sốc nhiễm khuẩn (Surviving Sepsis Campaign), sốc tim, tụt huyết áp nặng kháng dịch.',
    contraindications: [
      'Tụt huyết áp do giảm thể tích tuần hoàn chưa được bù đủ dịch (trừ biện pháp tạm thời cứu mạng)',
      'Huyết khối mạch mạc treo hoặc mạch ngoại vi',
    ],
    patientVerificationChecklist: [
      'Xác nhận bệnh nhân đã được bù đủ dịch tối thiểu 30 ml/kg tinh thể',
      'Đã đặt catheter tĩnh mạch trung tâm (CVC) hoặc đường truyền tĩnh mạch lớn an toàn',
      'Có monitor đo huyết áp liên tục (tốt nhất là huyết áp động mạch xâm lấn IBP)',
    ],
    tallManLASA: 'NorEPINEPHrine - Tránh nhầm với EPINEPHrine',
    highAlertRiskNote: 'Vận mạch co mạch mạnh - Nguy cơ hoại tử mô nếu thoát mạch',
    standardDosing: 'Khởi đầu 0.05 - 0.1 mcg/kg/phút qua bơm tiêm điện. Chuẩn độ mỗi 2-5 phút để đạt huyết áp động mạch trung bình MAP >= 65 mmHg.',
    maxDailyDose: 'Chuẩn độ theo mục tiêu MAP >= 65 mmHg dưới giám sát ICU.',
    renalAdjustment: 'Không cần chỉnh liều; cần duy trì MAP >= 65 mmHg để bảo tồn tưới máu thận.',
    hepaticAdjustment: 'Không cần chỉnh liều.',
    administrationRouteDetails: 'Bắt buộc truyền tĩnh mạch liên tục qua bơm tiêm điện vào TĨNH MẠCH TRUNG TÂM (CVC). Chỉ dùng tạm tĩnh mạch ngoại biên lớn trong lúc chờ đặt CVC.',
    compatibleDiluents: ['Glucose 5% (ưu tiên để chống oxy hóa)', 'NaCl 0.9%'],
    infusionRateLimit: 'Truyền liên tục qua bơm tiêm điện tự động (Syringe Pump). Cấm tiêm tĩnh mạch trực tiếp.',
    routeWarning: 'CẤM TIÊM BẮP HOẶC DƯỚI DA; THOÁT MẠCH TẠI CHỖ GÂY HOẠI TỬ MÔ NẶNG NỀ (Cần Phentolamin giải độc tại chỗ).',
    timingAndFrequency: 'Duy trì liên tục 24/24 qua bơm tiêm điện; giảm liều từng bước (weaning) khi huyết động ổn định.',
    mealRelation: 'Bệnh nhân hồi sức ICU.',
    stabilityAfterPrep: 'Ống pha trong bơm tiêm điện có giá trị sử dụng trong vòng 24 giờ.',
    clinicalMonitoring: 'Theo dõi MAP mỗi 5-15 phút, tưới máu ngoại vi (nổi vân tím, thời gian đổ đầy mao mạch CRT), lượng nước tiểu.',
    adverseReactions: ['Thiếu máu cục bộ chi', 'Loạn nhịp tim', 'Tăng huyết áp quá mức', 'Thiếu máu mạc treo'],
    antidote: 'Phentolamin mesylate 5-10mg pha trong 10ml NaCl 0.9% tiêm thấm tại chỗ nếu xảy ra thoát mạch ngoại vi.',
    blackBoxWarning: 'CẢNH BÁO THOÁT MẠCH: Kiểm tra vị trí truyền tĩnh mạch mỗi 1 giờ để phát hiện sớm dấu hiệu thoát mạch.',
    ddiWarnings: ['Thuốc ức chế MAO và thuốc chống trầm cảm 3 vòng làm tăng tác dụng co mạch kịch phát'],
    pregnancyLactation: 'FDA thai kỳ: Nhóm C. Dùng khi lợi ích cứu mẹ vượt trội nguy cơ giảm tưới máu tử cung-rau thai.',
    storageAndHandling: 'Bảo quản 15-30°C, tránh ánh sáng. Không sử dụng nếu dung dịch có cặn hoặc biến màu.',
  },

  // Kali clorid 10% (KCl)
  'med-em-09': {
    targetPopulation: 'Người lớn và trẻ em hạ kali máu nặng (< 3.0 mmol/L) hoặc có biểu hiện loạn nhịp trên điện tâm đồ.',
    contraindications: [
      'Tăng kali máu (> 5.0 mmol/L)',
      'Suy thận vô niệu hoặc thiểu niệu nặng chưa được lọc máu',
      'Bệnh Addison không được kiểm soát',
    ],
    patientVerificationChecklist: [
      'Xác nhận kết quả điện giải đồ mới nhất trong vòng 2-4 giờ',
      'Đo điện tâm đồ (ECG) phát hiện sóng T dẹt, sóng U hoặc loạn nhịp',
      'Kiểm tra thể tích nước tiểu (> 0.5 ml/kg/h)',
    ],
    tallManLASA: 'Potassium Chloride (KCL) 10%',
    highAlertRiskNote: 'THUỐC CẢNH BÁO CAO ĐỎ (ISMP) - TIÊM NHẦM TĨNH MẠCH TRỰC TIẾP GÂY NGỪNG TIM TỬ VONG NGAY LẬP TỨC',
    standardDosing: 'Pha loãng truyền tĩnh mạch: 10 - 20 mEq (1-2 ống 10%) trong 500ml NaCl 0.9% hoặc Ringer Lactat.',
    maxDailyDose: 'Không quá 200 mEq/24h (tối đa 2-3 mmol/kg/24h).',
    renalAdjustment: 'Giảm 50% tốc độ truyền ở suy thận; theo dõi kali máu sát sao mỗi 2 giờ.',
    hepaticAdjustment: 'Không cần chỉnh liều đặc biệt.',
    administrationRouteDetails: 'BẮT BUỘC PHA LOÃNG TRƯỚC KHI TRUYỀN. Nồng độ tối đa qua ngoại vi: 40 mmol/L (3g KCl trong 1 lít dịch). Qua CVC: tối đa 80 mmol/L.',
    compatibleDiluents: ['NaCl 0.9%', 'Ringer Lactat (TRÁNH dùng Glucose ban đầu vì kích thích Insulin làm hạ kali máu thêm)'],
    infusionRateLimit: 'Tốc độ tối đa qua ngoại vi: KHÔNG QUÁ 10 - 20 mmol/giờ (tương đương 1-1.5g KCl/giờ).',
    routeWarning: 'TUYỆT ĐỐI CẤM TIÊM TĨNH MẠCH TRỰC TIẾP HOẶC TIÊM BẮP DƯỚI MỌI HÌNH THỨC.',
    timingAndFrequency: 'Truyền chậm trong 4 đến 8 giờ. Xét nghiệm lại kali máu sau khi kết thúc truyền 1-2 giờ.',
    mealRelation: 'Nếu dùng đường uống: uống cùng hoặc ngay sau bữa ăn với nhiều nước.',
    stabilityAfterPrep: 'Lắc đều chai dịch truyền sau khi bơm KCl vào để tránh đọng nồng độ cao ở đáy chai.',
    clinicalMonitoring: 'Theo dõi điện tâm đồ liên tục trên monitor (sóng T, khoảng PR, nhịp tim), xét nghiệm điện giải máu.',
    adverseReactions: ['Loạn nhịp tim tử vong', 'Viêm đau kích ứng tĩnh mạch ngoại vi', 'Tăng kali máu kịch phát'],
    antidote: 'Cấp cứu tăng kali máu: Calci clorid 10% 10ml IV (ổn định màng cơ tim) + Glucose 20% 200ml + 10 UI Insulin thường.',
    blackBoxWarning: 'CẢNH BÁO TỬ VONG: Độc chất gây ngừng tim nếu tiêm nhanh. Ống tiêm phải có nhãn cảnh báo đỏ riêng biệt.',
    ddiWarnings: ['Thuốc lợi tiểu giữ kali (Spironolactone)', 'Thuốc ức chế men chuyển (Enalapril, Captopril)'],
    pregnancyLactation: 'FDA thai kỳ: Nhóm C. Nồng độ sinh lý cần thiết cho thai nhi.',
    storageAndHandling: 'Bảo quản biệt lập trong hộp dán nhãn nguy cơ cao màu đỏ "CHÚ Ý: PHA LOÃNG TRƯỚC KHI DÙNG".',
  },

  // Ceftriaxone 1g
  'med-ab-01': {
    targetPopulation: 'Nhiễm khuẩn nặng vi khuẩn nhạy cảm: Viêm phổi cộng đồng/bệnh viện, viêm màng não mủ, nhiễm khuẩn huyết, nhiễm khuẩn tiết niệu-sinh dục.',
    contraindications: [
      'Dị ứng kháng sinh nhóm Cephalosporin hoặc tiền sử phản vệ nặng với Penicillin',
      'Trẻ sơ sinh < 28 ngày tuổi bị vàng da tăng bilirubin tự do',
      'PHỐI HỢP DÙNG CHUNG ĐƯỜNG TRUYỀN VỚI CÁC DUNG DỊCH CHỨA CANXI (như Ringer Lactat)',
    ],
    patientVerificationChecklist: [
      'Xác nhận tiền sử dị ứng thuốc và kháng sinh',
      'Đã lấy mẫu bệnh phẩm nuôi cấy vi sinh (cấy máu/đờm) TRƯỚC KHI tiêm liều đầu tiên',
      'Kiểm tra đường truyền không dùng chung dịch có Canxi',
    ],
    tallManLASA: 'CefTRIAXone (Tránh nhầm với CefTAZidime, CefOTAXime)',
    highAlertRiskNote: 'Kháng sinh phổ rộng - Nguy cơ sốc phản vệ và tủa muối Canxi-Ceftriaxone gây suy tạng',
    standardDosing: 'Người lớn: 1 - 2g IV hoặc IM một lần duy nhất trong ngày (q24h). Nhiễm khuẩn huyết/Viêm màng não: 2g mỗi 12h (q12h).',
    maxDailyDose: 'Không quá 4g/24 giờ.',
    renalAdjustment: 'Không cần chỉnh liều nếu suy thận đơn thuần (thải trừ qua gan bù trừ). Nếu suy cả gan và thận: tối đa 2g/ngày.',
    hepaticAdjustment: 'Không cần chỉnh liều nếu chức năng thận bình thường.',
    administrationRouteDetails: 'Tiêm tĩnh mạch chậm trong 3-5 phút hoặc truyền tĩnh mạch ngắt quãng trong 30 phút (pha trong 50-100ml NaCl 0.9%).',
    compatibleDiluents: ['NaCl 0.9%', 'Glucose 5%', 'Nước cất pha tiêm'],
    infusionRateLimit: 'Truyền trong ít nhất 30 phút. Tiêm IV chậm trong ít nhất 3-5 phút.',
    routeWarning: 'CẤM PHA HOẶC DÙNG CHUNG ĐƯỜNG TRUYỀN VỚI DUNG DỊCH CHỨA CANXI (nguy cơ tủa gây tử vong ở phổi/thận).',
    timingAndFrequency: 'Dùng một lần mỗi 24 giờ (hoặc mỗi 12 giờ trong nhiễm khuẩn thần kinh trung ương). Đúng giờ quy định.',
    mealRelation: 'Không liên quan bữa ăn.',
    stabilityAfterPrep: 'Sau khi hoàn nguyên, bảo quản tối đa 6 giờ ở nhiệt độ phòng và 24 giờ ở 2-8°C.',
    clinicalMonitoring: 'Theo dõi dấu hiệu phản vệ trong 30 phút sau tiêm. Đánh giá đáp ứng lâm sàng (nhiệt độ, bạch cầu, CRP/Procalcitonin).',
    adverseReactions: ['Dị ứng/phát ban', 'Tiêu chảy do Clostridioides difficile', 'Tăng men gan thoáng qua', 'Bùn mật giả sỏi'],
    antidote: 'Không có antidote đặc hiệu. Nếu có sốc phản vệ: xử trí khẩn cấp bằng Adrenalin theo Thông tư 51.',
    blackBoxWarning: 'TƯƠNG KỴ CANXI: Chống chỉ định dùng cùng lúc dịch truyền Canxi ở trẻ sơ sinh do nguy cơ tủa lắng chết người.',
    ddiWarnings: ['Các dung dịch tiêm truyền chứa Canxi (Ringer Lactat, Calci gluconat)', 'Kháng vitamin K (Warfarin)'],
    pregnancyLactation: 'FDA thai kỳ: Nhóm B (tương đối an toàn trong thai kỳ). Bài tiết nồng độ thấp qua sữa mẹ.',
    storageAndHandling: 'Bảo quản bột vô khuẩn ở nhiệt độ < 25°C, tránh ánh sáng.',
  },
};
