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
    <div className="flex flex-col h-full overflow-hidden space-y-2.5 w-full">
      {/* 1. Unified Minimalist Command Ribbon */}
      <div className="bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-xl border border-slate-200 shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Search Input & Status Filter Pills */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm tên thuốc, số lô, kệ..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400 transition"
            />
          </div>

          <div className="flex items-center gap-1 text-sm bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
                filterMode === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Tất cả ({batches.length})
            </button>
            <button
              onClick={() => setFilterMode('near_expiry')}
              className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
                filterMode === 'near_expiry' ? 'bg-white text-rose-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Cận hạn &lt; 60 ngày ({nearExpiryBatches.length})
            </button>
            <button
              onClick={() => setFilterMode('low_stock')}
              className={`px-3 py-1.5 rounded-md text-sm transition cursor-pointer shrink-0 ${
                filterMode === 'low_stock' ? 'bg-white text-amber-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              Dưới định mức Min ({lowStockBatches.length})
            </button>
          </div>
        </div>

        {/* Right: Primary Action + Secondary Controls */}
        <div className="flex items-center gap-2 shrink-0 justify-end">
          <button
            onClick={() => onOpenPrintForm?.('TT22_RESTOCK_PROPOSAL')}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium transition cursor-pointer"
            title="In Phiếu dự trù bổ sung cơ số thuốc tủ trực (Mẫu 01/TT22)"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">In Mẫu 01</span>
          </button>

          {lowStockBatches.length > 0 && (
            <button
              onClick={() => setIsRestockModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-semibold text-sm transition cursor-pointer active:scale-98"
              title="Lập phiếu dự trù bổ sung cơ số thuốc kho dược theo TT 22/2011"
            >
              <PackagePlus className="w-4 h-4 text-teal-300" />
              <span>Dự trù ({lowStockBatches.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* 4A. Mobile Card-Based List (md:hidden) - Modern, touch-friendly, no horizontal cut-off */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5 pb-8">
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
                className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 hover:border-slate-300 transition"
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
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
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
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-xl border border-slate-300 overflow-hidden flex-col shadow-xs">
        <div className="overflow-auto flex-1 pb-24">
          <table className="w-full text-left text-sm min-w-[880px] border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-300 text-slate-700">
              <tr className="font-bold text-xs uppercase tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap border-r border-slate-200">Mặt hàng y tế</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Số lô SX</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Hạn dùng (EXP)</th>
                <th className="py-3 px-3 text-center whitespace-nowrap border-r border-slate-200">Tồn kho / Mức Min</th>
                <th className="py-3 px-3 text-center whitespace-nowrap border-r border-slate-200">Tình trạng</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Vị trí kệ GSP</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch) => {
                const isUnderMin = batch.currentStock <= batch.minThreshold;
                return (
                  <tr key={batch.id} className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors border-b border-slate-200/80">
                    <td className="py-3 px-4 border-r border-slate-200/70">
                      <span className="font-bold text-slate-950 block text-[15px] leading-snug">{batch.itemName}</span>
                      <span className="text-xs text-slate-600 font-medium block mt-0.5">{batch.category}</span>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-slate-800 font-bold text-xs whitespace-nowrap border-r border-slate-200/70">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-300/70 inline-block">
                        {batch.batchNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 font-mono whitespace-nowrap border-r border-slate-200/70">
                      <span className="text-slate-950 font-bold block text-sm">{batch.expiryDate}</span>
                      <span className={`text-xs font-bold block mt-0.5 ${batch.daysLeft <= 60 ? 'text-rose-600' : 'text-slate-600'}`}>
                        Còn {batch.daysLeft} ngày
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono whitespace-nowrap border-r border-slate-200/70">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-base font-extrabold ${isUnderMin ? 'text-rose-600' : 'text-slate-950'}`}>
                          {batch.currentStock}
                        </span>
                        <span className="text-slate-600 text-xs font-semibold">/ Min: {batch.minThreshold}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap border-r border-slate-200/70">
                      <div className="flex flex-col gap-1 items-center">
                        {batch.isNearExpiry && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300">
                            Cận hạn ({batch.daysLeft} ngày)
                          </span>
                        )}
                        {isUnderMin ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <AlertOctagon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            Dưới Min
                          </span>
                        ) : (
                          !batch.isNearExpiry && (
                            <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              Đủ an toàn
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-slate-800 text-xs font-semibold max-w-[180px] truncate border-r border-slate-200/70" title={batch.warehouseLocation}>
                      📍 {batch.warehouseLocation}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        {isUnderMin && (
                          <button
                            onClick={() => setIsRestockModalOpen(true)}
                            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer active:scale-98 whitespace-nowrap"
                            title="Lập phiếu dự trù nhập bổ sung cơ số thuốc theo Thông tư 22/2011"
                          >
                            <PackagePlus className="w-3.5 h-3.5 text-amber-700" />
                            <span>Dự trù</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleQuickDispatch(batch)}
                          className={`inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-98 ${
                            batch.isNearExpiry
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
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
