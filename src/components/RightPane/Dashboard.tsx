import React from 'react';
import { Lock } from 'lucide-react';
import {
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  ColdChainMonitorState,
  IncidentStatus,
  AssetAuditRecord,
  UserRole,
  type DashboardTab
} from '../../types/clinical';
import { USER_PROFILES } from '../../data/initialData';
import { DebtLedgerTab } from './Tabs/DebtLedgerTab';
import { CpoePrescriptionTab } from './Tabs/CpoePrescriptionTab';
import { EquipmentIncidentTab } from './Tabs/EquipmentIncidentTab';
import { FefoInventoryTab } from './Tabs/FefoInventoryTab';
import { ColdChainTab } from './Tabs/ColdChainTab';
import { AssetAuditTab } from './Tabs/AssetAuditTab';
import { PrintableFormType } from '../Modals/PrintableFormModal';

export type { DashboardTab };

interface DashboardProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  currentUserRole: UserRole;
  debts: DebtRecord[];
  onSettleDebt: (id: string) => void;
  onSimulateMorningReminder: () => void;
  onToggleAmpouleReturn: (id: string) => void;
  onAddNewDebt?: (newRecord: Omit<DebtRecord, 'id' | 'code' | 'borrowDate' | 'borrowTime' | 'status'>) => void;
  tickets: EquipmentTicket[];
  onUpdateTicketStatus: (id: string, newStatus: IncidentStatus) => void;
  onAddNewTicket: (ticket: EquipmentTicket) => void;
  batches: InventoryBatch[];
  onDispatchBatch: (batchId: string, quantity: number) => void;
  coldChainState: ColdChainMonitorState;
  onTriggerOutage: () => void;
  onRestorePower: () => void;
  assets: AssetAuditRecord[];
  onConfirmTransfer: (id: string, newDept: string) => void;
  onRequestLiquidation: (id: string, reason: string) => void;
  onSimulateQrScan: () => void;
  isAudioMuted: boolean;
  onDestroyAmpoules?: (ids: string[]) => void;
  onRestockBatches?: (batchIds: string[]) => void;
  onReleaseQuarantine?: () => void;
  onOpenBorrowModal?: () => void;
  onOpenIncidentModal?: () => void;
  onOpenAuditTrail?: () => void;
  onOpenPrintForm?: (formType: PrintableFormType, item?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentTab,
  onTabChange,
  currentUserRole = 'nurse',
  debts,
  onSettleDebt,
  onSimulateMorningReminder,
  onToggleAmpouleReturn,
  onAddNewDebt,
  tickets,
  onUpdateTicketStatus,
  onAddNewTicket,
  batches,
  onDispatchBatch,
  coldChainState,
  onTriggerOutage,
  onRestorePower,
  assets,
  onConfirmTransfer,
  onRequestLiquidation,
  onSimulateQrScan,
  isAudioMuted,
  onDestroyAmpoules,
  onRestockBatches,
  onReleaseQuarantine,
  onOpenBorrowModal,
  onOpenIncidentModal,
  onOpenAuditTrail,
  onOpenPrintForm,
}) => {
  const currentProfile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;
  const allowedTabs = currentProfile.allowedTabs || ['debt'];

  return (
    <div className="flex flex-col h-full bg-slate-50/70 overflow-hidden">
      {/* Main Tab Viewport (Pinned Controls & Isolated Scroll Table) */}
      <div className="flex-1 overflow-hidden p-3 sm:p-4 min-h-0 flex flex-col">
        {!allowedTabs.includes(currentTab) ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white border border-slate-200 rounded-xl m-2">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1.5">
              Phân Hệ Nằm Ngoài Thẩm Quyền Truy Cập (RBAC Isolation)
            </h3>
            <p className="text-sm text-slate-600 max-w-md mb-5 leading-relaxed">
              Tài khoản hiện tại (<strong className="text-slate-900 font-semibold">{currentProfile.name}</strong> - {currentProfile.roleName}) không có quyền thao tác trên phân hệ này theo quy chế quản trị bệnh viện.
            </p>
            <button
              onClick={() => onTabChange(currentProfile.defaultTab || allowedTabs[0] || 'debt')}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition cursor-pointer active:scale-98"
            >
              Quay về phân hệ được phân quyền ({currentProfile.defaultTab || allowedTabs[0]})
            </button>
          </div>
        ) : (
          <>
            {currentTab === 'cpoe' && (
              <CpoePrescriptionTab doctorName={USER_PROFILES[currentUserRole]?.name} />
            )}

            {currentTab === 'debt' && (
              <DebtLedgerTab
                debts={debts}
                onSettleDebt={onSettleDebt}
                onSimulateMorningReminder={onSimulateMorningReminder}
                onToggleAmpouleReturn={onToggleAmpouleReturn}
                onDestroyAmpoules={onDestroyAmpoules}
                onAddNewDebt={onAddNewDebt}
                onOpenPrintForm={onOpenPrintForm}
                isAudioMuted={isAudioMuted}
                currentUserRole={currentUserRole}
              />
            )}

            {currentTab === 'equipment' && (
              <EquipmentIncidentTab
                tickets={tickets}
                onUpdateTicketStatus={onUpdateTicketStatus}
                onAddNewTicket={onAddNewTicket}
                onOpenPrintForm={onOpenPrintForm}
                isAudioMuted={isAudioMuted}
                currentUserRole={currentUserRole}
              />
            )}

            {currentTab === 'fefo' && (
              <FefoInventoryTab
                batches={batches}
                onDispatchBatch={onDispatchBatch}
                onRestockBatches={onRestockBatches}
                onOpenPrintForm={onOpenPrintForm}
                isAudioMuted={isAudioMuted}
              />
            )}

            {currentTab === 'coldchain' && (
              <ColdChainTab
                coldChainState={coldChainState}
                onTriggerOutage={onTriggerOutage}
                onRestorePower={onRestorePower}
                onReleaseQuarantine={onReleaseQuarantine}
                onOpenPrintForm={onOpenPrintForm}
                isAudioMuted={isAudioMuted}
              />
            )}

            {currentTab === 'asset_audit' && (
              <AssetAuditTab
                assets={assets}
                onConfirmTransfer={onConfirmTransfer}
                onRequestLiquidation={onRequestLiquidation}
                onSimulateQrScan={onSimulateQrScan}
                onOpenPrintForm={onOpenPrintForm}
                isAudioMuted={isAudioMuted}
                currentUserRole={currentUserRole}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

