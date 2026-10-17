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
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white px-3 py-2 rounded-lg border border-slate-200/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 whitespace-nowrap">
            Sổ Nợ Tủ Trực Cấp Cứu
          </h2>
          <span className="text-[11px] font-mono text-slate-400 border-l border-slate-200 pl-2 hidden md:inline">
            Căn cứ: TT 22/2011 &amp; TT 20/2017/TT-BYT
          </span>
          {/* Subtle inline summary */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 border-l border-slate-200 pl-2.5">
            <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              {activeDebts.length} đang nợ
            </span>
            {pendingAmpoules.length > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {pendingAmpoules.length} nợ vỏ
              </span>
            )}
            <span className="text-slate-400 font-medium">·</span>
            <span className="text-slate-500 text-[11px]">
              {settledDebts.length} đã hoàn bù
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Manual Borrow Button (100% Standalone Clinical Workstation) */}
          <button
            onClick={() => setIsBorrowModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98"
            title="Lập phiếu mượn khẩn thuốc / vật tư từ tủ trực cấp cứu ca đêm (TT 22/2011/TT-BYT)"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Mượn Khẩn Thuốc / Vật Tư</span>
          </button>

          {returnedAmpoules.length > 0 && (currentUserRole === 'pharmacist' || currentUserRole === 'director') ? (
            <button
              onClick={() => setIsDestructionModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 hover:border-slate-400 text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98"
              title="Lập biên bản Hội đồng tiêu hủy vỏ ống thuốc gây nghiện theo Thông tư 20/2017/TT-BYT"
            >
              <Flame className="w-3.5 h-3.5 text-rose-600" />
              <span>Hội đồng hủy vỏ ({returnedAmpoules.length})</span>
            </button>
          ) : returnedAmpoules.length > 0 ? (
            <span
              className="hidden md:inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-50 text-slate-500 border border-slate-200 text-xs font-medium"
              title="Theo Thông tư 20/2017/TT-BYT, Hội đồng hủy vỏ do Dược sĩ Kho Dược chủ trì có sự tham gia của ĐD Trưởng"
            >
              <Flame className="w-3.5 h-3.5 text-slate-400" />
              <span>{returnedAmpoules.length} vỏ chờ Dược sĩ hủy</span>
            </span>
          ) : null}

          <button
            onClick={onSimulateMorningReminder}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98"
            title="Mô phỏng chuông nhắc đối soát hoàn bù lúc 07:00 sáng theo TT 22"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Nhắc hoàn bù 07:00</span>
          </button>

          <button
            onClick={() => onOpenPrintForm?.('TT20_AMPOULE_DESTRUCTION')}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98"
            title="In Biểu Mẫu Hành Chính Y Tế (Mẫu 16/TT20 Hủy Vỏ Ống / Mẫu Phiếu Mượn TT22)"
          >
            <Printer className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">In Biểu Mẫu A4</span>
          </button>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm thuốc, buồng bệnh..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-400 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 text-xs bg-slate-100 p-0.5 rounded-md">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterStatus === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({debts.length})
          </button>
          <button
            onClick={() => setFilterStatus('debt')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterStatus === 'debt' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đang nợ ({activeDebts.length})
          </button>
          <button
            onClick={() => setFilterStatus('narcotics')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterStatus === 'narcotics' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Thuốc gây nghiện ({narcoticDebts.length})
          </button>
          <button
            onClick={() => setFilterStatus('settled')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterStatus === 'settled' ? 'bg-white text-emerald-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã hoàn bù ({settledDebts.length})
          </button>
        </div>
      </div>

      {/* 4. Table (Maximized Viewport Height & Sticky Thead) */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200/90 overflow-hidden shadow-2xs flex flex-col">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 font-semibold">
                <th className="py-2.5 px-3.5 whitespace-nowrap">Mã phiếu</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Mặt hàng</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">SL</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Bệnh nhân / Vị trí</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Thời gian</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Vỏ ống (TT 20)</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Trạng thái</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDebts.map((item) => {
                const isDebt = item.status === 'debt';
                const isNarcotic = item.itemType === 'Thuốc gây nghiện';
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3.5 font-mono text-slate-700 font-semibold whitespace-nowrap">{item.code}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-900 block">{item.itemName}</span>
                      <span className="text-[10px] text-slate-400">{item.itemType}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 whitespace-nowrap">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-slate-900 font-semibold block text-xs">{item.patientName}</span>
                      <span className="text-[11px] text-slate-500">{item.patientRoom}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-xs font-mono whitespace-nowrap">{item.borrowTime}</td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      {isNarcotic ? (
                        item.ampouleDestroyed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Đã tiêu hủy
                          </span>
                        ) : item.ampouleReturned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Đã nộp khay
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAmpouleReturn(item.id)}
                            className="inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition cursor-pointer active:scale-98 whitespace-nowrap"
                            title="Xác nhận đã nộp lại vỏ ống thủy tinh rỗng vào khay theo TT 20/2017"
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-600 shrink-0" />
                            <span>Thu hồi vỏ</span>
                          </button>
                        )
                      ) : (
                        <span className="text-slate-300 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                          isDebt ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {isDebt ? 'Đang nợ' : 'Đã hoàn bù'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => onOpenPrintForm?.(isNarcotic ? 'TT20_AMPOULE_DESTRUCTION' : 'EMERGENCY_BORROW_TICKET', item)}
                          className="p-1 rounded text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                          title="In phiếu mượn kẹp bệnh án (TT22) hoặc Biên bản hủy vỏ (TT20)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {isDebt ? (
                          isNarcotic && !item.ampouleReturned ? (
                            <div
                              className="inline-flex items-center gap-1"
                              title="BẮT BUỘC THU HỒI VỎ: Theo Điều 15 Thông tư 20/2017/TT-BYT, phải nộp vỏ ống thuốc gây nghiện vào khay kiểm soát trước khi được duyệt hoàn bù cơ số."
                            >
                              <span className="inline-flex items-center gap-1 h-6 px-2 rounded bg-slate-100 text-slate-400 border border-slate-200 text-[10px] font-semibold cursor-not-allowed select-none">
                                <Lock className="w-2.5 h-2.5 text-slate-400" />
                                <span>Chờ thu hồi vỏ (TT 20)</span>
                              </span>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSettle(item.id)}
                              className="inline-flex items-center gap-1 h-6 px-2.5 rounded bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                              title="Hoàn bù cơ số thuốc về tủ trực theo TT 22/2011"
                            >
                              <Check className="w-3 h-3" />
                              <span>Duyệt hoàn bù</span>
                            </button>
                          )
                        ) : (
                          <span className="text-[11px] font-medium text-slate-400">Đã chốt sổ</span>
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
