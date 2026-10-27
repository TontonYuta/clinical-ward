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
    <tr className="hover:bg-teal-50/40 transition-colors border-b border-slate-200/80 text-slate-800 text-xs">
      {/* 1. STT */}
      <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-medium whitespace-nowrap w-12">
        {index + 1}
      </td>

      {/* 2. Số Đăng Ký (SĐK) - Bấm tra cứu hồ sơ công bố Cục QLD */}
      <td className="py-2.5 px-3 whitespace-nowrap font-mono">
        <button
          type="button"
          onClick={() => onSelectBatch?.(batch)}
          data-testid={`btn-sdk-${batch.id}`}
          className="font-bold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer bg-teal-50/80 border border-teal-200 px-2 py-0.5 rounded text-2xs"
          title="Bấm để xem Giấy công bố thuốc Cục Quản Lý Dược"
        >
          {sdk}
        </button>
      </td>

      {/* 3. Tên Thuốc & Hoạt Chất (Hàm Lượng) - Bấm tra cứu hồ sơ */}
      <td className="py-2.5 px-3 min-w-[200px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            data-testid={`btn-medname-${batch.id}`}
            className="font-bold text-slate-900 text-xs leading-tight hover:text-blue-700 hover:underline cursor-pointer text-left"
            title="Bấm để xem hồ sơ công bố và chuyên luận Dược Thư"
          >
            {batch.itemName}
          </button>
          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border select-none ${pharmGroup.badgeClass}`} title={`Nhóm tác dụng trị liệu: ${pharmGroup.label}`}>
            {pharmGroup.shortLabel}
          </span>
          {batch.isControlledSubstance && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-800 border border-rose-200" title="Thuốc kiểm soát đặc biệt">
              KSĐB
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
          <span className="text-slate-500 font-medium">Hoạt chất:</span> {batch.activeIngredient || '—'}
          {batch.concentration && <span className="font-semibold text-slate-700 ml-1">({batch.concentration})</span>}
        </p>
      </td>

      {/* 4. Dạng Bào Chế & Quy Cách Đóng Gói */}
      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
        <p className="font-medium text-slate-800 text-[11px]">{batch.dosageForm || '—'}</p>
        <p className="text-[10px] text-slate-500 truncate max-w-[160px]" title={`${batch.packagingSpec || '—'}${batch.shelfLife ? ` • Hạn: ${batch.shelfLife}` : ''}`}>
          {batch.packagingSpec || '—'}{batch.shelfLife ? ` • ${batch.shelfLife}` : ''}
        </p>
      </td>

      {/* 5. Cơ Sở Sản Xuất & Nước SX */}
      <td className="py-2.5 px-3 text-slate-700 min-w-[140px] max-w-[180px]">
        <p className="font-medium text-slate-800 text-[11px] truncate" title={batch.manufacturer}>
          {batch.manufacturer || '—'}
        </p>
        <p className="text-[10px] text-slate-500">
          {batch.country || 'Việt Nam'} • <span className="font-mono">{batch.standardPharmacopeia || 'DĐVN V'}</span>
        </p>
      </td>

      {/* 6. Số Lô & Hạn Dùng */}
      <td className="py-2.5 px-3 whitespace-nowrap font-mono">
        <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">
          {batch.batchNumber}
        </span>
        <div className="mt-0.5">
          <span className="text-slate-700 text-[11px] font-semibold">{batch.expiryDate}</span>
          <span className={`ml-1 text-[10px] font-bold ${batch.daysLeft <= 60 ? 'text-rose-600' : 'text-slate-500'}`}>
            ({batch.daysLeft}d)
          </span>
        </div>
      </td>

      {/* 7. Tồn Kho Bệnh Viện & Vị Trí */}
      <td className="py-2.5 px-3 text-center whitespace-nowrap">
        <div className="font-mono">
          <span className={`text-xs font-black ${isUnderMin ? 'text-rose-600' : 'text-slate-900'}`}>
            {batch.currentStock} {batch.unit}
          </span>
          <span className="text-slate-400 text-[10px] block">Cơ số min: {batch.minThreshold}</span>
        </div>
        <p className="text-[10px] text-slate-500 truncate max-w-[130px] mt-0.5" title={batch.warehouseLocation}>
          {batch.warehouseLocation}
        </p>
      </td>

      {/* 8. Thao Tác Hành Chính & Tra Cứu */}
      <td className="py-2.5 px-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5 justify-end">
          {/* Nút 1: Mở hồ sơ công bố Cục QLD & Dược Thư 2015/2022 */}
          <button
            type="button"
            onClick={() => onSelectBatch?.(batch)}
            data-testid={`btn-doi-chung-kho-${batch.id}`}
            className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-md border border-blue-200 bg-blue-50/90 hover:bg-blue-100 text-blue-900 text-xs font-bold cursor-pointer transition shadow-2xs"
            title="Xem hồ sơ công bố Cục Quản Lý Dược & Dược Thư Quốc Gia 2015/2022 (Xem PDF HDSD, Nhãn, Liều, Chống chỉ định)"
          >
            <FileText className="w-3.5 h-3.5 text-blue-700" />
            <span>Hồ sơ &amp; Dược thư</span>
          </button>

          {/* Nút 2: Tra cứu An toàn 5 Đúng & Dị ứng */}
          {onOpenSafetyGuide && (
            <button
              type="button"
              onClick={() => onOpenSafetyGuide(batch.itemName)}
              data-testid={`btn-safety-kho-${batch.id}`}
              className="inline-flex items-center gap-1 h-7.5 px-2 rounded-md border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold cursor-pointer transition shadow-2xs"
              title="Tra cứu An toàn 5 Đúng & Cảnh báo dị ứng lâm sàng"
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-700" />
              <span>An toàn</span>
            </button>
          )}

          {/* Nút 3: Cấp phát thuốc theo y lệnh */}
          <button
            type="button"
            onClick={() => onQuickDispatch(batch)}
            className={`inline-flex items-center gap-1 h-7.5 px-2.5 rounded-md text-xs font-semibold transition cursor-pointer active:scale-98 ${
              batch.isNearExpiry
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
            title="Xuất kho cấp phát theo phiếu dự trù/y lệnh"
          >
            <span>Xuất</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
};
