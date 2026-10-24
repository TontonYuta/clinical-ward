/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Định nghĩa Chuẩn Dược Lâm Sàng Bệnh Viện (QĐ 2147/QĐ-BYT & TT 20/2022/TT-BYT)
 */

export type MedicationGroup =
  | 'Thuốc gây nghiện'
  | 'Thuốc hướng thần'
  | 'Thuốc cấp cứu'
  | 'Thuốc nguy cơ cao'
  | 'Kháng sinh'
  | 'Dịch truyền'
  | 'Vật tư tiêu hao';

export interface MedicationAllergyProfile {
  allergyClass: string; // Nhóm dị ứng lâm sàng (VD: Opioid, Beta-lactam Cephalosporin, Benzodiazepin...)
  activeAllergens: string[]; // Các hoạt chất có nguy cơ gây dị ứng
  excipientAllergens: string[]; // Tá dược có thể gây phản ứng quá mẫn (Natri metabisulfit, lactose, benzyl alcohol...)
  crossReactivities: string[]; // Nguy cơ dị ứng chéo (VD: Penicillin, các opioid khác...)
  contraindicatedAllergies: string[]; // Chống chỉ định tiền sử dị ứng (Sốc phản vệ, hội chứng Stevens-Johnson...)
  commonAllergySigns: string[]; // Triệu chứng lâm sàng khi dị ứng (Mề đay, phù Quinke, co thắt phế quản, sốc...)
  emergencyManagement: string; // Xử trí khẩn cấp (Ngừng thuốc ngay, Adrenalin theo Thông tư 51/2017)
}

export interface FiveRightsSafetyInfo {
  // Chỉ định điều trị lâm sàng & Cơ chế ("Dùng để làm gì")
  indications?: string[]; // Mục đích & chỉ định điều trị chi tiết
  pharmacologyMechanism?: string; // Cơ chế tác dụng dược lý tóm tắt
  activeIngredients?: string[]; // Hoạt chất chính
  // Hồ sơ dị ứng & cảnh báo quá mẫn
  allergyProfile?: MedicationAllergyProfile;
  // 1. Đúng người bệnh
  targetPopulation: string; // Phù hợp với ai / Chỉ định đối tượng
  contraindications: string[]; // Chống chỉ định tuyệt đối & thận trọng
  patientVerificationChecklist: string[]; // Các bước nhận diện người bệnh
  // 2. Đúng thuốc
  tallManLASA?: string; // Tên Tall Man chống nhầm lẫn LASA
  highAlertRiskNote?: string; // Ghi chú rủi ro cao ISMP
  // 3. Đúng liều
  standardDosing: string; // Liều thông thường / bắt đầu
  maxDailyDose: string; // Liều tối đa an toàn trong 24h
  renalAdjustment?: string; // Hiệu chỉnh chức năng thận (eGFR / CrCl)
  hepaticAdjustment?: string; // Hiệu chỉnh chức năng gan (Child-Pugh)
  // 4. Đúng đường dùng
  administrationRouteDetails: string; // Đường dùng & kỹ thuật tiêm/truyền
  compatibleDiluents: string[]; // Dung môi tương thích (NaCl 0.9%, G5%...)
  infusionRateLimit?: string; // Giới hạn tốc độ tiêm truyền
  routeWarning?: string; // Cảnh báo đường dùng nguy hiểm (VD: Cấm tiêm trực tiếp KCl)
  // 5. Đúng thời gian
  timingAndFrequency: string; // Thời gian & tần suất dùng (q4h, q8h, trước/sau ăn)
  mealRelation: string; // Liên quan bữa ăn
  stabilityAfterPrep?: string; // Độ ổn định sau khi pha / mở nắp
  // Mở rộng an toàn lâm sàng
  clinicalMonitoring: string; // Theo dõi lâm sàng
  adverseReactions: string[]; // Tác dụng phụ thường gặp & dấu hiệu ngộ độc
  antidote?: string; // Thuốc giải độc đặc hiệu
  blackBoxWarning?: string; // Cảnh báo nguy cơ cao / Hộp đen
  ddiWarnings: string[]; // Tương tác thuốc nghiêm trọng
  pregnancyLactation: string; // Phân loại thai kỳ FDA & cho con bú
  storageAndHandling: string; // Điều kiện bảo quản & quản lý vỏ ống
}

export interface MasterMedication {
  id: string;
  nationalCode: string; // Mã định danh Bộ Y tế / BHYT
  brandName: string; // Tên biệt dược / thương mại
  tallManName?: string; // Tên theo chuẩn Tall Man Lettering (chống nhầm lẫn LASA)
  activeIngredient: string; // Tên hoạt chất quốc tế (INN)
  concentration: string; // Hàm lượng / Nồng độ (VD: 10mg/1ml, 1g)
  dosageForm: string; // Dạng bào chế
  route: string; // Đường dùng chuẩn
  standardUnit: string; // Ống, Lọ, Chai, Viên, Cái, Bộ
  defaultDoseQty: number; // Cơ số mượn/chỉ định thường gặp
  group: MedicationGroup;
  atcCode?: string; // Mã ATC
  isControlled: boolean; // Thuốc kiểm soát đặc biệt (TT 18/2026/TT-BYT)
  isHighAlert: boolean; // Thuốc nguy cơ cao ISMP
  isCrashCart: boolean; // Thuộc cơ số tủ trực cấp cứu
  isAnaphylaxisKit?: boolean; // Thuộc hộp thuốc chống sốc phản vệ (TT 51/2017)
  wardStockCount: number; // Tồn khả dụng tại tủ trực khoa lâm sàng
  hospitalStockCount: number; // Tồn khả dụng tại Kho Dược bệnh viện
  searchAliases: string[]; // Bí danh viết tắt (VD: adre, nor, mor, epi, kcl)
  note?: string;
  clinicalProfile?: FiveRightsSafetyInfo;
}
