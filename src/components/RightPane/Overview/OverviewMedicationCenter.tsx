/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Thông Tin Thuốc Tối Giản (<=200 LOC)
 */

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { normalizeLookupQuery } from '../flatDashboardModel';

interface OverviewMedicationCenterProps {
  canSearch: boolean;
  onOpenMedication: (query: string) => void;
  onOpenFefo: () => void;
}

export const OverviewMedicationCenter: React.FC<OverviewMedicationCenterProps> = ({
  canSearch,
  onOpenMedication,
  onOpenFefo
}) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeLookupQuery(query);
    if (clean) onOpenMedication(clean);
  };

  const keyMedications = [
    { name: 'Adrenalin 1mg/1ml', tag: 'Cấp cứu TT 51', color: 'rose' },
    { name: 'Morphin 10mg/1ml', tag: 'Gây nghiện TT 20', color: 'purple' },
    { name: 'Kali Clorid 10% (KCl)', tag: 'High-Alert', color: 'amber' },
    { name: 'Ceftriaxon 1g', tag: 'Kháng sinh', color: 'blue' },
    { name: 'Diazepam 10mg/2ml', tag: 'Hướng thần', color: 'purple' },
    { name: 'Paracetamol 500mg', tag: 'Hạ sốt', color: 'emerald' },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
      {/* 1. Header & Thanh Tìm Kiếm Dược */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Thông Tin Dược Lâm Sàng &amp; Dược Thư Quốc Gia
          </h3>
          <span className="text-2xs font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
            54.885 DAV
          </span>
        </div>

        {canSearch && (
          <form onSubmit={handleSearch} className="flex items-center gap-1.5 w-full sm:w-64">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên biệt dược, hoạt chất..."
              className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold bg-blue-800 hover:bg-blue-900 text-white rounded-lg transition cursor-pointer shrink-0"
            >
              Tìm
            </button>
          </form>
        )}
      </div>

      {/* 2. Danh mục hoạt chất tra cứu nhanh */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {keyMedications.map((med) => (
          <button
            key={med.name}
            type="button"
            onClick={() => onOpenMedication(med.name.split(' ')[0])}
            className="p-2 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-left transition cursor-pointer"
          >
            <div className="font-bold text-xs text-slate-900 truncate">
              {med.name}
            </div>
            <div className="text-2xs text-slate-500 mt-0.5 flex items-center justify-between">
              <span>{med.tag}</span>
              <span className="text-blue-700">&rarr;</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
