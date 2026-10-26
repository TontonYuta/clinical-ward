/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Các Tab Nội Dung Lâm Sàng Chi Tiết từ Dược Thư Quốc Gia (<=200 LOC)
 */

import React, { useState } from 'react';
import { Pill, Stethoscope, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { ClinicalDataProps } from './DavClinicalKnowledgeBlock';

type TabType = 'dosage' | 'indications' | 'safety';

export const DavClinicalTabs: React.FC<{ data: ClinicalDataProps }> = ({ data }) => {
  const [activeTab, setActiveTab] = useState<TabType>('dosage');
  const [fullView, setFullView] = useState<Record<string, boolean>>({});

  const toggle = (sec: string) => setFullView((p) => ({ ...p, [sec]: !p[sec] }));

  const renderBlock = (id: string, title: string, text?: string, badge?: string, badgeCls = 'bg-slate-100 text-slate-700') => {
    if (!text) return null;
    const isFull = fullView[id];
    const isLong = text.length > 250;

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <span className="font-bold text-slate-900 text-2xs uppercase tracking-wide">{title}</span>
          {badge && <span className={`text-3xs font-semibold px-2 py-0.5 rounded ${badgeCls}`}>{badge}</span>}
        </div>
        <div className={`text-2xs sm:text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium ${!isFull && isLong ? 'max-h-24 overflow-hidden relative' : ''}`}>
          {text}
          {!isFull && isLong && <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none" />}
        </div>
        {isLong && (
          <button type="button" onClick={() => toggle(id)} className="text-3xs font-bold text-teal-800 hover:text-teal-950 flex items-center gap-0.5 pt-0.5 cursor-pointer">
            {isFull ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
        activeTab === tab ? 'bg-teal-700 text-white shadow-2xs font-bold' : 'text-teal-900 hover:bg-teal-100/70'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="space-y-2.5 pt-1">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-teal-200/80 pb-1.5 text-2xs sm:text-xs font-semibold">
        {navBtn('dosage', 'Liều dùng & Chỉnh liều', Pill)}
        {navBtn('indications', 'Chỉ định & Cảnh báo', Stethoscope)}
        {navBtn('safety', 'ADR & Tương tác', AlertTriangle)}
      </div>

      {/* Panels */}
      <div className="space-y-2">
        {activeTab === 'dosage' && (
          <div className="space-y-2 animate-in fade-in duration-100">
            {renderBlock('adult', 'Liều người lớn & Trần liều 24h', data.adultDosage, 'Người lớn', 'bg-blue-50 text-blue-800 border border-blue-200')}
            {renderBlock('pediatric', 'Liều trẻ em (mg/kg theo tuổi & cân nặng)', data.pediatricDosage, 'Nhi khoa (mg/kg)', 'bg-amber-50 text-amber-800 border border-amber-200')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {renderBlock('renal', 'Chỉnh liều suy thận (ClCr)', data.renalAdjustment, 'Suy thận', 'bg-indigo-50 text-indigo-800 border border-indigo-200')}
              {renderBlock('hepatic', 'Chỉnh liều suy gan', data.hepaticAdjustment, 'Suy gan', 'bg-rose-50 text-rose-800 border border-rose-200')}
            </div>
          </div>
        )}

        {activeTab === 'indications' && (
          <div className="space-y-2 animate-in fade-in duration-100">
            {renderBlock('indications', 'Chỉ định điều trị chính thức', data.indications, 'Chỉ định', 'bg-teal-50 text-teal-800 border border-teal-200')}
            {renderBlock('precautions', 'Thận trọng & Cảnh báo đặc biệt', data.precautions, 'Cảnh báo lâm sàng', 'bg-amber-50 text-amber-900 border border-amber-200')}
            {renderBlock('pregnancy', 'Thời kỳ mang thai & Cho con bú', data.pregnancyWarning, 'Thai kỳ & Nuôi con', 'bg-purple-50 text-purple-900 border border-purple-200')}
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="space-y-2 animate-in fade-in duration-100">
            {renderBlock('adverse', 'Tác dụng không mong muốn (ADR)', data.adverseEffects, 'ADR Dược Thư', 'bg-rose-50 text-rose-900 border border-rose-200')}
            {renderBlock('interactions', 'Tương tác thuốc đáng chú ý', data.drugInteractions, 'Tương tác thuốc', 'bg-orange-50 text-orange-900 border border-orange-200')}
            {renderBlock('overdose', 'Xử trí quá liều & Ngộ độc cấp', data.overdoseTreatment, 'Quá liều cấp', 'bg-slate-100 text-slate-800 border border-slate-300')}
          </div>
        )}
      </div>
    </div>
  );
};
