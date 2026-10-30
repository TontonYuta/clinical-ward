/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Sổ Nợ Vỏ Morphin & Cơ Số Tủ Trực Cấp Cứu (TT 18/2026/TT-BYT & VBHN 07)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { DebtRecord, UserRole } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { AmpouleDestructionModal } from '../../Modals/AmpouleDestructionModal';
import { ManualBorrowModal } from '../../Modals/ManualBorrowModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import { DebtHeaderRibbon } from './Debt/DebtHeaderRibbon';
import { DebtRecordCard } from './Debt/DebtRecordCard';
import { DebtRecordRow } from './Debt/DebtRecordRow';

interface DebtLedgerTabProps {
  debts: DebtRecord[];
  onSettleDebt: (id: string) => void;
  onSimulateMorningReminder: () => void;
  onToggleAmpouleReturn?: (id: string) => void;
  onDestroyAmpoules?: (ids: string[]) => void;
  onAddNewDebt?: (newRecord: Omit<DebtRecord, 'id' | 'code' | 'borrowDate' | 'borrowTime' | 'status'>) => void;
  onOpenPrintForm?: (formType: PrintableFormType, record?: DebtRecord) => void;
  isAudioMuted: boolean;
  currentUserRole?: UserRole;
}

export const DebtLedgerTab: React.FC<DebtLedgerTabProps> = ({
  debts,
  onSettleDebt,
  onSimulateMorningReminder,
  onToggleAmpouleReturn,
  onDestroyAmpoules,
  onAddNewDebt,
  onOpenPrintForm,
  isAudioMuted,
  currentUserRole = 'nurse',
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'debt' | 'settled' | 'narcotics'>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('debt_filter') as any) || 'all' : 'all'));
  const [searchQuery, setSearchQuery] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('debt_search') || '' : ''));
  const [isDestructionModalOpen, setIsDestructionModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem('debt_filter', filterStatus);
      sessionStorage.setItem('debt_search', searchQuery);
    } catch {}
  }, [filterStatus, searchQuery]);

  const activeDebts = useMemo(() => debts.filter((d) => d.status === 'debt'), [debts]);
  const settledDebts = useMemo(() => debts.filter((d) => d.status === 'settled'), [debts]);
  const narcoticDebts = useMemo(() => debts.filter((d) => d.itemType === 'Thuốc gây nghiện'), [debts]);
  const pendingAmpoules = useMemo(
    () => debts.filter((d) => d.itemType === 'Thuốc gây nghiện' && !d.ampouleReturned),
    [debts]
  );
  const returnedAmpoules = useMemo(
    () => debts.filter((d) => d.itemType === 'Thuốc gây nghiện' && d.ampouleReturned && !d.ampouleDestroyed),
    [debts]
  );

  const filteredDebts = useMemo(() => {
    return debts.filter((item) => {
      let matchesFilter = true;
      if (filterStatus === 'debt') matchesFilter = item.status === 'debt';
      if (filterStatus === 'settled') matchesFilter = item.status === 'settled';
      if (filterStatus === 'narcotics') matchesFilter = item.itemType === 'Thuốc gây nghiện';

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery.trim() ||
        item.itemName.toLowerCase().includes(q) ||
        item.patientName.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.patientRoom.toLowerCase().includes(q);

      return matchesFilter && matchesSearch;
    });
  }, [debts, filterStatus, searchQuery]);

  const handleSettle = (id: string) => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onSettleDebt(id);
  };

  const handleAmpouleReturn = (id: string) => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onToggleAmpouleReturn?.(id);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden gap-2 w-full">
      <header className="flex items-center justify-end gap-6 px-1">
        <div className="hidden sm:flex items-center gap-6 pb-1 text-sm">
          <div><span className="block text-xs text-slate-500">Phiếu đang nợ</span><strong className="mt-0.5 block text-lg font-semibold tabular-nums text-slate-950">{activeDebts.length}</strong></div>
          <div className="h-9 w-px bg-slate-200" />
          <div><span className="block text-xs text-slate-500">Chờ xử lý vỏ ống</span><strong className="mt-0.5 block text-lg font-semibold tabular-nums text-slate-950">{pendingAmpoules.length}</strong></div>
        </div>
      </header>
      <DebtHeaderRibbon
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        totalCount={debts.length}
        activeCount={activeDebts.length}
        narcoticsCount={narcoticDebts.length}
        pendingAmpoulesCount={pendingAmpoules.length}
        settledCount={settledDebts.length}
        returnedAmpoulesCount={returnedAmpoules.length}
        onOpenDestruction={() => setIsDestructionModalOpen(true)}
        onOpenPrintForm={(type) => onOpenPrintForm?.(type)}
        onOpenBorrowModal={() => setIsBorrowModalOpen(true)}
      />

      {/* Mobile Card List */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-2 pr-0.5 pb-8">
        {filteredDebts.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-600 text-sm">
            <p className="font-medium text-slate-900">Không tìm thấy phiếu phù hợp</p>
            <p className="mt-1">Thử đổi từ khóa tìm kiếm hoặc trạng thái lọc.</p>
          </div>
        ) : (
          filteredDebts.map((item) => (
            <DebtRecordCard
              key={item.id}
              item={item}
              onOpenPrintForm={onOpenPrintForm}
              onAmpouleReturn={handleAmpouleReturn}
              onSettle={handleSettle}
            />
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex-col shadow-sm">
        <div className="overflow-x-auto overflow-y-auto flex-1 w-full pb-4">
          <table className="w-full min-w-[1100px] text-left text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr className="font-semibold text-xs tracking-wide">
                <th className="py-3 px-4 whitespace-nowrap">Mã phiếu</th>
                <th className="py-3 px-4">Thuốc / Vật tư</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Số lượng</th>
                <th className="py-3 px-4">Người bệnh</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Thời gian</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Vỏ ống</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Trạng thái</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredDebts.map((item) => (
                <DebtRecordRow
                  key={item.id}
                  item={item}
                  onOpenPrintForm={onOpenPrintForm}
                  onAmpouleReturn={handleAmpouleReturn}
                  onSettle={handleSettle}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AmpouleDestructionModal
        isOpen={isDestructionModalOpen}
        onClose={() => setIsDestructionModalOpen(false)}
        returnedAmpoules={returnedAmpoules}
        onDestroyConfirm={(ids) => onDestroyAmpoules?.(ids)}
        onOpenPrintForm={onOpenPrintForm}
        isAudioMuted={isAudioMuted}
      />

      <ManualBorrowModal
        isOpen={isBorrowModalOpen}
        onClose={() => setIsBorrowModalOpen(false)}
        onConfirmBorrow={(record) => onAddNewDebt?.(record)}
        isAudioMuted={isAudioMuted}
      />
    </div>
  );
};
