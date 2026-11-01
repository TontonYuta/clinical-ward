/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tổng Quan Trạm Làm Việc Lâm Sàng (Operations Overview, <=200 LOC)
 */

import React from 'react';
import type { DashboardTab, UserRole, AuditTrailRecord } from '../../types/clinical';
import type { DebtRecord, InventoryBatch } from '../../types/pharmacy';
import type { EquipmentTicket, ColdChainMonitorState, AssetAuditRecord } from '../../types/equipment';
import { canSearchMedications, canSearchPatients } from './flatDashboardModel';
import { OverviewHeader } from './Overview/OverviewHeader';
import { OverviewCapabilities } from './Overview/OverviewCapabilities';
import { OverviewPatientCenter } from './Overview/OverviewPatientCenter';
import { OverviewMedicationCenter } from './Overview/OverviewMedicationCenter';
import { OverviewLegalDocs } from './Overview/OverviewLegalDocs';
import { OverviewOperationsKpi } from './Overview/OverviewOperationsKpi';

interface OperationsOverviewProps {
  currentUserRole: UserRole;
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  coldChainState: ColdChainMonitorState;
  assets: AssetAuditRecord[];
  auditRecords: AuditTrailRecord[];
  allowedTabs: DashboardTab[];
  onTabChange: (tab: DashboardTab) => void;
  onOpenPatient: (query: string) => void;
  onOpenMedication: (query: string) => void;
  onOpenCopilot?: () => void;
  onOpenLegalDocs?: () => void;
}

export const OperationsOverview: React.FC<OperationsOverviewProps> = ({
  currentUserRole,
  debts,
  tickets,
  batches,
  coldChainState,
  assets,
  auditRecords,
  allowedTabs,
  onTabChange,
  onOpenPatient,
  onOpenMedication,
  onOpenCopilot,
  onOpenLegalDocs
}) => {
  const roleTitles: Record<UserRole, string> = {
    nurse: 'Điều Dưỡng Trực',
    doctor: 'Bác Sĩ Điều Trị',
    pharmacist: 'Dược Sĩ Lâm Sàng',
    biomedical_engineer: 'Kỹ Sư Thiết Bị Y Tế',
    director: 'Lãnh Đạo Bệnh Viện'
  };

  const roleTitle = roleTitles[currentUserRole] || 'Nhân Viên Y Tế';
  const canSearchPatientData = canSearchPatients(currentUserRole);
  const canSearchMedicationData = canSearchMedications(currentUserRole);

  return (
    <div className="h-full overflow-y-auto bg-slate-50/70 p-3 sm:p-6 thin-scrollbar">
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        {/* 1. Header & AI Copilot Banner */}
        <OverviewHeader
          currentUserRole={currentUserRole}
          roleTitle={roleTitle}
          onOpenCopilot={onOpenCopilot}
        />

        {/* 2. Bản đồ năng lực hệ thống (4 Trụ Cột Nghiệp Vụ) */}
        <OverviewCapabilities
          allowedTabs={allowedTabs}
          onTabChange={onTabChange}
        />

        {/* 3. Trung tâm Thông tin Bệnh nhân & Thông tin Dược */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <OverviewPatientCenter
            canSearch={canSearchPatientData}
            onOpenPatient={onOpenPatient}
          />
          <OverviewMedicationCenter
            canSearch={canSearchMedicationData}
            onOpenMedication={onOpenMedication}
            onOpenFefo={() => onTabChange('fefo')}
          />
        </div>

        {/* 4. Tài liệu quy phạm pháp luật đính kèm (Thông tư, Nghị định, Dược thư) */}
        <OverviewLegalDocs
          onOpenLegalDocs={onOpenLegalDocs}
        />

        {/* 5. Chỉ số KPI Vận Hành & Việc Cần Chú Ý */}
        <OverviewOperationsKpi
          currentUserRole={currentUserRole}
          debts={debts}
          tickets={tickets}
          batches={batches}
          coldChainState={coldChainState}
          assets={assets}
          auditRecords={auditRecords}
          allowedTabs={allowedTabs}
          onTabChange={onTabChange}
        />
      </div>
    </div>
  );
};
