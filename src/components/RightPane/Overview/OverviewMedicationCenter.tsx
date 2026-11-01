/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Thông Tin Thuốc - Lọc Theo Từ Khóa (<=200 LOC)
 */

import React, { useState } from 'react';
import { Search, X, Pill } from 'lucide-react';
import { searchMasterMedications } from '../../../data/medicationMasterData';
import { normalizeLookupQuery } from '../flatDashboardModel';

interface OverviewMedicationCenterProps {
  canSearch: boolean;
  onOpenMedication: (query: string) => void;
  onOpenFefo: () => void;
}

export const OverviewMedicationCenter: React.FC<OverviewMedicationCenterProps> = ({
  canSearch,
  onOpenMedication
}) => {
  const [query, setQuery] = useState('');

  const cleanQuery = normalizeLookupQuery(query);

  // Chỉ lọc khi người dùng nhập từ khóa (không hiển thị mẫu cố định)
  const filteredMeds = cleanQuery
    ? searchMasterMedications(cleanQuery, { limit: 8 })
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanQuery) {
      if (filteredMeds.length > 0) {
        onOpenMedication(filteredMeds[0].brandName || filteredMeds[0].activeIngredient);
      } else {
        onOpenMedication(cleanQuery);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
      {/* 1. Header & Thanh Tìm Kiếm Dược */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Thông tin thuốc
          </h3>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
            54.885 số đăng ký
          </span>
        </div>

        {canSearch && (
          <form onSubmit={handleSearch} className="relative flex items-center w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập tên biệt dược hoặc hoạt chất..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600"
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
          <div className="py-8 text-center text-slate-500">
            <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-600">
              Nhập tên thuốc hoặc hoạt chất để tra cứu an toàn lâm sàng
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Hệ thống tra cứu tự động liều dùng, tương tác chống chỉ định và đường dùng
            </p>
          </div>
        ) : filteredMeds.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-sm">
            Không tìm thấy thuốc phù hợp với từ khóa &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredMeds.map((med) => (
              <div
                key={med.nationalCode}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenMedication(med.brandName)}
                      className="font-bold text-base text-slate-900 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      {med.brandName}
                    </button>
                    {med.isHighAlert && (
                      <span className="text-2xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                        High-Alert
                      </span>
                    )}
                    {med.isNarcotic && (
                      <span className="text-2xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                        Gây nghiện
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-0.5 truncate">
                    Hoạt chất: <span className="font-semibold text-slate-800">{med.activeIngredient}</span> · {med.concentration} · {med.route}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenMedication(med.brandName)}
                  className="text-xs sm:text-sm font-semibold text-blue-800 hover:text-blue-950 px-3 py-1.5 rounded-lg hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition cursor-pointer shrink-0"
                >
                  Chi tiết &rarr;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
