/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh Tab phân nhóm thuốc lâm sàng cho Cổng Dược Quốc Gia (<=100 LOC)
 */

import React from 'react';

interface NationalDrugTabsProps {
  selectedGroup: string;
  onSelectGroup: (grp: string) => void;
  groupStats?: Record<string, number>;
  totalCount?: number;
}

export const GROUP_STYLES: Record<string, string> = {
  'Kháng sinh': 'bg-blue-50 text-blue-700 border-blue-200/60',
  'Thuốc gây nghiện': 'bg-amber-50 text-amber-800 border-amber-200/60',
  'Thuốc cấp cứu': 'bg-rose-50 text-rose-700 border-rose-200/60',
  'Thuốc nguy cơ cao': 'bg-red-50 text-red-700 border-red-200/60',
  'Dịch truyền': 'bg-cyan-50 text-cyan-800 border-cyan-200/60',
  'Thuốc hướng thần': 'bg-purple-50 text-purple-700 border-purple-200/60',
  'Vật tư tiêu hao': 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
  'Vắc xin & Chuỗi lạnh': 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
};

export const REGISTRY_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'Tất cả 55k SĐK' },
  { id: 'Thuốc gây nghiện', label: 'Gây nghiện' },
  { id: 'Thuốc hướng thần', label: 'Hướng thần' },
  { id: 'Thuốc cấp cứu', label: 'Cấp cứu tủ trực' },
  { id: 'Kháng sinh', label: 'Kháng sinh' },
  { id: 'Dịch truyền', label: 'Dịch truyền' },
  { id: 'Thuốc nguy cơ cao', label: 'Nguy cơ cao' },
  { id: 'Thuốc điều trị chuyên khoa', label: 'Chuyên khoa' },
];

export const NationalDrugTabs: React.FC<NationalDrugTabsProps> = ({
  selectedGroup,
  onSelectGroup,
  groupStats = {},
  totalCount = 54885
}) => {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none pb-0.5">
      {REGISTRY_TABS.map((tab) => {
        const count = tab.id === 'all' ? totalCount : groupStats[tab.id];
        const isSelected = selectedGroup === tab.id;
        return (
          <button
            key={tab.id}
            data-testid={`registry-tab-${tab.id}`}
            type="button"
            onClick={() => onSelectGroup(tab.id)}
            className={`px-3 py-1.5 rounded-lg shrink-0 font-medium cursor-pointer transition-all flex items-center gap-1.5 ${
              isSelected
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-2xs font-mono font-bold ${
                  isSelected ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count > 999 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}k` : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
