/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Tra Cứu Dữ Liệu Dược Quốc Gia (Cục Quản lý Dược - Bộ Y tế) (<=200 LOC)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Building2, ChevronLeft, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';
import { MasterMedication } from '../../types/medication';

interface NationalDrugRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedication?: (medName: string) => void;
}

const PAGE_SIZE = 12;

const GROUP_STYLES: Record<string, string> = {
  'Kháng sinh': 'bg-blue-50 text-blue-700 border-blue-200/60',
  'Thuốc gây nghiện': 'bg-amber-50 text-amber-800 border-amber-200/60',
  'Thuốc cấp cứu': 'bg-rose-50 text-rose-700 border-rose-200/60',
  'Thuốc nguy cơ cao': 'bg-red-50 text-red-700 border-red-200/60',
  'Dịch truyền': 'bg-cyan-50 text-cyan-800 border-cyan-200/60',
  'Thuốc hướng thần': 'bg-purple-50 text-purple-700 border-purple-200/60',
  'Thuốc điều trị chuyên khoa': 'bg-slate-100 text-slate-700 border-slate-200/60',
};

const CATEGORIES = ['all', 'Kháng sinh', 'Thuốc gây nghiện', 'Thuốc cấp cứu', 'Dịch truyền', 'Thuốc nguy cơ cao', 'Thuốc hướng thần', 'Thuốc điều trị chuyên khoa'];

export const NationalDrugRegistryModal: React.FC<NationalDrugRegistryModalProps> = ({ isOpen, onClose, onSelectMedication }) => {
  const [drugs, setDrugs] = useState<MasterMedication[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isOpen || drugs.length > 0) return;
    setLoading(true);
    fetch('/data/vietnam_drug_registry/dav_essential_formulary.json')
      .then((res) => res.json())
      .then((data) => { setDrugs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isOpen, drugs.length]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return drugs.filter((d) => {
      if (selectedGroup !== 'all' && d.group !== selectedGroup) return false;
      if (!q) return true;
      return d.brandName.toLowerCase().includes(q) || d.activeIngredient.toLowerCase().includes(q) || d.nationalCode.toLowerCase().includes(q) || (d.note && d.note.toLowerCase().includes(q));
    });
  }, [drugs, search, selectedGroup]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentSlice = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-sm sm:text-base tracking-tight">Cổng Dữ Liệu Dược Quốc Gia</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> DAV Bộ Y Tế (55k SĐK)
                </span>
              </div>
              <p className="text-2xs text-slate-500 font-normal">Cơ sở dữ liệu số đăng ký lưu hành, tiêu chuẩn DĐVN V & dược lâm sàng chính thống</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Pills */}
        <div className="p-4 bg-slate-50/60 border-b border-slate-100 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Tìm theo tên thuốc, hoạt chất (Morphin, Ceftriaxone...), số đăng ký (SĐK)..."
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200/80 rounded-xl focus:bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 focus:outline-hidden text-slate-900 placeholder:text-slate-400 shadow-2xs transition"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto text-2xs scrollbar-none pb-0.5">
            {CATEGORIES.map((grp) => (
              <button
                key={grp} onClick={() => { setSelectedGroup(grp); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg shrink-0 font-medium cursor-pointer transition-all ${selectedGroup === grp ? 'bg-slate-900 text-white shadow-2xs font-semibold' : 'bg-white text-slate-600 border border-slate-200/70 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {grp === 'all' ? 'Tất cả danh mục' : grp}
              </button>
            ))}
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto bg-slate-50/30 p-3 sm:p-4">
          {loading ? (
            <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <span>Đang kết nối Cổng Dược Quốc Gia...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">Không tìm thấy thuốc phù hợp với từ khóa "{search}".</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 text-3xs uppercase tracking-wider">
                    <th className="py-3 px-3.5 whitespace-nowrap">Số Đăng Ký (SĐK)</th>
                    <th className="py-3 px-3.5">Tên Thuốc / Biệt Dược</th>
                    <th className="py-3 px-3.5">Hoạt Chất Chính & Hàm Lượng</th>
                    <th className="py-3 px-3.5 hidden md:table-cell">Dạng Bào Chế & Quy Cách</th>
                    <th className="py-3 px-3.5 text-right">An Toàn Y Tế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentSlice.map((d) => {
                    const badgeStyle = GROUP_STYLES[d.group] || 'bg-slate-100 text-slate-700 border-slate-200/60';
                    return (
                      <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3.5 whitespace-nowrap align-top">
                          <span className="font-mono font-semibold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/70 text-2xs inline-block">{d.nationalCode}</span>
                          <div className="text-3xs text-slate-400 mt-1 font-medium">{d.clinicalProfile?.officialSource?.standardPharmacopeia || 'DĐVN V'}</div>
                        </td>
                        <td className="py-3 px-3.5 align-top">
                          <div className="font-semibold text-slate-900 text-xs sm:text-sm">{d.brandName}</div>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-3xs font-medium border mt-1 ${badgeStyle}`}>{d.group}</span>
                        </td>
                        <td className="py-3 px-3.5 align-top">
                          <div className="text-slate-800 font-medium text-xs">{d.activeIngredient}</div>
                          <span className="inline-block text-3xs font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/50 mt-1">{d.concentration}</span>
                        </td>
                        <td className="py-3 px-3.5 hidden md:table-cell align-top">
                          <div className="text-slate-700 font-normal text-xs">{d.dosageForm}</div>
                          <div className="text-3xs text-slate-400 truncate max-w-xs mt-0.5">{d.clinicalProfile?.administrationRouteDetails}</div>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap align-top">
                          <button
                            onClick={() => { onClose(); onSelectMedication?.(d.brandName); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-2xs font-semibold text-teal-800 bg-teal-50/80 hover:bg-teal-100 border border-teal-200/60 transition cursor-pointer shadow-2xs"
                          >
                            <FileText className="w-3.5 h-3.5 text-teal-700" />
                            <span>Hồ sơ 5 Đúng</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 text-2xs">
            Hiển thị <span className="font-bold text-slate-800">{filtered.length}</span> thuốc phù hợp (Kho quốc gia 55.005 thuốc)
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg border border-slate-200/80 text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-slate-50 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-2xs font-medium text-slate-700">Trang <span className="font-bold">{page}</span> / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-slate-200/80 text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-slate-50 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
