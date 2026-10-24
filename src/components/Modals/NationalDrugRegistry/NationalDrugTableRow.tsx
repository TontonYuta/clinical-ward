/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng Thuốc Trong Bảng Tra Cứu Dữ Liệu Dược Quốc Gia & Đối Soát (<=200 LOC)
 */

import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { MasterMedication } from '../../../types/medication';

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
  return (
    <tr className="hover:bg-slate-50/70 transition-colors">
      <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
        {verifyMode ? (
          <a
            href="https://dichvucong.dav.gov.vn/congbothuoc/index"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono font-semibold text-teal-800 bg-teal-50/90 hover:bg-teal-100 px-2 py-0.5 rounded border border-teal-200/80 text-2xs inline-flex items-center gap-1 transition"
            title="Mở Cổng Dịch vụ công Cục Quản lý Dược đối soát số đăng ký"
          >
            <span>{d.nationalCode}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </a>
        ) : (
          <span className="font-mono font-semibold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/70 text-2xs inline-block">
            {d.nationalCode}
          </span>
        )}
        <div className="text-3xs text-slate-400 mt-1 font-medium">
          {d.clinicalProfile?.officialSource?.standardPharmacopeia || 'DĐVN V'}
        </div>
      </td>
      <td className="py-2.5 px-3.5 align-top">
        <div className="font-semibold text-slate-900 text-xs sm:text-sm">{d.brandName}</div>
        <span className={`inline-block px-2 py-0.5 rounded-md text-3xs font-medium border mt-1 ${badgeStyle}`}>
          {d.group}
        </span>
      </td>
      <td className="py-2.5 px-3.5 align-top">
        <div className="text-slate-800 font-medium text-xs">{d.activeIngredient}</div>
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <span className="text-3xs font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/50">
            {d.concentration}
          </span>
          {verifyMode && (
            <>
              <a
                href={`https://nidqc.org.vn/?s=${encodeURIComponent(d.activeIngredient.split('(')[0].trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-3xs font-semibold text-teal-700 bg-teal-50/70 hover:bg-teal-100 px-1.5 py-0.2 rounded border border-teal-200/60 inline-flex items-center gap-0.5 transition"
                title="Tra cứu chuyên luận Dược Thư QG Việt Nam"
              >
                <span>Dược thư</span>
                <ExternalLink className="w-2 h-2 opacity-60" />
              </a>
              <a
                href={`https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(d.activeIngredient.split('(')[0].trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-3xs font-semibold text-blue-700 bg-blue-50/70 hover:bg-blue-100 px-1.5 py-0.2 rounded border border-blue-200/60 inline-flex items-center gap-0.5 transition"
                title="Tra cứu nhãn SPL & tá dược trên US FDA DailyMed"
              >
                <span>FDA SPL</span>
                <ExternalLink className="w-2 h-2 opacity-60" />
              </a>
            </>
          )}
        </div>
      </td>
      <td className="py-2.5 px-3.5 hidden md:table-cell align-top">
        <div className="text-slate-700 font-normal text-xs">{d.dosageForm}</div>
        <div className="text-3xs text-slate-400 truncate max-w-xs mt-0.5">
          {d.clinicalProfile?.administrationRouteDetails}
        </div>
      </td>
      <td className="py-2.5 px-3.5 text-right whitespace-nowrap align-top">
        <button
          onClick={() => onOpenSafetyGuide(d.brandName)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-semibold text-teal-800 bg-teal-50/80 hover:bg-teal-100 border border-teal-200/60 transition cursor-pointer shadow-2xs"
        >
          <FileText className="w-3.5 h-3.5 text-teal-700" />
          <span>Hồ sơ 5 Đúng</span>
        </button>
      </td>
    </tr>
  );
};
