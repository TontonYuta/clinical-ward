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
}
