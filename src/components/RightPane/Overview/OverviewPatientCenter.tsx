/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Tra Cứu Hồ Sơ Bệnh Nhân (<=200 LOC)
 */

import React, { useState } from 'react';
import { Search, X, Users, AlertCircle, ArrowRight } from 'lucide-react';
import { INITIAL_PATIENTS } from '../../../services/patientService';

interface OverviewPatientCenterProps {
  canSearch: boolean;
  onOpenPatient: (query: string) => void;
}

const normalizeSearch = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();

const QUICK_PATIENT_CHIPS = [
  { label: 'Võ Minh Trí (BN-8820)', query: 'BN-8820' },
  { label: 'Đặng Thị Lan (BN-8825)', query: 'BN-8825' },
  { label: 'Nguyễn Hải Đăng (BN-8791)', query: 'BN-8791' }
];

export const OverviewPatientCenter: React.FC<OverviewPatientCenterProps> = ({
  canSearch,
  onOpenPatient
}) => {
  const [query, setQuery] = useState('');

  const normQuery = normalizeSearch(query);

  const filteredPatients = normQuery
    ? INITIAL_PATIENTS.filter((p) => {
        const fullStr = `${p.fullName || ''} ${p.id} ${p.room || ''} ${p.diagnosis || ''} ${p.chronicConditions || ''} ${p.cccd || ''}`;
        return normalizeSearch(fullStr).includes(normQuery);
      })
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (normQuery && filteredPatients.length > 0) {
      onOpenPatient(filteredPatients[0].fullName || filteredPatients[0].id);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
      {/* 1. Header Tra Cứu Bệnh Nhân */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none">
              Tra cứu hồ sơ bệnh nhân
            </h3>
            <span className="text-sm text-slate-500 font-medium">
              {INITIAL_PATIENTS.length} hồ sơ nội trú khoa A9 &amp; ICU
            </span>
          </div>
        </div>

        {canSearch && (
          <form onSubmit={handleSearch} className="relative flex items-center w-full sm:w-80">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên, mã BN hoặc buồng..."
              className="w-full pl-10 pr-9 py-2.5 text-base bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Xóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* 2. Hàng Gợi Ý Tra Cứu Nhanh (Chips) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-500">Gợi ý tra cứu:</span>
        {QUICK_PATIENT_CHIPS.map((chip) => (
          <button
            key={chip.query}
            type="button"
            onClick={() => setQuery(chip.query)}
            className="text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 border border-slate-200 text-slate-700 transition cursor-pointer"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 3. Nội dung tra cứu: KHÔNG hiện list mẫu khi chưa tìm kiếm */}
      <div>
        {!normQuery ? (
          <div className="p-5 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-start gap-4">
            <Users className="w-6 h-6 text-teal-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">
                Hệ thống hồ sơ bệnh án điện tử nội trú
              </h4>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Nhập họ tên, mã người bệnh (BN-xxxx), buồng giường hoặc bấm các gợi ý ở trên để xem hồ sơ bệnh án, tiền sử dị ứng thuốc và mức lọc cầu thận eGFR.
              </p>
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-base">
            Không tìm thấy bệnh nhân phù hợp với từ khóa &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {filteredPatients.map((p) => (
              <div
                key={p.id}
                className="p-4 hover:bg-slate-50/80 transition flex items-center justify-between gap-4 text-base"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenPatient(p.fullName || p.id)}
                      className="font-bold text-base sm:text-lg text-slate-900 hover:text-teal-800 hover:underline cursor-pointer truncate"
                    >
                      {p.fullName}
                    </button>
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded">
                      {p.id}
                    </span>
                    <span className="text-slate-500 text-sm font-medium">
                      · {p.room}
                    </span>
                  </div>

                  <div className="text-sm text-slate-600 flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="truncate max-w-[260px]">
                      {p.diagnosis || p.chronicConditions}
                    </span>
                    {p.allergies && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Dị ứng: {p.allergies}</span>
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenPatient(p.fullName || p.id)}
                  className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-teal-800 hover:text-teal-950 px-4 py-2 rounded-xl bg-teal-50/60 hover:bg-teal-100 border border-teal-200 transition cursor-pointer shrink-0"
                >
                  <span>Xem hồ sơ</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
