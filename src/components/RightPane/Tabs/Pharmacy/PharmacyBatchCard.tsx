/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hàng danh mục thuốc Mobile phẳng theo chuẩn hành chính Cục QLD (<=200 LOC)
 */

import React from 'react';
import { InventoryBatch } from '../../../../types/pharmacy';
import { resolvePharmacologicalGroup } from '../../../../utils/clinical/pharmacologicalClassification';
import { findBhytRule } from '../../../../data/bhytDrugRules';

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
  const bhytRule = findBhytRule(batch.activeIngredient || batch.itemName);

  return (
    <article className="bg-white border-b border-slate-200 px-1 py-3 space-y-2 text-sm">
      {/* Hàng 1: STT, SĐK & Phân loại */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-sans tabular-nums text-xs text-slate-500 font-bold w-6">#{index + 1}</span>
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            className="font-sans tabular-nums text-sm font-semibold text-slate-700 hover:text-slate-950 underline-offset-2 hover:underline cursor-pointer"
            title="Xem Giấy công bố Cục QLD"
          >
            SĐK: {sdk}
          </button>
          <span className="text-sm text-slate-500 select-none" title={`Nhóm tác dụng trị liệu: ${pharmGroup.label}`}>
            {pharmGroup.shortLabel}
          </span>
          {batch.isControlledSubstance && (
            <span className="text-sm font-medium text-rose-700">
              KSĐB
            </span>
          )}
          {bhytRule ? (
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-semibold border ${
                bhytRule.paymentRatio === 1.0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={`BHYT ${bhytRule.paymentRatio * 100}% (TT 20/2022/TT-BYT)`}
            >
              BHYT {bhytRule.paymentRatio * 100}%
            </span>
          ) : (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-normal text-slate-500 border border-slate-200 bg-slate-50"
              title="Ngoài danh mục BHYT TT 20/2022"
            >
              Tự túc
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 font-sans tabular-nums text-xs">
          <span className="font-medium text-slate-600 text-sm">
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
          className="font-semibold text-lg text-slate-900 leading-snug hover:text-slate-700 hover:underline cursor-pointer text-left block underline-offset-2"
        >
          {batch.itemName}
        </button>
        <p className="text-slate-600 text-sm mt-1">
          <span className="font-semibold text-slate-500">Hoạt chất:</span> {batch.activeIngredient || '—'}
          {batch.concentration && <span className="font-bold text-slate-800 ml-1">({batch.concentration})</span>}
        </p>
      </div>

      <div className="text-sm text-slate-600 py-2 border-y border-slate-100">{batch.dosageForm || '—'}</div>

      {/* Hàng 4: Tồn kho & Thao tác */}
      <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
        <div className="space-y-1">
          <div className="font-sans tabular-nums">
          <span className={`text-base font-semibold ${isUnderMin ? 'text-rose-700' : 'text-slate-900'}`}>
            Tồn: {batch.currentStock} {batch.unit}
          </span>
          <span className="text-slate-500 text-xs ml-1 font-medium">(Min: {batch.minThreshold})</span>
          </div>
          <div className="text-xs text-slate-500">Vị trí: <span className="text-slate-700">{batch.warehouseLocation || '—'}</span></div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            data-testid={`btn-doi-chung-card-${batch.id}`}
            className="inline-flex items-center gap-1 h-8 px-2 text-slate-700 hover:text-slate-950 font-medium text-xs cursor-pointer hover:underline underline-offset-2"
            title="Xem hồ sơ đối chứng thông tin gốc (Dược Thư 2015 & Cục QLD)"
          >
            <span>Chi tiết</span>
          </button>
        </div>
      </div>
    </article>
  );
};
