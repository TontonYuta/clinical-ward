/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khối Thông Tin Hành Chính Chuẩn Cục Quản Lý Dược (dichvucong.dav.gov.vn) (<=200 LOC)
 */

import React from 'react';
import { Building2, ShieldCheck, FileCheck, Layers, Clock, Globe } from 'lucide-react';

export interface DavAdministrativeData {
  dosageForm?: string;
  packagingSpec?: string;
  standardPharmacopeia?: string;
  shelfLife?: string;
  route?: string;
  category?: string;
  isControlledSubstance?: boolean;
  manufacturer?: string;
  manufacturerAddress?: string;
  country?: string;
  applicantName?: string;
  applicantAddress?: string;
  applicantCountry?: string;
  approvalDecision?: string;
  decisionDate?: string;
  registryExpiryDate?: string;
}

export const DavAdministrativeBlocks: React.FC<{ data: DavAdministrativeData }> = ({ data }) => {
  const mfrName = data.manufacturer || 'Theo hồ sơ cấp phép Cục Quản lý Dược';
  const appName = data.applicantName || mfrName.split('(')[0].trim();
  const originCountry = data.country || 'Việt Nam';
  const appCountry = data.applicantCountry || originCountry;
  const standard = data.standardPharmacopeia || 'DĐVN V / NSX';
  const shelfLife = data.shelfLife || '36 tháng';
  const packaging = data.packagingSpec || 'Theo tiêu chuẩn cơ sở của nhà sản xuất';
  const decision = data.approvalDecision || 'Quyết định Cấp SĐK Cục Quản lý Dược';

  return (
    <div className="space-y-3.5 text-xs text-slate-700">
      {/* 1. Lưới Tiêu Chuẩn & Quy Cách */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 border border-slate-200 rounded-lg p-3 bg-white">
        <div className="space-y-0.5 border-b sm:border-b-0 sm:border-r border-slate-100 pb-2 sm:pb-0 sm:pr-3">
          <div className="flex items-center gap-1 text-2xs uppercase font-bold text-slate-500">
            <Layers className="w-3.5 h-3.5 text-teal-700" />
            <span>Dạng bào chế & Đường dùng</span>
          </div>
          <p className="font-semibold text-slate-900">{data.dosageForm || 'Viên nén / Dung dịch tiêm'}</p>
          <p className="text-2xs text-slate-500">{data.route || 'Đường dùng quy định theo hồ sơ'}</p>
        </div>

        <div className="space-y-0.5 border-b sm:border-b-0 pb-2 sm:pb-0 sm:pl-1">
          <div className="flex items-center gap-1 text-2xs uppercase font-bold text-slate-500">
            <Clock className="w-3.5 h-3.5 text-teal-700" />
            <span>Tiêu chuẩn & Tuổi thọ lưu hành</span>
          </div>
          <p className="font-semibold text-slate-900 font-mono">{standard}</p>
          <p className="text-2xs text-teal-800 font-medium">Hạn dùng lưu hành: <span className="font-bold">{shelfLife}</span></p>
        </div>

        <div className="space-y-0.5 sm:border-r border-slate-100 sm:pr-3 pt-2 border-t border-slate-100">
          <span className="text-2xs uppercase font-bold text-slate-500 block">Quy cách đóng gói</span>
          <p className="font-semibold text-slate-900 leading-snug">{packaging}</p>
        </div>

        <div className="space-y-0.5 sm:pl-1 pt-2 border-t border-slate-100">
          <span className="text-2xs uppercase font-bold text-slate-500 block">Phân loại quản lý dược</span>
          <p className="font-semibold text-slate-900">
            {data.category || 'Thuốc điều trị chuyên khoa'}
            {data.isControlledSubstance && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-2xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                Kiểm soát đặc biệt
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 2. Khối Công Ty Sản Xuất & Công Ty Đăng Ký */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Cơ sở sản xuất */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <div className="flex items-center gap-1.5 text-2xs uppercase font-bold text-slate-600">
            <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>Cơ sở sản xuất</span>
          </div>
          <p className="font-semibold text-slate-900 line-clamp-2 leading-snug" title={mfrName}>
            {mfrName}
          </p>
          <div className="flex items-center gap-1 text-2xs text-slate-500 mt-1">
            <Globe className="w-3 h-3 text-slate-400" />
            <span>Xuất xứ: <strong className="text-slate-700">{originCountry}</strong></span>
          </div>
          {data.manufacturerAddress && (
            <p className="text-2xs text-slate-500 line-clamp-1" title={data.manufacturerAddress}>
              Đ/c: {data.manufacturerAddress}
            </p>
          )}
        </div>

        {/* Công ty đăng ký */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <div className="flex items-center gap-1.5 text-2xs uppercase font-bold text-slate-600">
            <FileCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
            <span>Doanh nghiệp đăng ký</span>
          </div>
          <p className="font-semibold text-slate-900 line-clamp-2 leading-snug" title={appName}>
            {appName}
          </p>
          <div className="flex items-center gap-1 text-2xs text-slate-500 mt-1">
            <Globe className="w-3 h-3 text-slate-400" />
            <span>Quốc gia: <strong className="text-slate-700">{appCountry}</strong></span>
          </div>
          {data.applicantAddress && (
            <p className="text-2xs text-slate-500 line-clamp-1" title={data.applicantAddress}>
              Đ/c: {data.applicantAddress}
            </p>
          )}
        </div>
      </div>

      {/* 3. Căn cứ cấp phép & Quyết định Bộ Y Tế */}
      <div className="flex items-center gap-2.5 p-2.5 bg-teal-50/60 border border-teal-200/80 rounded-lg text-2xs">
        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
        <div className="min-w-0 flex-1">
          <span className="font-bold text-teal-950 uppercase tracking-wide">Căn cứ cấp phép: </span>
          <span className="font-semibold text-teal-900 font-mono">{decision}</span>
          <span className="text-teal-800 ml-1.5">• Cục Quản lý Dược - Bộ Y Tế</span>
        </div>
      </div>
    </div>
  );
};
