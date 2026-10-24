/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Chi tiết Giám sát Lâm sàng, Giải độc Antidote & Dược Bệnh Viện (<=200 LOC)
 * Giao diện tối ưu không gian rộng, typography rõ nét, loại bỏ icon thừa
 */

import React from 'react';
import { FiveRightsSafetyInfo } from '../../../types/medication';
import { VerificationBadgeLink } from '../../Common/VerificationBadgeLink';

interface Props {
  profile: FiveRightsSafetyInfo;
}

export const MedicationClinicalSafetyView: React.FC<Props> = ({ profile }) => {
  const inn = profile.composition?.activeIngredients?.[0]?.innName;

  return (
    <div className="space-y-4 text-sm text-slate-800">
      {/* CẢNH BÁO NGUY CƠ CAO (BLACK BOX WARNING) */}
      {profile.blackBoxWarning && (
        <div className="p-4 bg-white border-2 border-rose-200 rounded-xl space-y-2 shadow-2xs">
          <div className="flex items-center justify-between pb-2 border-b border-rose-100">
            <span className="font-bold text-rose-950 text-sm">
              Cảnh báo nguy cơ cao (Black Box Warning)
            </span>
            {inn && (
              <VerificationBadgeLink
                href={`https://dailymed.nlm.nih.gov/dailymed/search.cfm?labeltype=all&query=${encodeURIComponent(inn)}`}
                label="FDA Boxed Warning"
                sourceType="fda"
              />
            )}
          </div>
          <p className="text-xs sm:text-sm leading-relaxed text-rose-900 font-medium">
            {profile.blackBoxWarning}
          </p>
        </div>
      )}

      {/* 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CỘT 1: GIẢI ĐỘC, TÁC DỤNG PHỤ & THEO DÕI */}
        <div className="space-y-4">
          {/* Thuốc giải độc đặc hiệu (Antidote) */}
          {profile.antidote && (
            <div className="p-4 bg-white border border-slate-200/90 rounded-xl space-y-2 shadow-2xs">
              <span className="font-bold text-slate-900 text-sm block pb-2 border-b border-slate-100">
                Thuốc giải độc đặc hiệu (Antidote)
              </span>
              <p className="font-bold text-emerald-900 bg-emerald-50/80 p-3 rounded-lg border border-emerald-200 text-sm">
                {profile.antidote}
              </p>
            </div>
          )}

          {/* Tác dụng phụ thường gặp & Quá liều */}
          <div className="p-4 bg-white border border-slate-200/90 rounded-xl space-y-3 shadow-2xs">
            <span className="font-bold text-slate-900 text-sm block pb-2 border-b border-slate-100">
              Tác dụng phụ thường gặp &amp; Dấu hiệu quá liều
            </span>
            <div className="flex flex-wrap gap-1.5">
              {profile.adverseReactions.map((adr, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium">
                  • {adr}
                </span>
              ))}
            </div>
            <div className="text-xs sm:text-sm text-slate-600 pt-2 border-t border-slate-100">
              <strong className="text-slate-900">Theo dõi lâm sàng: </strong>
              {profile.clinicalMonitoring}
            </div>
          </div>
        </div>

        {/* CỘT 2: TƯƠNG TÁC THUỐC (DDI) & TDM & THAI KỲ */}
        <div className="space-y-4">
          {/* Tương tác thuốc nghiêm trọng */}
          {profile.ddiWarnings && profile.ddiWarnings.length > 0 && (
            <div className="p-4 bg-white border border-slate-200/90 rounded-xl space-y-2.5 shadow-2xs">
              <span className="font-bold text-amber-950 text-sm block pb-2 border-b border-amber-100">
                Tương tác thuốc nghiêm trọng cần tránh (DDI)
              </span>
              <ul className="list-disc list-inside space-y-1.5 text-amber-900 text-xs sm:text-sm leading-relaxed">
                {profile.ddiWarnings.map((ddi, i) => (
                  <li key={i}>{ddi}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Giám sát TDM & Lọc máu ngoài thận */}
          {(profile.tdmMonitoring || profile.dialysisClearance) && (
            <div className="p-4 bg-white border border-slate-200/90 rounded-xl space-y-2 shadow-2xs">
              <span className="font-bold text-slate-900 text-sm block pb-2 border-b border-slate-100">
                Giám sát nồng độ thuốc (TDM) &amp; Thải trừ lọc máu
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {profile.tdmMonitoring && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-0.5">Nồng độ đáy (Trough):</strong>
                    <span className="text-slate-700">{profile.tdmMonitoring}</span>
                  </div>
                )}
                {profile.dialysisClearance && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <strong className="text-slate-900 block mb-0.5">Lọc máu (HD/CRRT):</strong>
                    <span className="text-slate-700">{profile.dialysisClearance}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Thai kỳ & Bảo quản */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-1 shadow-2xs">
              <span className="font-bold text-slate-900 text-xs block">Phụ nữ mang thai &amp; Cho con bú:</span>
              <p className="text-slate-600 text-xs leading-relaxed">{profile.pregnancyLactation}</p>
            </div>
            <div className="p-3 bg-white border border-slate-200/90 rounded-xl space-y-1 shadow-2xs">
              <span className="font-bold text-slate-900 text-xs block">Bảo quản &amp; Quản lý vỏ ống:</span>
              <p className="text-slate-600 text-xs leading-relaxed">{profile.storageAndHandling}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
