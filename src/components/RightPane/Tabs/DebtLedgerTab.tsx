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
import { PatientDetailModal } from '../../Modals/PatientDetailModal';
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
  onToggleAmpouleReturn,
  onDestroyAmpoules,
  onAddNewDebt,
  onOpenPrintForm,
  isAudioMuted,
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | 'debt' | 'settled' | 'narcotics'>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('debt_filter') as any) || 'all' : 'all'));
  const [searchQuery, setSearchQuery] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('debt_search') || '' : ''));
  const [isDestructionModalOpen, setIsDestructionModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [selectedPatientForDetail, setSelectedPatientForDetail] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('debt_filter', filterStatus);
      sessionStorage.setItem('debt_search', searchQuery);
    } catch {}
  }, [filterStatus, searchQuery]);

  const activeDebts = useMemo(() => debts.filter((d) => d.status === 'debt'), [debts]);
  const narcoticDebts = useMemo(() => debts.filter((d) => d.itemType === 'Thuốc gây nghiện'), [debts]);
  const pendingAmpoules = useMemo(() => debts.filter((d) => d.itemType === 'Thuốc gây nghiện' && !d.ampouleReturned), [debts]);
  const returnedAmpoules = useMemo(() => debts.filter((d) => d.itemType === 'Thuốc gây nghiện' && d.ampouleReturned && !d.ampouleDestroyed), [debts]);
  const settledDebts = useMemo(() => debts.filter((d) => d.status === 'settled'), [debts]);

  const filteredDebts = useMemo(() => {
    return debts.filter((item) => {
      if (filterStatus === 'debt' && item.status !== 'debt') return false;
      if (filterStatus === 'settled' && item.status !== 'settled') return false;
      if (filterStatus === 'narcotics' && item.itemType !== 'Thuốc gây nghiện') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.itemName.toLowerCase().includes(q) ||
          item.patientName.toLowerCase().includes(q) ||
          item.patientRoom.toLowerCase().includes(q) ||
          item.code.toLowerCase().includes(q) ||
          item.borrowerName.toLowerCase().includes(q)
        );
      }
      return true;
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
    <div className="flex flex-col h-full overflow-hidden gap-1.5 w-full">
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

      {/* Mobile View: Danh sách phẳng hành chính */}
      <div className="md:hidden flex-1 overflow-y-auto px-1 pb-8">
        {filteredDebts.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
            Không tìm thấy phiếu mượn nợ phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredDebts.map((item, idx) => (
            <DebtRecordCard
              key={item.id}
              index={idx}
              item={item}
              onOpenPrintForm={onOpenPrintForm}
              onAmpouleReturn={handleAmpouleReturn}
              onSettle={handleSettle}
              onSelectPatient={(name) => setSelectedPatientForDetail(name)}
            />
          ))
        )}
      </div>

      {/* Desktop View: Bảng sổ nợ hành chính */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white border-y border-slate-200 overflow-hidden flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 w-full">
          <table className="w-full min-w-[1550px] table-fixed text-left text-sm border-collapse">
            <colgroup>
              <col style={{ width: '70px' }} />
              <col style={{ width: '180px' }} />
              <col className="w-[26%]" style={{ minWidth: '320px' }} />
              <col style={{ width: '130px' }} />
              <col className="w-[22%]" style={{ minWidth: '280px' }} />
              <col style={{ width: '220px' }} />
              <col style={{ width: '180px' }} />
              <col style={{ width: '160px' }} />
              <col style={{ width: '160px' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr className="font-semibold text-sm tracking-normal">
                <th className="py-3 px-3 text-center border-r border-slate-200">STT</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Mã phiếu</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Thuốc / Vật tư mượn</th>
                <th className="py-3 px-3 text-center border-r border-slate-200">Số lượng</th>
                <th className="py-3 px-3.5 border-r border-slate-200">Người bệnh, Buồng &amp; SĐT</th>
                <th className="py-3 px-3.5 text-center border-r border-slate-200">Thời gian</th>
                <th className="py-3 px-3.5 text-center border-r border-slate-200">Vỏ ống TT20</th>
                <th className="py-3 px-3.5 text-center border-r border-slate-200">Trạng thái</th>
                <th className="py-3 px-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 font-medium text-sm">
                    Không tìm thấy phiếu khớp với tiêu chí tra cứu.
                  </td>
                </tr>
              ) : (
                filteredDebts.map((item, idx) => (
                  <DebtRecordRow
                    key={item.id}
                    index={idx}
                    item={item}
                    onOpenPrintForm={onOpenPrintForm}
                    onAmpouleReturn={handleAmpouleReturn}
                    onSettle={handleSettle}
                    onSelectPatient={(name) => setSelectedPatientForDetail(name)}
                  />
                ))
              )}
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

      {/* Modal Chi Tiết Bệnh Nhân & An Toàn Lâm Sàng Chuẩn Kho Dược */}
      <PatientDetailModal
        isOpen={!!selectedPatientForDetail}
        onClose={() => setSelectedPatientForDetail(null)}
        patientIdOrName={selectedPatientForDetail || ''}
      />
    </div>
  );
};
