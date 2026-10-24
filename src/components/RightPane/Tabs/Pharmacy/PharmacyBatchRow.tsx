/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị lô thuốc/vật tư trên giao diện Desktop
 */

import React from 'react';
import { ArrowUpRight, AlertOctagon, PackagePlus, ShieldAlert } from 'lucide-react';
import { InventoryBatch } from '../../../../types/pharmacy';

interface PharmacyBatchRowProps {
  batch: InventoryBatch;
  onQuickDispatch: (batch: InventoryBatch) => void;
  onOpenRestock: () => void;
}

export const PharmacyBatchRow: React.FC<PharmacyBatchRowProps> = ({
  batch,
  onQuickDispatch,
  onOpenRestock,
}) => {
  const isUnderMin = batch.currentStock <= batch.minThreshold;

  return (
    <tr className="odd:bg-white even:bg-slate-50/70 hover:bg-teal-50/40 transition-colors border-b border-slate-200/80">
      <td className="py-3 px-4 border-r border-slate-200/70">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-950 block text-[15px] leading-snug">
            {batch.itemName}
          </span>
          {batch.isControlledSubstance && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300"
              title="Thuốc kiểm soát đặc biệt theo Thông tư 18/2026/TT-BYT"
            >
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              KSĐB
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-600 font-medium">{batch.category}</span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-500 font-medium">
            {batch.commodityType === 'medical_supply' ? '🏷️ Vật tư y tế' : '💊 Dược phẩm'}
          </span>
        </div>
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
            {batch.currentStock} {batch.unit}
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
              onClick={onOpenRestock}
              className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition cursor-pointer active:scale-98"
              title="Lập phiếu dự trù nhập bổ sung cơ số theo VBHN 07 & Mẫu 01/TT22"
            >
              <PackagePlus className="w-3.5 h-3.5 text-amber-700" />
              <span>Dự trù</span>
            </button>
          )}
          <button
            onClick={() => onQuickDispatch(batch)}
            className={`inline-flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-98 ${
              batch.isNearExpiry
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400'
            }`}
            title="Xuất kho đơn vị theo FEFO"
          >
            <span>Xuất FEFO</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
