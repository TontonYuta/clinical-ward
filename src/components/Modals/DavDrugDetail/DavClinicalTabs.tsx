/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Các Tab Nội Dung Lâm Sàng Chi Tiết Dược Thư Quốc Gia 2022 (<=200 LOC)
 * Trình bày cấu trúc hóa theo dạng thẻ & gạch đầu dòng, tối ưu quét nhanh cho Bác sĩ
 */

import React, { useState } from 'react';
import { Pill, Stethoscope, AlertTriangle, ChevronDown, ChevronUp, Clock, ShieldAlert, Route } from 'lucide-react';
import { ClinicalDataProps } from './DavClinicalKnowledgeBlock';
import { extractQuickDosageMetrics, parseClinicalBullets } from '../../../utils/clinicalFormatter';

type TabType = 'dosage' | 'indications' | 'safety';

export const DavClinicalTabs: React.FC<{ data: ClinicalDataProps }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<TabType>('dosage');
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});

  const toggleRaw = (sec: string) => setShowRaw((p) => ({ ...p, [sec]: !p[sec] }));
  const dosageMetrics = extractQuickDosageMetrics(data.adultDosage);

  const renderStructuredBlock = (
    id: string,
    title: string,
    rawText?: string,
    badge?: string,
    badgeCls = 'bg-blue-50 text-blue-800 border-blue-200'
  ) => {
    if (!rawText) return null;
    const isRaw = showRaw[id];
    const bullets = parseClinicalBullets(rawText);

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-1.5 pb-2 border-b border-slate-100">
          <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight">{title}</span>
          <div className="flex items-center gap-1.5">
            {badge && <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${badgeCls}`}>{badge}</span>}
            <button
              type="button"
              onClick={() => toggleRaw(id)}
              className="text-2xs text-slate-500 hover:text-blue-600 underline cursor-pointer ml-1"
            >
              {isRaw ? 'Xem dạng thẻ' : 'Văn bản gốc'}
            </button>
          </div>
        </div>

        {isRaw ? (
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-mono bg-slate-50 p-2.5 rounded border border-slate-200/70">
            {rawText}
          </p>
        ) : (
          <div className="space-y-2">
            {bullets.map((b, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-md text-xs sm:text-sm leading-relaxed ${
                  b.isImportant
                    ? 'bg-amber-50/60 border border-amber-200/80 text-amber-950 font-medium'
                    : 'bg-slate-50/80 border border-slate-100 text-slate-800'
                }`}
              >
                {b.label && (
                  <span className="inline-block px-1.5 py-0.5 rounded font-bold text-2xs mr-1.5 uppercase tracking-wide bg-blue-100 text-blue-900 border border-blue-200">
                    {b.label}
                  </span>
                )}
                <span>{b.content}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const navBtn = (tab: TabType, label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm transition cursor-pointer font-medium ${
        activeTab === tab
          ? 'bg-blue-600 text-white shadow-xs font-bold'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-3 pt-1">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        {navBtn('dosage', 'Liều dùng & Chỉnh liều', Pill)}
        {navBtn('indications', 'Chỉ định & Thận trọng', Stethoscope)}
        {navBtn('safety', 'ADR & Tương tác', AlertTriangle)}
      </div>

      {/* Tab Panels */}
      {activeTab === 'dosage' && (
        <div className="space-y-3 animate-in fade-in duration-100">
          {/* Quick Dosage Highlight Bar for Doctors */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="space-y-0.5">
              <span className="text-slate-500 text-2xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Route className="w-3 h-3 text-blue-600" /> Đường dùng
              </span>
              <div className="font-bold text-slate-900 truncate">
                {dosageMetrics.routes.join(' • ')}
              </div>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-500 text-2xs font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-600" /> Khoảng cách liều
              </span>
              <div className="font-bold text-blue-900 truncate">{dosageMetrics.interval || '4 - 6 giờ/lần'}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-500 text-2xs font-bold uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3 h-3 text-rose-600" /> Trần liều 24h
              </span>
              <div className="font-bold text-rose-700 truncate">{dosageMetrics.maxDailyDose || 'Tối đa 4 g/ngày'}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-slate-500 text-2xs font-bold uppercase tracking-wider">Cảnh báo đặc biệt</span>
              <div className="text-slate-700 truncate text-2xs font-medium" title={dosageMetrics.specialWarning || 'Theo dõi chức năng gan'}>
                {dosageMetrics.specialWarning || 'Theo dõi chức năng gan'}
              </div>
            </div>
          </div>

          {renderStructuredBlock('adult', 'Liều dùng người lớn & Khuyến cáo đường dùng', data.adultDosage, 'Người lớn')}
          {renderStructuredBlock('pediatric', 'Liều dùng trẻ em (mg/kg theo tuổi & cân nặng)', data.pediatricDosage, 'Nhi khoa')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderStructuredBlock('renal', 'Chỉnh liều suy thận (ClCr / eGFR)', data.renalAdjustment, 'Suy thận')}
            {renderStructuredBlock('hepatic', 'Chỉnh liều suy gan', data.hepaticAdjustment, 'Suy gan')}
          </div>
        </div>
      )}

      {activeTab === 'indications' && (
        <div className="space-y-3 animate-in fade-in duration-100">
          {renderStructuredBlock('indications', 'Chỉ định điều trị chính thức', data.indications, 'Chỉ định')}
          {renderStructuredBlock('precautions', 'Thận trọng & Cảnh báo an toàn lâm sàng', data.precautions, 'Cảnh báo')}
          {renderStructuredBlock('pregnancy', 'Thời kỳ mang thai & Cho con bú', data.pregnancyWarning, 'Thai kỳ & Nuôi con')}
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="space-y-3 animate-in fade-in duration-100">
          {renderStructuredBlock('adverse', 'Tác dụng không mong muốn (ADR & Tỷ lệ gặp)', data.adverseEffects, 'ADR Dược Thư', 'bg-rose-50 text-rose-800 border-rose-200')}
          {renderStructuredBlock('interactions', 'Tương tác thuốc đáng chú ý & Phối hợp cần tránh', data.drugInteractions, 'Tương tác thuốc')}
          {renderStructuredBlock('overdose', 'Xử trí quá liều & Triệu chứng ngộ độc cấp', data.overdoseTreatment, 'Quá liều cấp', 'bg-slate-100 text-slate-800 border-slate-300')}
        </div>
      )}
    </div>
  );
};
