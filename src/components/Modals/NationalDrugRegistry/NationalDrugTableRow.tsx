/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng Thuốc Trong Bảng Tra Cứu Dữ Liệu Dược Quốc Gia & Đối Soát (<=200 LOC)
 * Tối ưu typography, khoảng cách hàng và hiển thị trọn vẹn thông tin hành chính DAV
 */

import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { MasterMedication } from '../../../types/medication';
import { getDavRegistryUrl } from '../../../config/clinicalVerification';
import { resolvePharmacologicalGroup } from '../../../utils/clinical/pharmacologicalClassification';

interface NationalDrugTableRowProps {
  drug: MasterMedication;
  verifyMode: boolean;
  badgeStyle: string;
  onOpenSafetyGuide: (name: string) => void;
  onOpenDavDetail?: (drug: MasterMedication) => void;
}

export const NationalDrugTableRow: React.FC<NationalDrugTableRowProps> = ({
  drug: d,
  verifyMode,
  badgeStyle,
  onOpenSafetyGuide,
  onOpenDavDetail,
}) => {
  const hasVerifiedMonograph = !!d.clinicalProfile?.indications && d.clinicalProfile.indications.length > 0;
  const isVerified = Boolean(
    d.isVerified ||
    (d.clinicalSource && d.clinicalSource.includes('Dược thư')) ||
    (d.clinicalSource && d.clinicalSource.includes('SmPC')) ||
    hasVerifiedMonograph
  );
  const standard = d.standardPharmacopeia || d.clinicalProfile?.officialSource?.standardPharmacopeia || 'NSX';
  const shelfLife = d.shelfLife || '36 tháng';
  const packaging = d.packagingSpec || 'Theo tiêu chuẩn cơ sở';
  const pharmGroup = resolvePharmacologicalGroup(
    d.atcCode,
    `${d.brandName} ${d.activeIngredient}`,
    d.group
  );

  return (
    <tr className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
      {/* 1. SĐK & Tiêu chuẩn */}
      <td className="py-2.5 px-3 whitespace-nowrap align-top">
        <button
          type="button"
          onClick={() => onOpenDavDetail ? onOpenDavDetail(d) : null}
          className="font-mono font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-0.5 rounded border border-blue-200 text-xs inline-flex items-center transition cursor-pointer"
          title="Bấm để xem Giấy công bố thuốc Cục Quản lý Dược"
        >
          <span>{d.nationalCode}</span>
        </button>
        <div className="text-2xs text-slate-500 mt-1 font-mono">
          {standard} • Hạn: {shelfLife}
        </div>
      </td>

      {/* 2. Tên Thuốc & Tồn Kho */}
      <td className="py-2.5 px-3 align-top min-w-[170px]">
        <button
          type="button"
          onClick={() => onOpenDavDetail ? onOpenDavDetail(d) : onOpenSafetyGuide(d.activeIngredient || d.brandName)}
          className="font-bold text-slate-900 text-xs sm:text-sm hover:text-blue-600 hover:underline cursor-pointer text-left leading-tight"
        >
          {d.brandName}
        </button>
        <div className="flex items-center gap-1 flex-wrap mt-1">
          {pharmGroup.key !== 'all' && (
            <span
              className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border ${pharmGroup.badgeClass}`}
              title={`Nhóm tác dụng dược lý lâm sàng: ${pharmGroup.label}`}
            >
              {pharmGroup.shortLabel}
            </span>
          )}
          <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-medium border ${badgeStyle}`}>
            {d.group}
          </span>
          {isVerified && (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-50 text-blue-900 border border-blue-200 select-none font-mono"
              title={d.clinicalSource || "Có chuyên luận đối chiếu: Dược Thư Quốc Gia Việt Nam 2015 (QĐ 2033/QĐ-BYT)"}
            >
              DTQG 2015{d.clinicalSource?.match(/Trang\s*(\d+)/i)?.[1] ? ` • Tr.${d.clinicalSource.match(/Trang\s*(\d+)/i)![1]}` : ''}
            </span>
          )}
          {d.hospitalStockCount > 0 ? (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300"
              title="Đã đối soát tồn kho thực tế từ Kho Dược Bệnh Viện"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Kho BV: {d.hospitalStockCount} {d.standardUnit}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium">Chưa nhập kho BV</span>
          )}
        </div>
      </td>

      {/* 3. Hoạt Chất & Nồng Độ / Hàm Lượng */}
      <td className="py-2.5 px-3 align-top min-w-[160px]">
        <div className="text-slate-800 font-medium text-xs leading-snug">{d.activeIngredient}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-2xs font-bold text-blue-900 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200/60 font-mono">
            {d.concentration || 'Theo tiêu chuẩn'}
          </span>
          {verifyMode && (
            <a
              href={getDavRegistryUrl(d.nationalCode, d.brandName)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs text-blue-600 hover:underline inline-flex items-center gap-0.5"
              title="Cổng Dịch vụ công Cục QLD"
            >
              <span>DAV Portal</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </td>

      {/* 4. Quy Cách, Dạng Bào Chế & Cơ Sở SX */}
      <td className="py-2.5 px-3 hidden md:table-cell align-top max-w-[240px]">
        <p className="font-semibold text-slate-800 text-xs leading-snug">{d.dosageForm || '—'}</p>
        <p className="text-2xs text-slate-600 truncate mt-0.5" title={packaging}>
          Quy cách: {packaging}
        </p>
        <p className="text-[11px] text-slate-500 truncate mt-0.5" title={d.manufacturer || d.note}>
          NSX: {d.manufacturer || d.note || 'Cục QLD cấp phép'}
        </p>
      </td>

      {/* 5. Thao Tác Chi Tiết & Đối Chứng */}
      <td className="py-2.5 px-3 text-right whitespace-nowrap align-top">
        <div className="inline-flex items-center gap-1.5 justify-end">
          <button
            type="button"
            onClick={() => onOpenDavDetail?.(d)}
            data-testid={`btn-doi-chung-${d.nationalCode}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer shadow-2xs"
            title="Mở hồ sơ đối chứng thông tin gốc (Dược Thư 2015 & Giấy Công Bố Cục QLD)"
          >
            <FileText className="w-3.5 h-3.5 text-blue-700" />
            <span>Đối chứng gốc</span>
          </button>
          {d.clinicalSource?.match(/Trang\s*(\d+)/i)?.[1] && (
            <a
              href={`/api/v1/pdf/Duoc_Thu_Quoc_Gia_Viet_Nam.pdf#page=${d.clinicalSource.match(/Trang\s*(\d+)/i)![1]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 px-2 py-1 rounded-lg text-2xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition cursor-pointer"
              title={`Mở trực tiếp tệp PDF Dược Thư tại Trang ${d.clinicalSource.match(/Trang\s*(\d+)/i)![1]}`}
            >
              <span>PDF Tr.{d.clinicalSource.match(/Trang\s*(\d+)/i)![1]}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </td>
    </tr>
  );
};
