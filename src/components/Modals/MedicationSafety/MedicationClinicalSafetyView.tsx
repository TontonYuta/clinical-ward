/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Chi tiết Giám sát Lâm sàng, Giải độc Antidote & Pháp lý Quản lý Dược (<=200 LOC)
 */

import React from 'react';
import { ShieldAlert, LifeBuoy, AlertOctagon, GitCompare, Baby, Lock } from 'lucide-react';
import { FiveRightsSafetyInfo } from '../../../types/medication';

interface Props {
  profile: FiveRightsSafetyInfo;
}

export const MedicationClinicalSafetyView: React.FC<Props> = ({ profile }) => {
  return (
    <div className="space-y-3 text-xs">
      {/* Cảnh báo hộp đen (nếu có) */}
      {profile.blackBoxWarning && (
        <div className="p-3 bg-rose-50 border-2 border-rose-300 rounded-lg text-rose-950 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-rose-900 text-xs">
            <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0" />
            <span>CẢNH BÁO NGUY CƠ CAO (BLACK BOX WARNING)</span>
          </div>
          <p className="text-[11.5px] leading-relaxed font-medium">{profile.blackBoxWarning}</p>
        </div>
      )}

      {/* Thuốc giải độc đặc hiệu (Antidote) */}
      {profile.antidote && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
            <LifeBuoy className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>THUỐC GIẢI ĐỘC ĐẶC HIỆU (ANTIDOTE)</span>
          </div>
          <p className="font-semibold text-emerald-800 bg-white p-2 rounded border border-emerald-200">
            {profile.antidote}
          </p>
        </div>
      )}

      {/* Tác dụng phụ thường gặp & Ngộ độc */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Tác Dụng Phụ Thường Gặp &amp; Dấu Hiệu Quá Liều</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {profile.adverseReactions.map((adr, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 text-[11px] font-medium">
              • {adr}
            </span>
          ))}
        </div>
        <div className="text-slate-600 text-[11px] pt-1 border-t border-slate-200">
          <strong className="text-slate-800">Theo dõi lâm sàng:</strong> {profile.clinicalMonitoring}
        </div>
      </div>

      {/* Tương tác thuốc nghiêm trọng */}
      {profile.ddiWarnings && profile.ddiWarnings.length > 0 && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
            <GitCompare className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Tương Tác Thuốc Cần Tránh (DDI Warning)</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-amber-900 text-[11.5px]">
            {profile.ddiWarnings.map((ddi, i) => (
              <li key={i}>{ddi}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Thai kỳ & Quản lý bảo quản */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <div className="flex items-center gap-1 font-bold text-slate-800 text-xs">
            <Baby className="w-3.5 h-3.5 text-purple-600" />
            <span>Phụ Nữ Mang Thai &amp; Cho Con Bú</span>
          </div>
          <p className="text-slate-600 text-[11px]">{profile.pregnancyLactation}</p>
        </div>

        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
          <div className="flex items-center gap-1 font-bold text-slate-800 text-xs">
            <Lock className="w-3.5 h-3.5 text-teal-600" />
            <span>Bảo Quản &amp; Quản Lý Vỏ Ống (TT 18/2026)</span>
          </div>
          <p className="text-slate-600 text-[11px]">{profile.storageAndHandling}</p>
        </div>
      </div>
    </div>
  );
};
