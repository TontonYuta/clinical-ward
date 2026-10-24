/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Định danh Người dùng, Phân quyền RBAC & Chứng thực Lâm sàng
 */

export type UserRole =
  | 'doctor'
  | 'nurse'
  | 'pharmacist'
  | 'biomedical_engineer'
  | 'director';

export type DashboardTab =
  | 'debt'
  | 'equipment'
  | 'fefo'
  | 'coldchain'
  | 'asset_audit';

export type ClinicalActionType =
  | 'PRESCRIBE_MEDICATION'
  | 'APPROVE_PRESCRIPTION'
  | 'DISPENSE_OUTPATIENT'
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

export interface UserProfile {
  role: UserRole;
  name: string;
  roleName: string;
  department: string;
  practiceCertificate: string; // Chứng chỉ hành nghề y tế (CCHN)
  pinCode: string; // Mã PIN lâm sàng 4 số
  rfidCardId: string; // Mã thẻ RFID/NFC
  allowedActions: ClinicalActionType[];
  allowedTabs: DashboardTab[];
  responsibilities: string;
  defaultTab: DashboardTab;
  badgeColor: string;
}

export interface ClinicalAuthRequest {
  actionType: ClinicalActionType;
  title: string;
  description: string;
  targetItem: string;
  legalBasis: string;
  requiredRoles: UserRole[];
  requiresDualWitness?: boolean; // Yêu cầu 02 người ký (Hội đồng tiêu hủy Morphin TT 18/2026)
  dualWitnessRoles?: UserRole[];
  onConfirm: (signer: UserProfile, witness?: UserProfile, authMethod?: 'PIN' | 'RFID_NFC') => void;
  onCancel?: () => void;
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
