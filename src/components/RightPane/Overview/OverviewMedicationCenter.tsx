/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Tra Cứu Thông Tin Thuốc & Dược Thư (<=200 LOC)
 */

import React, { useState } from 'react';
import { Search, X, Pill, ArrowRight } from 'lucide-react';
import { searchMasterMedications } from '../../../data/medicationMasterData';
import { normalizeLookupQuery } from '../flatDashboardModel';

interface OverviewMedicationCenterProps {
  canSearch: boolean;
  onOpenMedication: (query: string) => void;
  onOpenFefo?: () => void;
}

const QUICK_CHIPS = ['Paracetamol', 'Augmentin', 'Lovenox', 'Morphin', 'Diazepam', 'Ceftriaxon'];

export const OverviewMedicationCenter: React.FC<OverviewMedicationCenterProps> = ({
  canSearch,
  onOpenMedication
}) => {
  const [query, setQuery] = useState('');

  const cleanQuery = normalizeLookupQuery(query);

  const filteredMeds = cleanQuery
    ? searchMasterMedications(cleanQuery, { limit: 6 })
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
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-5">
      {/* 1. Header & Thanh Tìm Kiếm Dược */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Pill className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none">
              Tra cứu Dược thư &amp; Thuốc DAV
            </h3>
            <span className="text-sm text-slate-500 font-medium">
              54.885 số đăng ký Cục QLD &amp; Dược Thư VN
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
              placeholder="Nhập tên thuốc, hoạt chất..."
              className="w-full pl-10 pr-9 py-2.5 text-base bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
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

      {/* 2. Hàng Gợi Ý Hoạt Chất Phổ Biến (Chips) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-500">Hoạt chất phổ biến:</span>
        {QUICK_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setQuery(chip)}
            className="text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-900 hover:border-blue-300 border border-slate-200 text-slate-700 transition cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* 3. Nội dung tra cứu: KHÔNG hiện list mẫu khi chưa tìm kiếm */}
      <div>
        {!cleanQuery ? (
          <div className="p-5 bg-slate-50/70 rounded-xl border border-slate-200/80 flex items-start gap-4">
            <Pill className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-base font-bold text-slate-900">
                CSDL Dược thư Quốc gia &amp; Thuốc lưu hành Bộ Y Tế
              </h4>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Nhập tên thuốc, hoạt chất, số đăng ký hoặc bấm gợi ý ở trên để tra cứu liều dùng khuyến cáo, kiểm tra tương tác chống chỉ định (QĐ 5948) và hạn dùng FEFO.
              </p>
            </div>
          </div>
        ) : filteredMeds.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-base">
            Không tìm thấy thuốc phù hợp với từ khóa &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
            {filteredMeds.map((med) => (
              <div
                key={med.nationalCode}
                className="p-4 hover:bg-slate-50/80 transition flex items-center justify-between gap-4 text-base"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenMedication(med.brandName)}
                      className="font-bold text-base sm:text-lg text-slate-900 hover:text-blue-800 hover:underline cursor-pointer truncate"
                    >
                      {med.brandName}
                    </button>
                    {med.isHighAlert && (
                      <span className="text-xs font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        High-Alert
                      </span>
                    )}
                    {med.isControlled && (
                      <span className="text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                        Kiểm soát ĐB
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-600 mt-1.5 truncate">
                    Hoạt chất: <span className="font-bold text-slate-800">{med.activeIngredient}</span> · {med.concentration} · {med.route}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenMedication(med.brandName)}
                  className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-blue-800 hover:text-blue-950 px-4 py-2 rounded-xl bg-blue-50/60 hover:bg-blue-100 border border-blue-200 transition cursor-pointer shrink-0"
                >
                  <span>Dược thư</span>
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
