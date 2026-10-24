/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * View Chi Tiết: Thành Phần Công Thức, Chỉ Định & Cảnh Báo Dị Ứng (<=200 LOC)
 */

import React from 'react';
import { ShieldAlert, AlertTriangle, Activity, Stethoscope, Sparkles, FlaskConical, Package } from 'lucide-react';
import { FiveRightsSafetyInfo } from '../../../types/medication';

interface MedicationAllergyViewProps {
  profile: FiveRightsSafetyInfo;
  medName: string;
}

export const MedicationAllergyView: React.FC<MedicationAllergyViewProps> = ({ profile, medName }) => {
  const comp = profile.composition;
  const allergy = profile.allergyProfile;
  const indications = profile.indications || ['Điều trị các bệnh lý theo chỉ định chuyên khoa.', profile.targetPopulation];

  return (
    <div className="space-y-3.5 text-xs">
      {/* 1. KHỐI THÀNH PHẦN THUỐC & DẠNG BÀO CHẾ (DĐVN V & DƯỢC THƯ) */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-teal-700" />
            <h4 className="font-bold text-slate-900 text-sm">Thành phần &amp; Dạng bào chế</h4>
          </div>
          {comp?.pharmacopeiaStandard && (
            <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-200">
              {comp.pharmacopeiaStandard}
            </span>
          )}
        </div>

        {/* Hoạt chất chính */}
        <div className="space-y-1.5 mb-2.5">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            Dược chất chính (API):
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(comp?.activeIngredients || [{ innName: medName, chemicalSalt: medName, strength: 'Hàm lượng chuẩn' }]).map((act, i) => (
              <div key={i} className="bg-white p-2 rounded border border-slate-200 shadow-2xs">
                <div className="font-bold text-slate-900">{act.innName}</div>
                <div className="text-[11px] text-slate-600">{act.chemicalSalt} • <strong className="text-teal-800">{act.strength}</strong></div>
                {act.molarQuantity && <div className="text-[10px] text-purple-700 font-mono mt-0.5">{act.molarQuantity}</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Danh mục tá dược */}
        <div className="space-y-1.5 mb-2.5">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-500" />
            Tá dược:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(comp?.excipients || (allergy?.excipientAllergens || []).map(e => ({ name: e, role: 'Tá dược', safetyNotice: undefined }))).map((exc: { name: string; role: string; safetyNotice?: string }, i) => (
              <span key={i} className="px-2 py-1 rounded bg-white border border-slate-200 text-slate-800 text-[11px] shadow-2xs">
                <strong>{exc.name}</strong> <span className="text-slate-500">({exc.role})</span>
                {exc.safetyNotice && <span className="text-rose-600 font-semibold ml-1">⚠️ {exc.safetyNotice}</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Cảm quan, pH & Quy cách đóng gói */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200/80 text-[11px]">
          <div>
            <span className="text-slate-500 block">Dạng bào chế:</span>
            <strong className="text-slate-800">{comp?.dosageForm || 'Dung dịch tiêm / Bột pha tiêm'}</strong>
          </div>
          <div>
            <span className="text-slate-500 block">pH &amp; Áp lực thẩm thấu:</span>
            <strong className="text-slate-800">{comp?.phAndOsmolarity || 'Theo Dược điển'}</strong>
          </div>
          <div>
            <span className="text-slate-500 block">Quy cách &amp; Cảm quan:</span>
            <span className="text-slate-700 truncate block" title={comp?.packagingSpec}>{comp?.packagingSpec || 'Hộp tiêu chuẩn'}</span>
          </div>
        </div>
      </div>

      {/* 2. CHỈ ĐỊNH ĐIỀU TRỊ */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-1.5">
          <Stethoscope className="w-4 h-4 text-blue-700" />
          <h4 className="font-bold text-blue-900 text-sm">Chỉ định điều trị</h4>
        </div>
        <ul className="space-y-1 text-slate-800 list-disc list-inside pl-1 text-[11.5px]">
          {indications.map((ind, idx) => (
            <li key={idx}><span className="font-medium">{ind}</span></li>
          ))}
        </ul>
        {profile.pharmacologyMechanism && (
          <div className="mt-2.5 pt-2 border-t border-blue-100 flex items-start gap-1.5 text-slate-700 text-[11.5px]">
            <Activity className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
            <p className="leading-snug"><strong className="text-blue-900">Cơ chế: </strong>{profile.pharmacologyMechanism}</p>
          </div>
        )}
      </div>

      {/* 3. CẢNH BÁO DỊ ỨNG */}
      <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-700" />
            <h4 className="font-bold text-rose-900 text-sm">Cảnh báo dị ứng</h4>
          </div>
          {allergy?.allergyClass && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
              Nhóm: {allergy.allergyClass}
            </span>
          )}
        </div>

        {allergy && (
          <div className="space-y-2 text-[11.5px]">
            {allergy.crossReactivities && allergy.crossReactivities.length > 0 && (
              <div>
                <span className="font-bold text-rose-900">⚠️ Dị ứng chéo: </span>
                <span className="font-semibold text-rose-800">{allergy.crossReactivities.join(', ')}</span>
              </div>
            )}
            <div>
              <span className="font-bold text-slate-900">🚫 Chống chỉ định: </span>
              <span className="text-rose-900 font-medium">{(allergy.contraindicatedAllergies || profile.contraindications).join('; ')}</span>
            </div>
            <div className="p-2 bg-white rounded border border-rose-200 text-slate-800 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <strong>Xử trí phản vệ: </strong>
                {allergy.emergencyManagement || 'Ngừng thuốc ngay lập tức. Tiêm bắp Adrenalin 1mg/1ml.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
