/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Thông Tin Bệnh Nhân Tối Giản (<=200 LOC)
 */

import React, { useState } from 'react';
import { INITIAL_PATIENTS } from '../../../services/patientService';
import { normalizeLookupQuery } from '../flatDashboardModel';

interface OverviewPatientCenterProps {
  canSearch: boolean;
  onOpenPatient: (query: string) => void;
}

export const OverviewPatientCenter: React.FC<OverviewPatientCenterProps> = ({
  canSearch,
  onOpenPatient
}) => {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeLookupQuery(query);
    if (clean) onOpenPatient(clean);
  };

  const samplePatients = INITIAL_PATIENTS.slice(0, 3);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
      {/* 1. Header & Thanh Tìm Kiếm */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Thông tin bệnh nhân
          </h3>
          <span className="text-2xs font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
            {INITIAL_PATIENTS.length} NB
          </span>
        </div>

        {canSearch && (
          <form onSubmit={handleSearch} className="flex items-center gap-1.5 w-full sm:w-64">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mã BN hoặc họ tên..."
              className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-600 focus:border-teal-600"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold bg-teal-800 hover:bg-teal-900 text-white rounded-lg transition cursor-pointer shrink-0"
            >
              Tìm
            </button>
          </form>
        )}
      </div>

      {/* 2. Danh sách bệnh nhân ngắn gọn */}
      <div className="divide-y divide-slate-100">
        {samplePatients.map((p) => {
          const hasAllergy = p.allergies && !p.allergies.toLowerCase().includes('không');
          const isRenal = p.egfr && p.egfr < 60;
          return (
            <div
              key={p.id}
              className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onOpenPatient(p.fullName || p.id)}
                    className="font-bold text-slate-900 hover:text-teal-800 hover:underline cursor-pointer"
                  >
                    {p.fullName}
                  </button>
                  <span className="font-mono text-2xs text-slate-500">[{p.id}]</span>
                  <span className="text-slate-500 text-2xs">· {p.room}</span>
                </div>
                <div className="text-2xs text-slate-600 flex items-center gap-2 mt-0.5">
                  <span className="truncate">{p.diagnosis || p.chronicConditions}</span>
                  {hasAllergy && (
                    <span className="text-rose-700 font-semibold shrink-0">
                      · Dị ứng: {p.allergies}
                    </span>
                  )}
                  {isRenal && (
                    <span className="text-amber-800 font-semibold shrink-0">
                      · eGFR: {p.egfr}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenPatient(p.fullName || p.id)}
                className="text-2xs font-semibold text-slate-600 hover:text-teal-800 px-2 py-1 rounded hover:bg-slate-50 border border-slate-200 transition cursor-pointer shrink-0"
              >
                Hồ sơ &rarr;
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
