/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Các Tab Nội Dung Lâm Sàng Chi Tiết Dược Thư Quốc Gia 2022 (<=200 LOC)
 * Trình bày cấu trúc danh sách gạch đầu dòng chuẩn y tế (NHS/UpToDate), tối ưu khả năng đọc
 */

import React, { useState } from 'react';
import { ClinicalDataProps } from './DavClinicalKnowledgeBlock';
import { extractQuickDosageMetrics, parseClinicalBullets } from '../../../utils/clinicalFormatter';

type TabType = 'dosage' | 'indications' | 'safety';

export const DavClinicalTabs: React.FC<{ data: ClinicalDataProps }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<TabType>('dosage');
  const [showRaw, setShowRaw] = useState<Record<string, boolean>>({});

  const toggleRaw = (sec: string) => setShowRaw((p) => ({ ...p, [sec]: !p[sec] }));
  const dosageMetrics = extractQuickDosageMetrics(data.adultDosage);

  const renderSection = (
    id: string,
    title: string,
    rawText?: string,
    badge?: string
  ) => {
    if (!rawText) return null;
    const isRaw = showRaw[id];
    const bullets = parseClinicalBullets(rawText);

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h4 className="font-bold text-slate-900 text-sm tracking-tight">{title}</h4>
          <div className="flex items-center gap-2">
            {badge && (
              <span className="text-2xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                {badge}
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleRaw(id)}
              className="text-2xs text-slate-500 hover:text-blue-600 underline cursor-pointer"
            >
              {isRaw ? 'Xem gạch đầu dòng' : 'Văn bản gốc'}
            </button>
          </div>
        </div>

        {isRaw ? (
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-mono bg-slate-50 p-3 rounded border border-slate-200">
            {rawText}
          </p>
        ) : (
          <ul className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
            {bullets.map((b, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-2 ${
                  b.isImportant ? 'bg-amber-50/50 p-2 rounded text-slate-800' : ''
                }`}
              >
                <span className={`font-bold select-none mt-0.5 ${b.isImportant ? 'text-amber-600' : 'text-blue-600'}`}>
                  •
                </span>
                <div className="flex-1">
                  {b.label && (
                    <strong className="font-bold text-slate-900 mr-1.5">
                      {b.label}:
                    </strong>
                  )}
                  <span>{b.content}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const navTab = (tab: TabType, label: string) => {
    const isActive = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(tab)}
        className={`px-4 py-2 text-xs sm:text-sm font-semibold transition cursor-pointer border-b-2 -mb-px ${
          isActive
            ? 'text-blue-600 border-blue-600 font-bold'
            : 'text-slate-500 hover:text-slate-900 border-transparent'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4 pt-1">
      {/* Navigation Underline Tabs (Chuẩn Flat Medical, Không Icon) */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {navTab('dosage', 'Liều dùng & Chỉnh liều')}
        {navTab('indications', 'Chỉ định & Thận trọng')}
        {navTab('safety', 'ADR & Tương tác')}
      </div>

      {/* Tab Panels */}
      {activeTab === 'dosage' && (
        <div className="space-y-3.5 animate-in fade-in duration-100">
          {/* Quick Dosage Highlight Bar (Sạch sẽ, không icon rác) */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-500 text-2xs font-bold uppercase tracking-wider block">Đường dùng</span>
              <p className="font-bold text-slate-900 mt-0.5 truncate">{dosageMetrics.routes.join(' • ')}</p>
            </div>
            <div>
              <span className="text-slate-500 text-2xs font-bold uppercase tracking-wider block">Khoảng cách liều</span>
              <p className="font-bold text-slate-900 mt-0.5 truncate">{dosageMetrics.interval || '4 - 6 giờ/lần'}</p>
            </div>
            <div>
              <span className="text-slate-500 text-2xs font-bold uppercase tracking-wider block">Trần liều 24h</span>
              <p className="font-bold text-red-600 mt-0.5 truncate">{dosageMetrics.maxDailyDose || 'Tối đa 4 g/ngày'}</p>
            </div>
            <div>
              <span className="text-slate-500 text-2xs font-bold uppercase tracking-wider block">Lưu ý an toàn</span>
              <p className="text-slate-700 text-2xs font-medium mt-0.5 truncate" title={dosageMetrics.specialWarning || 'Theo dõi chức năng gan'}>
                {dosageMetrics.specialWarning || 'Theo dõi chức năng gan'}
              </p>
            </div>
          </div>

          {renderSection('adult', 'Liều dùng người lớn & Khuyến cáo đường dùng', data.adultDosage, 'Người lớn')}
          {renderSection('pediatric', 'Liều dùng trẻ em (mg/kg theo tuổi & cân nặng)', data.pediatricDosage, 'Nhi khoa')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {renderSection('renal', 'Chỉnh liều suy thận (ClCr / eGFR)', data.renalAdjustment, 'Suy thận')}
            {renderSection('hepatic', 'Chỉnh liều suy gan', data.hepaticAdjustment, 'Suy gan')}
          </div>
        </div>
      )}

      {activeTab === 'indications' && (
        <div className="space-y-3.5 animate-in fade-in duration-100">
          {renderSection('indications', 'Chỉ định điều trị chính thức', data.indications, 'Chỉ định')}
          {renderSection('precautions', 'Thận trọng & Cảnh báo an toàn lâm sàng', data.precautions, 'Cảnh báo')}
          {renderSection('pregnancy', 'Thời kỳ mang thai & Cho con bú', data.pregnancyWarning, 'Thai kỳ & Nuôi con')}
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="space-y-3.5 animate-in fade-in duration-100">
          {renderSection('adverse', 'Tác dụng không mong muốn (ADR & Tỷ lệ gặp)', data.adverseEffects, 'ADR')}
          {renderSection('interactions', 'Tương tác thuốc đáng chú ý & Phối hợp cần tránh', data.drugInteractions, 'Tương tác')}
          {renderSection('overdose', 'Xử trí quá liều & Triệu chứng ngộ độc cấp', data.overdoseTreatment, 'Quá liều')}
        </div>
      )}
    </div>
  );
};
