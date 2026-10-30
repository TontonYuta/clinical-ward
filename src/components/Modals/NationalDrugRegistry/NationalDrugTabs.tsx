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
  'Kháng sinh': 'bg-slate-100 text-slate-700 border-slate-200',
  'Thuốc gây nghiện': 'bg-slate-100 text-slate-700 border-slate-200',
  'Thuốc cấp cứu': 'bg-slate-100 text-slate-700 border-slate-200',
  'Thuốc nguy cơ cao': 'bg-slate-100 text-slate-700 border-slate-200',
  'Dịch truyền': 'bg-slate-100 text-slate-700 border-slate-200',
  'Thuốc hướng thần': 'bg-slate-100 text-slate-700 border-slate-200',
  'Vật tư tiêu hao': 'bg-slate-100 text-slate-700 border-slate-200',
  'Vắc xin & Chuỗi lạnh': 'bg-slate-100 text-slate-700 border-slate-200',
};

export const REGISTRY_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
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
    <div role="group" aria-label="Lọc theo nhóm thuốc" className="flex items-center gap-1 overflow-x-auto text-sm scrollbar-none border-b border-slate-200 pb-0">
      {REGISTRY_TABS.map((tab) => {
        const count = tab.id === 'all' ? totalCount : groupStats[tab.id];
        const isSelected = selectedGroup === tab.id;
        return (
          <button
            key={tab.id}
            data-testid={`registry-tab-${tab.id}`}
            type="button"
            onClick={() => onSelectGroup(tab.id)}
            aria-pressed={isSelected}
            className={`px-3 py-2 border-b-2 shrink-0 font-medium cursor-pointer transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              isSelected
                ? 'border-slate-900 text-slate-950 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-950'
            }`}
          >
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className="text-xs font-mono tabular-nums text-slate-500"
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
