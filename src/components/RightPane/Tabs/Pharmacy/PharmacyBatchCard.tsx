/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hàng danh mục thuốc Mobile phẳng theo chuẩn hành chính Cục QLD (<=200 LOC)
 */

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { InventoryBatch } from '../../../../types/pharmacy';
import { resolvePharmacologicalGroup } from '../../../../utils/clinical/pharmacologicalClassification';

interface PharmacyBatchCardProps {
  index: number;
  batch: InventoryBatch;
  onQuickDispatch: (batch: InventoryBatch) => void;
  onOpenRestock: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onSelectBatch?: (batch: InventoryBatch) => void;
}

export const PharmacyBatchCard: React.FC<PharmacyBatchCardProps> = ({
  index, batch, onQuickDispatch, onOpenRestock, onOpenSafetyGuide, onSelectBatch,
}) => {
  const isUnderMin = batch.currentStock <= batch.minThreshold;
  const sdk = batch.registrationNumber || batch.nationalCode || '—';
  const pharmGroup = resolvePharmacologicalGroup(
    batch.atcCode,
    `${batch.itemName} ${batch.activeIngredient}`,
    batch.pharmacologicalClass || batch.category
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2 hover:border-slate-300 transition shadow-2xs text-xs">
      {/* Hàng 1: STT, SĐK & Phân loại */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-2xs text-slate-500 font-bold w-5">#{index + 1}</span>
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            className="font-mono text-2xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded cursor-pointer"
          >
            SĐK: {sdk}
          </button>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border select-none ${pharmGroup.badgeClass}`} title={`Nhóm tác dụng trị liệu: ${pharmGroup.label}`}>
            {pharmGroup.shortLabel}
          </span>
          {batch.isControlledSubstance && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-800 border border-rose-200">
              KSĐB
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono text-2xs">
          <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            Lô: {batch.batchNumber}
          </span>
          <span className={batch.daysLeft <= 60 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
            HSD: {batch.expiryDate} ({batch.daysLeft}d)
          </span>
        </div>
      </div>

      {/* Hàng 2: Tên thuốc & Hoạt chất */}
      <div>
        <button
          type="button"
          onClick={() => onSelectBatch ? onSelectBatch(batch) : onOpenSafetyGuide?.(batch.itemName)}
          className="font-bold text-sm text-slate-900 leading-snug hover:text-teal-800 hover:underline cursor-pointer text-left block"
        >
          {batch.itemName}
        </button>
        <p className="text-slate-600 text-xs mt-0.5">
          <span className="font-medium text-slate-500">Hoạt chất:</span> {batch.activeIngredient || '—'}
          {batch.concentration && <span className="font-semibold text-slate-700 ml-1">({batch.concentration})</span>}
        </p>
      </div>

      {/* Hàng 3: Bào chế, Quy cách, Cơ sở SX */}
      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-slate-50/70 p-2 rounded border border-slate-100">
        <div>
          <span className="text-slate-400 block text-2xs">Dạng, Quy cách & Hạn lưu hành:</span>
          <span className="font-medium text-slate-800 truncate block">
            {batch.dosageForm || '—'} • {batch.packagingSpec || '—'}{batch.shelfLife ? ` (${batch.shelfLife})` : ''}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block text-2xs">Nhà sản xuất:</span>
          <span className="font-medium text-slate-800 truncate block">
            {batch.manufacturer || '—'} ({batch.country || 'VN'})
          </span>
        </div>
      </div>

      {/* Hàng 4: Tồn kho & Thao tác */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="font-mono">
          <span className={`text-xs font-black ${isUnderMin ? 'text-rose-600' : 'text-slate-900'}`}>
            Tồn: {batch.currentStock} {batch.unit}
          </span>
          <span className="text-slate-400 text-2xs ml-1">(Min: {batch.minThreshold})</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSelectBatch?.(batch)}
            className="inline-flex items-center h-7 px-2 rounded border border-slate-200 bg-white text-slate-700 font-semibold text-xs cursor-pointer hover:bg-slate-50"
          >
            <span>Chi tiết</span>
          </button>
          {isUnderMin && (
            <button
              onClick={onOpenRestock}
              className="inline-flex items-center h-7 px-2 rounded bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold cursor-pointer"
            >
              <span>Dự trù</span>
            </button>
          )}
          <button
            onClick={() => onQuickDispatch(batch)}
            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-semibold cursor-pointer ${
              batch.isNearExpiry
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-teal-800 text-white'
            }`}
          >
            <span>Xuất</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
