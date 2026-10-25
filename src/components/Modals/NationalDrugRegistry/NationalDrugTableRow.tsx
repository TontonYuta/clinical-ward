/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng Thuốc Trong Bảng Tra Cứu Dữ Liệu Dược Quốc Gia & Đối Soát (<=200 LOC)
 * Tối ưu typography, khoảng cách hàng và loại bỏ icon thừa
 */

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { MasterMedication } from '../../../types/medication';
import {
  getDavRegistryUrl,
  getDailyMedFdaUrl,
} from '../../../config/clinicalVerification';

interface NationalDrugTableRowProps {
  drug: MasterMedication;
  verifyMode: boolean;
  badgeStyle: string;
  onOpenSafetyGuide: (name: string) => void;
}

export const NationalDrugTableRow: React.FC<NationalDrugTableRowProps> = ({
  drug: d,
  verifyMode,
  badgeStyle,
  onOpenSafetyGuide,
}) => {
  const cleanInn = d.activeIngredient.split('(')[0].trim();
  const hasVerifiedMonograph = !!d.clinicalProfile?.indications && d.clinicalProfile.indications.length > 0;

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
      <td className="py-3 px-4 whitespace-nowrap align-top">
        {verifyMode ? (
          <a
            href={getDavRegistryUrl(d.nationalCode, d.brandName)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono font-semibold text-teal-800 bg-teal-50/90 hover:bg-teal-100 px-2.5 py-1 rounded-md border border-teal-200/80 text-xs inline-flex items-center gap-1 transition"
            title="Kiểm chứng trên Cổng Cục Quản lý Dược (dichvucong.dav.gov.vn)"
          >
            <span>{d.nationalCode}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>
        ) : (
          <span className="font-mono font-medium text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 text-xs inline-block">
            {d.nationalCode}
          </span>
        )}
        <div className="text-2xs text-slate-400 mt-1 font-medium">
          {d.clinicalProfile?.officialSource?.standardPharmacopeia || 'Tiêu chuẩn NSX / DĐVN'}
        </div>
      </td>
      <td className="py-3 px-4 align-top">
        <div className="font-bold text-slate-900 text-sm">{d.brandName}</div>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <span className={`inline-block px-2 py-0.5 rounded text-2xs font-medium border ${badgeStyle}`}>
            {d.group}
          </span>
          {d.hospitalStockCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300"
              title="Đã đối soát tồn kho thực tế từ Kho Dược Bệnh Viện (FEFO)"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Kho BV: {d.hospitalStockCount} {d.standardUnit} {d.batchCount ? `(${d.batchCount} lô)` : ''}
            </span>
          ) : (
            <span className="text-2xs text-slate-400 font-medium">
              Chưa nhập kho BV
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 align-top">
        <div className="text-slate-800 font-medium text-xs sm:text-sm">{d.activeIngredient}</div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="text-2xs font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
            {d.concentration}
          </span>
          {verifyMode && hasVerifiedMonograph && (
            <>
              <button
                type="button"
                onClick={() => onOpenSafetyGuide(d.activeIngredient || d.brandName)}
                className="text-2xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200 inline-flex items-center gap-1 transition cursor-pointer"
                title="Chuyên luận lâm sàng chính thức từ Dược thư Quốc gia Việt Nam"
              >
                <span>Dược thư QG</span>
              </button>
            </>
          )}
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell align-top">
        <div className="text-slate-800 font-medium text-xs sm:text-sm">{d.dosageForm}</div>
        <div className="text-xs text-slate-500 truncate max-w-sm mt-0.5" title={d.note}>
          {d.note || 'Cục Quản lý Dược cấp phép'}
        </div>
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap align-top">
        {hasVerifiedMonograph ? (
          <button
            onClick={() => onOpenSafetyGuide(d.activeIngredient || d.brandName)}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition cursor-pointer shadow-2xs"
          >
            Chuyên luận lâm sàng
          </button>
        ) : (
          <span className="inline-flex items-center px-2 py-1 rounded text-2xs font-medium text-slate-500 bg-slate-100 border border-slate-200">
            Đã cấp phép Cục QLD
          </span>
        )}
      </td>
    </tr>
  );
};
