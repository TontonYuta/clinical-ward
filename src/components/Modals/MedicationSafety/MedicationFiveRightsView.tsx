/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng hiển thị Chi tiết Quy chuẩn 5 Đúng trong Dùng thuốc (QĐ 2147/BYT) (<=200 LOC)
 */

import React from 'react';
import { UserCheck, Pill, Scale, Navigation, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { FiveRightsSafetyInfo } from '../../../types/medication';

interface Props {
  profile: FiveRightsSafetyInfo;
}

export const MedicationFiveRightsView: React.FC<Props> = ({ profile }) => {
  return (
    <div className="space-y-3 text-xs">
      {/* 1. Đúng Người Bệnh */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-200 pb-1.5">
          <div className="w-5 h-5 rounded bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-[11px]">1</div>
          <UserCheck className="w-4 h-4 text-blue-700" />
          <span>1. Đúng người bệnh</span>
        </div>
        <div className="space-y-1.5 text-slate-700">
          <div><strong className="text-slate-900">• Đối tượng phù hợp:</strong> {profile.targetPopulation}</div>
          <div>
            <strong className="text-rose-800">• Chống chỉ định tuyệt đối &amp; thận trọng:</strong>
            <ul className="list-disc list-inside ml-2 mt-0.5 space-y-0.5 text-rose-700">
              {profile.contraindications.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <div className="bg-blue-50/80 p-2 rounded border border-blue-200 text-blue-900 text-[11px]">
            <strong className="flex items-center gap-1 mb-0.5"><ShieldCheck className="w-3.5 h-3.5" /> Checklist đối soát điều dưỡng:</strong>
            {profile.patientVerificationChecklist.join(' • ')}
          </div>
        </div>
      </div>

      {/* 2. Đúng Thuốc */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-200 pb-1.5">
          <div className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">2</div>
          <Pill className="w-4 h-4 text-emerald-700" />
          <span>2. Đúng thuốc</span>
        </div>
        <div className="space-y-1 text-slate-700">
          <div>
            <strong className="text-slate-900">• Tên Tall Man (chống nhầm lẫn LASA):</strong>{' '}
            <span className="font-mono font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {profile.tallManLASA || 'Chuẩn biệt dược gốc'}
            </span>
          </div>
          {profile.highAlertRiskNote && (
            <div className="text-amber-800 font-semibold flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{profile.highAlertRiskNote}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Đúng Liều */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-200 pb-1.5">
          <div className="w-5 h-5 rounded bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[11px]">3</div>
          <Scale className="w-4 h-4 text-amber-700" />
          <span>3. Đúng liều</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
          <div className="bg-white p-2 rounded border border-slate-200">
            <span className="text-[10.5px] text-slate-500 block">Liều chỉ định thông thường:</span>
            <span className="font-bold text-slate-900">{profile.standardDosing}</span>
          </div>
          <div className="bg-white p-2 rounded border border-slate-200">
            <span className="text-[10.5px] text-slate-500 block">Liều tối đa 24 giờ:</span>
            <span className="font-bold text-rose-700">{profile.maxDailyDose}</span>
          </div>
        </div>
        {profile.renalAdjustment && (
          <div className="text-[11px] text-slate-600">
            <strong className="text-slate-800">• Chỉnh liều suy thận:</strong> {profile.renalAdjustment}
          </div>
        )}
      </div>

      {/* 4. Đúng Đường Dùng */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-200 pb-1.5">
          <div className="w-5 h-5 rounded bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-[11px]">4</div>
          <Navigation className="w-4 h-4 text-purple-700" />
          <span>4. Đúng đường dùng</span>
        </div>
        <div className="space-y-1.5 text-slate-700">
          <div><strong className="text-slate-900">• Hướng dẫn đường dùng:</strong> {profile.administrationRouteDetails}</div>
          {profile.compatibleDiluents && profile.compatibleDiluents.length > 0 && (
            <div>
              <strong className="text-slate-900">• Dung môi tương thích:</strong>{' '}
              <span className="font-medium text-slate-800">{profile.compatibleDiluents.join(', ')}</span>
            </div>
          )}
          {profile.routeWarning && (
            <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-900 font-bold text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{profile.routeWarning}</span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Đúng Thời Gian */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-200 pb-1.5">
          <div className="w-5 h-5 rounded bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-[11px]">5</div>
          <Clock className="w-4 h-4 text-teal-700" />
          <span>5. Đúng thời gian</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
          <div className="bg-white p-2 rounded border border-slate-200">
            <span className="text-[10.5px] text-slate-500 block">Khoảng cách liều:</span>
            <span className="font-bold text-slate-900">{profile.timingAndFrequency}</span>
          </div>
          <div className="bg-white p-2 rounded border border-slate-200">
            <span className="text-[10.5px] text-slate-500 block">Liên quan bữa ăn:</span>
            <span className="font-bold text-slate-900">{profile.mealRelation}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
