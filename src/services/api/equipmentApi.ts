/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * API Service for Biomedical Equipment & Incidents (NĐ 04/2025/NĐ-CP)
 */

import { apiRequest } from './client';
import { EquipmentTicket, DeviceRiskClass, UrgencyLevel, IncidentStatus } from '../../types/clinical';

interface BackendEquipmentTicket {
  id: string;
  code: string;
  device_name: string;
  device_model: string;
  serial_number: string;
  risk_class: string;
  accessory_issue: string;
  location: string;
  urgency: string;
  assigned_engineer: string;
  status: string;
  next_inspection_due: string;
  inspection_unit: string;
  legal_basis: string;
  action_log?: string[];
}

function mapBackendToEquipmentTicket(b: BackendEquipmentTicket): EquipmentTicket {
  return {
    id: b.id,
    code: b.code,
    deviceName: b.device_name,
    deviceModel: b.device_model,
    serialNumber: b.serial_number,
    riskClass: (b.risk_class || 'C') as DeviceRiskClass,
    accessoryIssue: b.accessory_issue,
    location: b.location,
    urgency: (b.urgency || 'normal') as UrgencyLevel,
    assignedEngineer: b.assigned_engineer,
    status: (b.status === 'resolved' ? 'resolved' : b.status === 'in_repair' ? 'in_progress' : 'pending') as IncidentStatus,
    reportTime: '08:00 AM',
    lastInspectionDate: '01/01/2026',
    nextInspectionDue: b.next_inspection_due || '30/12/2026',
    inspectionUnit: b.inspection_unit || 'Quatest 1',
    legalBasis: b.legal_basis || 'Nghị định 04/2025/NĐ-CP',
    actionLog: b.action_log || [],
  };
}

export const equipmentApi = {
  async fetchEquipmentTickets(): Promise<EquipmentTicket[]> {
    const raw = await apiRequest<BackendEquipmentTicket[]>('/equipment');
    return raw.map(mapBackendToEquipmentTicket);
  },

  async reportIncident(payload: {
    deviceName: string;
    deviceModel: string;
    serialNumber: string;
    riskClass: DeviceRiskClass;
    location: string;
    accessoryIssue: string;
    urgency: UrgencyLevel;
    assignedEngineer?: string;
  }): Promise<EquipmentTicket> {
    const res = await apiRequest<BackendEquipmentTicket>('/equipment/incidents', {
      method: 'POST',
      body: JSON.stringify({
        device_name: payload.deviceName,
        device_model: payload.deviceModel,
        serial_number: payload.serialNumber,
        risk_class: payload.riskClass,
        location: payload.location,
        accessory_issue: payload.accessoryIssue,
        urgency: payload.urgency,
        assigned_engineer: payload.assignedEngineer || 'KS. Đặng Văn Nam (Phòng TBYT)',
      }),
    });
    return mapBackendToEquipmentTicket(res);
  },
};
