/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng hiển thị Quy chuẩn 5 Đúng trong Dùng thuốc (QĐ 2147/BYT) (<=200 LOC)
 * Giao diện tối ưu không gian rộng, typography rõ nét, loại bỏ icon thừa
 */

import React from 'react';
import { FiveRightsSafetyInfo } from '../../../types/medication';

interface Props {
  profile: FiveRightsSafetyInfo;
}

export const MedicationFiveRightsView: React.FC<Props> = ({ profile }) => {
  return (
    <div className="space-y-4 text-sm text-slate-800">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 1. ĐÚNG NGƯỜI BỆNH */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs">1</span>
            <span className="text-sm">Đúng Người Bệnh &amp; Chống Chỉ Định</span>
          </div>
          <div className="space-y-2 text-xs sm:text-sm">
            <div>
              <strong className="text-slate-900 block mb-0.5">Đối tượng chỉ định:</strong>
              <p className="text-slate-700 leading-relaxed">{profile.targetPopulation}</p>
            </div>
            <div>
              <strong className="text-rose-900 block mb-0.5">Chống chỉ định tuyệt đối &amp; thận trọng:</strong>
              <ul className="list-disc list-inside space-y-0.5 text-rose-800 leading-relaxed">
                {profile.contraindications.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-slate-700 text-xs">
              <strong className="text-slate-900 block mb-0.5">Checklist nhận diện &amp; đối soát:</strong>
              {profile.patientVerificationChecklist.join(' • ')}
            </div>
          </div>
        </div>

        {/* 2. ĐÚNG THUỐC */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs">2</span>
            <span className="text-sm">Đúng Thuốc &amp; Chống Nhầm Lẫn (LASA)</span>
          </div>
          <div className="space-y-3 text-xs sm:text-sm">
            <div>
              <strong className="text-slate-900 block mb-1">Tên chuẩn Tall Man chống nhầm lẫn:</strong>
              <span className="font-mono font-bold text-teal-950 bg-teal-50 px-3 py-1 rounded-md border border-teal-200 inline-block text-sm">
                {profile.tallManLASA || 'Chuẩn biệt dược gốc'}
              </span>
            </div>
            {profile.highAlertRiskNote && (
              <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200 text-amber-950 text-xs leading-relaxed">
                <strong className="block mb-0.5">Cảnh báo rủi ro cao (ISMP High-Alert):</strong>
                {profile.highAlertRiskNote}
              </div>
            )}
          </div>
        </div>

        {/* 3. ĐÚNG LIỀU */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs">3</span>
            <span className="text-sm">Đúng Liều &amp; Giới Hạn Tối Đa 24h</span>
          </div>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                <span className="text-xs text-slate-500 block mb-0.5">Liều khởi đầu / Thông thường:</span>
                <span className="font-bold text-slate-900 text-sm">{profile.standardDosing}</span>
              </div>
              <div className="bg-rose-50/60 p-2.5 rounded-lg border border-rose-200/70">
                <span className="text-xs text-rose-600 block mb-0.5">Liều tối đa 24 giờ:</span>
                <span className="font-bold text-rose-800 text-sm">{profile.maxDailyDose}</span>
              </div>
            </div>
            {profile.renalAdjustment && (
              <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
                <strong className="text-slate-900 block mb-0.5">Hiệu chỉnh liều theo chức năng thận:</strong>
                {profile.renalAdjustment}
              </div>
            )}
          </div>
        </div>

        {/* 4. ĐÚNG ĐƯỜNG DÙNG */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2.5 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
            <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs">4</span>
            <span className="text-sm">Đúng Đường Dùng &amp; Dung Môi Pha Truyền</span>
          </div>
          <div className="space-y-2 text-xs sm:text-sm">
            <div>
              <strong className="text-slate-900 block mb-0.5">Kỹ thuật tiêm / truyền:</strong>
              <p className="text-slate-700 leading-relaxed">{profile.administrationRouteDetails}</p>
            </div>
            {profile.compatibleDiluents && profile.compatibleDiluents.length > 0 && (
              <div>
                <strong className="text-slate-900 block mb-0.5">Dung môi pha truyền tương thích:</strong>
                <span className="text-slate-800 font-medium">{profile.compatibleDiluents.join(', ')}</span>
              </div>
            )}
            {profile.routeWarning && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 font-bold text-xs">
                ⚠️ {profile.routeWarning}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. ĐÚNG THỜI GIAN (FULL WIDTH BANNER) */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2 shadow-2xs">
        <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
          <span className="w-5 h-5 rounded-md bg-slate-900 text-white flex items-center justify-center font-bold text-xs">5</span>
          <span className="text-sm">Đúng Thời Gian, Tần Suất &amp; Liên Quan Bữa Ăn</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
            <span className="text-xs text-slate-500 block mb-0.5">Khoảng cách liều &amp; Tần suất dùng:</span>
            <span className="font-bold text-slate-900">{profile.timingAndFrequency}</span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/70">
            <span className="text-xs text-slate-500 block mb-0.5">Liên quan bữa ăn:</span>
            <span className="font-bold text-slate-900">{profile.mealRelation}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
