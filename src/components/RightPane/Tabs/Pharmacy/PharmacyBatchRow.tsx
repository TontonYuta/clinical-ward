/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng bảng dữ liệu Kho Dược theo chuẩn hành chính Cục Quản Lý Dược (<=200 LOC)
 */

import React from 'react';
import { ArrowUpRight, FileText, BookOpen } from 'lucide-react';
import { InventoryBatch } from '../../../../types/pharmacy';
import { resolvePharmacologicalGroup } from '../../../../utils/clinical/pharmacologicalClassification';

interface PharmacyBatchRowProps {
  index: number;
  batch: InventoryBatch;
  onQuickDispatch: (batch: InventoryBatch) => void;
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

  return (
    <tr className="hover:bg-teal-50/50 transition-colors border-b border-slate-200/90 text-slate-800 text-sm">
      {/* 1. STT */}
      <td className="py-3.5 px-3.5 text-center font-mono text-slate-600 font-bold whitespace-nowrap w-12 text-sm">
        {index + 1}
      </td>

      {/* 2. Số Đăng Ký (SĐK) - Bấm tra cứu hồ sơ công bố Cục QLD */}
      <td className="py-3.5 px-3.5 whitespace-nowrap font-mono">
        <button
          type="button"
          onClick={() => onSelectBatch?.(batch)}
          data-testid={`btn-sdk-${batch.id}`}
          className="font-bold text-teal-900 hover:text-teal-950 hover:underline cursor-pointer bg-teal-50 border border-teal-300 px-2.5 py-1 rounded text-xs sm:text-sm transition shadow-2xs"
          title="Bấm để xem Giấy công bố thuốc Cục Quản Lý Dược"
        >
          {sdk}
        </button>
      </td>

      {/* 3. Tên Thuốc & Hoạt Chất (Hàm Lượng) - Bấm tra cứu hồ sơ */}
      <td className="py-3.5 px-3.5 min-w-[240px]">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            data-testid={`btn-medname-${batch.id}`}
            className="font-black text-slate-900 text-sm sm:text-base leading-snug hover:text-blue-700 hover:underline cursor-pointer text-left"
            title="Bấm để xem hồ sơ công bố và chuyên luận Dược Thư"
          >
            {batch.itemName}
          </button>
          <span className={`text-xs font-bold px-2 py-0.5 rounded border select-none ${pharmGroup.badgeClass}`} title={`Nhóm tác dụng trị liệu: ${pharmGroup.label}`}>
            {pharmGroup.shortLabel}
          </span>
          {batch.isControlledSubstance && (
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300" title="Thuốc kiểm soát đặc biệt">
              KSĐB
            </span>
          )}
        </div>
        <p className="text-xs sm:text-sm text-slate-700 mt-1 line-clamp-1">
          <span className="text-slate-500 font-semibold">Hoạt chất:</span> {batch.activeIngredient || '—'}
          {batch.concentration && <span className="font-bold text-slate-800 ml-1">({batch.concentration})</span>}
        </p>
      </td>

      {/* 4. Dạng Bào Chế & Quy Cách Đóng Gói */}
      <td className="py-3.5 px-3.5 text-slate-700 whitespace-nowrap min-w-[180px]">
        <p className="font-bold text-slate-900 text-xs sm:text-sm">{batch.dosageForm || '—'}</p>
        <p className="text-xs sm:text-sm text-slate-600 font-medium truncate max-w-[220px] mt-0.5" title={`${batch.packagingSpec || '—'}${batch.shelfLife ? ` • Hạn: ${batch.shelfLife}` : ''}`}>
          {batch.packagingSpec || '—'}{batch.shelfLife ? ` • ${batch.shelfLife}` : ''}
        </p>
      </td>

      {/* 5. Cơ Sở Sản Xuất & Nước SX */}
      <td className="py-3.5 px-3.5 text-slate-700 min-w-[160px] max-w-[220px]">
        <p className="font-bold text-slate-900 text-xs sm:text-sm truncate" title={batch.manufacturer}>
          {batch.manufacturer || '—'}
        </p>
        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
          {batch.country || 'Việt Nam'} • <span className="font-mono font-bold text-slate-700">{batch.standardPharmacopeia || 'DĐVN V'}</span>
        </p>
      </td>

      {/* 6. Số Lô & Hạn Dùng */}
      <td className="py-3.5 px-3.5 whitespace-nowrap font-mono">
        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs sm:text-sm border border-slate-300">
          {batch.batchNumber}
        </span>
        <div className="mt-1">
          <span className="text-slate-800 text-xs sm:text-sm font-bold">{batch.expiryDate}</span>
          <span className={`ml-1.5 text-xs sm:text-sm font-black ${batch.daysLeft <= 60 ? 'text-rose-600' : 'text-slate-500'}`}>
            ({batch.daysLeft}d)
          </span>
        </div>
      </td>

      {/* 7. Tồn Kho Bệnh Viện & Vị Trí */}
      <td className="py-3.5 px-3.5 text-center whitespace-nowrap min-w-[130px]">
        <div className="font-mono">
          <span className={`text-sm sm:text-base font-black ${isUnderMin ? 'text-rose-600' : 'text-slate-900'}`}>
            {batch.currentStock} {batch.unit}
          </span>
          <span className="text-slate-500 text-xs sm:text-sm block font-medium mt-0.5">Cơ số min: {batch.minThreshold}</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 truncate max-w-[180px] mt-0.5 font-medium" title={batch.warehouseLocation}>
          {batch.warehouseLocation}
        </p>
      </td>

      {/* 8. Thao Tác Hành Chính & Tra Cứu */}
      <td className="py-3.5 px-3.5 text-right whitespace-nowrap min-w-[230px]">
        <div className="inline-flex items-center gap-2 justify-end">
          {/* Nút 1: Mở hồ sơ công bố Cục QLD & Dược Thư 2015/2022 */}
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            data-testid={`btn-doi-chung-kho-${batch.id}`}
            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs sm:text-sm font-bold cursor-pointer transition shadow-2xs"
            title="Xem hồ sơ công bố Cục Quản Lý Dược & Dược Thư Quốc Gia 2015/2022"
          >
            <FileText className="w-4 h-4 text-blue-700" />
            <span>Hồ sơ &amp; Dược thư</span>
          </button>

          {/* Nút 2: Tra cứu An toàn 5 Đúng & Dị ứng */}
          {onOpenSafetyGuide && (
            <button
              type="button"
              onClick={() => onOpenSafetyGuide(batch.itemName)}
              data-testid={`btn-safety-kho-${batch.id}`}
              className="inline-flex items-center gap-1.5 h-8.5 px-2.5 rounded-lg border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs sm:text-sm font-bold cursor-pointer transition shadow-2xs"
              title="Tra cứu An toàn 5 Đúng & Cảnh báo dị ứng lâm sàng"
            >
              <BookOpen className="w-4 h-4 text-teal-700" />
              <span>An toàn</span>
            </button>
          )}

          {/* Nút 3: Cấp phát thuốc theo y lệnh */}
          <button
            type="button"
            onClick={() => onQuickDispatch(batch)}
            className={`inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer active:scale-98 ${
              batch.isNearExpiry
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
            title="Xuất kho cấp phát theo phiếu dự trù/y lệnh"
          >
            <span>Xuất</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};
