/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Banner quy chuẩn kỹ thuật Thiết bị y tế theo Nghị định 04/2025/NĐ-CP & NĐ 98/2021/NĐ-CP
 */

import React from 'react';
import { Wrench, ShieldAlert } from 'lucide-react';

export const EquipmentLegalBanner: React.FC = () => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 flex items-start justify-between gap-3 shrink-0">
      <div className="flex items-start gap-2.5">
        <Wrench className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-950">
              Phân hệ Kỹ thuật Y sinh (BME) &amp; Quản lý Thiết bị Y tế
            </span>
            <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.2 rounded border border-teal-300">
              NĐ 04/2025/NĐ-CP &amp; NĐ 98/2021
            </span>
          </div>
          <p className="text-slate-600 leading-relaxed">
            Áp dụng quy chuẩn kỹ thuật thiết bị y tế loại C &amp; D: Kiểm định an toàn điện, thử tải áp lực, và lập biên bản nghiệm thu bàn giao 2 bên trước khi đưa trở lại khoa lâm sàng.
          </p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg shrink-0 text-[11px] font-bold">
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>Kiểm định Loại C/D bắt buộc</span>
      </div>
    </div>
  );
};
