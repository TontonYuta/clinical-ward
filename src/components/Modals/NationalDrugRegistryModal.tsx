/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Tra Cứu Dữ Liệu Dược Quốc Gia (55.000 SĐK Cục QLD & Kho BV) (<=200 LOC)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search, ChevronLeft, ChevronRight, Boxes, RotateCw, Check } from 'lucide-react';
import { MasterMedication } from '../../types/medication';
import { InventoryBatch } from '../../types/pharmacy';
import { isVerificationLinksVisible, setVerificationLinksVisibility } from '../../config/clinicalVerification';
import { getNationalDrugRegistryApi } from '../../services/api';
import { NationalDrugTableRow } from './NationalDrugRegistry/NationalDrugTableRow';
import { NationalDrugTabs, GROUP_STYLES } from './NationalDrugRegistry/NationalDrugTabs';
import { queryOfflineRegistry } from './NationalDrugRegistry/offlineRegistry';
import { DavDrugDetailModal } from './DavDrugDetailModal';

interface Props { isOpen: boolean; onClose: () => void; onSelectMedication?: (medName: string) => void; inventoryBatches?: InventoryBatch[]; }

const PAGE_SIZE = 12;
export const NationalDrugRegistryModal: React.FC<Props> = ({ isOpen, onClose, onSelectMedication, inventoryBatches }) => {
  const [drugs, setDrugs] = useState<MasterMedication[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [onlyInWarehouse, setOnlyInWarehouse] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(54885);
  const [totalPages, setTotalPages] = useState(1);
  const [groupStats, setGroupStats] = useState<Record<string, number>>({});
  const [verifyMode, setVerifyMode] = useState(isVerificationLinksVisible());
  const [selectedDrugForDav, setSelectedDrugForDav] = useState<MasterMedication | null>(null);

  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 250); return () => clearTimeout(t); }, [searchInput]);
  const toggleVerify = () => { const next = !verifyMode; setVerificationLinksVisibility(next); setVerifyMode(next); };

  const loadData = useCallback(async (isManualSync = false) => {
    if (isManualSync) { setIsSyncing(true); setSyncNotice(null); } else setLoading(true);
    let loaded = false;
    try {
      const data = await getNationalDrugRegistryApi({ search, group: selectedGroup, page, pageSize: PAGE_SIZE });
      if (data && Array.isArray(data.items) && (data.items.length > 0 || search.trim() !== '' || selectedGroup !== 'all')) {
        const mapped: MasterMedication[] = data.items.map((i: any) => ({
          id: i.id, nationalCode: i.national_code, brandName: i.brand_name,
          activeIngredient: i.active_ingredient, concentration: i.concentration, dosageForm: i.dosage_form,
          route: i.route, standardUnit: i.standard_unit, group: i.group, isControlled: i.is_controlled,
          isHighAlert: i.is_high_alert, isCrashCart: i.is_crash_cart, defaultDoseQty: 1, wardStockCount: 0,
          hospitalStockCount: 0, searchAliases: [i.brand_name.toLowerCase()], note: i.note,
          packagingSpec: i.packaging_spec, standardPharmacopeia: i.standard_pharmacopeia, shelfLife: i.shelf_life,
          manufacturer: i.manufacturer, country: i.country, applicantName: i.applicant_name, approvalDecision: i.approval_decision,
          hdsdPath: i.hdsd_path || i.hdsdPath, labelPath: i.label_path || i.labelPath,
          atcCode: i.atc_code || i.atcCode, drugClass: i.drug_class || i.drugClass, indications: i.indications,
          contraindications: i.contraindications, precautions: i.precautions, pregnancyWarning: i.pregnancy_warning || i.pregnancyWarning,
          adultDosage: i.adult_dosage || i.adultDosage, pediatricDosage: i.pediatric_dosage || i.pediatricDosage,
          renalAdjustment: i.renal_adjustment || i.renalAdjustment, hepaticAdjustment: i.hepatic_adjustment || i.hepaticAdjustment,
          adverseEffects: i.adverse_effects || i.adverseEffects, drugInteractions: i.drug_interactions || i.drugInteractions,
          overdoseTreatment: i.overdose_treatment || i.overdoseTreatment, antidote: i.antidote, clinicalSource: i.clinical_source || i.clinicalSource,
        }));
        setDrugs(mapped); setTotalCount(data.total || mapped.length); setTotalPages(data.total_pages || 1);
        if (data.group_stats) setGroupStats(data.group_stats);
        if (isManualSync) { setSyncNotice(`Đã đồng bộ ${data.total.toLocaleString()} thuốc!`); setTimeout(() => setSyncNotice(null), 3500); }
        loaded = true;
      }
    } catch {}

    if (!loaded) {
      try {
        const off = await queryOfflineRegistry(search, selectedGroup, page, PAGE_SIZE);
        setDrugs(off.items); setTotalCount(off.total); setTotalPages(off.totalPages); setGroupStats(off.groupStats);
        if (isManualSync) { setSyncNotice(`Đã nạp ${off.total.toLocaleString()} thuốc!`); setTimeout(() => setSyncNotice(null), 3500); }
      } catch { setSyncNotice('Lỗi nạp CSDL thuốc'); }
    }
    setLoading(false); setIsSyncing(false);
  }, [search, selectedGroup, page]);

  useEffect(() => { if (isOpen) loadData(); }, [isOpen, loadData]);

  const syncedDrugs = useMemo(() => {
    if (!inventoryBatches || inventoryBatches.length === 0) return drugs;
    const map = new Map<string, { stock: number; batches: number; unit: string }>();
    for (const b of inventoryBatches) {
      const keys = [b.registrationNumber?.toLowerCase().trim(), b.nationalCode?.toLowerCase().trim(), b.itemCode?.toLowerCase().trim()].filter(Boolean) as string[];
      for (const k of new Set(keys)) {
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
  const displayedDrugs = useMemo(() => onlyInWarehouse ? syncedDrugs.filter((d) => (d.hospitalStockCount ?? 0) > 0) : syncedDrugs, [syncedDrugs, onlyInWarehouse]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Cổng Dữ Liệu Dược Quốc Gia" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-[96vw] max-w-6xl lg:max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        <div className="px-6 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">Cổng Dữ Liệu Dược Quốc Gia</h3>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">DAV 55.000 SĐK</span>
              {inWarehouseCount > 0 && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal-50 text-teal-900 border border-teal-300 flex items-center gap-1">
                  <Boxes className="w-3.5 h-3.5 text-teal-700" />Kho BV ({inWarehouseCount})
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Hệ thống Dữ liệu Dược Quốc Gia &amp; Đối soát Danh mục Thuốc Bệnh Viện</p>
          </div>
          <div className="flex items-center gap-2">
            {syncNotice && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 animate-in fade-in">
                <Check className="w-3 h-3 text-emerald-600" />{syncNotice}
              </span>
            )}
            <button onClick={() => loadData(true)} disabled={isSyncing} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 transition cursor-pointer shadow-2xs flex items-center gap-1.5 active:scale-95 disabled:opacity-50" title="Tải lại danh mục từ máy chủ">
              <RotateCw className={`w-3.5 h-3.5 text-teal-700 ${isSyncing ? 'animate-spin' : ''}`} /><span>{isSyncing ? 'Đang nạp...' : 'Tự động cập nhật'}</span>
            </button>
            <button onClick={toggleVerify} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer shadow-2xs ${verifyMode ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
              Kiểm chứng: {verifyMode ? 'BẬT' : 'TẮT'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 space-y-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm trên 55.000 thuốc: Tên thuốc, hoạt chất (Morphin, Venetoclax, Cefaclor...), SĐK (VD-24757-16)..." className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-white border border-slate-200/90 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 text-slate-900 placeholder:text-slate-400 shadow-2xs transition" />
            </div>
            <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl text-xs shrink-0 font-medium">
              <button type="button" onClick={() => { setOnlyInWarehouse(false); setPage(1); }} className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${!onlyInWarehouse ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>Tất cả 55k</button>
              <button type="button" onClick={() => { setOnlyInWarehouse(true); setPage(1); }} className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${onlyInWarehouse ? 'bg-teal-700 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}>
                <span>Kho Dược BV</span><span className={`px-1.5 py-0.2 rounded-full text-2xs ${onlyInWarehouse ? 'bg-teal-800 text-teal-100' : 'bg-slate-300 text-slate-700 font-bold'}`}>{inWarehouseCount}</span>
              </button>
            </div>
          </div>
          <NationalDrugTabs selectedGroup={selectedGroup} onSelectGroup={(g) => { setSelectedGroup(g); setPage(1); }} groupStats={groupStats} totalCount={totalCount} />
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/40 p-4 sm:p-6">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" />
              <span>Đang truy vấn CSDL 55.000 thuốc Cục Quản lý Dược...</span>
            </div>
          ) : displayedDrugs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">Không tìm thấy thuốc nào phù hợp với bộ lọc hiện tại.</div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200/80 text-xs uppercase tracking-wider">
                    <th className="py-3 px-4 whitespace-nowrap">Số Đăng Ký (SĐK)</th>
                    <th className="py-3 px-4">Tên Thuốc &amp; Tồn Kho BV</th>
                    <th className="py-3 px-4">Hoạt Chất &amp; Hàm Lượng</th>
                    <th className="py-3 px-4 hidden md:table-cell">Dạng Bào Chế &amp; Cơ Sở SX</th>
                    <th className="py-3 px-4 text-right">Thẩm Định</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayedDrugs.map((d) => (
                    <NationalDrugTableRow
                      key={d.id} drug={d} verifyMode={verifyMode}
                      badgeStyle={GROUP_STYLES[d.group] || 'bg-slate-100 text-slate-700 border-slate-200/60'}
                      onOpenSafetyGuide={(name) => { onClose(); onSelectMedication?.(name); }}
                      onOpenDavDetail={(drug) => setSelectedDrugForDav(drug)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-6 py-2.5 bg-white border-t border-slate-200/80 flex items-center justify-between text-xs shrink-0">
          <div className="text-slate-500">Hiển thị <span className="font-bold text-slate-900">{totalCount.toLocaleString('vi-VN')}</span> thuốc Cục QLD (Trang {page}/{totalPages} | Đồng bộ: {inWarehouseCount} mục kho BV)</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-slate-50 transition"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-medium text-slate-700">Trang <span className="font-bold text-slate-900">{page}</span> / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-slate-50 transition"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
      <DavDrugDetailModal isOpen={!!selectedDrugForDav} onClose={() => setSelectedDrugForDav(null)} drug={selectedDrugForDav} />
    </div>
  );
};
