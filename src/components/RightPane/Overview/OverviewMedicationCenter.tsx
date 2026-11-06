/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Thông Tin Thuốc - Lọc Theo Từ Khóa (<=200 LOC)
 */

import React, { useState } from 'react';
import { Search, X, Pill, AlertTriangle } from 'lucide-react';
import { searchMasterMedications } from '../../../data/medicationMasterData';
import { normalizeLookupQuery } from '../flatDashboardModel';

interface OverviewMedicationCenterProps {
  canSearch: boolean;
  onOpenMedication: (query: string) => void;
  onOpenFefo: () => void;
}

const FEATURED_MEDICATIONS = [
  {
    nationalCode: 'VN-18291-14',
    brandName: 'Paracetamol 500mg',
    activeIngredient: 'Paracetamol',
    concentration: '500mg',
    route: 'Đường uống',
    category: 'Giảm đau hạ sốt',
    isHighAlert: false,
    isControlled: false
  },
  {
    nationalCode: 'VN-11920-11',
    brandName: 'Augmentin 1g',
    activeIngredient: 'Amoxicillin + Acid Clavulanic',
    concentration: '875mg/125mg',
    route: 'Đường uống',
    category: 'Kháng sinh Beta-lactam',
    isHighAlert: false,
    isControlled: false
  },
  {
    nationalCode: 'VN-22109-18',
    brandName: 'Lovenox 4000 UI (40mg/0.4ml)',
    activeIngredient: 'Enoxaparin natri',
    concentration: '40mg/0.4ml',
    route: 'Tiêm dưới da',
    category: 'Chống đông máu LMWH',
    isHighAlert: true,
    isControlled: false
  },
  {
    nationalCode: 'VN-00912-16',
    brandName: 'Morphin hydroclorid 10mg/ml',
    activeIngredient: 'Morphin hydroclorid',
    concentration: '10mg/ml',
    route: 'Tiêm tĩnh mạch',
    category: 'Giảm đau Opioid cấp cứu',
    isHighAlert: true,
    isControlled: true
  }
];

const QUICK_CHIPS = ['Paracetamol', 'Amoxicillin', 'Lovenox', 'Morphin', 'Diazepam', 'Ceftriaxon'];

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
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-4 flex flex-col justify-between min-h-[360px]">
      <div>
        {/* 1. Header & Thanh Tìm Kiếm Dược */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Pill className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-none">
                Thông tin thuốc
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                54.885 số đăng ký Cục QLD & Dược Thư VN
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
                placeholder="Nhập tên biệt dược hoặc hoạt chất..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
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

        {/* 2. Dải Chip Tra Nhanh */}
        <div className="flex items-center gap-1.5 pt-1.5 pb-0.5 overflow-x-auto thin-scrollbar">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Tra nhanh:
          </span>
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onOpenMedication(chip)}
              className="text-xs font-semibold text-slate-700 hover:text-blue-800 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 px-2.5 py-1 rounded-md transition cursor-pointer shrink-0 active:scale-95"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* 3. Danh sách thuốc, không để khoảng trống rỗng */}
        {cleanQuery ? (
          filteredMeds.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              Không tìm thấy thuốc phù hợp với từ khóa &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30 mt-1">
              {filteredMeds.map((med) => (
                <div
                  key={med.nationalCode}
                  className="p-3 sm:p-3.5 hover:bg-white transition flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenMedication(med.brandName)}
                        className="font-bold text-base text-slate-900 hover:text-blue-800 hover:underline cursor-pointer truncate"
                      >
                        {med.brandName}
                      </button>
                      {med.isHighAlert && (
                        <span className="text-2xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                          High-Alert
                        </span>
                      )}
                      {med.isControlled && (
                        <span className="text-2xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded shrink-0">
                          Gây nghiện
                        </span>
                      )}
                    </div>
                    <div className="text-xs sm:text-sm text-slate-600 mt-1 truncate">
                      Hoạt chất: <span className="font-semibold text-slate-800">{med.activeIngredient}</span> · {med.concentration} · {med.route}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenMedication(med.brandName)}
                    className="text-xs sm:text-sm font-semibold text-blue-800 hover:text-blue-950 px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition cursor-pointer shrink-0"
                  >
                    Dược thư &rarr;
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30 mt-1">
            {FEATURED_MEDICATIONS.map((med) => (
              <div
                key={med.nationalCode}
                className="p-3 sm:p-3.5 hover:bg-white transition flex items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => onOpenMedication(med.brandName)}
                      className="font-bold text-base text-slate-900 hover:text-blue-800 hover:underline cursor-pointer truncate"
                    >
                      {med.brandName}
                    </button>
                    {med.isHighAlert && (
                      <span className="inline-flex items-center gap-1 text-2xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded shrink-0">
                        <AlertTriangle className="w-3 h-3" />
                        High-Alert
                      </span>
                    )}
                    {med.isControlled && (
                      <span className="text-2xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded shrink-0">
                        Kiểm soát ĐB
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm text-slate-600 mt-1 truncate">
                    {med.activeIngredient} · {med.concentration} · <span className="text-slate-700 font-medium">{med.category}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenMedication(med.brandName)}
                  className="text-xs sm:text-sm font-semibold text-blue-800 hover:text-blue-950 px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition cursor-pointer shrink-0"
                >
                  Dược thư &rarr;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 text-right pt-1">
        Bấm vào thuốc để tra cứu liều an toàn, tương tác QĐ 5948 và phác đồ điều trị
      </div>
    </div>
  );
};
