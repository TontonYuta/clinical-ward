/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hàng danh mục thuốc Mobile phẳng theo chuẩn hành chính Cục QLD (<=200 LOC)
 */

import React from 'react';
import { ArrowUpRight, FileText, BookOpen } from 'lucide-react';
import { InventoryBatch } from '../../../../types/pharmacy';
import { resolvePharmacologicalGroup } from '../../../../utils/clinical/pharmacologicalClassification';

interface PharmacyBatchCardProps {
  index: number;
  batch: InventoryBatch;
  onQuickDispatch: (batch: InventoryBatch) => void;
  onOpenRestock?: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onSelectBatch?: (batch: InventoryBatch) => void;
}

export const PharmacyBatchCard: React.FC<PharmacyBatchCardProps> = ({
  index, batch, onQuickDispatch, onOpenSafetyGuide, onSelectBatch,
}) => {
  const isUnderMin = batch.currentStock <= batch.minThreshold;
  const sdk = batch.registrationNumber || batch.nationalCode || '—';
  const pharmGroup = resolvePharmacologicalGroup(
    batch.atcCode,
    `${batch.itemName} ${batch.activeIngredient}`,
    batch.pharmacologicalClass || batch.category
  );

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 hover:border-slate-300 transition shadow-2xs text-xs sm:text-sm">
      {/* Hàng 1: STT, SĐK & Phân loại */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs text-slate-500 font-bold w-6">#{index + 1}</span>
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            className="font-mono text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded cursor-pointer"
            title="Xem Giấy công bố Cục QLD"
          >
            SĐK: {sdk}
          </button>
          <span className={`text-xs font-bold px-2 py-0.5 rounded border select-none ${pharmGroup.badgeClass}`} title={`Nhóm tác dụng trị liệu: ${pharmGroup.label}`}>
            {pharmGroup.shortLabel}
          </span>
          {batch.isControlledSubstance && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
              KSĐB
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            Lô: {batch.batchNumber}
          </span>
          <span className={batch.daysLeft <= 60 ? 'text-rose-600 font-bold' : 'text-slate-600 font-medium'}>
            HSD: {batch.expiryDate} ({batch.daysLeft}d)
          </span>
        </div>
      </div>

      {/* Hàng 2: Tên thuốc & Hoạt chất */}
      <div>
        <button
          type="button"
          onClick={() => onSelectBatch?.(batch)}
          className="font-bold text-base text-slate-900 leading-snug hover:text-blue-700 hover:underline cursor-pointer text-left block"
        >
          {batch.itemName}
        </button>
        <p className="text-slate-700 text-xs sm:text-sm mt-1">
          <span className="font-semibold text-slate-500">Hoạt chất:</span> {batch.activeIngredient || '—'}
          {batch.concentration && <span className="font-bold text-slate-800 ml-1">({batch.concentration})</span>}
        </p>
      </div>

      {/* Hàng 3: Bào chế, Quy cách, Cơ sở SX */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-700 bg-slate-50/80 p-2.5 rounded-md border border-slate-200">
        <div>
          <span className="text-slate-500 block text-xs font-semibold">Dạng, Quy cách & Hạn lưu hành:</span>
          <span className="font-bold text-slate-900 truncate block mt-0.5">
            {batch.dosageForm || '—'} • {batch.packagingSpec || '—'}{batch.shelfLife ? ` (${batch.shelfLife})` : ''}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-xs font-semibold">Nhà sản xuất:</span>
          <span className="font-bold text-slate-900 truncate block mt-0.5">
            {batch.manufacturer || '—'} ({batch.country || 'VN'})
          </span>
        </div>
      </div>

      {/* Hàng 4: Tồn kho & Thao tác */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
        <div className="font-mono">
          <span className={`text-sm font-black ${isUnderMin ? 'text-rose-600' : 'text-slate-900'}`}>
            Tồn: {batch.currentStock} {batch.unit}
          </span>
          <span className="text-slate-500 text-xs ml-1 font-medium">(Min: {batch.minThreshold})</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            data-testid={`btn-doi-chung-card-${batch.id}`}
            className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md border border-blue-200 bg-blue-50 text-blue-900 font-bold text-xs cursor-pointer hover:bg-blue-100 shadow-2xs"
            title="Xem hồ sơ đối chứng thông tin gốc (Dược Thư 2015 & Cục QLD)"
          >
            <FileText className="w-3.5 h-3.5 text-blue-700" />
            <span>Hồ sơ &amp; Dược thư</span>
          </button>
          {onOpenSafetyGuide && (
            <button
              type="button"
              onClick={() => onOpenSafetyGuide(batch.itemName)}
              className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-teal-200 bg-teal-50 text-teal-800 font-bold text-xs cursor-pointer hover:bg-teal-100 shadow-2xs"
              title="Xem hướng dẫn sử dụng 5 Đúng & An toàn"
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-700" />
              <span>An toàn</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onQuickDispatch(batch)}
            className={`inline-flex items-center gap-1 h-8 px-3 rounded-md text-xs font-bold cursor-pointer shadow-2xs transition active:scale-98 ${
              batch.isNearExpiry
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
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
