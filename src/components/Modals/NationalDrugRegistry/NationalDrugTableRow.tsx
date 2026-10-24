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
  getNidqcPharmacopeiaUrl,
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

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
      <td className="py-3 px-4 whitespace-nowrap align-top">
        {verifyMode ? (
          <a
            href={getDavRegistryUrl(d.nationalCode, d.brandName)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono font-semibold text-teal-800 bg-teal-50/90 hover:bg-teal-100 px-2.5 py-1 rounded-md border border-teal-200/80 text-xs inline-flex items-center gap-1 transition"
            title="Mở Cổng Đăng ký thuốc Cục Quản lý Dược (Bộ Y tế)"
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
          {d.clinicalProfile?.officialSource?.standardPharmacopeia || 'DĐVN V'}
        </div>
      </td>
      <td className="py-3 px-4 align-top">
        <div className="font-bold text-slate-900 text-sm">{d.brandName}</div>
        <span className={`inline-block px-2 py-0.5 rounded text-2xs font-medium border mt-1 ${badgeStyle}`}>
          {d.group}
        </span>
      </td>
      <td className="py-3 px-4 align-top">
        <div className="text-slate-800 font-medium text-xs sm:text-sm">{d.activeIngredient}</div>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span className="text-2xs font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
            {d.concentration}
          </span>
          {verifyMode && (
            <>
              <button
                type="button"
                onClick={() => onOpenSafetyGuide(d.brandName)}
                className="text-2xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200 inline-flex items-center gap-1 transition cursor-pointer"
                title="Xem hướng dẫn sử dụng chuẩn từ Bộ Y Tế & Dược điển Việt Nam"
              >
                <span>Chuẩn BYT</span>
              </button>
              <a
                href={getNidqcPharmacopeiaUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-0.5 transition"
                title="Cổng Viện Kiểm nghiệm Thuốc Trung ương (NIDQC - Bộ Y tế)"
              >
                <span>Kiểm nghiệm BYT</span>
                <ExternalLink className="w-2 h-2 opacity-60" />
              </a>
              <a
                href={getDailyMedFdaUrl(cleanInn)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xs font-medium text-blue-800 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 inline-flex items-center gap-0.5 transition"
                title="Tra cứu thông tin nhãn thuốc từ Cục Quản lý Thực phẩm & Dược phẩm Hoa Kỳ (FDA)"
              >
                <span>Chuẩn FDA (Mỹ)</span>
                <ExternalLink className="w-2 h-2 opacity-60" />
              </a>
            </>
          )}
        </div>
      </td>
      <td className="py-3 px-4 hidden md:table-cell align-top">
        <div className="text-slate-800 font-medium text-xs sm:text-sm">{d.dosageForm}</div>
        <div className="text-xs text-slate-500 truncate max-w-sm mt-0.5">
          {d.clinicalProfile?.administrationRouteDetails}
        </div>
      </td>
      <td className="py-3 px-4 text-right whitespace-nowrap align-top">
        <button
          onClick={() => onOpenSafetyGuide(d.brandName)}
          className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer shadow-2xs"
        >
          Hướng dẫn dùng thuốc
        </button>
      </td>
    </tr>
  );
};
