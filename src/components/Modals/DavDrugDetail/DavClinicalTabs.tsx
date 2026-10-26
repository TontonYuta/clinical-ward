/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Các Tab Nội Dung Lâm Sàng Chi Tiết Dược Thư Quốc Gia 2022 (<=200 LOC)
 */

import React, { useState } from 'react';
import { Pill, Stethoscope, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ClinicalDataProps } from './DavClinicalKnowledgeBlock';

type TabType = 'dosage' | 'indications' | 'safety';

export const DavClinicalTabs: React.FC<{ data: ClinicalDataProps }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<TabType>('dosage');
  const [fullView, setFullView] = useState<Record<string, boolean>>({});

  const toggle = (sec: string) => setFullView((p) => ({ ...p, [sec]: !p[sec] }));

  const renderBlock = (id: string, title: string, text?: string, badge?: string, badgeCls = 'bg-blue-50 text-blue-700 border border-blue-200') => {
    if (!text) return null;
    const isFull = fullView[id];
    const isLong = text.length > 300;

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-1.5 pb-1 border-b border-slate-100">
          <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">{title}</span>
          {badge && <span className={`text-xs font-semibold px-2.5 py-0.5 rounded ${badgeCls}`}>{badge}</span>}
        </div>
        <div className={`text-sm sm:text-base text-slate-800 leading-relaxed whitespace-pre-line font-normal ${!isFull && isLong ? 'max-h-48 overflow-hidden relative' : ''}`}>
          {text}
          {!isFull && isLong && <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />}
        </div>
        {isLong && (
          <button type="button" onClick={() => toggle(id)} className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 pt-1 cursor-pointer">
            {isFull ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{isFull ? 'Thu gọn bớt' : 'Xem toàn văn đầy đủ'}</span>
          </button>
        )}
      </div>
    );
  };

  const navBtn = (tab: TabType, label: string, Icon: React.ElementType) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 rounded text-xs sm:text-sm transition cursor-pointer ${
        activeTab === tab ? 'bg-blue-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
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

      {/* Panels */}
      <div className="space-y-3">
        {activeTab === 'dosage' && (
          <div className="space-y-3 animate-in fade-in duration-100">
            {renderBlock('adult', 'Liều người lớn & Trần liều 24h', data.adultDosage, 'Người lớn')}
            {renderBlock('pediatric', 'Liều trẻ em (mg/kg theo tuổi & cân nặng)', data.pediatricDosage, 'Nhi khoa (mg/kg)')}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {renderBlock('renal', 'Chỉnh liều suy thận (ClCr / eGFR)', data.renalAdjustment, 'Suy thận')}
              {renderBlock('hepatic', 'Chỉnh liều suy gan', data.hepaticAdjustment, 'Suy gan')}
            </div>
          </div>
        )}

        {activeTab === 'indications' && (
          <div className="space-y-3 animate-in fade-in duration-100">
            {renderBlock('indications', 'Chỉ định điều trị chính thức', data.indications, 'Chỉ định')}
            {renderBlock('precautions', 'Thận trọng & Cảnh báo đặc biệt khi sử dụng', data.precautions, 'Cảnh báo lâm sàng')}
            {renderBlock('pregnancy', 'Thời kỳ mang thai & Cho con bú', data.pregnancyWarning, 'Thai kỳ & Nuôi con')}
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="space-y-3 animate-in fade-in duration-100">
            {renderBlock('adverse', 'Tác dụng không mong muốn (ADR & Tỷ lệ gặp)', data.adverseEffects, 'ADR Dược Thư', 'bg-rose-50 text-rose-800 border border-rose-200')}
            {renderBlock('interactions', 'Tương tác thuốc đáng chú ý & Phối hợp cần tránh', data.drugInteractions, 'Tương tác thuốc')}
            {renderBlock('overdose', 'Xử trí quá liều & Triệu chứng ngộ độc cấp', data.overdoseTreatment, 'Quá liều cấp', 'bg-slate-100 text-slate-800 border border-slate-300')}
          </div>
        )}
      </div>
    </div>
  );
};
