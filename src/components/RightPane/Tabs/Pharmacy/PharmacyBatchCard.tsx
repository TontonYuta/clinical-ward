/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị lô thuốc/vật tư trên giao diện Mobile
 */

import React from 'react';
import { ArrowUpRight, AlertOctagon, PackagePlus } from 'lucide-react';
import { InventoryBatch } from '../../../../types/pharmacy';

interface PharmacyBatchCardProps {
  batch: InventoryBatch;
  onQuickDispatch: (batch: InventoryBatch) => void;
  onOpenRestock: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
}

export const PharmacyBatchCard: React.FC<PharmacyBatchCardProps> = ({
  batch,
  onQuickDispatch,
  onOpenRestock,
  onOpenSafetyGuide,
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
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenSafetyGuide?.(batch.itemName)}
            className="font-bold text-base text-slate-900 leading-snug hover:text-teal-700 hover:underline cursor-pointer text-left"
            title="Bấm để xem thông tin thuốc, chỉ định và hướng dẫn an toàn"
          >
            {batch.itemName}
          </button>
          {onOpenSafetyGuide && batch.commodityType !== 'medical_supply' && (
            <button
              type="button"
              onClick={() => onOpenSafetyGuide(batch.itemName)}
              className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer transition"
              title="Tra cứu thông tin thuốc & tiêu chuẩn lâm sàng Bộ Y Tế (Dược điển V)"
            >
              Chuẩn BYT
            </button>
          )}
          {batch.isControlledSubstance && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
              KSĐB
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {(batch.registrationNumber || batch.nationalCode) && (
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              SĐK: {batch.registrationNumber || batch.nationalCode}
            </span>
          )}
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            {batch.category}
          </span>
          <span className="text-xs text-slate-500 font-medium">Vị trí: {batch.warehouseLocation}</span>
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
