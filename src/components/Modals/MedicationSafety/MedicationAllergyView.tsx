/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * View Chi Tiết: Chỉ Định Điều Trị ("Dùng để làm gì") & Cảnh Báo Dị Ứng / Quá Mẫn (<=200 LOC)
 */

import React from 'react';
import { ShieldAlert, AlertTriangle, Activity, Stethoscope, Sparkles } from 'lucide-react';
import { FiveRightsSafetyInfo } from '../../../types/medication';

interface MedicationAllergyViewProps {
  profile: FiveRightsSafetyInfo;
  medName: string;
}

export const MedicationAllergyView: React.FC<MedicationAllergyViewProps> = ({ profile, medName }) => {
  const allergy = profile.allergyProfile;
  const indications = profile.indications || [
    'Điều trị các bệnh lý theo chỉ định chuyên khoa của bác sĩ điều trị.',
    profile.targetPopulation,
  ];

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Khối Chỉ định: Dùng để làm gì? */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope className="w-4 h-4 text-blue-700" />
          <h4 className="font-bold text-blue-900 text-sm">Chỉ định Điều trị ("Dùng để làm gì?")</h4>
        </div>
        <ul className="space-y-1.5 text-slate-800 list-disc list-inside pl-1">
          {indications.map((ind, idx) => (
            <li key={idx} className="leading-relaxed">
              <span className="font-medium">{ind}</span>
            </li>
          ))}
        </ul>

        {profile.pharmacologyMechanism && (
          <div className="mt-3 pt-2.5 border-t border-blue-100 flex items-start gap-2 text-slate-700">
            <Activity className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
            <p className="leading-snug">
              <strong className="text-blue-900">Cơ chế dược lý: </strong>
              {profile.pharmacologyMechanism}
            </p>
          </div>
        )}
      </div>

      {/* 2. Cảnh báo Dị ứng & Thành phần hoạt chất / tá dược */}
      <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-700" />
            <h4 className="font-bold text-rose-900 text-sm">Cảnh Báo Dị Ứng & Phản Vệ Thành Phần</h4>
          </div>
          {allergy?.allergyClass && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
              Nhóm: {allergy.allergyClass}
            </span>
          )}
        </div>

        {/* Thành phần có nguy cơ dị ứng */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
          <div className="bg-white/80 p-2.5 rounded border border-rose-200">
            <p className="font-bold text-rose-950 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              Hoạt chất chính:
            </p>
            <div className="flex flex-wrap gap-1">
              {(profile.activeIngredients || [medName]).map((ing, i) => (
                <span key={i} className="px-2 py-0.5 bg-rose-100/70 text-rose-900 font-mono text-[11px] rounded font-semibold">
                  {ing}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white/80 p-2.5 rounded border border-amber-200">
            <p className="font-bold text-amber-950 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Tá dược có thể gây quá mẫn:
            </p>
            <div className="flex flex-wrap gap-1">
              {(allergy?.excipientAllergens || ['Tá dược thông thường theo dược điển']).map((exc, i) => (
                <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-900 text-[11px] rounded border border-amber-200">
                  {exc}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Dị ứng chéo & Chống chỉ định tiền sử */}
        {allergy && (
          <div className="space-y-2 pt-2 border-t border-rose-100">
            {allergy.crossReactivities && allergy.crossReactivities.length > 0 && (
              <div>
                <p className="font-bold text-rose-900 mb-1">
                  ⚠️ Nguy cơ dị ứng chéo (Cross-reactivity):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allergy.crossReactivities.map((cr, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-semibold text-[11px] border border-rose-200">
                      {cr}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="font-bold text-slate-900 mb-1">🚫 Chống chỉ định người có tiền sử dị ứng:</p>
              <ul className="space-y-1 text-slate-800 list-disc list-inside">
                {(allergy.contraindicatedAllergies || profile.contraindications).map((item, idx) => (
                  <li key={idx} className="leading-snug font-medium text-rose-900">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 3. Dấu hiệu nhận biết & Xử trí phản vệ */}
      {allergy && (
        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-700" />
            <h5 className="font-bold text-amber-900 text-xs">Triệu Chứng Dị Ứng Lâm Sàng & Xử Trí Khẩn Cấp</h5>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11.5px]">
            <div>
              <p className="font-semibold text-slate-700 mb-1">Dấu hiệu nghi ngờ:</p>
              <ul className="list-disc list-inside text-slate-800 space-y-0.5">
                {(allergy.commonAllergySigns || ['Phát ban, ngứa, mày đay', 'Khó thở, phù mạch']).map((sign, i) => (
                  <li key={i}>{sign}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white/80 p-2 rounded border border-amber-300">
              <p className="font-bold text-rose-900 mb-1">Nguyên tắc xử trí tức thì:</p>
              <p className="text-slate-800 font-medium leading-relaxed">
                {allergy.emergencyManagement || 'Ngừng thuốc ngay lập tức. Tiêm bắp Adrenalin nếu có phản vệ theo Thông tư 51/2017/TT-BYT.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
