/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UrgencyLevel = 'urgent' | 'warning' | 'normal';
export type DebtStatus = 'debt' | 'settled';
export type IncidentStatus = 'pending' | 'in_progress' | 'inspected' | 'resolved';
export type DeviceRiskClass = 'A' | 'B' | 'C' | 'D';
export type AssetCondition = 'operational' | 'misallocated' | 'damaged_repairable' | 'broken_unrepairable' | 'dormant_over_12m';

export type UserRole = 'nurse' | 'biomedical_engineer' | 'pharmacist' | 'doctor' | 'director';

export type ClinicalActionType =
  | 'BORROW_EMERGENCY'
  | 'SETTLE_DEBT'
  | 'RETURN_AMPOULE'
  | 'DESTROY_AMPOULES'
  | 'CREATE_INCIDENT'
  | 'HANDOVER_EQUIPMENT'
  | 'DISPATCH_FEFO'
  | 'RESTOCK_MEDICATION'
  | 'TRANSFER_ASSET'
  | 'LIQUIDATE_ASSET'
  | 'RESTORE_POWER'
  | 'RELEASE_VACCINE_QUARANTINE'
  | 'SWITCH_ROLE';

export type DashboardTab = 'debt' | 'equipment' | 'fefo' | 'coldchain' | 'asset_audit';

export interface UserProfile {
  role: UserRole;
  name: string;
  roleName: string;
  department: string;
  practiceCertificate: string; // Chứng chỉ hành nghề y tế (CCHN) / Mã thẻ BME
  pinCode: string; // Mã PIN lâm sàng 4 số
  rfidCardId: string; // Mã thẻ RFID/NFC
  allowedActions: ClinicalActionType[];
  allowedTabs: DashboardTab[]; // Các phân hệ lâm sàng được phép hiển thị theo RBAC
  responsibilities: string;
  defaultTab: DashboardTab;
  badgeColor: string;
}

export interface AuditTrailRecord {
  id: string; // AUD-2026-xxxx
  timestamp: string;
  actionType: ClinicalActionType;
  actionTitle: string;
  targetItem: string;
  legalBasis: string;
  signerRole: UserRole;
  signerName: string;
  signerCertificate: string;
  witnessRole?: UserRole;
  witnessName?: string;
  witnessCertificate?: string;
  authMethod: 'PIN' | 'RFID_NFC';
  integrityHash: string;
  status: 'verified';
}

export interface ClinicalAuthRequest {
  actionType: ClinicalActionType;
  title: string;
  description: string;
  targetItem: string;
  legalBasis: string;
  requiredRoles: UserRole[]; // Danh sách các vai trò có thẩm quyền
  requiresDualWitness?: boolean; // Yêu cầu 02 người ký (Hội đồng tiêu hủy Morphin TT20)
  dualWitnessRoles?: UserRole[];
  onConfirm: (signer: UserProfile, witness?: UserProfile, authMethod?: 'PIN' | 'RFID_NFC') => void;
  onCancel?: () => void;
}

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
  legalBasis: string; // "Thông tư 22/2011/TT-BYT - Điều 9"
  settledAt?: string;
  // Theo Thông tư 20/2017/TT-BYT: Kiểm soát vỏ ống thuốc gây nghiện tiêu hủy
  ampouleReturned?: boolean;
  ampouleReturnTime?: string;
  ampouleDestroyed?: boolean;
}

export interface EquipmentTicket {
  id: string;
  code: string; // SC-2026-xxx
  deviceName: string;
  deviceModel: string;
  serialNumber: string;
  riskClass: DeviceRiskClass; // Loại C, D theo NĐ 98/2021
  accessoryIssue: string; // Dây thở, sensor oxy, bản cực sốc tim...
  location: string; // Phòng mổ 2, Khoa Cấp cứu A9, ICU...
  urgency: UrgencyLevel;
  assignedEngineer: string;
  status: IncidentStatus;
  reportTime: string;
  lastInspectionDate: string;
  nextInspectionDue: string;
  inspectionUnit: string;
  legalBasis: string; // "Nghị định 98/2021/NĐ-CP - Quản lý trang thiết bị loại D"
  imageUrl?: string;
  actionLog?: string[];
}

export interface InventoryBatch {
  id: string;
  itemCode: string;
  itemName: string;
  category: 'Thuốc gây nghiện' | 'Kháng sinh' | 'Dịch truyền & Cấp cứu' | 'Chỉ phẫu thuật & Khâu' | 'Vật tư tiêu hao' | 'Thuốc cấp cứu' | 'Vắc xin & Chuỗi lạnh';
  batchNumber: string; // Số lô
  expiryDate: string; // YYYY-MM-DD
  daysLeft: number;
  daysRemaining?: number; // alias
  isNearExpiry: boolean; // Dưới 60 ngày -> FEFO ưu tiên đỏ
  currentStock: number;
  unit: string;
  warehouseLocation: string; // Kệ A1 - Tầng 2, Tủ sắt thuốc độc...
  storageCondition: string; // 15-25°C, <30°C GSP, Kho lạnh 2-8°C
  priorityOrder: number; // 1 là cận hạn nhất cần xuất ngay
  // Quản lý định mức số lượng an toàn theo TT 22/2011 & GSP TT 36/2018
  minThreshold: number; // Định mức cơ số an toàn tối thiểu
  maxThreshold: number; // Định mức cơ số dự trữ tối đa
  isLowStock: boolean; // currentStock <= minThreshold
}

export interface AssetAuditRecord {
  id: string;
  code: string; // TS-2026-xxx
  deviceName: string;
  model: string;
  serialNumber: string;
  riskClass: DeviceRiskClass;
  registeredDepartment: string; // Vị trí theo sổ kế toán tài sản công
  actualDepartment: string; // Vị trí quét QR thực tế buồng bệnh
  isMisallocated: boolean; // Bị mượn miệng sai khoa
  condition: AssetCondition;
  initialValueVND: number;
  depreciationRatePercent: number; // Tỷ lệ hao mòn tài sản (NĐ 151)
  operatingYears: number;
  dormantMonths: number; // Số tháng ngưng hoạt động
  pendingLiquidation: boolean; // Kiến nghị thanh lý tài sản nhà nước
  liquidationReason?: string;
  qrScannedAt?: string;
}

export interface ColdChainLog {
  timestamp: string;
  temperature: number;
  humidity: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface ColdChainMonitorState {
  storageName: string;
  currentTemp: number;
  currentHumidity: number;
  targetTempRange: string; // "2°C - 8°C"
  powerStatus: 'main_power' | 'battery_backup' | 'outage_critical';
  compressorStatus: 'running' | 'idle' | 'fault';
  alarmActive: boolean;
  alarmMessage?: string;
  totalVaccineDoses: number;
  logs: ColdChainLog[];
  // Quy chuẩn Biệt trữ GSP TT 36 & WHO PQS khi có sự cố quá nhiệt
  quarantineStatus?: 'normal' | 'quarantined' | 'released';
  quarantineTime?: string;
  quarantineReason?: string;
  vvmStage?: number; // 1 | 2 | 3 | 4
  mktTemperature?: number; // Ví dụ: 5.6°C
}

export interface ChatAttachment {
  type: 'image' | 'voice' | 'document';
  url?: string;
  title: string;
  description?: string;
}

export interface ActionPayload {
  type: 'DEBT_ADDED' | 'TICKET_CREATED' | 'FEFO_DISPATCHED' | 'INSPECTION_CHECK' | 'OUTAGE_SIMULATION' | 'DEBT_REMINDER' | 'ASSET_AUDIT' | 'AMPOULE_RETURNED' | 'RESTOCK_CHECK' | 'RESTOCK_APPROVED';
  data?: any;
  targetTab?: 'debt' | 'equipment' | 'fefo' | 'coldchain' | 'asset_audit';
}

export interface CdssAlert {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  antidoteRecommendation?: string;
  regulatoryReference?: string;
}

export interface AgentActionCard {
  cardType: 'borrow_confirm' | 'incident_confirm' | 'fefo_report' | 'low_stock_report' | 'equipment_report' | 'coldchain_status' | 'audit_integrity' | 'legal_guide' | 'shift_handover_report' | 'ocr_invoice_confirm' | 'biomedical_diagnostics';
  title: string;
  summary: string;
  data: any;
  primaryActionLabel?: string;
  primaryActionType?: string;
  targetTab?: 'debt' | 'equipment' | 'fefo' | 'coldchain' | 'asset_audit';
  status?: 'pending' | 'executed' | 'cancelled';
  cdssAlert?: CdssAlert;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  legalReference?: {
    lawCode: string; // "Thông tư 22/2011/TT-BYT", "Nghị định 98/2021/NĐ-CP", "Nghị định 151/2017/NĐ-CP", "Thông tư 36/2018/TT-BYT"
    title: string;
    clause: string;
  };
  actionPayload?: ActionPayload;
  card?: AgentActionCard;
  suggestedChips?: string[];
  cdssAlert?: CdssAlert;
  pipelineStage?: 'offline_engine' | 'cloud_gemini_vision' | 'cloud_gemini_reasoning';
}

export interface QuickSuggestionChip {
  id: string;
  label: string;
  fullPrompt: string;
  badge: string;
  category: 'debt' | 'equipment' | 'fefo' | 'coldchain' | 'inspection' | 'asset_audit';
}
