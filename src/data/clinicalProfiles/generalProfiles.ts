/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hồ Sơ Dược Thư Lâm Sàng & Dị Ứng: Giảm Đau, Hạ Sốt, Tim Mạch & Giải Độc (<=200 LOC)
 */

import { FiveRightsSafetyInfo } from '../../types/medication';

export const GENERAL_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  // Paracetamol (Acetaminophen) 1g truyền tĩnh mạch
  'med-gen-01': {
    composition: {
      activeIngredients: [{ innName: 'Paracetamol', chemicalSalt: 'Paracetamol (Acetaminophen)', strength: '1000 mg / 100 ml (10 mg/ml)' }],
      excipients: [
        { name: 'Mannitol', role: 'Chất điều chỉnh áp lực thẩm thấu' },
        { name: 'Acid citric monohydrat / Dinatri phosphat', role: 'Hệ đệm ổn định pH (pH 5.5 - 6.5)' },
        { name: 'Cystein hydroclorid monohydrat', role: 'Chất chống oxy hóa' },
        { name: 'Nước cất pha tiêm', role: 'Dung môi vừa đủ 100 ml' },
      ],
      dosageForm: 'Dung dịch tiêm truyền tĩnh mạch',
      appearance: 'Dung dịch trong suốt, không màu hoặc ánh vàng rất nhạt',
      phAndOsmolarity: 'pH: 5.5 - 6.5 | Áp lực thẩm thấu ~290 mOsm/kg',
      packagingSpec: 'Chai thủy tinh hoặc chai nhựa Polypropylen vô khuẩn 100ml',
      pharmacopeiaStandard: 'Dược điển Việt Nam V (DĐVN V) / EP',
    },
    indications: [
      'Hạ sốt nhanh trong các trường hợp sốt cao (> 38.5°C) hoặc người bệnh không uống được.',
      'Giảm đau mức độ nhẹ đến vừa: Đau đầu, đau cơ xương khớp, đau sau phẫu thuật (bước 1 bậc thang WHO).',
      'Phối hợp đa mô thức với Opioid để giảm nhu cầu liều Opioid sau mổ.',
    ],
    pharmacologyMechanism: 'Ức chế tổng hợp prostaglandin chủ yếu tại hệ thần kinh trung ương (COX-3 / ức chế peroxidase), tác dụng ngoại vi chống viêm không đáng kể. Tác dụng hạ sốt qua trung tâm điều nhiệt vùng dưới đồi.',
    activeIngredients: ['Paracetamol (Acetaminophen) 1000mg / 100ml'],
    allergyProfile: {
      allergyClass: 'Dẫn xuất Para-aminophenol',
      activeAllergens: ['Paracetamol (Acetaminophen)'],
      excipientAllergens: ['Mannitol', 'Acid citric', 'Natri phosphat dibasic'],
      crossReactivities: ['Propacetamol (tiền chất)', 'Thận trọng ở người quá mẫn với NSAID'],
      contraindicatedAllergies: [
        'Tiền sử quá mẫn nặng với Paracetamol hoặc Propacetamol',
        'Bệnh nhân suy tế bào gan nặng tiến triển',
      ],
      commonAllergySigns: [
        'Phát ban da, mày đay, mẩn đỏ',
        'Hiếm gặp phản ứng da nghiêm trọng đe dọa tử vong: Hội chứng Stevens-Johnson (SJS), hoại tử thượng bì nhiễm độc (TEN), mụn mủ toàn thân cấp tính (AGEP)',
      ],
      emergencyManagement: 'Ngừng ngay thuốc nếu xuất hiện phát ban da hoặc bọng nước. Nếu ngộ độc quá liều gan: Dùng N-Acetylcystein (NAC) đường uống hoặc truyền tĩnh mạch càng sớm càng tốt (trong 8h đầu).',
    },
    targetPopulation: 'Bệnh nhân sốt cao hoặc đau cấp tính sau mổ không dùng được đường uống.',
    contraindications: [
      'Suy gan nặng, suy tế bào gan tiến triển, nghiện rượu nặng',
      'Tiền sử quá mẫn hoặc phản ứng da nghiêm trọng với Paracetamol',
    ],
    patientVerificationChecklist: [
      'Xác nhận tổng liều Paracetamol từ TẤT CẢ các nguồn thuốc trong 24 giờ qua (tránh trùng lặp)',
      'Kiểm tra men gan ALT/AST và tiền sử bệnh lý gan mật',
      'Đảm bảo khoảng cách giữa 2 liều tối thiểu 4 - 6 giờ',
    ],
    tallManLASA: 'PARACETAMOL (Tránh nhầm lẫn dạng viên uống 500mg và chai truyền 1g)',
    highAlertRiskNote: 'Nguy cơ hoại tử tế bào gan cấp tính nếu dùng quá liều tối đa 4g/24 giờ',
    standardDosing: 'Người lớn >= 50kg: 1000mg (1 chai 100ml) truyền IV trong 15 phút, mỗi 4-6 giờ khi cần.',
    maxDailyDose: 'Tối đa 4000mg (4g) / 24 giờ ở người bình thường; tối đa 2000-3000mg/24h ở người suy gan nhẹ, nghiện rượu hoặc < 50kg.',
    renalAdjustment: 'eGFR 10-50 ml/ph: giãn cách liều mỗi 6 giờ; eGFR < 10 ml/ph: giãn cách mỗi 8 giờ.',
    hepaticAdjustment: 'Chống chỉ định ở suy gan nặng. Suy gan nhẹ/vừa: tối đa 2g/ngày.',
    administrationRouteDetails: 'Truyền tĩnh mạch ngắt quãng trong vòng 15 phút. Không tiêm bắp.',
    compatibleDiluents: ['Dung dịch có sẵn 100ml dùng trực tiếp; tương thích NaCl 0.9%, G5%.'],
    infusionRateLimit: 'Truyền trong 15 phút. Không truyền quá nhanh.',
    routeWarning: 'CẤM TIÊM BẮP HOẶC DƯỚI DA.',
    timingAndFrequency: 'Mỗi 4 - 6 giờ khi đau hoặc sốt. Không dùng dồn liều.',
    mealRelation: 'Không liên quan bữa ăn (đường truyền tĩnh mạch).',
    stabilityAfterPrep: 'Chai dịch truyền vô trùng dùng 1 lần, bỏ phần thừa sau khi mở.',
    clinicalMonitoring: 'Theo dõi nhiệt độ cơ thể, thang điểm đau VAS, men gan nếu dùng liên tục > 48 giờ.',
    adverseReactions: ['Độc tính gan do chất chuyển hóa NAPQI', 'Phát ban da', 'Tụt huyết áp thoáng qua khi truyền nhanh'],
    antidote: 'N-Acetylcystein (NAC) - Uống hoặc truyền tĩnh mạch theo phác đồ giải độc ngộ độc Paracetamol.',
    blackBoxWarning: 'CẢNH BÁO HOẠI TỬ GAN: Không vượt quá 4g/ngày từ mọi dạng dùng (uống + truyền).',
    ddiWarnings: ['Rượu ethanol làm tăng hoạt hóa CYP2E1 tạo chất độc NAPQI', 'Thuốc cảm cúm phối hợp chứa paracetamol'],
    pregnancyLactation: 'FDA: Nhóm B. Là thuốc hạ sốt giảm đau lựa chọn đầu tay trong thai kỳ.',
    storageAndHandling: 'Bảo quản nhiệt độ phòng < 30°C, tránh ánh sáng.',
  },

  // Lipid 20% (Lipid Emulsion 20% 100ml / 250ml)
  'med-gen-02': {
    composition: {
      activeIngredients: [{ innName: 'Nhũ dịch Lipid 20%', chemicalSalt: 'Dầu đậu nành tinh khiết phân đoạn', strength: '20 g lipid / 100 ml (20%)' }],
      excipients: [
        { name: 'Phospholipid từ lòng đỏ trứng tinh chế', role: 'Chất nhũ hóa tự nhiên 1.2%' },
        { name: 'Glycerol', role: 'Chất làm đẳng trương 2.5%' },
        { name: 'Natri oleat / Natri hydroxyd', role: 'Chất điều chỉnh pH (pH 6.5 - 8.5)' },
        { name: 'Nước cất pha tiêm', role: 'Dung môi vừa đủ 100 ml' },
      ],
      dosageForm: 'Nhũ dịch dầu trong nước (O/W) tiêm truyền tĩnh mạch',
      appearance: 'Nhũ dịch trắng đục đồng nhất như sữa, không tách lớp mỡ',
      phAndOsmolarity: 'pH: 6.5 - 8.5 | Áp lực thẩm thấu ~350 mOsm/kg',
      packagingSpec: 'Chai thủy tinh trung tính 100ml / 250ml',
      pharmacopeiaStandard: 'Dược điển Mỹ (USP) / EP',
    },
    indications: [
      'Giải độc khẩn cấp ngộ độc toàn thân thuốc gây tê cục bộ (LAST - Local Anesthetic Systemic Toxicity) do Bupivacain, Lidocain, Ropivacain.',
      'Giải độc quá liều một số thuốc tan trong lipid khác (thuốc chẹn beta, thuốc chống trầm cảm 3 vòng) khi hồi sinh tim phổi thất bại.',
      'Cung cấp năng lượng và acid béo thiết yếu trong nuôi dưỡng tĩnh mạch toàn phần (TPN).',
    ],
    pharmacologyMechanism: 'Cơ chế bẫy lipid ("Lipid Sink") hấp thu và gắn kết các phân tử thuốc gây tê tan trong dầu ra khỏi thụ thể tim và não, phục hồi chức năng co bóp cơ tim.',
    activeIngredients: ['Nhũ dịch dầu đậu nành tinh khiết 20% (20g lipid / 100ml)'],
    allergyProfile: {
      allergyClass: 'Nhũ dịch lipid nuôi dưỡng & giải độc',
      activeAllergens: ['Dầu đậu nành tinh chế', 'Phospholipid từ lòng đỏ trứng'],
      excipientAllergens: ['Glycerol', 'Natri oleat', 'Nước cất'],
      crossReactivities: ['Dị ứng đậu phộng (Peanut)', 'Dị ứng đậu nành (Soybean)', 'Dị ứng trứng (Egg)'],
      contraindicatedAllergies: [
        'Tiền sử dị ứng nặng với đậu nành, lạc hoặc protein từ trứng (TUY NHIÊN trong cấp cứu ngừng tim LAST, VẪN BẮT BUỘC DÙNG ĐỂ CỨU MẠNG).',
      ],
      commonAllergySigns: [
        'Phát ban, khó thở, sốt run trong trường hợp truyền dinh dưỡng thông thường',
      ],
      emergencyManagement: 'Trong cấp cứu ngộ độc thuốc tê LAST đe dọa ngừng tim: Bắt buộc truyền ngay lập tức, không trì hoãn vì tiền sử dị ứng đậu nành/trứng.',
    },
    targetPopulation: 'Bệnh nhân ngộ độc thuốc tê toàn thân LAST tại phòng mổ hoặc hồi sức cấp cứu.',
    contraindications: [
      'Rối loạn chuyển hóa lipid nặng (ngoài tình huống cấp cứu LAST cứu mạng)',
      'Viêm tụy cấp kèm tăng triglycerid máu nặng',
    ],
    patientVerificationChecklist: [
      'Nhận diện dấu hiệu LAST: Tê quanh miệng, ù tai, co giật, loạn nhịp tim sau gây tê vùng',
      'Ngừng tiêm thuốc tê ngay lập tức',
      'Gọi hỗ trợ cấp cứu LAST và lấy ngay chai Lipid 20% từ tủ trực',
    ],
    tallManLASA: 'LIPID EMULSION 20% (Intralipid / Lipovenoes 20%)',
    highAlertRiskNote: 'Thuốc giải độc cứu mạng trong ngộ độc thuốc tê - Bắt buộc có sẵn tại mọi phòng gây tê',
    standardDosing: 'Phác đồ LAST ASRA/AAGBI: Bolus 1.5 ml/kg IV trong 1 phút (khoảng 100ml ở người 70kg). Sau đó truyền duy trì 0.25 ml/kg/phút (khoảng 1000ml/giờ).',
    maxDailyDose: 'Tổng liều tối đa trong hồi sức LAST: 12 ml/kg (tối đa khoảng 800 - 1000ml).',
    renalAdjustment: 'Không cần chỉnh liều trong cấp cứu LAST.',
    hepaticAdjustment: 'Không cần chỉnh liều trong cấp cứu LAST.',
    administrationRouteDetails: 'Tiêm tĩnh mạch trực tiếp (Bolus) sau đó truyền tĩnh mạch liên tục qua catheter tĩnh mạch lớn.',
    compatibleDiluents: ['Dùng trực tiếp dung dịch nhũ dịch nguyên chất 20%, CẤM pha loãng với nước cất hay dung dịch khác.'],
    infusionRateLimit: 'Bolus nhanh trong 1 phút theo đúng phác đồ cấp cứu LAST.',
    routeWarning: 'CẤM TIÊM BẮP HOẶC DƯỚI DA.',
    timingAndFrequency: 'Dùng ngay khi nghi ngờ ngộ độc thuốc tê toàn thân. Lặp lại bolus 1-2 lần nếu huyết động chưa hồi phục.',
    mealRelation: 'Không liên quan bữa ăn.',
    stabilityAfterPrep: 'Chai nhũ dịch đục như sữa, kiểm tra không bị tách lớp hoặc vón cục.',
    clinicalMonitoring: 'Theo dõi ECG, huyết áp, nhịp tim, tri giác cho đến khi huyết động ổn định ít nhất 2 giờ.',
    adverseReactions: ['Tăng triglycerid máu', 'Nghẽn mạch lipid (rất hiếm khi dùng đúng phác đồ)', 'Viêm tụy'],
    antidote: 'Chính nó là thuốc giải độc đặc hiệu cho ngộ độc Bupivacain/Lidocain/Ropivacain.',
    blackBoxWarning: 'CẤP CỨU LAST: Phải có sẵn tại mọi bàn phẫu thuật có thực hiện gây tê vùng.',
    ddiWarnings: ['Tránh dùng thuốc chẹn kênh calci hoặc thuốc chẹn beta trong cấp cứu LAST vì làm suy tim nặng hơn'],
    pregnancyLactation: 'Được phép dùng cấp cứu ở phụ nữ có thai khi ngộ độc thuốc tê chuyển dạ.',
    storageAndHandling: 'Bảo quản nhiệt độ phòng < 25°C. CẤM để đông đá.',
  },
};
