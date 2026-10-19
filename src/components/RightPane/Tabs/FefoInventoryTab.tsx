/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, ArrowUpRight, AlertOctagon, PlusCircle, PackagePlus, Printer } from 'lucide-react';
import { InventoryBatch } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { RestockProposalModal } from '../../Modals/RestockProposalModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';

interface FefoInventoryTabProps {
  batches: InventoryBatch[];
  onDispatchBatch: (batchId: string, quantity: number) => void;
  onRestockBatches?: (batchIds: string[]) => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
}

export const FefoInventoryTab: React.FC<FefoInventoryTabProps> = ({
  batches,
  onDispatchBatch,
  onRestockBatches,
  onOpenPrintForm,
  isAudioMuted
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'near_expiry' | 'low_stock'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);

  const nearExpiryBatches = batches.filter(b => b.isNearExpiry);
  const lowStockBatches = batches.filter(b => b.isLowStock || b.currentStock <= b.minThreshold);

  const filteredBatches = batches.filter(batch => {
    let matchesMode = true;
    if (filterMode === 'near_expiry') matchesMode = batch.isNearExpiry;
    if (filterMode === 'low_stock') matchesMode = batch.isLowStock || batch.currentStock <= batch.minThreshold;

    const matchesSearch =
      batch.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.warehouseLocation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMode && matchesSearch;
  });

  const handleQuickDispatch = (batch: InventoryBatch) => {
    const dispatchQty = Math.min(10, batch.currentStock);
    if (dispatchQty <= 0) return;

    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onDispatchBatch(batch.id, dispatchQty);
  };

  const handleConfirmRestock = (batchIds: string[]) => {
    if (onRestockBatches) {
      onRestockBatches(batchIds);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden space-y-2 w-full">
      {/* 1. Unified Clinical Command Ribbon */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/80 shadow-2xs shrink-0 space-y-2">
        {/* Row 1: Title, Legal Basis, Key Stat Badges, Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 whitespace-nowrap">
              Kho Dược - Hạn Dùng &amp; Định Mức
            </h2>
            <span className="text-xs font-mono text-slate-500 border-l border-slate-200 pl-2 hidden md:inline">
              TT 36/2018 (GSP) &amp; TT 22/2011
            </span>
            {/* Subtle inline summary */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 sm:border-l sm:border-slate-200 sm:pl-2">
              <span className="text-slate-600 font-mono text-xs font-medium">{batches.length} lô</span>
              {nearExpiryBatches.length > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/80 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  {nearExpiryBatches.length} cận hạn
                </span>
              )}
              {lowStockBatches.length > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  {lowStockBatches.length} chạm Min
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => onOpenPrintForm?.('TT22_RESTOCK_PROPOSAL')}
              className="inline-flex items-center gap-1 h-8 px-2 sm:px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-xs sm:text-sm transition shadow-2xs cursor-pointer active:scale-98"
              title="In Phiếu dự trù bổ sung cơ số thuốc tủ trực (Mẫu 01/TT22 Thông tư 22/2011/TT-BYT)"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700" />
              <span className="hidden sm:inline">In Mẫu 01/TT22</span>
              <span className="sm:hidden">In Mẫu 01</span>
            </button>

            {lowStockBatches.length > 0 && (
              <button
                onClick={() => setIsRestockModalOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition shadow-2xs cursor-pointer active:scale-98"
                title="Lập phiếu dự trù bổ sung cơ số thuốc kho dược theo TT 22/2011"
              >
                <PackagePlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                <span className="hidden sm:inline">Lập phiếu dự trù ({lowStockBatches.length})</span>
                <span className="sm:hidden">Dự trù ({lowStockBatches.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search Input & Status Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên thuốc, số lô, kệ..."
              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-800 placeholder-slate-400 shadow-2xs transition"
            />
          </div>

          <div className="flex items-center gap-1 text-xs bg-slate-100/80 p-0.5 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({batches.length})
            </button>
            <button
              onClick={() => setFilterMode('near_expiry')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                filterMode === 'near_expiry' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cận hạn &lt; 60 ngày ({nearExpiryBatches.length})
            </button>
            <button
              onClick={() => setFilterMode('low_stock')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                filterMode === 'low_stock' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dưới định mức Min ({lowStockBatches.length})
            </button>
          </div>
        </div>
      </div>

      {/* 4A. Mobile Card-Based List (md:hidden) - Modern, touch-friendly, no horizontal cut-off */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5">
        {filteredBatches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Không tìm thấy lô thuốc nào phù hợp với bộ lọc.
          </div>
        ) : (
          filteredBatches.map((batch) => {
            const isUnderMin = batch.currentStock <= batch.minThreshold;
            const stockPercent = Math.min(100, Math.max(8, Math.round((batch.currentStock / batch.maxThreshold) * 100)));
            return (
              <div
                key={batch.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs space-y-3 hover:border-slate-300 transition"
              >
                {/* Card Top: Batch Number + Expiry Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
                      {batch.batchNumber}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      HSD: {batch.expiryDate}
                    </span>
                  </div>
                  <div>
                    {batch.isNearExpiry ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        Còn {batch.daysLeft} ngày
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                        Còn {batch.daysLeft} ngày
                      </span>
                    )}
                  </div>
                </div>

                {/* Drug Name & Category */}
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-snug">
                    {batch.itemName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      {batch.category}
                    </span>
                    <span className="text-xs text-slate-500">
                      📍 {batch.warehouseLocation}
                    </span>
                  </div>
                </div>

                {/* Stock Level & Visual Meter */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/70">
                  <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
                    <span className="text-slate-600 font-medium">Tồn kho hiện tại:</span>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-base font-black font-mono ${isUnderMin ? 'text-rose-600' : 'text-slate-900'}`}>
                        {batch.currentStock} {batch.unit}
                      </span>
                      <span className="text-xs text-slate-500">
                        (Min: {batch.minThreshold} · Max: {batch.maxThreshold})
                      </span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isUnderMin ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${stockPercent}%` }}
                    />
                  </div>
                  {isUnderMin && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-amber-800">
                      <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
                      <span>Cảnh báo: Tồn kho dưới định mức tối thiểu!</span>
                    </div>
                  )}
                </div>

                {/* Mobile Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  {isUnderMin && (
                    <button
                      onClick={() => setIsRestockModalOpen(true)}
                      className="flex-1 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-2xs transition cursor-pointer active:scale-98"
                    >
                      <PackagePlus className="w-4 h-4 text-amber-700" />
                      <span>Lập dự trù bù</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleQuickDispatch(batch)}
                    className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98 ${
                      batch.isNearExpiry
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span>Xuất kho FEFO (10)</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4B. Desktop Table (hidden md:flex) - Pinned Sticky Header, Isolated Scroll Body */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm min-w-[760px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
              <tr className="text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap bg-slate-50">Mặt hàng</th>
                <th className="py-3 px-3.5 whitespace-nowrap bg-slate-50">Số lô</th>
                <th className="py-3 px-3.5 whitespace-nowrap bg-slate-50">Hạn dùng (EXP)</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap bg-slate-50">Tồn kho / Mức Min</th>
                <th className="py-3 px-3.5 text-center whitespace-nowrap bg-slate-50">Tình trạng</th>
                <th className="py-3 px-3.5 whitespace-nowrap bg-slate-50">Vị trí kệ GSP</th>
                <th className="py-3 px-4 text-right whitespace-nowrap bg-slate-50">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBatches.map((batch) => {
                const isUnderMin = batch.currentStock <= batch.minThreshold;
                return (
                  <tr key={batch.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block text-sm">{batch.itemName}</span>
                      <span className="text-xs text-slate-500 font-medium">{batch.category}</span>
                    </td>
                    <td className="py-3.5 px-3.5 font-mono text-slate-700 font-semibold text-xs sm:text-sm whitespace-nowrap">{batch.batchNumber}</td>
                    <td className="py-3.5 px-3.5 font-mono whitespace-nowrap">
                      <span className="text-slate-900 font-semibold block text-sm">{batch.expiryDate}</span>
                      <span className={`text-xs font-bold ${batch.daysLeft <= 60 ? 'text-rose-600' : 'text-slate-500'}`}>
                        Còn {batch.daysLeft} ngày
                      </span>
                    </td>
                    <td className="py-3.5 px-3.5 text-center font-mono whitespace-nowrap">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-sm font-black ${isUnderMin ? 'text-rose-600' : 'text-slate-900'}`}>
                          {batch.currentStock}
                        </span>
                        <span className="text-slate-500 text-xs">/ Min: {batch.minThreshold}</span>
                      </div>
                      {/* Active Parameter Visual Meter */}
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden mx-auto mt-1.5 border border-slate-300/60" title={`Tồn ${batch.currentStock} / Định mức tối thiểu ${batch.minThreshold}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isUnderMin ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(8, Math.round((batch.currentStock / batch.maxThreshold) * 100)))}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-center">
                        {batch.isNearExpiry && (
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs">
                            Cận hạn ({batch.daysLeft} ngày)
                          </span>
                        )}
                        {isUnderMin ? (
                          <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <AlertOctagon className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            Dưới định mức Min
                          </span>
                        ) : (
                          !batch.isNearExpiry && (
                            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                              Đủ cơ số an toàn
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3.5 text-slate-700 text-xs font-medium max-w-[200px] truncate" title={batch.warehouseLocation}>{batch.warehouseLocation}</td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {isUnderMin && (
                          <button
                            onClick={() => setIsRestockModalOpen(true)}
                            className="inline-flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                            title="Lập phiếu dự trù nhập bổ sung cơ số thuốc theo Thông tư 22/2011"
                          >
                            <PackagePlus className="w-3.5 h-3.5 text-amber-700" />
                            <span>Dự trù</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleQuickDispatch(batch)}
                          className={`inline-flex items-center gap-1.5 h-7.5 px-3 rounded-lg text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98 ${
                            batch.isNearExpiry
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400'
                          }`}
                          title="Xuất kho 10 đơn vị theo thứ tự ưu tiên hạn gần (FEFO)"
                        >
                          <span>Xuất kho (10)</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Closed-loop Modal: Lập phiếu dự trù bổ sung thuốc TT 22 */}
      <RestockProposalModal
        isOpen={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        lowStockBatches={lowStockBatches}
        onConfirmRestock={handleConfirmRestock}
        onOpenPrintForm={onOpenPrintForm}
        isAudioMuted={isAudioMuted}
      />
    </div>
  );
};
