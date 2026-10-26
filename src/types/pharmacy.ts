/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Dược Bệnh Viện: Kho Nội Trú, Kho Ngoại Trú & Nợ Vỏ Morphin
 */

export type WarehouseType = 'inpatient_central' | 'ward_emergency' | 'outpatient_pharmacy';
export type DebtStatus = 'debt' | 'settled';

export interface DebtRecord {
  id: string;
  code: string; // PN-2026-xxx
  itemName: string;
  itemType: 'Thuốc gây nghiện' | 'Thuốc hướng thần' | 'Thuốc cấp cứu' | 'Vật tư tiêu hao' | 'Vật tư phẫu thuật';
  isNarcotic?: boolean;
  quantity: string;
  patientName: string;
  patientRoom: string;
  borrowTime: string;
  borrowDate: string;
  borrowerName: string;
  status: DebtStatus;
  note: string;
  legalBasis: string; // Theo TT 18/2026/TT-BYT & VBHN 07/VBHN-BYT
  settledAt?: string;
  ampouleReturned?: boolean;
  ampouleReturnTime?: string;
  ampouleDestroyed?: boolean;
}

export interface InventoryBatch {
  id: string;
  itemCode: string;
  itemName: string;
  category:
    | 'Thuốc gây nghiện'
    | 'Kháng sinh'
    | 'Dịch truyền & Cấp cứu'
    | 'Chỉ phẫu thuật & Khâu'
    | 'Vật tư tiêu hao'
    | 'Thuốc cấp cứu'
    | 'Vắc xin & Chuỗi lạnh'
    | 'Thuốc điều trị chuyên khoa'
    | 'Thuốc nguy cơ cao'
    | 'Thuốc hướng thần';
  commodityType?: 'medication' | 'medical_supply'; // Bóc tách Thuốc vs Vật tư y tế
  warehouseType?: WarehouseType;
  batchNumber: string; // Số lô
  expiryDate: string; // YYYY-MM-DD
  daysLeft: number;
  daysRemaining?: number;
  isNearExpiry: boolean; // Dưới 60 ngày -> FEFO ưu tiên đỏ
  currentStock: number;
  unit: string;
  warehouseLocation: string;
  storageCondition: string;
  priorityOrder: number;
  minThreshold: number; // Định mức an toàn tối thiểu (VBHN 07/VBHN-BYT)
  maxThreshold: number;
  isLowStock: boolean;
  isControlledSubstance?: boolean; // Thuốc kiểm soát đặc biệt (TT 18/2026/TT-BYT)
  nationalCode?: string; // Mã định danh Quốc gia / SĐK Dược Cục QLD (VD: VD-31291-18)
  registrationNumber?: string; // Số đăng ký lưu hành
  activeIngredient?: string; // Hoạt chất chính
  concentration?: string; // Nồng độ / Hàm lượng (dichvucong.dav.gov.vn)
  dosageForm?: string; // Dạng bào chế
  manufacturer?: string; // Cơ sở sản xuất
  country?: string; // Nước sản xuất
  packagingSpec?: string; // Quy cách đóng gói được cấp phép
  standardPharmacopeia?: string; // Tiêu chuẩn (DĐVN V / NSX / USP)
  shelfLife?: string; // Tuổi thọ / Hạn dùng lưu hành (24 tháng, 36 tháng)
  manufacturerAddress?: string; // Địa chỉ nhà máy sản xuất
  applicantName?: string; // Tên doanh nghiệp đứng tên đăng ký
  applicantAddress?: string; // Địa chỉ doanh nghiệp đăng ký
  applicantCountry?: string; // Nước đăng ký
  approvalDecision?: string; // Quyết định cấp phép lưu hành
  decisionDate?: string; // Ngày ban hành quyết định
  registryExpiryDate?: string; // Ngày hết hạn SĐK
  route?: string; // Đường dùng
  hdsdPath?: string; // Đường dẫn tài liệu HDSD (dichvucong.dav.gov.vn)
  labelPath?: string; // Đường dẫn mẫu nhãn lưu hành
  // Dữ liệu lâm sàng chuẩn Dược Thư Quốc Gia
  atcCode?: string;
  drugClass?: string;
  indications?: string;
  contraindications?: string;
  precautions?: string;
  pregnancyWarning?: string;
  adultDosage?: string;
  pediatricDosage?: string;
  renalAdjustment?: string;
  hepaticAdjustment?: string;
  adverseEffects?: string;
  drugInteractions?: string;
  overdoseTreatment?: string;
  antidote?: string;
  clinicalSource?: string;
}
