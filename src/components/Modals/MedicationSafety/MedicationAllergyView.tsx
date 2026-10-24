/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * View Chi Tiết: Thành Phần Công Thức, Chỉ Định & Dị Ứng (<=200 LOC)
 * Tối ưu hiển thị không gian rộng, typography rõ nét, loại bỏ icon thừa
 */

import React from 'react';
import { FiveRightsSafetyInfo } from '../../../types/medication';
import { VerificationPanelSection } from '../../Common/VerificationBadgeLink';

interface MedicationAllergyViewProps {
  profile: FiveRightsSafetyInfo;
  medName: string;
}

export const MedicationAllergyView: React.FC<MedicationAllergyViewProps> = ({ profile, medName }) => {
  const comp = profile.composition;
  const allergy = profile.allergyProfile;
  const source = profile.officialSource;
  const indications = profile.indications || ['Điều trị các bệnh lý theo chỉ định chuyên khoa.', profile.targetPopulation];

  return (
    <div className="space-y-4 text-sm text-slate-800">
      {/* 1. NGUỒN TRÍCH XUẤT CHÍNH THỨC */}
      {source && (
        <div className="p-3.5 bg-white border border-slate-200/90 rounded-xl space-y-1.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
              Nguồn trích xuất y tế chính thống
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
              {source.approvalAuthority || 'Cục Quản lý Dược - Bộ Y Tế'}
            </span>
          </div>
          <div className="font-medium text-slate-900 text-sm">{source.documentName}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1 border-t border-slate-100">
            {source.registrationNumber && (
              <span>SĐK: <strong className="text-slate-900 font-mono">{source.registrationNumber}</strong></span>
            )}
            {source.manufacturer && (
              <span>NSX: <strong className="text-slate-800">{source.manufacturer}</strong></span>
            )}
            {source.standardPharmacopeia && (
              <span>Chuẩn dược điển: <strong className="text-slate-800">{source.standardPharmacopeia}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* LIÊN KẾT ĐỐI SOÁT THỦ CÔNG */}
      <VerificationPanelSection
        sdk={source?.registrationNumber}
        innName={comp?.activeIngredients?.[0]?.innName || medName}
        brandName={medName}
        legalBasis={source?.documentName || profile.highAlertRiskNote}
      />

      {/* 2-COLUMN GRID: THÀNH PHẦN & CHỈ ĐỊNH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CỘT 1: THÀNH PHẦN & DẠNG BÀO CHẾ */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-xl space-y-3 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Thành phần &amp; Dạng bào chế</h4>
              {comp?.pharmacopeiaStandard && (
                <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {comp.pharmacopeiaStandard}
                </span>
              )}
            </div>

            {/* Dược chất chính */}
            <div className="space-y-1.5 mt-3">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">Dược chất chính (API):</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(comp?.activeIngredients || [{ innName: medName, chemicalSalt: medName, strength: 'Chuẩn' }]).map((act, i) => (
                  <div key={i} className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-200/80">
                    <div className="font-bold text-slate-900 text-sm">{act.innName}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{act.chemicalSalt} • <strong className="text-teal-800">{act.strength}</strong></div>
                    {act.molarQuantity && <div className="text-xs text-purple-700 font-mono mt-0.5">{act.molarQuantity}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Tá dược */}
            <div className="space-y-1.5 mt-3">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">Danh mục tá dược (Excipients):</span>
              <div className="flex flex-wrap gap-1.5">
                {(comp?.excipients || (allergy?.excipientAllergens || []).map(e => ({ name: e, role: 'Tá dược', safetyNotice: undefined }))).map((exc, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-800 text-xs">
                    <strong>{exc.name}</strong> <span className="text-slate-500">({exc.role})</span>
                    {exc.safetyNotice && <span className="text-rose-700 font-semibold ml-1">⚠️ {exc.safetyNotice}</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Dạng bào chế & Cảm quan */}
          <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-500 block">Dạng bào chế:</span>
              <strong className="text-slate-900">{comp?.dosageForm || 'Dung dịch tiêm'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">pH &amp; Thẩm thấu:</span>
              <strong className="text-slate-900">{comp?.phAndOsmolarity || 'Chuẩn DĐVN'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Quy cách:</span>
              <span className="text-slate-800 font-medium truncate block" title={comp?.packagingSpec}>{comp?.packagingSpec || 'Hộp tiêu chuẩn'}</span>
            </div>
          </div>
        </div>

        {/* CỘT 2: CHỈ ĐỊNH ĐIỀU TRỊ & DƯỢC LÝ */}
        <div className="p-4 bg-white border border-slate-200/90 rounded-xl space-y-3 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-900 text-sm">Chỉ định điều trị &amp; Cơ chế</h4>
            </div>
            <ul className="space-y-1.5 text-slate-800 list-disc list-inside mt-3 text-xs sm:text-sm leading-relaxed">
              {indications.map((ind, idx) => (
                <li key={idx}><span className="font-medium text-slate-900">{ind}</span></li>
              ))}
            </ul>
          </div>
          {profile.pharmacologyMechanism && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200/60">
              <strong className="text-slate-900 block mb-0.5">Cơ chế tác dụng dược lý:</strong>
              {profile.pharmacologyMechanism}
            </div>
          )}
        </div>
      </div>

      {/* 3. CẢNH BÁO DỊ ỨNG & PHẢN VỆ */}
      <div className="p-4 bg-white border border-rose-200/90 rounded-xl space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between pb-2 border-b border-rose-100">
          <h4 className="font-bold text-rose-950 text-sm">Hồ sơ Cảnh báo Dị ứng &amp; Xử trí Phản vệ</h4>
          {allergy?.allergyClass && (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
              Nhóm: {allergy.allergyClass}
            </span>
          )}
        </div>

        {allergy && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
            <div className="space-y-1.5">
              {allergy.crossReactivities && allergy.crossReactivities.length > 0 && (
                <div>
                  <span className="font-bold text-rose-950">Nguy cơ dị ứng chéo: </span>
                  <span className="font-semibold text-rose-800">{allergy.crossReactivities.join(', ')}</span>
                </div>
              )}
              <div>
                <span className="font-bold text-slate-900">Chống chỉ định tiền sử: </span>
                <span className="text-rose-900 font-medium">{(allergy.contraindicatedAllergies || profile.contraindications).join('; ')}</span>
              </div>
            </div>
            <div className="p-3 bg-rose-50/70 rounded-lg border border-rose-200 text-slate-800 text-xs leading-relaxed">
              <strong className="text-rose-950 block mb-0.5">Xử trí cấp cứu phản vệ (Thông tư 51/2017/TT-BYT):</strong>
              {allergy.emergencyManagement || 'Ngừng thuốc ngay lập tức. Tiêm bắp Adrenalin 1mg/1ml.'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
