/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hồ Sơ Dược Thư Lâm Sàng & Dị Ứng: Thuốc Mạn Tính Ngoại Trú & Thuốc Thiết Yếu (<=200 LOC)
 */

import { FiveRightsSafetyInfo } from '../../types/medication';

export const HOSPITAL_SPECIALTY_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  // Metformin (Panfor PR-750)
  'med-met-01': {
    officialSource: {
      documentName: 'Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT)',
      registrationNumber: 'VN-19823-16 / 893110595324',
      standardPharmacopeia: 'Dược điển Việt Nam V (DĐVN V) / USP',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
      pdfDocument: 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
      pdfPage: '965 - 968',
      citationUrl: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=965',
    },
    composition: {
      activeIngredients: [{ innName: 'Metformin hydroclorid', chemicalSalt: 'Metformin HCl', strength: '750 mg' }],
      dosageForm: 'Viên nén giải phóng kéo dài (PR)',
      pharmacopeiaStandard: 'DĐVN V / USP',
      packagingSpec: 'Hộp 10 vỉ x 10 viên',
    },
    indications: [
      'Điều trị đái tháo đường typ 2 ở người lớn, đặc biệt ở bệnh nhân thừa cân béo phì khi chế độ ăn và luyện tập không kiểm soát được glucose huyết.',
      'Đơn trị liệu hoặc phối hợp với các thuốc hạ đường huyết đường uống khác hoặc Insulin.',
    ],
    contraindications: [
      'Nhiễm toan chuyển hóa cấp tính hoặc mạn tính (nhiễm toan lactic, nhiễm toan ceton do đái tháo đường)',
      'Tiền hôn mê hoặc hôn mê do đái tháo đường',
      'Suy thận nặng với eGFR < 30 mL/phút/1.73m² (nguy cơ tích lũy thuốc gây nhiễm toan lactic tử vong)',
      'Tình trạng suy tim cấp, nhồi máu cơ tim cấp, sốc, nhiễm khuẩn nặng',
      'Suy gan nặng, ngộ độc rượu cấp tính, người nghiện rượu',
    ],
    standardDosing: 'Khởi đầu 500mg hoặc 750mg uống 1 lần mỗi ngày vào bữa ăn tối. Tăng liều dần sau mỗi 10-15 ngày, liều tối đa 2000mg/ngày.',
    maxDailyDose: '2000 mg/ngày (chia 1 - 2 lần).',
    renalAdjustment: 'eGFR 45-59 mL/phút: Tối đa 1000mg/ngày; eGFR 30-44 mL/phút: Tối đa 500mg/ngày; eGFR < 30 mL/phút: CHỐNG CHỈ ĐỊNH TUYỆT ĐỐI.',
    hepaticAdjustment: 'Chống chỉ định ở bệnh nhân suy gan (tăng nguy cơ nhiễm toan acid lactic).',
    blackBoxWarning: 'CẢNH BÁO NGUY CƠ NHIỄM TOAN LACTIC: Rất hiếm gặp nhưng tử vong cao (~50%). Triệu chứng: Đau bụng, thở nhanh sâu (Kussmaul), hạ thân nhiệt, tụt HA. Ngừng ngay thuốc khi nghi ngờ.',
    antidote: 'Lọc máu thẩm tách máu ngoài thận (Hemodialysis) để nhanh chóng đào thải Metformin và điều chỉnh toan kiềm.',
    ddiWarnings: [
      'Thuốc cản quang chứa iod tiêm mạch: Ngừng Metformin trước 48h vì nguy cơ suy thận cấp gây toan lactic.',
      'Cimetidin: Làm giảm thải trừ Metformin qua ống thận, làm tăng 60% nồng độ Metformin trong máu.',
    ],
    patientVerificationChecklist: [
      'Kiểm tra xét nghiệm chức năng thận (Creatinine, eGFR) định kỳ mỗi 3-6 tháng',
      'Nuốt nguyên viên thuốc, CẤM nhai nát hoặc bẻ đôi viên giải phóng kéo dài PR',
      'Uống thuốc cùng hoặc ngay sau bữa ăn tối để giảm kích ứng đường tiêu hóa',
    ],
    targetPopulation: 'Bệnh nhân đái tháo đường typ 2 có chức năng thận ổn định (eGFR >= 30 mL/phút).',
    activeIngredients: ['Metformin hydroclorid 750mg'],
    allergyProfile: {
      allergyClass: 'Thuốc hạ đường huyết nhóm Biguanid',
      activeAllergens: ['Metformin'],
      excipientAllergens: ['Tá dược kéo dài giải phóng (HPMC)'],
      crossReactivities: ['Các dẫn xuất Biguanid khác'],
      contraindicatedAllergies: ['Tiền sử quá mẫn nặng với Metformin'],
      commonAllergySigns: ['Phát ban da, ngứa, mày đay'],
      emergencyManagement: 'Ngừng thuốc và điều trị triệu chứng dị ứng.',
    },
    adverseReactions: ['Rối loạn tiêu hóa (tiêu chảy, buồn nôn, đau bụng)', 'Vị kim loại trong miệng', 'Giảm hấp thu Vitamin B12'],
    clinicalMonitoring: 'Theo dõi đường huyết đói, HbA1c, Creatinine huyết thanh, eGFR hàng năm.',
    storageAndHandling: 'Bảo quản dưới 30°C, nơi khô ráo, tránh ánh sáng.',
  },

  // Amlodipin (Safeesem 5)
  'med-aml-01': {
    officialSource: {
      documentName: 'Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT)',
      registrationNumber: 'VN-17842-14 / 840110304425',
      standardPharmacopeia: 'Dược điển Việt Nam V (DĐVN V) / BP',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
      pdfDocument: 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
      pdfPage: '120 - 124',
      citationUrl: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=120',
    },
    composition: {
      activeIngredients: [{ innName: 'Amlodipin besilat', chemicalSalt: 'Amlodipine besylate', strength: '5 mg' }],
      dosageForm: 'Viên nén',
      pharmacopeiaStandard: 'DĐVN V / BP',
      packagingSpec: 'Hộp 3 vỉ x 10 viên',
    },
    indications: [
      'Điều trị tăng huyết áp nguyên phát ở người lớn (đơn trị liệu hoặc phối hợp với thuốc lợi tiểu thiazid, chẹn beta, ức chế men chuyển).',
      'Điều trị đau thắt ngực ổn định mạn tính và đau thắt ngực do co thắt mạch vành (đau thắt ngực Prinzmetal).',
    ],
    contraindications: [
      'Quá mẫn với dẫn xuất dihydropyridin hoặc bất kỳ thành phần nào của thuốc',
      'Hạ huyết áp nặng (huyết áp tâm thu < 90 mmHg)',
      'Sốc (bao gồm sốc tim)',
      'Tắc nghẽn đường ra thất trái (hẹp động mạch chủ nặng)',
      'Suy tim huyết động không ổn định sau nhồi máu cơ tim cấp',
    ],
    standardDosing: 'Khởi đầu 5mg uống 1 lần mỗi ngày. Có thể tăng liều lên tối đa 10mg/ngày sau 2-4 tuần nếu chưa kiểm soát được huyết áp.',
    maxDailyDose: '10 mg/ngày.',
    renalAdjustment: 'Không cần chỉnh liều ở bệnh nhân suy thận (thuốc chuyển hóa gần như hoàn toàn qua gan).',
    hepaticAdjustment: 'Thận trọng, bắt đầu liều thấp 2.5mg/ngày ở bệnh nhân suy gan nặng.',
    antidote: 'Calci gluconat hoặc Calci clorid tiêm tĩnh mạch để đối kháng tác dụng chẹn kênh calci; truyền dịch và thuốc vận mạch (Noradrenalin/Dopamin) nếu tụt huyết áp.',
    ddiWarnings: [
      'Simvastatin: Amlodipin làm tăng nồng độ Simvastatin. Liều Simvastatin không được vượt quá 20mg/ngày khi dùng cùng Amlodipin.',
      'Dantrolen (truyền tĩnh mạch): Nguy cơ rung thất và trụy tim mạch gây tử vong (Quyết định 5948/BYT).',
    ],
    patientVerificationChecklist: [
      'Đo huyết áp hàng ngày trước khi uống thuốc',
      'Theo dõi dấu hiệu phù mắt cá chân (tác dụng phụ giãn tiểu động mạch)',
      'Uống đều đặn vào cùng một thời điểm mỗi ngày (sáng hoặc tối)',
    ],
    targetPopulation: 'Bệnh nhân tăng huyết áp, đau thắt ngực ổn định.',
    activeIngredients: ['Amlodipin 5mg'],
    allergyProfile: {
      allergyClass: 'Thuốc chẹn kênh calci nhóm Dihydropyridin',
      activeAllergens: ['Amlodipine'],
      excipientAllergens: ['Cellulose vi tinh thể', 'Magnesi stearat'],
      crossReactivities: ['Nifedipin', 'Felodipin', 'Nicardipin'],
      contraindicatedAllergies: ['Tiền sử quá mẫn với các thuốc chẹn kênh calci Dihydropyridin'],
      commonAllergySigns: ['Phát ban da, mày đay, ngứa'],
      emergencyManagement: 'Ngừng thuốc và xử trí chống dị ứng.',
    },
    adverseReactions: ['Phù mắt cá chân ngoại vi', 'Đau đầu, chóng mặt', 'Đỏ bừng mặt', 'Đánh trống ngực'],
    clinicalMonitoring: 'Theo dõi huyết áp, nhịp tim, tình trạng phù chi dưới.',
    storageAndHandling: 'Bảo quản dưới 30°C, tránh ẩm và ánh sáng.',
  },

  // Atorvastatin 20mg
  'med-ato-01': {
    officialSource: {
      documentName: 'Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT)',
      registrationNumber: 'VN-16584-13',
      standardPharmacopeia: 'Dược điển Việt Nam V (DĐVN V) / USP',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
      pdfDocument: 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
      pdfPage: '175 - 179',
      citationUrl: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=175',
    },
    composition: {
      activeIngredients: [{ innName: 'Atorvastatin calci', chemicalSalt: 'Atorvastatin calcium trihydrate', strength: '20 mg' }],
      dosageForm: 'Viên nén bao phim',
      pharmacopeiaStandard: 'DĐVN V / USP',
      packagingSpec: 'Hộp 3 vỉ x 10 viên',
    },
    indications: [
      'Điều trị tăng cholesterol toàn phần, tăng LDL-cholesterol, apolipoprotein B và triglycerid ở bệnh nhân tăng lipid máu nguyên phát.',
      'Dự phòng tiên phát và thứ phát biến cố tim mạch (nhồi máu cơ tim, đột quỵ, tái thông mạch vành) ở người có nguy cơ cao.',
    ],
    contraindications: [
      'Bệnh gan hoạt động hoặc tăng dai dẳng không giải thích được của transaminase huyết thanh (> 3 lần giới hạn trên bình thường)',
      'Phụ nữ có thai hoặc đang cho con bú, phụ nữ có khả năng mang thai không dùng biện pháp tránh thai thích hợp',
      'Quá mẫn với Atorvastatin hoặc bất kỳ thành phần nào của thuốc',
    ],
    standardDosing: 'Khởi đầu 10mg hoặc 20mg uống 1 lần mỗi ngày vào buổi tối. Chuẩn liều sau 4 tuần, liều tối đa 80mg/ngày.',
    maxDailyDose: '80 mg/ngày.',
    renalAdjustment: 'Không cần chỉnh liều ở bệnh nhân suy thận.',
    hepaticAdjustment: 'Chống chỉ định ở bệnh gan đang hoạt động.',
    antidote: 'Không có thuốc giải độc đặc hiệu. Rửa dạ dày, than hoạt và điều trị hỗ trợ; theo dõi men gan AST/ALT và men cơ CK.',
    ddiWarnings: [
      'Clarithromycin, Itraconazol, Ketoconazol: Ức chế mạnh CYP3A4 làm tăng nồng độ Atorvastatin, nguy cơ tiêu cơ vân.',
      'Gemfibrozil, Cyclosporin: Tăng nguy cơ tổn thương cơ và tiêu cơ vân cấp (QĐ 5948/BYT).',
    ],
    patientVerificationChecklist: [
      'Kiểm tra men gan ALT/AST trước khi bắt đầu dùng và định kỳ sau đó',
      'Báo ngay cho bác sĩ nếu xuất hiện đau cơ, yếu cơ không giải thích được hoặc nước tiểu sẫm màu',
      'Uống thuốc 1 lần trong ngày vào bất kỳ thời điểm nào, khuyến khích uống vào buổi tối',
    ],
    targetPopulation: 'Bệnh nhân rối loạn lipid máu, phòng ngừa biến cố tim mạch xơ vữa.',
    activeIngredients: ['Atorvastatin 20mg'],
    allergyProfile: {
      allergyClass: 'Thuốc hạ lipid máu nhóm Statin (ức chế HMG-CoA reductase)',
      activeAllergens: ['Atorvastatin'],
      excipientAllergens: ['Lactose monohydrat'],
      crossReactivities: ['Rosuvastatin', 'Simvastatin', 'Pravastatin'],
      contraindicatedAllergies: ['Tiền sử dị ứng hoặc bệnh cơ do Statin'],
      commonAllergySigns: ['Phát ban da, mày đay, phù mạch'],
      emergencyManagement: 'Ngừng thuốc ngay lập tức.',
    },
    adverseReactions: ['Đau cơ, yếu cơ (myopathy)', 'Tăng men gan transaminase', 'Rối loạn tiêu hóa (táo bón, đầy hơi)'],
    clinicalMonitoring: 'Theo dõi Lipid máu (LDL-C), men gan ALT, men cơ CK khi có đau cơ.',
    storageAndHandling: 'Bảo quản dưới 30°C, nơi khô ráo.',
  },

  // Enoxaparin 4000 IU / 0.4ml (Lovenox)
  'med-enox-01': {
    officialSource: {
      documentName: 'Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT)',
      registrationNumber: 'VN-18234-14',
      standardPharmacopeia: 'Dược điển Châu Âu (EP) / DĐVN V',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
      pdfDocument: 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
      pdfPage: '582 - 586',
      citationUrl: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=582',
    },
    composition: {
      activeIngredients: [{ innName: 'Enoxaparin natri', chemicalSalt: 'Enoxaparin sodium', strength: '4000 IU anti-Xa / 0.4 ml (40 mg)' }],
      dosageForm: 'Dung dịch tiêm trong bơm tiêm đóng sẵn thuốc',
      pharmacopeiaStandard: 'EP / DĐVN V',
      packagingSpec: 'Hộp 2 bơm tiêm nạp sẵn 0.4ml',
    },
    indications: [
      'Dự phòng thuyên tắc huyết khối tĩnh mạch (DVT) ở bệnh nhân phẫu thuật chỉnh hình hoặc ngoại tổng quát có nguy cơ vừa/cao.',
      'Dự phòng huyết khối tĩnh mạch ở bệnh nhân nội khoa nằm liệt giường do bệnh cấp tính (suy tim, suy hô hấp).',
      'Điều trị huyết khối tĩnh mạch sâu (DVT) có hoặc không có thuyên tắc phổi (PE).',
      'Điều trị hội chứng vành cấp: Đau thắt ngực không ổn định và nhồi máu cơ tim không ST chênh lên (NSTEMI).',
    ],
    contraindications: [
      'Tiền sử giảm tiểu cầu do Heparin qua trung gian miễn dịch (HIT) trong vòng 100 ngày hoặc có kháng thể lưu hành',
      'Xuất huyết nghiêm trọng đang tiến triển lâm sàng',
      'Tổn thương cơ quan có nguy cơ chảy máu cao (loét dạ dày tiến triển, đột quỵ xuất huyết gần đây)',
      'Gây tê tủy sống hoặc ngoài màng cứng trong vòng 24 giờ (nguy cơ tụ máu tủy sống gây liệt vĩnh viễn)',
    ],
    standardDosing: 'Dự phòng DVT: 20-40mg (2000-4000 IU) tiêm dưới da ngày 1 lần. Điều trị DVT: 1mg/kg (100 IU/kg) mỗi 12 giờ tiêm dưới da.',
    maxDailyDose: '100 IU/kg mỗi 12 giờ.',
    renalAdjustment: 'ClCr < 30 mL/phút: Giảm liều còn 20mg (2000 IU) ngày 1 lần (dự phòng) hoặc 1mg/kg ngày 1 lần (điều trị).',
    hepaticAdjustment: 'Thận trọng ở bệnh nhân suy gan vì nguy cơ xuất huyết tăng.',
    blackBoxWarning: 'CẢNH BÁO TỤ MÁU TỦY SỐNG: Bệnh nhân gây tê tủy sống/ngoài màng cứng hoặc chọc dò tủy sống có nguy cơ tụ máu ngoài màng cứng gây liệt kéo dài hoặc vĩnh viễn.',
    antidote: 'Protamin sulfat tiêm tĩnh mạch chậm (1mg Protamin trung hòa khoảng 100 IU Enoxaparin natri).',
    ddiWarnings: [
      'Thuốc chống đông đường uống (Warfarin, NOAC/DOAC), NSAID liều cao, thuốc chống kết tập tiểu cầu: Tăng nguy cơ xuất huyết nặng.',
    ],
    patientVerificationChecklist: [
      'Tiêm dưới da ở thành bụng trước bên hoặc sau bên, luân chuyển vị trí tiêm',
      'CẤM tiêm bắp (nguy cơ tụ máu lớn trong cơ)',
      'Theo dõi số lượng tiểu cầu trước khi dùng và định kỳ ngày thứ 3, 5, 7 (phát hiện HIT)',
    ],
    targetPopulation: 'Bệnh nhân có nguy cơ hoặc đang điều trị huyết khối tắc mạch.',
    activeIngredients: ['Enoxaparin natri 4000 IU/0.4ml'],
    allergyProfile: {
      allergyClass: 'Heparin trọng lượng phân tử thấp (LMWH)',
      activeAllergens: ['Enoxaparin'],
      excipientAllergens: ['Nước cất pha tiêm'],
      crossReactivities: ['Heparin không phân đoạn (UFH)', 'Dalteparin', 'Nadroparin'],
      contraindicatedAllergies: ['Tiền sử dị ứng LMWH hoặc giảm tiểu cầu do Heparin (HIT)'],
      commonAllergySigns: ['Phản ứng tại chỗ tiêm (tụ máu, bầm tím, ngứa)', 'Nổi mề đay'],
      emergencyManagement: 'Ngừng thuốc, dùng Protamin nếu xuất huyết đe dọa tính mạng.',
    },
    adverseReactions: ['Xuất huyết các mức độ', 'Giảm tiểu cầu (HIT)', 'Tăng men gan AST/ALT thoáng qua'],
    clinicalMonitoring: 'Theo dõi công thức máu (Hgb, Hct, Tiểu cầu), dấu hiệu xuất huyết dưới da/niêm mạc.',
    storageAndHandling: 'Bảo quản dưới 25°C. CẤM để đông đá.',
  },

  // Naloxon hydroclorid 0.4mg/ml (Thuốc giải độc Opioid)
  'med-nalox-01': {
    officialSource: {
      documentName: 'Dược thư Quốc gia Việt Nam (Lần xuất bản II - 2015, QĐ 2033/QĐ-BYT)',
      registrationNumber: 'VD-21345-14',
      standardPharmacopeia: 'Dược điển Việt Nam V (DĐVN V) / USP',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
      pdfDocument: 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf',
      pdfPage: '1024 - 1027',
      citationUrl: '/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=1024',
    },
    composition: {
      activeIngredients: [{ innName: 'Naloxon hydroclorid', chemicalSalt: 'Naloxone HCl dihydrate', strength: '0.4 mg / 1 ml' }],
      dosageForm: 'Dung dịch tiêm',
      pharmacopeiaStandard: 'DĐVN V / USP',
      packagingSpec: 'Hộp 10 ống x 1ml',
    },
    indications: [
      'Giải độc đặc hiệu ngộ độc cấp tính hoặc quá liều Opioid tự nhiên hoặc tổng hợp (Morphin, Fentanyl, Codein, Heroin, Pethidin).',
      'Xử trí suy hô hấp cấp nặng và hôn mê do Opioid sau phẫu thuật hoặc dùng thuốc giảm đau gây nghiện.',
      'Chẩn đoán nghi ngờ ngộ độc quá liều Opioid.',
    ],
    contraindications: [
      'Quá mẫn với Naloxon hydroclorid hoặc bất kỳ thành phần nào của thuốc (trong cấp cứu quá liều đe dọa tính mạng KHÔNG CÓ chống chỉ định tuyệt đối).',
    ],
    standardDosing: 'Khởi đầu 0.4mg - 2mg tiêm tĩnh mạch trực tiếp (hoặc tiêm bắp/tiêm dưới da nếu không có đường truyền TM). Lặp lại mỗi 2 - 3 phút nếu chưa cải thiện thông khí đến tối đa 10mg.',
    maxDailyDose: '10 mg trong cấp cứu ngộ độc Opioid.',
    renalAdjustment: 'Không cần chỉnh liều trong cấp cứu ngộ độc Opioid.',
    hepaticAdjustment: 'Không cần chỉnh liều trong cấp cứu ngộ độc Opioid.',
    antidote: 'Chính Naloxon là thuốc giải độc đặc hiệu đối kháng cạnh tranh trên thụ thể mu, kappa, delta opioid.',
    ddiWarnings: [
      'Thuốc Opioid: Hóa giải hoàn toàn tác dụng giảm đau của Opioid, có thể kích phát hội chứng cai thuốc cấp dữ dội.',
    ],
    patientVerificationChecklist: [
      'Chuẩn bị sẵn bóng Ambu, oxy và phương tiện hỗ trợ hô hấp',
      'Thời gian bán thải của Naloxon (30-90 phút) ngắn hơn Morphin (2-4h) và Methadon (24-36h): Nguy cơ tái suy hô hấp sau khi Naloxon hết tác dụng, bắt buộc theo dõi sát ít nhất 24 giờ',
    ],
    targetPopulation: 'Bệnh nhân suy hô hấp cấp, đồng tử co nhỏ như đầu đinh ghim, hôn mê do quá liều Opioid.',
    activeIngredients: ['Naloxon hydroclorid 0.4mg/1ml'],
    allergyProfile: {
      allergyClass: 'Thuốc đối kháng chọn lọc thụ thể Opioid',
      activeAllergens: ['Naloxone'],
      excipientAllergens: ['Natri clorid', 'Nước cất'],
      crossReactivities: ['Naltrexone', 'Nalmefene'],
      contraindicatedAllergies: ['Dị ứng Naloxon (ngoại trừ tình huống cấp cứu ngừng thở cứu mạng)'],
      commonAllergySigns: ['Hội chứng cai thuốc cấp (buồn nôn, vã mồ hôi, tim đập nhanh, kích động, run)'],
      emergencyManagement: 'Hỗ trợ hô hấp tuần hoàn, an thần nhẹ nếu hội chứng cai quá kích.',
    },
    adverseReactions: ['Hội chứng cai thuốc opioid cấp tính', 'Tụt hoặc tăng huyết áp phản ứng', 'Phù phổi cấp (hiếm gặp)'],
    clinicalMonitoring: 'Theo dõi liên tục nhịp thở, SpO2, tri giác, đường kính đồng tử và ECG ít nhất 24 giờ.',
    storageAndHandling: 'Bảo quản dưới 25°C, tránh ánh sáng.',
  },
};
