/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Tra Cứu Dữ Liệu Dược Quốc Gia (Cục Quản lý Dược - Bộ Y tế) (<=200 LOC)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Building2, ShieldAlert, ChevronLeft, ChevronRight, FileText, CheckCircle2 } from 'lucide-react';
import { MasterMedication } from '../../types/medication';

interface NationalDrugRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedication?: (medName: string) => void;
}

const PAGE_SIZE = 12;

export const NationalDrugRegistryModal: React.FC<NationalDrugRegistryModalProps> = ({
  isOpen,
  onClose,
  onSelectMedication,
}) => {
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
      .then((data) => {
        setDrugs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [isOpen, drugs.length]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return drugs.filter((d) => {
      if (selectedGroup !== 'all' && d.group !== selectedGroup) return false;
      if (!q) return true;
      return (
        d.brandName.toLowerCase().includes(q) ||
        d.activeIngredient.toLowerCase().includes(q) ||
        d.nationalCode.toLowerCase().includes(q) ||
        (d.note && d.note.toLowerCase().includes(q))
      );
    });
  }, [drugs, search, selectedGroup]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentSlice = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-800 flex items-center justify-center border border-teal-700">
              <Building2 className="w-4 h-4 text-teal-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">Cổng Dữ Liệu Dược Quốc Gia (DAV - Bộ Y Tế)</h3>
                <span className="px-2 py-0.5 rounded-full text-2xs font-extrabold bg-teal-800 border border-teal-700 text-teal-200">55.005 SĐK</span>
              </div>
              <p className="text-2xs sm:text-xs text-teal-200">Cơ sở dữ liệu số đăng ký lưu hành, hoạt chất & tiêu chuẩn Dược điển Việt Nam</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-teal-800/80 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Tìm theo tên thuốc, hoạt chất (Morphin, Ceftriaxone...), số đăng ký (SĐK)..."
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-lg focus:border-teal-700 focus:outline-hidden text-slate-900"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto text-2xs font-bold scrollbar-none">
            {['all', 'Kháng sinh', 'Thuốc gây nghiện', 'Thuốc cấp cứu', 'Dịch truyền', 'Thuốc nguy cơ cao', 'Thuốc hướng thần'].map((grp) => (
              <button
                key={grp}
                onClick={() => { setSelectedGroup(grp); setPage(1); }}
                className={`px-2.5 py-1 rounded-md shrink-0 cursor-pointer transition ${selectedGroup === grp ? 'bg-teal-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
              >
                {grp === 'all' ? 'Tất cả nhóm' : grp}
              </button>
            ))}
          </div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto bg-slate-50 p-2 sm:p-3">
          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs">Đang nạp dữ liệu Dược Quốc Gia...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">Không tìm thấy thuốc phù hợp với từ khóa "{search}".</div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-2xs uppercase tracking-wider">
                    <th className="py-2.5 px-3 whitespace-nowrap">Số Đăng Ký (SĐK)</th>
                    <th className="py-2.5 px-3">Tên Thuốc / Biệt Dược</th>
                    <th className="py-2.5 px-3">Hoạt Chất Chính & Hàm Lượng</th>
                    <th className="py-2.5 px-3 hidden md:table-cell">Dạng Bào Chế & Quy Cách</th>
                    <th className="py-2.5 px-3 text-right">An Toàn Y Tế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentSlice.map((d) => (
                    <tr key={d.id} className="hover:bg-teal-50/40 transition">
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-2xs">{d.nationalCode}</span>
                        <div className="text-3xs text-slate-400 mt-0.5">{d.clinicalProfile?.officialSource?.standardPharmacopeia || 'DĐVN V'}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900">{d.brandName}</div>
                        <span className={`inline-block px-1.5 py-0.2 rounded text-3xs font-extrabold ${d.isControlled ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>{d.group}</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-slate-800 font-medium">{d.activeIngredient}</div>
                        <div className="text-3xs text-slate-500 font-bold">{d.concentration}</div>
                      </td>
                      <td className="py-2 px-3 hidden md:table-cell">
                        <div className="text-slate-700">{d.dosageForm}</div>
                        <div className="text-3xs text-slate-400 truncate max-w-xs">{d.clinicalProfile?.administrationRouteDetails}</div>
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => { onClose(); onSelectMedication?.(d.brandName); }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-800 hover:bg-teal-900 text-white font-bold text-2xs cursor-pointer shadow-2xs"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Hồ sơ 5 Đúng</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500 text-2xs">
            Hiển thị <span className="font-bold text-slate-800">{filtered.length}</span> thuốc phù hợp (Kho lưu hành 55.005 thuốc)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded border border-slate-200 text-slate-600 disabled:opacity-40 cursor-pointer hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-2xs font-bold text-slate-700">Trang {page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded border border-slate-200 text-slate-600 disabled:opacity-40 cursor-pointer hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
