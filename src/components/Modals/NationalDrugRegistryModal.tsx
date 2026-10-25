/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Tra Cứu Dữ Liệu Dược Quốc Gia & Đối Soát Thủ Công (Cục Quản lý Dược) (<=200 LOC)
 * Đồng bộ thời gian thực tồn kho & số lô FEFO với Kho Dược Bệnh Viện
 */

import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Boxes } from 'lucide-react';
import { MasterMedication } from '../../types/medication';
import { InventoryBatch } from '../../types/pharmacy';
import { isVerificationLinksVisible, setVerificationLinksVisibility } from '../../config/clinicalVerification';
import { NationalDrugTableRow } from './NationalDrugRegistry/NationalDrugTableRow';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedication?: (medName: string) => void;
  inventoryBatches?: InventoryBatch[];
}

const PAGE_SIZE = 12;
const GROUP_STYLES: Record<string, string> = {
  'Kháng sinh': 'bg-blue-50 text-blue-700 border-blue-200/60',
  'Thuốc gây nghiện': 'bg-amber-50 text-amber-800 border-amber-200/60',
  'Thuốc cấp cứu': 'bg-rose-50 text-rose-700 border-rose-200/60',
  'Thuốc nguy cơ cao': 'bg-red-50 text-red-700 border-red-200/60',
  'Dịch truyền': 'bg-cyan-50 text-cyan-800 border-cyan-200/60',
  'Thuốc hướng thần': 'bg-purple-50 text-purple-700 border-purple-200/60',
  'Vật tư tiêu hao': 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
  'Chỉ phẫu thuật & Khâu': 'bg-teal-50 text-teal-800 border-teal-200/60',
  'Vắc xin & Chuỗi lạnh': 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
  'Thuốc điều trị chuyên khoa': 'bg-slate-100 text-slate-700 border-slate-200/60',
};
const CATEGORIES = ['all', 'Kháng sinh', 'Thuốc gây nghiện', 'Thuốc cấp cứu', 'Dịch truyền', 'Vật tư tiêu hao', 'Vắc xin & Chuỗi lạnh'];

export const NationalDrugRegistryModal: React.FC<Props> = ({ isOpen, onClose, onSelectMedication, inventoryBatches }) => {
  const [drugs, setDrugs] = useState<MasterMedication[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [onlyInWarehouse, setOnlyInWarehouse] = useState(false);
  const [page, setPage] = useState(1);
  const [verifyMode, setVerifyMode] = useState(isVerificationLinksVisible());

  const toggleVerify = () => {
    const next = !verifyMode;
    setVerificationLinksVisibility(next);
    setVerifyMode(next);
  };

  useEffect(() => {
    if (!isOpen || drugs.length > 0) return;
    setLoading(true);
    fetch('/data/vietnam_drug_registry/dav_essential_formulary.json')
      .then((res) => res.json())
      .then((data) => { setDrugs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isOpen, drugs.length]);

  const syncedDrugs = useMemo(() => {
    if (!inventoryBatches || inventoryBatches.length === 0) return drugs;
    const map = new Map<string, { stock: number; batches: number; unit: string }>();
    for (const b of inventoryBatches) {
      const rawKeys = [b.registrationNumber?.toLowerCase().trim(), b.nationalCode?.toLowerCase().trim(), b.itemCode?.toLowerCase().trim()].filter(Boolean) as string[];
      const uniqueKeys = Array.from(new Set(rawKeys));
      for (const k of uniqueKeys) {
        const cur = map.get(k) || { stock: 0, batches: 0, unit: b.unit };
        map.set(k, { stock: cur.stock + b.currentStock, batches: cur.batches + 1, unit: b.unit });
      }
    }
    return drugs.map((d) => {
      const match = map.get(d.nationalCode.toLowerCase().trim()) || map.get(d.id.toLowerCase().trim());
      return match ? { ...d, hospitalStockCount: match.stock, batchCount: match.batches, standardUnit: match.unit || d.standardUnit } : d;
    });
  }, [drugs, inventoryBatches]);

  const inWarehouseCount = useMemo(() => syncedDrugs.filter((d) => (d.hospitalStockCount ?? 0) > 0).length, [syncedDrugs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return syncedDrugs.filter((d) => {
      if (onlyInWarehouse && (d.hospitalStockCount ?? 0) <= 0) return false;
      if (selectedGroup !== 'all' && d.group !== selectedGroup) return false;
      if (!q) return true;
      return d.brandName.toLowerCase().includes(q) || d.activeIngredient.toLowerCase().includes(q) || d.nationalCode.toLowerCase().includes(q) || (d.note && d.note.toLowerCase().includes(q));
    });
  }, [syncedDrugs, search, selectedGroup, onlyInWarehouse]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentSlice = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Cổng Dữ Liệu Dược Quốc Gia" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-[96vw] max-w-6xl lg:max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">Cổng Dữ Liệu Dược Quốc Gia</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">DAV 55.000 SĐK</span>
              {inWarehouseCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-900 border border-teal-300 flex items-center gap-1">
                  <Boxes className="w-3 h-3 text-teal-700" />Đồng bộ Kho BV ({inWarehouseCount} mục)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Cơ sở dữ liệu số đăng ký lưu hành, tiêu chuẩn DĐVN V &amp; đồng bộ thời gian thực Kho Dược</p>
          </div>
          <div className="flex items-center gap-2.5">
            <button onClick={toggleVerify} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-2xs ${verifyMode ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              Link kiểm chứng: {verifyMode ? 'BẬT' : 'TẮT'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 space-y-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tìm theo tên thuốc, hoạt chất (Morphin, Ceftriaxone...), số đăng ký (SĐK)..." className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200/90 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 text-slate-900 placeholder:text-slate-400 shadow-2xs transition" />
            </div>
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl text-xs shrink-0 font-medium">
              <button type="button" onClick={() => { setOnlyInWarehouse(false); setPage(1); }} className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${!onlyInWarehouse ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>Tất cả Dược QG</button>
              <button type="button" onClick={() => { setOnlyInWarehouse(true); setPage(1); }} className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${onlyInWarehouse ? 'bg-teal-700 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>
                <span>Kho Dược BV</span>
                <span className={`px-1.5 py-0.2 rounded-full text-2xs ${onlyInWarehouse ? 'bg-teal-800 text-teal-100' : 'bg-slate-300 text-slate-700 font-bold'}`}>{inWarehouseCount}</span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto text-xs scrollbar-none pb-0.5">
            {CATEGORIES.map((grp) => (
              <button key={grp} onClick={() => { setSelectedGroup(grp); setPage(1); }} className={`px-3 py-1 rounded-lg shrink-0 font-medium cursor-pointer transition-all ${selectedGroup === grp ? 'bg-slate-900 text-white shadow-2xs font-semibold' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                {grp === 'all' ? 'Tất cả nhóm' : grp}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/40 p-4 sm:p-6">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
              <span>Đang kết nối Cổng Dược Quốc Gia...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">Không tìm thấy thuốc phù hợp với từ khóa "{search}".</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 whitespace-nowrap">Số Đăng Ký (SĐK)</th>
                    <th className="py-3 px-4">Tên Thuốc &amp; Kho BV</th>
                    <th className="py-3 px-4">Hoạt Chất Chính &amp; Hàm Lượng</th>
                    <th className="py-3 px-4 hidden md:table-cell">Dạng Bào Chế &amp; Đường Dùng</th>
                    <th className="py-3 px-4 text-right">An Toàn Y Tế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentSlice.map((d) => (
                    <NationalDrugTableRow key={d.id} drug={d} verifyMode={verifyMode} badgeStyle={GROUP_STYLES[d.group] || 'bg-slate-100 text-slate-700 border-slate-200/60'} onOpenSafetyGuide={(name) => { onClose(); onSelectMedication?.(name); }} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-2.5 bg-white border-t border-slate-200/80 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500">Hiển thị <span className="font-bold text-slate-900">{filtered.length}</span> thuốc phù hợp (Đồng bộ: {inWarehouseCount} mặt hàng trong Kho BV)</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-slate-50 transition"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-medium text-slate-700">Trang <span className="font-bold text-slate-900">{page}</span> / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-slate-50 transition"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};
