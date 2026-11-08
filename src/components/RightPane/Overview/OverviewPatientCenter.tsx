/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Thông Tin Bệnh Nhân - Lọc Theo Từ Khóa (<=200 LOC)
 */

import React, { useState } from 'react';
import { Search, X, User } from 'lucide-react';
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

  const cleanQuery = normalizeLookupQuery(query).toLowerCase();

  // Chỉ lọc khi người dùng đã nhập từ khóa (không hiển thị danh sách mẫu)
  const filteredPatients = cleanQuery
    ? INITIAL_PATIENTS.filter((p) => {
        const nameMatch = p.fullName?.toLowerCase().includes(cleanQuery);
        const idMatch = p.id.toLowerCase().includes(cleanQuery);
        const roomMatch = p.room?.toLowerCase().includes(cleanQuery);
        const diagMatch = (p.diagnosis || p.chronicConditions || '').toLowerCase().includes(cleanQuery);
        return nameMatch || idMatch || roomMatch || diagMatch;
      })
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanQuery && filteredPatients.length > 0) {
      onOpenPatient(filteredPatients[0].fullName || filteredPatients[0].id);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4">
      {/* 1. Header & Thanh Tìm Kiếm Bệnh Nhân */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Thông tin bệnh nhân
          </h3>
          <span className="text-xs font-sans tabular-nums font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
            {INITIAL_PATIENTS.length} hồ sơ
          </span>
        </div>

        {canSearch && (
          <form onSubmit={handleSearch} className="relative flex items-center w-full sm:w-80">
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

      {/* 2. Danh sách kết quả lọc hoặc hướng dẫn */}
      <div>
        {!cleanQuery ? (
          <div className="py-10 text-center text-slate-500">
            <User className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-slate-700">
              Nhập họ tên hoặc mã bệnh nhân để tìm kiếm hồ sơ
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Hệ thống tra cứu hồ sơ người bệnh theo mã BN, CCCD, buồng giường
            </p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-sm">
            Không tìm thấy bệnh nhân phù hợp với từ khóa &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredPatients.map((p) => {
              return (
                <div
                  key={p.id}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenPatient(p.fullName || p.id)}
                        className="font-bold text-base text-slate-900 hover:text-teal-800 hover:underline cursor-pointer"
                      >
                        {p.fullName}
                      </button>
                      <span className="font-sans tabular-nums text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {p.id}
                      </span>
                      <span className="text-slate-500 text-xs font-medium">· {p.room}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-500 flex items-center gap-2 mt-1 flex-wrap font-sans tabular-nums">
                      {p.cccd && <span>CCCD: {p.cccd}</span>}
                      {p.phone && <span>· SĐT: {p.phone}</span>}
                      {p.department && <span>· {p.department}</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenPatient(p.fullName || p.id)}
                    className="text-xs sm:text-sm font-semibold text-teal-800 hover:text-teal-950 px-3 py-1.5 rounded-lg hover:bg-teal-50 border border-slate-200 hover:border-teal-300 transition cursor-pointer shrink-0"
                  >
                    Xem hồ sơ &rarr;
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
