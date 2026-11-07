/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng bảng dữ liệu Kho Dược theo chuẩn hành chính Cục Quản Lý Dược (<=200 LOC)
 */

import React from 'react';
import { InventoryBatch } from '../../../../types/pharmacy';
import { resolvePharmacologicalGroup } from '../../../../utils/clinical/pharmacologicalClassification';
import { findBhytRule } from '../../../../data/bhytDrugRules';

interface PharmacyBatchRowProps {
  index: number;
  batch: InventoryBatch;
  onQuickDispatch?: (batch: InventoryBatch) => void;
  onOpenRestock?: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onSelectBatch?: (batch: InventoryBatch) => void;
}

export const PharmacyBatchRow: React.FC<PharmacyBatchRowProps> = ({
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
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-200 text-slate-800 text-sm">
      {/* 1. STT */}
      <td className="py-3 px-3 text-center font-mono text-slate-600 font-medium whitespace-nowrap text-sm border-r border-slate-100">
        {index + 1}
      </td>

      {/* 2. Số Đăng Ký (SĐK) - Bấm tra cứu hồ sơ công bố Cục QLD */}
      <td className="py-3 px-3.5 whitespace-nowrap font-mono border-r border-slate-100">
        <button
          type="button"
          onClick={() => onSelectBatch?.(batch)}
          data-testid={`btn-sdk-${batch.id}`}
          className="font-medium text-slate-700 hover:text-slate-950 hover:underline cursor-pointer text-sm transition underline-offset-2"
          title="Bấm để xem Giấy công bố thuốc Cục Quản Lý Dược"
        >
          {sdk}
        </button>
      </td>

      {/* 3. Tên Thuốc & Hoạt Chất (Hàm Lượng) - Bấm tra cứu hồ sơ */}
      <td className="py-3 px-3.5 border-r border-slate-100">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            data-testid={`btn-medname-${batch.id}`}
            className="font-semibold text-slate-900 text-base leading-snug hover:text-slate-700 hover:underline cursor-pointer text-left underline-offset-2"
            title="Bấm để xem hồ sơ công bố và chuyên luận Dược Thư"
          >
            {batch.itemName}
          </button>
          <span className="text-sm text-slate-500 select-none" title={`Nhóm tác dụng trị liệu: ${pharmGroup.label}`}>
            {pharmGroup.shortLabel}
          </span>
          {batch.isControlledSubstance && (
            <span className="text-xs font-medium text-rose-700" title="Thuốc kiểm soát đặc biệt">
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
              title={`BHYT ${bhytRule.paymentRatio * 100}% (TT 20/2022/TT-BYT Trang ${bhytRule.pdfPage}) - Hạng: ${bhytRule.allowedRanks.map(r => r.replace('HANG_', '')).join(', ')}`}
            >
              BHYT {bhytRule.paymentRatio * 100}%
            </span>
          ) : (
            <span
              className="text-xs px-1.5 py-0.5 rounded font-normal text-slate-500 border border-slate-200 bg-slate-50"
              title="Ngoài danh mục thanh toán BHYT TT 20/2022"
            >
              Tự túc
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600 mt-1 line-clamp-1">
          {batch.activeIngredient || '—'}
          {batch.concentration && <span className="text-slate-700 ml-1">({batch.concentration})</span>}
        </p>
      </td>

      {/* 4. Dạng bào chế */}
      <td className="py-3 px-3.5 text-slate-700 border-r border-slate-100">
        <p className="font-medium text-slate-800 text-sm leading-snug">{batch.dosageForm || '—'}</p>
      </td>

      {/* 5. Số Lô & Hạn Dùng */}
      <td className="py-3 px-3.5 whitespace-nowrap font-mono border-r border-slate-100">
        <span className="font-medium text-slate-700 text-xs sm:text-sm">
          {batch.batchNumber}
        </span>
        <div className="mt-1">
          <span className="text-slate-800 text-sm font-medium">{batch.expiryDate}</span>
          <span className={`ml-1.5 text-sm font-medium ${batch.daysLeft <= 60 ? 'text-rose-700' : 'text-slate-500'}`}>
            ({batch.daysLeft}d)
          </span>
        </div>
      </td>

      {/* 6. Tồn Kho Bệnh Viện */}
      <td className="py-3 px-3.5 text-center whitespace-nowrap border-r border-slate-100">
        <div className="font-mono">
          <span className={`text-base font-semibold ${isUnderMin ? 'text-rose-700' : 'text-slate-900'}`}>
            {batch.currentStock} {batch.unit}
          </span>
          <span className="text-slate-500 text-xs sm:text-sm block font-medium mt-0.5">Cơ số min: {batch.minThreshold}</span>
        </div>
      </td>

      {/* 7. Vị trí lưu kho */}
      <td className="py-3 px-3.5 text-slate-700 border-r border-slate-100">
        <span className="font-medium text-slate-800 text-sm leading-snug">{batch.warehouseLocation || '—'}</span>
      </td>
    </tr>
  );
};
