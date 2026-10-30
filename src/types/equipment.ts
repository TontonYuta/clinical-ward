/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Quản lý Thiết Bị Y Tế & Chuỗi Lạnh IoT (Nghị định 98/2021 & NĐ 04/2025/NĐ-CP)
 */

export type DeviceRiskClass = 'A' | 'B' | 'C' | 'D';
export type UrgencyLevel = 'urgent' | 'warning' | 'normal';
export type IncidentStatus = 'pending' | 'in_progress' | 'inspected' | 'resolved';
export type AssetCondition = 'operational' | 'misallocated' | 'damaged_repairable' | 'broken_unrepairable' | 'dormant_over_12m';

export interface EquipmentTicket {
  id: string;
  code: string; // SC-2026-xxx
  deviceName: string;
  deviceModel: string;
  serialNumber: string;
  riskClass: DeviceRiskClass;
  accessoryIssue: string;
  location: string;
  urgency: UrgencyLevel;
  assignedEngineer: string;
  status: IncidentStatus;
  reportTime: string;
  lastInspectionDate: string;
  nextInspectionDue: string;
  inspectionUnit: string;
  legalBasis: string;
  imageUrl?: string;
  actionLog?: string[];
}

export interface AssetAuditRecord {
  id: string;
  code: string;
  deviceName: string;
  model: string;
  serialNumber: string;
  riskClass: DeviceRiskClass;
  registeredDepartment: string;
  actualDepartment: string;
  isMisallocated: boolean;
  condition: AssetCondition;
  initialValueVND: number;
  depreciationRatePercent: number;
  operatingYears: number;
  dormantMonths: number;
  pendingLiquidation: boolean;
  liquidationReason?: string;
  qrScannedAt?: string;
}

export interface ColdChainLog {
  timestamp: string;
  temperature: number;
  humidity: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface VaccineBatchItem {
  id: string;
  batchNumber: string;
  name: string;
  genericName: string;
  manufacturer: string;
  country: string;
  quantity: number;
  unit: string;
  expiryDate: string;
  storageCondition: string;
  vvmStage: 1 | 2 | 3 | 4;
  isFreezeSensitive: boolean;
  isLightSensitive: boolean;
  registrationNumber: string;
  nationalCode: string;
  status: 'ready' | 'quarantined';
  notes?: string;
}

export interface ColdChainMonitorState {
  storageName: string;
  currentTemp: number;
  currentHumidity: number;
  targetTempRange: string;
  powerStatus: 'main_power' | 'battery_backup' | 'outage_critical';
  compressorStatus: 'running' | 'idle' | 'fault';
  alarmActive: boolean;
  alarmMessage?: string;
  totalVaccineDoses: number;
  logs: ColdChainLog[];
  quarantineStatus?: 'normal' | 'quarantined' | 'released';
  quarantineTime?: string;
  quarantineReason?: string;
  vvmStage?: number;
  mktTemperature?: number;
}
