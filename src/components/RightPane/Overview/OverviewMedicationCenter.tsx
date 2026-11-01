/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Trung Tâm Thông Tin Thuốc & Dược Lâm Sàng (<=200 LOC)
 */

import React, { useState } from 'react';
import { Pill, Search, ShieldCheck, Database, AlertTriangle, ArrowRight, BookOpen, ShieldAlert } from 'lucide-react';
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
    { name: 'Adrenalin 1mg/1ml', type: 'Cấp cứu phản vệ (TT 51)', note: 'Tiêm bắp ngay từ Độ II, cấm tiêm TM trực tiếp', tag: 'Emergency', color: 'rose' },
    { name: 'Morphin 10mg/1ml', type: 'Gây nghiện (TT 20/TT 18)', note: 'Quản lý nợ vỏ ống rỗng, tiêu hủy có hội đồng', tag: 'Narcotic', color: 'purple' },
    { name: 'Kali Clorid 10% (KCl)', type: 'Điện giải High-Alert', note: 'CẤM TUYỆT ĐỐI tiêm tĩnh mạch trực tiếp', tag: 'High-Alert', color: 'amber' },
    { name: 'Ceftriaxon 1g', type: 'Kháng sinh Cephalosporin', note: 'Chống chỉ định phối hợp dung dịch Calci', tag: 'Antibiotic', color: 'blue' },
    { name: 'Diazepam 10mg/2ml', type: 'Hướng thần (TT 20/TT 18)', note: 'Cắt cơn co giật, theo dõi ức chế hô hấp', tag: 'Controlled', color: 'purple' },
    { name: 'Paracetamol 500mg', type: 'Giảm đau hạ sốt', note: 'Tối đa 4g/ngày, chú ý suy gan & tương tác', tag: 'Essential', color: 'emerald' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs space-y-4">
      {/* 1. Header & Thanh Tìm Kiếm Dược */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <Pill className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Thông Tin Dược Lâm Sàng &amp; Dược Thư Quốc Gia
            </h3>
            <span className="text-2xs font-bold px-2 py-0.5 rounded-full bg-blue-100/70 text-blue-800">
              54.885 Thuốc DAV
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tra cứu toàn văn chuyên luận Dược Thư, liều trần, đường dùng và tương tác chống chỉ định.
          </p>
        </div>

        {canSearch && (
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-80 shrink-0">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tên biệt dược, hoạt chất (Adrenalin, Morphin)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-xl transition cursor-pointer shadow-2xs shrink-0"
            >
              Tra cứu
            </button>
          </form>
        )}
      </div>

      {/* 2. Chỉ số CSDL Dược */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-200">
          <div className="text-2xs font-semibold text-blue-800 uppercase flex items-center gap-1">
            <Database className="w-3 h-3 text-blue-600" />
            <span>CSDL Cục Quản Lý Dược</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-blue-950">54.885</span>
            <span className="text-2xs text-blue-800">số đăng ký biệt dược</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-200">
          <div className="text-2xs font-semibold text-purple-800 uppercase flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-purple-600" />
            <span>Thuốc Kiểm Soát Đặc Biệt</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-purple-950">TT 20 &amp; TT 18</span>
            <span className="text-2xs text-purple-800">Gây nghiện, hướng thần</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
          <div className="text-2xs font-semibold text-emerald-800 uppercase flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-emerald-600" />
            <span>Dược Thư Quốc Gia Việt Nam</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-emerald-950">Lần II (2015)</span>
            <span className="text-2xs text-emerald-800">Liều trần &amp; chống chỉ định</span>
          </div>
        </div>
      </div>

      {/* 3. Lưới tra cứu nhanh các nhóm hoạt chất trọng yếu */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xs font-bold text-slate-500 uppercase tracking-wider">
            Danh Mục Thuốc Cấp Cứu &amp; Thiết Yếu Trọng Điểm
          </span>
          <button
            type="button"
            onClick={onOpenFefo}
            className="text-2xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
          >
            Xem toàn bộ kho dược →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {keyMedications.map((med) => (
            <button
              key={med.name}
              type="button"
              onClick={() => onOpenMedication(med.name.split(' ')[0])}
              className="p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-left transition cursor-pointer group shadow-2xs"
            >
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <span className="font-bold text-xs text-slate-900 group-hover:text-blue-900 truncate">
                  {med.name}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                  med.color === 'rose' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                  med.color === 'purple' ? 'bg-purple-50 text-purple-800 border-purple-200' :
                  med.color === 'amber' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {med.tag}
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-600 truncate">{med.type}</div>
              <div className="text-2xs text-slate-500 mt-0.5 truncate">{med.note}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
