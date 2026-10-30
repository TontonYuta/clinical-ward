/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng Thuốc Trong Bảng Tra Cứu Dữ Liệu Dược Quốc Gia & Đối Soát (<=200 LOC)
 * Tối ưu typography, khoảng cách hàng và hiển thị trọn vẹn thông tin hành chính DAV
 */

import React from 'react';
import { MasterMedication } from '../../../types/medication';
import { resolvePharmacologicalGroup } from '../../../utils/clinical/pharmacologicalClassification';

interface NationalDrugTableRowProps {
  drug: MasterMedication;
  verifyMode?: boolean;
  badgeStyle?: string;
  onOpenSafetyGuide?: (name: string) => void;
  onOpenDavDetail?: (drug: MasterMedication) => void;
}

export const NationalDrugTableRow: React.FC<NationalDrugTableRowProps> = ({
  drug: d,
  verifyMode,
  badgeStyle,
  onOpenSafetyGuide,
  onOpenDavDetail,
}) => {
  const pharmGroup = resolvePharmacologicalGroup(
    d.atcCode,
    `${d.brandName} ${d.activeIngredient}`,
    d.group
  );

  return (
    <tr className="hover:bg-slate-50 transition-colors border-b border-slate-200">
      {/* 1. SĐK */}
      <td className="py-3 px-4 whitespace-nowrap align-top border-r border-slate-100">
        <button
          type="button"
          onClick={() => onOpenDavDetail ? onOpenDavDetail(d) : null}
          className="font-mono font-medium text-slate-700 hover:text-slate-950 text-sm inline-flex items-center transition cursor-pointer hover:underline underline-offset-2"
          title="Bấm để xem Giấy công bố thuốc Cục Quản lý Dược"
        >
          <span>{d.nationalCode}</span>
        </button>
      </td>

      {/* 2. Tên Thuốc & Tồn Kho */}
      <td className="py-3 px-4 align-top border-r border-slate-100">
        <button
          type="button"
          onClick={() => onOpenDavDetail ? onOpenDavDetail(d) : onOpenSafetyGuide?.(d.activeIngredient || d.brandName)}
          className="font-semibold text-slate-900 text-sm hover:text-slate-700 hover:underline cursor-pointer text-left leading-snug underline-offset-2"
        >
          {d.brandName}
        </button>
        <div className="grid grid-cols-1 gap-y-1.5 mt-2 text-xs">
          {pharmGroup.key !== 'all' && (
            <span
              className="inline-block text-xs font-medium text-slate-500"
              title={`Nhóm tác dụng dược lý lâm sàng: ${pharmGroup.label}`}
            >
              {pharmGroup.shortLabel}
            </span>
          )}
          <span className="inline-block text-xs font-medium text-slate-500">
            {d.group}
          </span>
          {d.hospitalStockByUnit?.length ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700"
              title="Đã đối soát tồn kho thực tế từ Kho Dược Bệnh Viện"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Kho BV: {d.hospitalStockByUnit.map((stock) => stock.quantity.toLocaleString('vi-VN') + ' ' + stock.unit).join(' · ')}
            </span>
          ) : (
            <span className="text-xs text-slate-400 font-medium">Chưa nhập kho BV</span>
          )}
        </div>
      </td>

      {/* 3. Hoạt Chất & Nồng Độ / Hàm Lượng */}
      <td className="py-3 px-4 align-top border-r border-slate-100">
        <div className="text-slate-800 font-medium text-sm leading-snug">{d.activeIngredient}</div>
        <div className="flex flex-col items-start gap-2 mt-2">
          {d.concentration && d.concentration.trim() !== d.activeIngredient.trim() && (
            <span className="text-sm font-medium text-slate-600 font-mono">
              {d.concentration}
            </span>
          )}
        </div>
      </td>

      {/* 4. Dạng bào chế */}
      <td className="py-3 px-4 align-top border-r border-slate-100">
        <p className="font-medium text-slate-800 text-sm leading-snug">{d.dosageForm || '—'}</p>
      </td>
    </tr>
  );
};
