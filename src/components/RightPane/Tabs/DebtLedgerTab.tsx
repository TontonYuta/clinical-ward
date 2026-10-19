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
    <div className="flex flex-col h-full overflow-hidden space-y-2 w-full">
      {/* 1. Slim Integrated Executive Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
          <h2 className="hidden sm:inline text-sm sm:text-base font-bold text-slate-900 whitespace-nowrap">
            Sổ Nợ Tủ Trực Cấp Cứu
          </h2>
          <span className="text-xs font-mono text-slate-500 border-l border-slate-200 pl-2.5 hidden md:inline">
            Căn cứ: TT 22/2011 &amp; TT 20/2017/TT-BYT
          </span>
          {/* Subtle inline summary */}
          <div className="flex items-center gap-2 text-xs text-slate-600 sm:border-l sm:border-slate-200 sm:pl-2.5">
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/80 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {activeDebts.length} đang nợ
            </span>
            {pendingAmpoules.length > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                {pendingAmpoules.length} nợ vỏ
              </span>
            )}
            <span className="text-slate-400 font-medium hidden sm:inline">·</span>
            <span className="text-slate-600 text-xs font-medium hidden sm:inline">
              {settledDebts.length} đã hoàn bù
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {/* Manual Borrow Button (100% Standalone Clinical Workstation) */}
          <button
            onClick={() => setIsBorrowModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer active:scale-98"
            title="Lập phiếu mượn khẩn thuốc / vật tư từ tủ trực cấp cứu ca đêm (TT 22/2011/TT-BYT)"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">+ Mượn Khẩn Thuốc / Vật Tư</span>
            <span className="sm:hidden">+ Mượn Khẩn</span>
          </button>

          {returnedAmpoules.length > 0 && (
            <button
              onClick={() => setIsDestructionModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer active:scale-98"
              title="Lập biên bản Hội đồng tiêu hủy vỏ ống thuốc gây nghiện theo Thông tư 20/2017/TT-BYT (Xem danh mục & in Mẫu 16)"
            >
              <Flame className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">Hội đồng hủy vỏ ({returnedAmpoules.length})</span>
              <span className="sm:hidden">Hủy vỏ ({returnedAmpoules.length})</span>
            </button>
          )}

          <button
            onClick={onSimulateMorningReminder}
            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer active:scale-98"
            title="Mô phỏng chuông nhắc đối soát hoàn bù lúc 07:00 sáng theo TT 22"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Nhắc hoàn bù 07:00</span>
            <span className="sm:hidden">Nhắc 07:00</span>
          </button>

          <button
            onClick={() => onOpenPrintForm?.('TT20_AMPOULE_DESTRUCTION')}
            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer active:scale-98"
            title="In Biểu Mẫu Hành Chính Y Tế (Mẫu 16/TT20 Hủy Vỏ Ống / Mẫu Phiếu Mượn TT22)"
          >
            <Printer className="w-4 h-4 text-teal-700" />
            <span className="hidden sm:inline">In Biểu Mẫu A4</span>
            <span className="sm:hidden">In A4</span>
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm thuốc, buồng bệnh..."
            className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-200/90 rounded-lg focus:outline-hidden focus:border-teal-500 text-slate-800 placeholder-slate-400 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 text-xs bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
              filterStatus === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({debts.length})
          </button>
          <button
            onClick={() => setFilterStatus('debt')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
              filterStatus === 'debt' ? 'bg-white text-amber-800 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang nợ ({activeDebts.length})
          </button>
          <button
            onClick={() => setFilterStatus('narcotics')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
              filterStatus === 'narcotics' ? 'bg-white text-rose-800 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Thuốc gây nghiện ({narcoticDebts.length})
          </button>
          <button
            onClick={() => setFilterStatus('settled')}
            className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
              filterStatus === 'settled' ? 'bg-white text-emerald-800 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã hoàn bù ({settledDebts.length})
          </button>
        </div>
      </div>

      {/* 4A. Mobile Card-Based List (md:hidden) - Modern, touch-friendly, no horizontal cut-off */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5">
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
                className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs space-y-3 hover:border-slate-300 transition"
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
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
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
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
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
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs flex-col">
        <div className="overflow-auto flex-1 w-full">
          <table className="w-full text-left text-sm min-w-[760px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap">Mã phiếu</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Mặt hàng</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">SL</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Bệnh nhân / Vị trí</th>
                <th className="py-3 px-3.5 whitespace-nowrap">Thời gian</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Vỏ ống (TT 20)</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap">Trạng thái</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDebts.map((item) => {
                const isDebt = item.status === 'debt';
                const isNarcotic = item.itemType === 'Thuốc gây nghiện';
                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-700 font-bold text-xs sm:text-sm whitespace-nowrap">{item.code}</td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <span className="font-semibold text-slate-900 block text-sm">{item.itemName}</span>
                      <span className="text-xs text-slate-500 font-medium">{item.itemType}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900 text-sm whitespace-nowrap">
                      {item.quantity}
                    </td>
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <span className="text-slate-900 font-semibold block text-sm">{item.patientName}</span>
                      <span className="text-xs text-slate-500 font-medium">{item.patientRoom}</span>
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-600 text-xs font-mono whitespace-nowrap">{item.borrowTime}</td>
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      {isNarcotic ? (
                        item.ampouleDestroyed ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Đã tiêu hủy
                          </span>
                        ) : item.ampouleReturned ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            Đã nộp khay
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAmpouleReturn(item.id)}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition cursor-pointer active:scale-98 whitespace-nowrap"
                            title="Xác nhận đã nộp lại vỏ ống thủy tinh rỗng vào khay theo TT 20/2017"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>Thu hồi vỏ</span>
                          </button>
                        )
                      ) : (
                        <span className="text-slate-300 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold ${
                          isDebt ? 'bg-amber-50 text-amber-800 border border-amber-200/80' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isDebt ? 'Đang nợ' : 'Đã hoàn bù'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => onOpenPrintForm?.(isNarcotic ? 'TT20_AMPOULE_DESTRUCTION' : 'EMERGENCY_BORROW_TICKET', item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                          title="In phiếu mượn kẹp bệnh án (TT22) hoặc Biên bản hủy vỏ (TT20)"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isDebt ? (
                          isNarcotic && !item.ampouleReturned ? (
                            <button
                              onClick={() => handleAmpouleReturn(item.id)}
                              className="inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold cursor-pointer active:scale-98 transition shadow-2xs whitespace-nowrap"
                              title="BẮT BUỘC THU HỒI VỎ: Theo Điều 15 TT 20/2017/TT-BYT, phải nộp vỏ ống thuốc gây nghiện vào khay kiểm soát trước khi được duyệt hoàn bù cơ số. Bấm để nộp vỏ ngay."
                            >
                              <ShieldAlert className="w-3 h-3 text-amber-600" />
                              <span>Thu hồi vỏ</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSettle(item.id)}
                              className="inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                              title="Hoàn bù cơ số thuốc về tủ trực theo TT 22/2011"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Duyệt hoàn bù</span>
                            </button>
                          )
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Đã chốt sổ</span>
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
