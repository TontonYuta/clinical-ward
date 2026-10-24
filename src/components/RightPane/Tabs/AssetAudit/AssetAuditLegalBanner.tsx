/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Banner thông tin pháp lý kiểm kê tài sản nhà nước NĐ 151 & NĐ 114 (<=200 LOC)
 */

import React from 'react';
import { Building2, ShieldCheck } from 'lucide-react';

export const AssetAuditLegalBanner: React.FC = () => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-800 flex items-start justify-between gap-3 shrink-0 shadow-2xs">
      <div className="flex items-start gap-2.5">
        <Building2 className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">
              Kiểm kê tài sản công bệnh viện &amp; quản lý hao mòn định kỳ
            </span>
            <span className="bg-slate-200/90 text-slate-800 text-[10px] font-bold px-1.5 py-0.2 rounded border border-slate-300">
              NĐ 151/2017/NĐ-CP &amp; NĐ 114/2024
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Thực hiện kiểm kê đối soát thực tế tại khoa phòng thời điểm 24h ngày 31/12 hàng năm. Tự động phát hiện sai lệch vị trí điều chuyển giữa các khoa, đối soát mã QR và kiến nghị thanh lý thiết bị hao mòn trên 8 năm.
          </p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-md shrink-0 text-[11px] font-semibold">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
        <span>Chốt số liệu 31/12</span>
      </div>
    </div>
  );
};
