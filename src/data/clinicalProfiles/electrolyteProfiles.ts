/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dược Thư Lâm Sàng & Thành Phần Thuốc: Điện Giải Nguy Cơ Cao & Bù Kali (<=200 LOC)
 */

import { FiveRightsSafetyInfo } from '../../types/medication';

export const ELECTROLYTE_CLINICAL_PROFILES: Record<string, FiveRightsSafetyInfo> = {
  // Kali clorid (KCl) 10% 10ml
  'med-em-09': {
    officialSource: {
      documentName: 'Dược thư Quốc gia Việt Nam 2022 (Chuyên luận Kali clorid) & Viện ISMP',
      registrationNumber: 'VD-23846-15',
      manufacturer: 'B.Braun Việt Nam / Công ty Cổ phần Dược phẩm Vĩnh Phúc',
      standardPharmacopeia: 'Dược điển Việt Nam V (DĐVN V)',
      approvalAuthority: 'Cục Quản lý Dược - Bộ Y Tế',
    },
    composition: {
      activeIngredients: [{ innName: 'Potassium chloride (KCl)', chemicalSalt: 'Kali clorid vô khuẩn', strength: '1 g / 10 ml (10%)', molarQuantity: '13.4 mEq K+ và 13.4 mEq Cl- / 10ml' }],
      excipients: [{ name: 'Nước cất pha tiêm', role: 'Dung môi tinh khiết vừa đủ 10 ml' }],
      dosageForm: 'Dung dịch đậm đặc pha truyền tĩnh mạch',
      appearance: 'Dung dịch trong suốt không màu',
      phAndOsmolarity: 'pH: 4.0 - 8.0 | Áp lực thẩm thấu cực cao ~2600 mOsm/L (BẮT BUỘC pha loãng)',
      packagingSpec: 'Hộp 10 ống thủy tinh/nhựa 10ml dán nhãn cảnh báo đỏ ISMP',
      pharmacopeiaStandard: 'Dược điển Việt Nam V (DĐVN V) / USP',
    },
    indications: [
      'Điều trị hạ kali máu mức độ vừa đến nặng (< 3.0 mmol/L) hoặc có rối loạn nhịp tim trên điện tâm đồ.',
      'Dự phòng hạ kali máu ở bệnh nhân nuôi dưỡng tĩnh mạch hoàn toàn (TPN) hoặc dùng lợi tiểu quai kéo dài.',
      'Bù kali trong toan xeton đái tháo đường (DKA) sau khi đã dùng insulin.',
    ],
    pharmacologyMechanism: 'Cation nội bào chủ yếu của cơ thể, tham gia trực tiếp vào việc duy trì điện thế màng tế bào, dẫn truyền xung động thần kinh và co bóp cơ trơn, cơ vân, cơ tim.',
    activeIngredients: ['Potassium chloride (KCl) 10% (1g / 10ml = 13.4 mEq K+)'],
    allergyProfile: {
      allergyClass: 'Muối khoáng điện giải thiết yếu',
      activeAllergens: ['Kali clorid (chất điện giải tự nhiên, không gây dị ứng miễn dịch học)'],
      excipientAllergens: ['Nước cất pha tiêm vô khuẩn'],
      crossReactivities: ['Không có'],
      contraindicatedAllergies: [
        'Tăng kali máu (K+ > 5.0 mmol/L)',
        'Suy thận vô niệu hoặc thiểu niệu nặng (chưa lọc máu)',
        'Bệnh suy vỏ thượng thận (Addison) không điều trị',
      ],
      commonAllergySigns: [
        'Kích ứng đau rát dữ dội dọc tĩnh mạch truyền (do độ thẩm thấu cao, không phải dị ứng)',
        'Cảm giác tê bì đầu chi, yếu liệt cơ khi nồng độ kali máu tăng vọt',
      ],
      emergencyManagement: 'Nếu nhầm lẫn tiêm trực tiếp gây tăng kali cấp: Tiêm ngay Calci Clorid 10% 10ml IV chậm (ổn định tim) + Glucose 20% + Insulin.',
    },
    targetPopulation: 'Bệnh nhân hạ kali máu nặng hoặc nguy cơ loạn nhịp tim.',
    contraindications: [
      'Tăng kali máu (> 5.0 mmol/L), suy thận thiểu niệu/vô niệu chưa lọc máu, bệnh Addison',
    ],
    patientVerificationChecklist: [
      'Xác nhận kết quả xét nghiệm kali máu trong vòng 2-4 giờ',
      'Đo ECG kiểm tra sóng T dẹt, sóng U hoặc loạn nhịp',
      'Kiểm tra lượng nước tiểu (> 0.5 ml/kg/h)',
    ],
    tallManLASA: 'Potassium Chloride (KCL) 10%',
    highAlertRiskNote: 'THUỐC CẢNH BÁO CAO ĐỎ (ISMP) - TIÊM TRỰC TIẾP TĨNH MẠCH GÂY NGỪNG TIM TỬ VONG TỨC THÌ',
    standardDosing: 'Pha 1-2 ống (10-20 mEq) trong 500ml NaCl 0.9% hoặc Ringer Lactat, truyền chậm 4-8 giờ.',
    maxDailyDose: 'Không quá 200 mEq/24h (tối đa 2-3 mmol/kg/24h).',
    renalAdjustment: 'Giảm 50% tốc độ truyền ở suy thận; theo dõi kali máu mỗi 2 giờ.',
    hepaticAdjustment: 'Không cần chỉnh liều đặc biệt.',
    administrationRouteDetails: 'BẮT BUỘC PHA LOÃNG TRUYỀN TĨNH MẠCH. Nồng độ tối đa ngoại vi: 40 mmol/L; qua CVC: 80 mmol/L.',
    compatibleDiluents: ['NaCl 0.9%', 'Ringer Lactat (TRÁNH dùng Glucose ban đầu vì kích thích insulin làm hạ kali thêm)'],
    infusionRateLimit: 'Tốc độ tối đa qua ngoại vi: KHÔNG QUÁ 10 - 20 mmol/giờ (1-1.5g KCl/giờ).',
    routeWarning: 'TUYỆT ĐỐI CẤM TIÊM TĨNH MẠCH TRỰC TIẾP HOẶC TIÊM BẮP DƯỚI MỌI HÌNH THỨC.',
    timingAndFrequency: 'Truyền chậm trong 4 - 8 giờ. Xét nghiệm lại kali sau truyền 1-2 giờ.',
    mealRelation: 'Uống (nếu dạng uống): uống cùng bữa ăn với nhiều nước.',
    stabilityAfterPrep: 'Lắc đều chai dịch truyền sau khi bơm KCl vào để tránh đọng nồng độ cao ở đáy chai.',
    clinicalMonitoring: 'Monitor điện tâm đồ liên tục (sóng T nhọn, khoảng PR giãn), xét nghiệm điện giải máu.',
    adverseReactions: ['Loạn nhịp thất ngừng tim', 'Viêm đau kích ứng tĩnh mạch', 'Tăng kali máu kịch phát'],
    antidote: 'Cấp cứu tăng kali máu: Calci clorid 10% 10ml IV (ổn định cơ tim) + Glucose 20% 200ml + 10 UI Insulin thường.',
    blackBoxWarning: 'CẢNH BÁO TỬ VONG: Độc chất gây ngừng tim nếu tiêm nhanh. Ống tiêm dán nhãn cảnh báo đỏ riêng biệt.',
    ddiWarnings: ['Thuốc lợi tiểu giữ kali (Spironolactone)', 'Thuốc ức chế men chuyển ACEi'],
    pregnancyLactation: 'FDA: Nhóm C. Bù kali an toàn khi có chỉ định sinh lý.',
    storageAndHandling: 'Hộp cảnh báo cao màu đỏ "CHÚ Ý: PHA LOÃNG TRƯỚC KHI DÙNG".',
    atcCode: 'A12BA01',
    bhytCoverage: 'Thanh toán 100% BHYT thuốc dịch truyền/điện giải',
  },
};
