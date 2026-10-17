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
      {/* 1. Slim Integrated Executive Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white px-3 py-2 rounded-lg border border-slate-200/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 whitespace-nowrap">
            Kho Dược - Hạn Dùng &amp; Định Mức
          </h2>
          <span className="text-[11px] font-mono text-slate-400 border-l border-slate-200 pl-2 hidden md:inline">
            Căn cứ: TT 36/2018 (GSP) &amp; TT 22/2011
          </span>
          {/* Subtle inline summary */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 border-l border-slate-200 pl-2.5">
            <span className="text-slate-500 font-mono text-[11px]">{batches.length} lô</span>
            <span className="text-slate-300">·</span>
            {nearExpiryBatches.length > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {nearExpiryBatches.length} cận hạn (&lt;60d)
              </span>
            )}
            {lowStockBatches.length > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {lowStockBatches.length} chạm Min
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onOpenPrintForm?.('TT22_RESTOCK_PROPOSAL')}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-xs transition shadow-2xs cursor-pointer active:scale-98"
            title="In Phiếu dự trù bổ sung cơ số thuốc tủ trực (Mẫu 01/TT22 Thông tư 22/2011/TT-BYT)"
          >
            <Printer className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">In Mẫu 01/TT22 (Dự Trù)</span>
          </button>

          {lowStockBatches.length > 0 && (
            <button
              onClick={() => setIsRestockModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shadow-2xs cursor-pointer active:scale-98"
              title="Lập phiếu dự trù bổ sung cơ số thuốc kho dược theo TT 22/2011"
            >
              <PackagePlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Lập phiếu dự trù ({lowStockBatches.length})</span>
            </button>
          )}
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
            placeholder="Tìm tên thuốc, số lô, kệ..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-400 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 text-xs bg-slate-100 p-0.5 rounded-md">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({batches.length})
          </button>
          <button
            onClick={() => setFilterMode('near_expiry')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterMode === 'near_expiry' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lô cận hạn &lt; 60 ngày ({nearExpiryBatches.length})
          </button>
          <button
            onClick={() => setFilterMode('low_stock')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterMode === 'low_stock' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dưới định mức Min ({lowStockBatches.length})
          </button>
        </div>
      </div>

      {/* 4. Table (Pinned Sticky Header, Isolated Scroll Body) */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200/90 overflow-hidden shadow-2xs flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-2xs">
              <tr className="text-slate-500 font-semibold">
                <th className="py-2.5 px-3.5 whitespace-nowrap bg-slate-50">Mặt hàng</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50">Số lô</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50">Hạn dùng (EXP)</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-50">Tồn kho / Mức Min</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-50">Tình trạng</th>
                <th className="py-2.5 px-3 whitespace-nowrap bg-slate-50">Vị trí kệ GSP</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap bg-slate-50">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBatches.map((batch) => {
                const isUnderMin = batch.currentStock <= batch.minThreshold;
                return (
                  <tr key={batch.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3.5">
                      <span className="font-bold text-slate-900 block text-xs">{batch.itemName}</span>
                      <span className="text-[11px] text-slate-500">{batch.category}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 font-semibold whitespace-nowrap">{batch.batchNumber}</td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      <span className="text-slate-800 font-semibold block">{batch.expiryDate}</span>
                      <span className={`text-[11px] font-bold ${batch.daysLeft <= 60 ? 'text-rose-600' : 'text-slate-500'}`}>
                        Còn {batch.daysLeft} ngày
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono whitespace-nowrap">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-sm font-black ${isUnderMin ? 'text-rose-600' : 'text-slate-900'}`}>
                          {batch.currentStock}
                        </span>
                        <span className="text-slate-500 text-[11px]">/ Min: {batch.minThreshold}</span>
                      </div>
                      {/* Active Parameter Visual Meter (Levites Strekalova et al. 2026) */}
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full overflow-hidden mx-auto mt-1 border border-slate-300/60" title={`Tồn ${batch.currentStock} / Định mức tối thiểu ${batch.minThreshold}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isUnderMin ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(8, Math.round((batch.currentStock / batch.maxThreshold) * 100)))}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-center">
                        {batch.isNearExpiry && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                            Cận hạn ({batch.daysLeft} ngày)
                          </span>
                        )}
                        {isUnderMin ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-2xs">
                            <AlertOctagon className="w-3 h-3 text-amber-700 shrink-0" />
                            Dưới định mức Min
                          </span>
                        ) : (
                          !batch.isNearExpiry && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Đủ cơ số an toàn
                            </span>
                          )
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 text-xs font-medium max-w-[200px] truncate" title={batch.warehouseLocation}>{batch.warehouseLocation}</td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {isUnderMin && (
                          <button
                            onClick={() => setIsRestockModalOpen(true)}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                            title="Lập phiếu dự trù nhập bổ sung cơ số thuốc theo Thông tư 22/2011"
                          >
                            <PackagePlus className="w-3 h-3 text-amber-700" />
                            <span>Dự trù</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleQuickDispatch(batch)}
                          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98 ${
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
