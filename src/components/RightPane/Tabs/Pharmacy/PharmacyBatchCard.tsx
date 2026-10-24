/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị lô thuốc/vật tư trên giao diện Mobile
 */

import React from 'react';
import { ArrowUpRight, AlertOctagon, PackagePlus, ShieldAlert } from 'lucide-react';
import { InventoryBatch } from '../../../../types/pharmacy';

interface PharmacyBatchCardProps {
  batch: InventoryBatch;
  onQuickDispatch: (batch: InventoryBatch) => void;
  onOpenRestock: () => void;
}

export const PharmacyBatchCard: React.FC<PharmacyBatchCardProps> = ({
  batch,
  onQuickDispatch,
  onOpenRestock,
}) => {
  const isUnderMin = batch.currentStock <= batch.minThreshold;
  const stockPercent = Math.min(100, Math.max(8, Math.round((batch.currentStock / batch.maxThreshold) * 100)));

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-3 hover:border-slate-300 transition shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60">
            {batch.batchNumber}
          </span>
          <span className="text-xs text-slate-500 font-mono">HSD: {batch.expiryDate}</span>
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

      <div>
        <div className="flex items-center gap-1.5">
          <h3 className="font-bold text-base text-slate-900 leading-snug">{batch.itemName}</h3>
          {batch.isControlledSubstance && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-0.5">
              <ShieldAlert className="w-2.5 h-2.5" /> KSĐB
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            {batch.category}
          </span>
          <span className="text-xs text-slate-500">📍 {batch.warehouseLocation}</span>
        </div>
      </div>

      <div className="bg-slate-50 rounded-md p-3 border border-slate-200/70">
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
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${isUnderMin ? 'bg-rose-500' : 'bg-emerald-500'}`}
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

      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
        {isUnderMin && (
          <button
            onClick={onOpenRestock}
            className="flex-1 py-1.5 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
          >
            <PackagePlus className="w-4 h-4 text-amber-700" />
            <span>Lập dự trù bù</span>
          </button>
        )}
        <button
          onClick={() => onQuickDispatch(batch)}
          className={`flex-1 py-1.5 rounded-md text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98 ${
            batch.isNearExpiry
              ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          <span>Xuất kho FEFO</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
