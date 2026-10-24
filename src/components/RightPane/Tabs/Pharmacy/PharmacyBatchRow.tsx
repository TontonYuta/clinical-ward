/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng hiển thị lô thuốc/vật tư trên giao diện Desktop (Modern Data Grid)
 */

import React from 'react';
import { ArrowUpRight, AlertOctagon, PackagePlus, ShieldAlert, ExternalLink } from 'lucide-react';
import { InventoryBatch } from '../../../../types/pharmacy';
import { useVerificationLinksVisible } from '../../../Common/VerificationBadgeLink';
import { getNidqcPharmacopeiaUrl } from '../../../../config/clinicalVerification';

interface PharmacyBatchRowProps {
  batch: InventoryBatch;
  onQuickDispatch: (batch: InventoryBatch) => void;
  onOpenRestock: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
}

export const PharmacyBatchRow: React.FC<PharmacyBatchRowProps> = ({
  batch,
  onQuickDispatch,
  onOpenRestock,
  onOpenSafetyGuide,
}) => {
  const isUnderMin = batch.currentStock <= batch.minThreshold;
  const verifyMode = useVerificationLinksVisible();

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-slate-800">
      <td className="py-3 px-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => onOpenSafetyGuide?.(batch.itemName)}
            className="font-bold text-slate-900 text-sm leading-snug hover:text-teal-700 hover:underline cursor-pointer text-left"
            title="Bấm để xem thông tin thuốc, chỉ định và cảnh báo dị ứng"
          >
            {batch.itemName}
          </button>
          {onOpenSafetyGuide && (
            <button
              type="button"
              onClick={() => onOpenSafetyGuide(batch.itemName)}
              className="text-xs font-medium px-2 py-0.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 cursor-pointer transition"
              title="Tra cứu thông tin thuốc, chỉ định & cảnh báo dị ứng"
            >
              Thông tin thuốc
            </button>
          )}
          {verifyMode && batch.commodityType !== 'medical_supply' && (
            <a
              href={getNidqcPharmacopeiaUrl(batch.itemName)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 transition"
              title="Kiểm chứng chuyên luận Dược Thư QG Việt Nam (NIDQC)"
            >
              <span>Kiểm chứng</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
          {batch.isControlledSubstance && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200"
              title="Thuốc kiểm soát đặc biệt theo Thông tư 18/2026/TT-BYT"
            >
              KSĐB
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-slate-500 font-medium">{batch.category}</span>
          <span className="text-slate-300">•</span>
          <span className="text-xs text-slate-500 font-medium">
            {batch.commodityType === 'medical_supply' ? 'Vật tư y tế' : 'Dược phẩm'}
          </span>
        </div>
      </td>

      <td className="py-3 px-3 font-mono font-bold text-xs whitespace-nowrap">
        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 inline-block">
          {batch.batchNumber}
        </span>
      </td>

      <td className="py-3 px-3 font-mono whitespace-nowrap">
        <span className="text-slate-900 font-bold block text-xs">{batch.expiryDate}</span>
        <span className={`text-[11px] font-semibold block mt-0.5 ${batch.daysLeft <= 60 ? 'text-rose-600' : 'text-slate-500'}`}>
          Còn {batch.daysLeft} ngày
        </span>
      </td>

      <td className="py-3 px-3 text-center font-mono whitespace-nowrap">
        <div className="flex items-baseline justify-center gap-1">
          <span className={`text-sm font-extrabold ${isUnderMin ? 'text-rose-600' : 'text-slate-900'}`}>
            {batch.currentStock} {batch.unit}
          </span>
          <span className="text-slate-500 text-xs">/ Min: {batch.minThreshold}</span>
        </div>
      </td>

      <td className="py-3 px-3 text-center whitespace-nowrap">
        <div className="flex flex-col gap-1 items-center">
          {batch.isNearExpiry && (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Cận hạn ({batch.daysLeft}d)
            </span>
          )}
          {isUnderMin ? (
            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1">
              <AlertOctagon className="w-3 h-3 text-amber-600 shrink-0" />
              Dưới Min
            </span>
          ) : (
            !batch.isNearExpiry && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                Đủ an toàn
              </span>
            )
          )}
        </div>
      </td>

      <td className="py-3 px-3 text-slate-700 text-xs truncate max-w-[160px]" title={batch.warehouseLocation}>
        {batch.warehouseLocation}
      </td>

      <td className="py-3 px-3 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-1.5 justify-end">
          {isUnderMin && (
            <button
              onClick={onOpenRestock}
              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition cursor-pointer active:scale-98"
              title="Lập phiếu dự trù nhập bổ sung cơ số (Mẫu 01/TT22)"
            >
              <PackagePlus className="w-3.5 h-3.5 text-amber-700" />
              <span>Dự trù</span>
            </button>
          )}
          <button
            onClick={() => onQuickDispatch(batch)}
            className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-semibold transition cursor-pointer active:scale-98 ${
              batch.isNearExpiry
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
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
