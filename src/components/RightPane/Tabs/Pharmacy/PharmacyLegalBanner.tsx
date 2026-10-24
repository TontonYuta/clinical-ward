/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Banner thông tin pháp lý và quy chuẩn nghiệp vụ kho Dược Nội/Ngoại trú
 */

import React from 'react';
import { ShieldCheck, Stethoscope, Store, Building2 } from 'lucide-react';
import { WarehouseFilter } from './PharmacyHeaderRibbon';

interface PharmacyLegalBannerProps {
  warehouse: WarehouseFilter;
}

export const PharmacyLegalBanner: React.FC<PharmacyLegalBannerProps> = ({ warehouse }) => {
  if (warehouse === 'inpatient') {
    return (
      <div className="bg-teal-50 border border-teal-200/80 rounded-xl p-3 text-xs text-teal-900 flex items-start gap-2.5">
        <Building2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-teal-950">Phân hệ Kho Dược Nội Trú & Tủ Trực Khoa Lâm Sàng</span>
            <span className="bg-teal-200/80 text-teal-900 text-[10px] font-bold px-1.5 py-0.2 rounded">
              VBHN 07 &amp; TT 18/2026/TT-BYT
            </span>
          </div>
          <p className="text-teal-800 leading-relaxed">
            Cấp phát theo y lệnh hàng ngày và cơ số tủ trực cấp cứu. Thuốc gây nghiện (Morphin, Fentanyl) và hướng thần được quản lý khóa kép, ký nhận vỏ ống và biên bản hủy 4 thành phần theo TT 18/2026.
          </p>
        </div>
      </div>
    );
  }

  if (warehouse === 'outpatient') {
    return (
      <div className="bg-indigo-50 border border-indigo-200/80 rounded-xl p-3 text-xs text-indigo-900 flex items-start gap-2.5">
        <Store className="w-4 h-4 text-indigo-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-950">Phân hệ Kho Dược Ngoại Trú BHYT &amp; Cấp Đơn Điện Tử</span>
            <span className="bg-indigo-200/80 text-indigo-900 text-[10px] font-bold px-1.5 py-0.2 rounded">
              TT 26/2025/TT-BYT (Mới)
            </span>
          </div>
          <p className="text-indigo-800 leading-relaxed">
            Cấp phát theo mã đơn thuốc điện tử liên thông Hệ thống Quốc gia. Cấp thuốc bệnh mạn tính (ĐTĐ, THA, Hen) tối đa 90 ngày theo danh mục 252 bệnh. Kiểm soát FEFO tránh tồn đọng cận hạn.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
        <span className="font-medium">
          Hệ thống Quản lý Dược Bệnh viện chuẩn GSP: Tách bạch Kho Nội trú, Kho Ngoại trú BHYT và Kho Vật tư y tế.
        </span>
      </div>
      <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
        FEFO Priority Mode: Active
      </span>
    </div>
  );
};
