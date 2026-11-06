/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Thông Tin Bệnh Nhân - Lọc Theo Từ Khóa (<=200 LOC)
 */

import React, { useState } from 'react';
import { Search, X, Users, AlertCircle } from 'lucide-react';
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

  const displayList = normQuery ? filteredPatients : INITIAL_PATIENTS.slice(0, 3);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between min-h-[360px]">
      <div>
        {/* 1. Header & Thanh Tìm Kiếm Bệnh Nhân */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
                Thông tin bệnh nhân
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                {INITIAL_PATIENTS.length} hồ sơ nội trú A9
              </span>
            </div>
          </div>

          {canSearch && (
            <form onSubmit={handleSearch} className="relative flex items-center w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập tên, mã BN hoặc phòng..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 transition"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          )}
        </div>

        {/* 2. Tiêu đề danh mục con */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mt-3 mb-2 px-0.5">
          <span>{normQuery ? `Kết quả tra cứu (${filteredPatients.length})` : 'Bệnh nhân trọng điểm ca trực'}</span>
          <span className="font-normal text-slate-400">{normQuery ? 'Khớp từ khóa' : 'Gợi ý 1-chạm'}</span>
        </div>

        {/* 3. Danh sách hồ sơ rộng rãi, không để khoảng trắng rỗng */}
        {normQuery && filteredPatients.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            Không tìm thấy bệnh nhân phù hợp với từ khóa &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
            {displayList.map((p) => {
              return (
                <div
                  key={p.id}
                  className="p-3 sm:p-3.5 hover:bg-white transition flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenPatient(p.fullName || p.id)}
                        className="font-bold text-base text-slate-900 hover:text-teal-800 hover:underline cursor-pointer truncate"
                      >
                        {p.fullName}
                      </button>
                      <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-200/80 px-1.5 py-0.5 rounded shrink-0">
                        {p.id}
                      </span>
                      <span className="text-slate-500 text-xs font-medium truncate">
                        · {p.room}
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm text-slate-500 flex items-center gap-2 mt-1 flex-wrap">
                      <span className="truncate max-w-[220px]">
                        {p.diagnosis || p.chronicConditions}
                      </span>
                      {p.allergies && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded truncate max-w-[240px]">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>Dị ứng: {p.allergies}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenPatient(p.fullName || p.id)}
                    className="text-xs sm:text-sm font-semibold text-teal-800 hover:text-teal-950 px-3 py-1.5 rounded-lg bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition cursor-pointer shrink-0"
                  >
                    Xem hồ sơ &rarr;
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 text-right pt-1">
        Bấm vào người bệnh để xem hồ sơ bệnh án, tiền sử dị ứng và chức năng thận
      </div>
    </div>
  );
};
