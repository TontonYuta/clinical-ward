/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Hành Chính Chuẩn Cục Quản Lý Dược (<=200 LOC)
 */

import React from 'react';
import { Building2, Layers, Clock, Globe } from 'lucide-react';

export interface DavAdministrativeData {
  dosageForm?: string;
  packagingSpec?: string;
  standardPharmacopeia?: string;
  shelfLife?: string;
  route?: string;
  category?: string;
  isControlledSubstance?: boolean;
  manufacturer?: string;
  country?: string;
  applicantName?: string;
  approvalDecision?: string;
}

export const DavAdministrativeBlocks: React.FC<{ data: DavAdministrativeData }> = ({ data }) => {
  const mfrName = data.manufacturer || 'Theo hồ sơ cấp phép Cục Quản lý Dược';
  const originCountry = data.country || 'Việt Nam';
  const standard = data.standardPharmacopeia || 'DĐVN V / NSX';
  const shelfLife = data.shelfLife || '36 tháng';
  const packaging = data.packagingSpec || 'Theo tiêu chuẩn cơ sở của nhà sản xuất';

  return (
    <div className="space-y-3 text-xs sm:text-sm text-slate-800">
      {/* 1. Lưới Tiêu Chuẩn & Quy Cách */}
      <div className="border border-slate-200 rounded-lg p-3.5 bg-white space-y-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase font-bold text-slate-500 mb-0.5">
              <Layers className="w-3.5 h-3.5 text-teal-700" />
              <span>Dạng bào chế & Đường dùng</span>
            </div>
            <p className="font-semibold text-slate-900 text-sm">{data.dosageForm || 'Viên nén / Dung dịch tiêm'}</p>
            <p className="text-xs text-slate-600 mt-0.5">{data.route || 'Đường dùng quy định theo hồ sơ'}</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase font-bold text-slate-500 mb-0.5">
              <Clock className="w-3.5 h-3.5 text-teal-700" />
              <span>Tiêu chuẩn & Hạn dùng</span>
            </div>
            <p className="font-mono font-bold text-slate-900 text-sm">{standard}</p>
            <p className="text-xs text-teal-900 font-medium mt-0.5">Hạn lưu hành: <strong className="text-slate-900">{shelfLife}</strong></p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
          <div>
            <span className="text-xs uppercase font-bold text-slate-500 block mb-0.5">Quy cách đóng gói</span>
            <p className="font-medium text-slate-900 text-xs sm:text-sm leading-snug">{packaging}</p>
          </div>

          <div>
            <span className="text-xs uppercase font-bold text-slate-500 block mb-0.5">Phân loại quản lý</span>
            <p className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
              <span>{data.category || 'Thuốc điều trị chuyên khoa'}</span>
              {data.isControlledSubstance && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                  Kiểm soát đặc biệt
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Khối Cơ Sở Sản Xuất */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs uppercase font-bold text-slate-600">
          <Building2 className="w-4 h-4 text-teal-700 shrink-0" />
          <span>Cơ sở sản xuất & Xuất xứ</span>
        </div>
        <p className="font-bold text-slate-900 text-sm leading-snug" title={mfrName}>
          {mfrName}
        </p>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-0.5">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span>Quốc gia xuất xứ: <strong className="text-slate-800">{originCountry}</strong></span>
        </div>
      </div>
    </div>
  );
};
