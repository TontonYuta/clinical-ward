/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Hành Chính Chuẩn Cục Quản Lý Dược (<=200 LOC)
 * Thiết kế phẳng, tối giản, triệt tiêu icon rác theo chuẩn y tế
 */

import React from 'react';
import { resolvePharmacologicalGroup } from '../../../utils/clinical/pharmacologicalClassification';

export interface DavAdministrativeData {
  dosageForm?: string;
  packagingSpec?: string;
  standardPharmacopeia?: string;
  shelfLife?: string;
  route?: string;
  category?: string;
  pharmacologicalClass?: string;
  atcCode?: string;
  itemName?: string;
  activeIngredient?: string;
  isControlledSubstance?: boolean;
  manufacturer?: string;
  country?: string;
  applicantName?: string;
  approvalDecision?: string;
}

export const DavAdministrativeBlocks: React.FC<{ data: DavAdministrativeData }> = ({ data }) => {
  const mfrName = data.manufacturer || 'Theo hồ sơ cấp phép Cục Quản lý Dược';
  const originCountry = data.country || 'Theo hồ sơ công bố Cục QLD';
  const standard = data.standardPharmacopeia || 'Theo hồ sơ công bố / NSX';
  const shelfLife = data.shelfLife || 'Theo nhãn và hồ sơ công bố';
  const packaging = data.packagingSpec || 'Theo hồ sơ công bố Cục QLD';
  const pharmGroup = resolvePharmacologicalGroup(
    data.atcCode,
    `${data.itemName || ''} ${data.activeIngredient || ''}`,
    data.pharmacologicalClass || data.category
  );

  return (
    <div className="space-y-3 text-sm text-slate-800">
      {/* 1. Lưới Tiêu Chuẩn & Quy Cách */}
      <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] uppercase font-semibold text-slate-500 block mb-0.5">Dạng bào chế & Đường dùng</span>
            <p className="font-semibold text-slate-900 text-sm">{data.dosageForm || 'Theo hồ sơ công bố'}</p>
            <p className="text-xs text-slate-500 mt-0.5">{data.route || 'Theo hồ sơ công bố'}</p>
          </div>

          <div>
            <span className="text-[11px] uppercase font-semibold text-slate-500 block mb-0.5">Tiêu chuẩn & Hạn dùng</span>
            <p className="font-mono font-bold text-slate-900 text-sm">{standard}</p>
            <p className="text-xs text-slate-600 font-medium mt-0.5">Hạn lưu hành: <strong className="text-slate-900">{shelfLife}</strong></p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          <div>
            <span className="text-[11px] uppercase font-semibold text-slate-500 block mb-0.5">Quy cách đóng gói</span>
            <p className="font-medium text-slate-900 text-xs sm:text-sm leading-snug">{packaging}</p>
          </div>

          <div>
            <span className="text-[11px] uppercase font-semibold text-slate-500 block mb-0.5">Nhóm Dược Lý & Quản Lý</span>
            <div className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${pharmGroup.badgeClass}`}>
                {pharmGroup.label}
              </span>
              {data.atcCode && (
                <span className="text-2xs font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  ATC: {data.atcCode}
                </span>
              )}
              {data.isControlledSubstance && (
                <span className="px-1.5 py-0.2 rounded text-2xs font-bold bg-red-50 text-red-700 border border-red-200">
                  KSĐB
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Khối Cơ Sở Sản Xuất */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-1">
        <span className="text-[11px] uppercase font-semibold text-slate-500 block">Cơ sở sản xuất & Xuất xứ</span>
        <p className="font-semibold text-slate-900 text-sm leading-snug" title={mfrName}>
          {mfrName}
        </p>
        <p className="text-xs text-slate-500">
          Quốc gia xuất xứ: <strong className="text-slate-800">{originCountry}</strong>
        </p>
      </div>
    </div>
  );
};
