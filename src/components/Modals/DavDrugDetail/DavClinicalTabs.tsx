/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Các Tab Nội Dung Lâm Sàng Chi Tiết Dược Thư Quốc Gia 2022 (<=200 LOC)
 * Font chữ tăng gấp đôi, hỗ trợ scroll ngang và dọc mượt mà với thanh scroll siêu nhỏ
 */

import React, { useState } from 'react';
import { ClinicalDataProps } from './DavClinicalKnowledgeBlock';
import { extractQuickDosageMetrics, parseClinicalBullets } from '../../../utils/clinicalFormatter';

export type TabType = 'dosage' | 'indications' | 'safety';

export const DavClinicalTabs: React.FC<{ data: ClinicalDataProps; activeTab?: TabType; showNavigation?: boolean; onTabChange?: (tab: TabType) => void }> = ({ data, activeTab: selectedTab, showNavigation = true, onTabChange }) => {
  const [localTab, setLocalTab] = useState<TabType>('dosage');
  const activeTab = selectedTab ?? localTab;
  const dosageMetrics = extractQuickDosageMetrics(data.adultDosage);

  const renderSection = (
    _id: string,
    title: string,
    rawText?: string,
    badge?: string
  ) => {
    if (!rawText) return null;
    const bullets = parseClinicalBullets(rawText);

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <h4 className="font-semibold text-slate-900 text-base sm:text-lg tracking-tight">{title}</h4>
          {badge && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
              {badge}
            </span>
          )}
        </div>

        <ul className="space-y-2.5 text-sm sm:text-base text-slate-700 leading-relaxed">
          {bullets.map((b, idx) => (
            <li
              key={idx}
              className={`flex items-start gap-2 ${
                b.isImportant ? 'bg-amber-50/80 p-2.5 rounded-lg border border-amber-200/80 text-amber-950 font-medium' : ''
              }`}
            >
              <span className={`font-bold text-base select-none leading-normal mt-0 ${b.isImportant ? 'text-amber-600' : 'text-blue-600'}`}>
                •
              </span>
              <div className="flex-1">
                {b.label && (
                  <strong className="font-bold text-slate-950 mr-2">
                    {b.label.replace(/[:：]+$/u, '')}
                  </strong>
                )}
                <span>{b.content}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const navTab = (tab: TabType, label: string) => {
    const isActive = activeTab === tab;
    return (
      <button
        type="button"
        onClick={() => { setLocalTab(tab); onTabChange?.(tab); }}
        className={`px-3 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-base font-bold transition cursor-pointer border-b-2 -mb-px shrink-0 whitespace-nowrap ${
          isActive
            ? 'text-blue-700 border-blue-700 bg-blue-50/50'
            : 'text-slate-500 hover:text-slate-900 border-transparent hover:bg-slate-50'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4 pt-1 overflow-x-auto thin-scrollbar w-full sm:min-w-[700px]">
      {/* Navigation Underline Tabs */}
      {showNavigation && <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 overflow-x-auto thin-scrollbar pb-0.5">
        {navTab('dosage', '1. Liều Dùng & Hiệu Chỉnh')}
        {navTab('indications', '2. Chỉ Định & Thận Trọng')}
        {navTab('safety', '3. Tác Dụng Phụ (ADR) & Tương Tác')}
      </div>}

      {/* Tab Panels */}
      {activeTab === 'dosage' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          {/* Quick Dosage Highlight Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide block">Đường dùng</span>
              <p className="font-semibold text-slate-900 mt-1 text-sm sm:text-base">{dosageMetrics.routes.join(' • ')}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide block">Khoảng cách liều</span>
              <p className="font-semibold text-slate-900 mt-1 text-sm sm:text-base">{dosageMetrics.interval || 'Theo phác đồ điều trị'}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide block">Trần liều / Tối đa</span>
              <p className="font-semibold text-rose-700 mt-1 text-sm sm:text-base">{dosageMetrics.maxDailyDose || 'Theo dõi đáp ứng'}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wide block">Lưu ý an toàn</span>
              <p className="text-slate-800 text-sm sm:text-base font-semibold mt-1">
                {dosageMetrics.specialWarning || 'Theo dõi sát dấu hiệu sinh tồn'}
              </p>
            </div>
          </div>

          {renderSection('adult', 'Liều dùng người lớn & Khuyến cáo đường dùng', data.adultDosage, 'Người lớn')}
          {renderSection('pediatric', 'Liều dùng trẻ em (mg/kg theo tuổi & cân nặng)', data.pediatricDosage, 'Nhi khoa')}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderSection('renal', 'Chỉnh liều suy thận theo Cockcroft-Gault (ClCr / eGFR)', data.renalAdjustment, 'Suy thận')}
            {renderSection('hepatic', 'Chỉnh liều suy gan', data.hepaticAdjustment, 'Suy gan')}
          </div>
        </div>
      )}

      {activeTab === 'indications' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          {renderSection('indications', 'Chỉ định điều trị lâm sàng chính thức', data.indications, 'Chỉ định')}
          {renderSection('precautions', 'Thận trọng & Cảnh báo an toàn lâm sàng', data.precautions, 'Cảnh báo')}
          {renderSection('pregnancy', 'Thời kỳ mang thai & Cho con bú', data.pregnancyWarning, 'Thai kỳ & Nuôi con')}
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="space-y-4 animate-in fade-in duration-100">
          {renderSection('adverse', 'Tác dụng không mong muốn (ADR & Tỷ lệ gặp)', data.adverseEffects, 'ADR')}
          {data.drugInteractions && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">Nội dung dưới đây được trích từ chuyên luận nguồn. Đây chưa phải bảng tương tác thuốc theo cặp đã thẩm định; không dùng riêng đoạn văn này để kết luận phối hợp bị chống chỉ định.</p>}
          {renderSection('interactions', 'Tương tác thuốc theo chuyên luận nguồn', data.drugInteractions, 'Nguyên văn nguồn')}
          {renderSection('overdose', 'Xử trí quá liều & Triệu chứng ngộ độc cấp', data.overdoseTreatment, 'Quá liều')}
        </div>
      )}
    </div>
  );
};
