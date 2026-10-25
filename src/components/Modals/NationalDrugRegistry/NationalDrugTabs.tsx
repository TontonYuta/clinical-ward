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
                ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-2xs font-mono font-bold ${
                  isSelected ? 'bg-slate-800 text-teal-300' : 'bg-slate-100 text-slate-600'
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
