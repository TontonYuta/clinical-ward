/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Clock, Search, Check, ShieldAlert, ShieldCheck, Flame, Lock, PlusCircle, Printer } from 'lucide-react';
import { DebtRecord, UserRole } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { AmpouleDestructionModal } from '../../Modals/AmpouleDestructionModal';
import { ManualBorrowModal } from '../../Modals/ManualBorrowModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'debt' | 'settled' | 'narcotics'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDestructionModalOpen, setIsDestructionModalOpen] = useState(false);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);

  const activeDebts = debts.filter(d => d.status === 'debt');
  const settledDebts = debts.filter(d => d.status === 'settled');
  const narcoticDebts = debts.filter(d => d.itemType === 'Thuốc gây nghiện');
  const pendingAmpoules = debts.filter(d => d.itemType === 'Thuốc gây nghiện' && !d.ampouleReturned);
  const returnedAmpoules = debts.filter(d => d.itemType === 'Thuốc gây nghiện' && d.ampouleReturned && !d.ampouleDestroyed);


  const filteredDebts = debts.filter(item => {
    let matchesFilter = true;
    if (filterStatus === 'debt') matchesFilter = item.status === 'debt';
    if (filterStatus === 'settled') matchesFilter = item.status === 'settled';
    if (filterStatus === 'narcotics') matchesFilter = item.itemType === 'Thuốc gây nghiện';

    const matchesSearch =
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.patientRoom.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSettle = (id: string) => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onSettleDebt(id);
  };

  const handleAmpouleReturn = (id: string) => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    if (onToggleAmpouleReturn) {
      onToggleAmpouleReturn(id);
    }
  };

  const handleDestroyConfirm = (ids: string[]) => {
    if (onDestroyAmpoules) {
      onDestroyAmpoules(ids);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-2.5 w-full">
      {/* 1. Unified Minimalist Command Ribbon */}
      <div className="bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Search input + Segmented Filter Pills */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm thuốc, bệnh nhân, buồng..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400 transition"
            />
          </div>

          <div className="flex items-center gap-1 text-sm bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
                filterStatus === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Tất cả ({debts.length})
            </button>
            <button
              onClick={() => setFilterStatus('debt')}
              className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
                filterStatus === 'debt' ? 'bg-white text-amber-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Đang nợ ({activeDebts.length})
            </button>
            <button
              onClick={() => setFilterStatus('narcotics')}
              className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
                filterStatus === 'narcotics' ? 'bg-white text-rose-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Thuốc gây nghiện ({narcoticDebts.length})
              {pendingAmpoules.length > 0 && (
                <span className="ml-1 text-xs font-bold text-rose-600">· {pendingAmpoules.length} nợ vỏ</span>
              )}
            </button>
            <button
              onClick={() => setFilterStatus('settled')}
              className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
                filterStatus === 'settled' ? 'bg-white text-slate-800 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Đã hoàn bù ({settledDebts.length})
            </button>
          </div>
        </div>

        {/* Right: Primary Action + Secondary Controls */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          {returnedAmpoules.length > 0 && (
            <button
              onClick={() => setIsDestructionModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-sm font-semibold transition cursor-pointer"
              title="Hội đồng tiêu hủy vỏ ống thuốc gây nghiện TT 20"
            >
              <Flame className="w-4 h-4 text-rose-600" />
              <span>Hủy vỏ ({returnedAmpoules.length})</span>
            </button>
          )}

          <button
            onClick={() => onOpenPrintForm?.('TT20_AMPOULE_DESTRUCTION')}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium transition cursor-pointer"
            title="In biểu mẫu hành chính A4"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">In biểu mẫu</span>
          </button>

          <button
            onClick={() => setIsBorrowModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold transition cursor-pointer active:scale-98"
            title="Lập phiếu mượn khẩn thuốc / vật tư (TT 22)"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Mượn Khẩn</span>
          </button>
        </div>
      </div>

      {/* 4A. Mobile Card-Based List (md:hidden) - Modern, touch-friendly, no horizontal cut-off */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5 pb-8">
        {filteredDebts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Không tìm thấy phiếu mượn nào phù hợp với bộ lọc.
          </div>
        ) : (
          filteredDebts.map((item) => {
            const isDebt = item.status === 'debt';
            const isNarcotic = item.itemType === 'Thuốc gây nghiện';
            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 hover:border-slate-300 transition"
              >
                {/* Card Top: Code + Time + Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                      {item.code}
                    </span>
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {item.borrowTime}
                    </span>
                  </div>
                  <div>
                    {isDebt ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Đang nợ
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                        ✓ Đã hoàn bù
                      </span>
                    )}
                  </div>
                </div>

                {/* Drug & Quantity */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-slate-900 leading-snug">
                      {item.itemName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                          isNarcotic
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {item.itemType}
                      </span>
                      <span className="text-xs sm:text-sm text-slate-600">
                        BN: <strong className="text-slate-900 font-semibold">{item.patientName}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-lg font-black text-teal-900 bg-teal-50 border border-teal-200/90 px-3 py-1 rounded-xl inline-block shadow-2xs">
                      {item.quantity}
                    </span>
                  </div>
                </div>

                {/* Room & Ampoule status */}
                <div className="flex items-center justify-between text-xs sm:text-sm pt-2.5 border-t border-slate-100">
                  <div className="text-slate-600">
                    📍 <span className="font-medium text-slate-900">{item.patientRoom}</span>
                  </div>
                  <div>
                    {isNarcotic ? (
                      item.ampouleDestroyed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                          Đã tiêu hủy vỏ
                        </span>
                      ) : item.ampouleReturned ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Đã nộp vỏ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          Nợ vỏ Morphin
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400 text-xs">Cơ số thường</span>
                    )}
                  </div>
                </div>

                {/* Mobile Actions */}
                <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100">
                  <button
                    onClick={() =>
                      onOpenPrintForm?.(
                        isNarcotic ? 'TT20_AMPOULE_DESTRUCTION' : 'EMERGENCY_BORROW_TICKET',
                        item
                      )
                    }
                    className="flex-1 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-teal-700" />
                    <span>In phiếu</span>
                  </button>
                  {isDebt && (
                    isNarcotic && !item.ampouleReturned ? (
                      <button
                        onClick={() => handleAmpouleReturn(item.id)}
                        className="flex-2 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        <span>Thu hồi vỏ nộp khay</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSettle(item.id)}
                        className="flex-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
                      >
                        <Check className="w-4 h-4" />
                        <span>Duyệt hoàn bù</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4B. Desktop Table (hidden md:flex) - Pinned Sticky Header, Isolated Scroll Body */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex-col">
        <div className="overflow-auto flex-1 w-full pb-24">
          <table className="w-full text-left text-sm table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-700 font-bold text-xs uppercase tracking-wider">
                <th className="py-3.5 px-4 w-28 whitespace-nowrap">Mã phiếu</th>
                <th className="py-3.5 px-3.5 w-[26%]">Mặt hàng y tế</th>
                <th className="py-3.5 px-2 text-center w-16 whitespace-nowrap">Số lượng</th>
                <th className="py-3.5 px-3.5 w-[26%]">Bệnh nhân / Vị trí</th>
                <th className="py-3.5 px-2 text-center w-24 whitespace-nowrap">Thời gian</th>
                <th className="py-3.5 px-2 text-center w-32 whitespace-nowrap">Vỏ ống (TT 20)</th>
                <th className="py-3.5 px-2 text-center w-28 whitespace-nowrap">Trạng thái</th>
                <th className="py-3.5 px-4 text-right w-28 whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDebts.map((item) => {
                const isDebt = item.status === 'debt';
                const isNarcotic = item.itemType === 'Thuốc gây nghiện';
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-800 font-bold text-xs whitespace-nowrap">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200/70 inline-block">
                        {item.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 pr-2">
                      <span className="font-bold text-slate-950 block text-[15px] leading-snug truncate" title={item.itemName}>
                        {item.itemName}
                      </span>
                      <span className="text-xs text-slate-600 font-medium block truncate mt-0.5">{item.itemType}</span>
                    </td>
                    <td className="py-3.5 px-2 text-center font-mono font-extrabold text-slate-950 text-base whitespace-nowrap">
                      {item.quantity}
                    </td>
                    <td className="py-3.5 px-3.5 pr-2">
                      <span className="text-slate-950 font-bold block text-[15px] leading-snug truncate" title={item.patientName}>
                        {item.patientName}
                      </span>
                      <span className="text-xs text-slate-700 font-medium block truncate mt-0.5" title={item.patientRoom}>
                        📍 {item.patientRoom}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-center text-slate-700 text-xs font-mono font-semibold whitespace-nowrap">
                      {item.borrowTime}
                    </td>
                    <td className="py-3.5 px-2 text-center whitespace-nowrap">
                      {isNarcotic ? (
                        item.ampouleDestroyed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            Đã tiêu hủy
                          </span>
                        ) : item.ampouleReturned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Đã nộp khay
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            Chưa nộp vỏ
                          </span>
                        )
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-2 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isDebt ? 'bg-amber-50 text-amber-900 border border-amber-300' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isDebt ? 'Đang nợ' : 'Đã hoàn bù'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => onOpenPrintForm?.(isNarcotic ? 'TT20_AMPOULE_DESTRUCTION' : 'EMERGENCY_BORROW_TICKET', item)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-teal-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
                          title="In phiếu kẹp bệnh án (TT22)"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isDebt && (
                          isNarcotic && !item.ampouleReturned ? (
                            <button
                              onClick={() => handleAmpouleReturn(item.id)}
                              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 text-xs font-bold cursor-pointer active:scale-98 transition shadow-2xs whitespace-nowrap"
                              title="Thu hồi vỏ ống thuốc gây nghiện nộp vào khay (Điều 15 TT 20)"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Nộp vỏ</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSettle(item.id)}
                              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                              title="Duyệt hoàn bù cơ số tủ trực (TT 22)"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Hoàn bù</span>
                            </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Closed-loop Modal: Hội đồng tiêu hủy vỏ ống TT 20 */}
      <AmpouleDestructionModal
        isOpen={isDestructionModalOpen}
        onClose={() => setIsDestructionModalOpen(false)}
        returnedAmpoules={returnedAmpoules}
        onDestroyConfirm={handleDestroyConfirm}
        onOpenPrintForm={onOpenPrintForm}
        isAudioMuted={isAudioMuted}
      />

      {/* 7. Manual Emergency Borrowing Modal (100% No-AI) */}
      <ManualBorrowModal
        isOpen={isBorrowModalOpen}
        onClose={() => setIsBorrowModalOpen(false)}
        onConfirmBorrow={(record) => onAddNewDebt && onAddNewDebt(record)}
        isAudioMuted={isAudioMuted}
      />
    </div>
  );
};
