/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Tra Cứu Dữ Liệu Dược Quốc Gia (55.000 SĐK Cục QLD & Kho BV) (<=200 LOC)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, Search, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { MasterMedication } from '../../types/medication';
import { getNationalDrugRegistryApi } from '../../services/api';
import { NationalDrugTableRow } from './NationalDrugRegistry/NationalDrugTableRow';
import { NationalDrugTabs } from './NationalDrugRegistry/NationalDrugTabs';
import { queryOfflineRegistry } from './NationalDrugRegistry/offlineRegistry';
import { DavDrugDetailModal } from './DavDrugDetailModal';
import { PHARMACOLOGICAL_GROUPS } from '../../utils/clinical/pharmacologicalClassification';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import { getCachedRegistryPage, saveCachedRegistryPage, RegistryPageKey } from '../../utils/storage/registryPageCache';

interface Props { isOpen: boolean; onClose: () => void; onSelectMedication?: (medName: string) => void; }

const PAGE_SIZE = 12;
export const NationalDrugRegistryModal: React.FC<Props> = ({ isOpen, onClose, onSelectMedication }) => {
  useModalDismiss(isOpen, onClose);
  const [drugs, setDrugs] = useState<MasterMedication[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [pharmGroup, setPharmGroup] = useState<string>('all');
  const [onlyInWarehouse, setOnlyInWarehouse] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(54885);
  const [totalPages, setTotalPages] = useState(1);
  const [groupStats, setGroupStats] = useState<Record<string, number>>({});
  const [hospitalStockDrugCount, setHospitalStockDrugCount] = useState(0);
  const [cacheStatus, setCacheStatus] = useState<'none' | 'checking' | 'current' | 'updated' | 'offline' | 'static'>('none');
  const [selectedDrugForDav, setSelectedDrugForDav] = useState<MasterMedication | null>(null);

  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 250); return () => clearTimeout(t); }, [searchInput]);

  const loadData = useCallback(async (isManualSync = false) => {
    const key: RegistryPageKey = { search, group: selectedGroup, pharmGroup, page, pageSize: PAGE_SIZE, onlyInWarehouse };
    const cached = getCachedRegistryPage(key);
    if (!isManualSync && cached) {
      const cachedResponse = cached.response;
      const mappedCache = cachedResponse.items.map((i) => ({
        ...i, id: i.id, nationalCode: i.national_code, brandName: i.brand_name,
        activeIngredient: i.active_ingredient, dosageForm: i.dosage_form,
        standardUnit: i.standard_unit || 'Viên', group: i.group || 'Thuốc điều trị chuyên khoa',
        hospitalStockByUnit: i.hospital_stock_by_unit.map((stock) => ({ unit: stock.unit, quantity: stock.quantity, batchCount: stock.batch_count })),
        hospitalStockCount: i.hospital_stock_by_unit.reduce((sum, stock) => sum + (stock.unit === (i.standard_unit || 'Viên') ? stock.quantity : 0), 0),
        isControlled: !!i.is_controlled, isHighAlert: !!i.is_high_alert, isCrashCart: !!i.is_crash_cart,
        defaultDoseQty: 1, wardStockCount: 0, searchAliases: [i.brand_name.toLowerCase()],
      })) as MasterMedication[];
      setDrugs(mappedCache); setTotalCount(cachedResponse.total); setTotalPages(cachedResponse.total_pages);
      setGroupStats(cachedResponse.group_stats); setHospitalStockDrugCount(cachedResponse.hospital_stock_drug_count);
      setCacheStatus('checking'); setLoading(false);
    } else if (isManualSync) { setIsSyncing(true); setSyncNotice(null); } else setLoading(true);
    let loaded = false;
    try {
      const data = await getNationalDrugRegistryApi({ search, group: selectedGroup, pharmGroup, page, pageSize: PAGE_SIZE, onlyInWarehouse });
      if (data && Array.isArray(data.items) && (data.items.length > 0 || data.total > 0)) {
        const mapped: MasterMedication[] = data.items.map((i: any) => ({
          ...i, id: i.id, nationalCode: i.national_code || i.nationalCode, brandName: i.brand_name || i.brandName,
          activeIngredient: i.active_ingredient || i.activeIngredient, dosageForm: i.dosage_form || i.dosageForm,
          standardUnit: i.standard_unit || i.standardUnit || 'Viên', group: i.group || 'Thuốc điều trị chuyên khoa',
          hospitalStockByUnit: (i.hospital_stock_by_unit || []).map((stock: any) => ({ unit: stock.unit, quantity: stock.quantity, batchCount: stock.batch_count })),
          hospitalStockCount: (i.hospital_stock_by_unit || []).reduce((total: number, stock: { quantity: number; unit: string }) => total + (stock.unit === (i.standard_unit || i.standardUnit || 'Viên') ? stock.quantity : 0), 0),
          isControlled: !!(i.is_controlled ?? i.isControlled), isHighAlert: !!(i.is_high_alert ?? i.isHighAlert),
          isCrashCart: !!(i.is_crash_cart ?? i.isCrashCart), defaultDoseQty: 1, wardStockCount: 0,
          searchAliases: [(i.brand_name || i.brandName || '').toLowerCase()], packagingSpec: i.packaging_spec || i.packagingSpec,
          standardPharmacopeia: i.standard_pharmacopeia || i.standardPharmacopeia, shelfLife: i.shelf_life || i.shelfLife,
          manufacturer: i.manufacturer, country: i.country, applicantName: i.applicant_name || i.applicantName,
          approvalDecision: i.approval_decision || i.approvalDecision, hdsdPath: i.hdsd_path || i.hdsdPath,
          labelPath: i.label_path || i.labelPath, atcCode: i.atc_code || i.atcCode, drugClass: i.drug_class || i.drugClass,
          clinicalSource: i.clinical_source || i.clinicalSource,
        }));
        setDrugs(mapped); setTotalCount(data.total ?? mapped.length); setTotalPages(data.total_pages || 1);
        setHospitalStockDrugCount(data.hospital_stock_drug_count ?? 0);
        if (data.group_stats) setGroupStats(data.group_stats);
        saveCachedRegistryPage(key, data);
        setCacheStatus(cached && cached.response.inventory_revision === data.inventory_revision && cached.response.registry_revision === data.registry_revision ? 'current' : cached ? 'updated' : 'none');
        if (isManualSync) { setSyncNotice(`Đã cập nhật ${data.total.toLocaleString()} kết quả`); setTimeout(() => setSyncNotice(null), 3500); }
        loaded = true;
      }
    } catch { setCacheStatus('offline'); }

    if (!loaded) {
      try {
        if (onlyInWarehouse) throw new Error('Warehouse inventory requires the authoritative database');
        const off = await queryOfflineRegistry(search, selectedGroup, pharmGroup, page, PAGE_SIZE);
        setDrugs(off.items); setTotalCount(off.total); setTotalPages(off.totalPages); setGroupStats(off.groupStats); setHospitalStockDrugCount(0);
        setCacheStatus('static');
        if (isManualSync) { setSyncNotice('Danh mục DAV bản chuẩn hóa đã được tải. API nghiệp vụ chưa cung cấp trạng thái tồn kho trực tiếp.'); setTimeout(() => setSyncNotice(null), 5000); }
      } catch {
        if (!cached) { setDrugs([]); setTotalCount(0); setTotalPages(1); setHospitalStockDrugCount(0); }
        setCacheStatus('offline');
        setSyncNotice('Chưa tải được dữ liệu mới từ CSDL.');
      }
    }
    setLoading(false); setIsSyncing(false);
  }, [search, selectedGroup, pharmGroup, page, onlyInWarehouse]);

  useEffect(() => { if (isOpen) loadData(); }, [isOpen, loadData]);

  const inWarehouseCount = hospitalStockDrugCount;
  const displayedDrugs = drugs;

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="Kho Dược Quốc Gia" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-0 sm:p-6">
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:w-[96vw] max-w-6xl lg:max-w-7xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-950 text-lg sm:text-xl">Kho Dược Quốc Gia</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} data-testid="btn-close-national-registry" aria-label="Đóng" className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-2 bg-white border-b border-slate-200 space-y-1.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap xl:flex-nowrap">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm theo tên thuốc, hoạt chất hoặc số đăng ký" aria-label="Tìm trong Kho Dược Quốc Gia" className="w-full min-h-11 pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-500 focus:bg-white text-slate-900 placeholder:text-slate-500 transition" />
            </div>
            <select value={pharmGroup} onChange={(e) => { setPharmGroup(e.target.value); setPage(1); }} data-testid="registry-pharm-select" className="min-h-11 bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-500 cursor-pointer max-w-[220px] truncate shrink-0" title="Lọc theo Tác dụng Dược lý Lâm sàng">
              <option value="all">Tất cả nhóm dược lý</option>
              {PHARMACOLOGICAL_GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            <div className="flex items-center gap-1 border border-slate-300 p-0.5 rounded-lg text-sm shrink-0 font-medium">
              <button type="button" aria-pressed={!onlyInWarehouse} onClick={() => { setOnlyInWarehouse(false); setPage(1); }} className={`px-3 py-2 rounded-md transition cursor-pointer ${!onlyInWarehouse ? 'bg-slate-100 text-slate-950 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}>Tất cả</button>
              <button type="button" aria-pressed={onlyInWarehouse} onClick={() => { setOnlyInWarehouse(true); setPage(1); }} className={`px-3 py-2 rounded-md transition cursor-pointer flex items-center gap-1.5 ${onlyInWarehouse ? 'bg-slate-100 text-slate-950 font-semibold' : 'text-slate-600 hover:text-slate-900'}`}>
                <span>Kho bệnh viện</span><span className="text-xs text-slate-500 tabular-nums">{inWarehouseCount}</span>
              </button>
            </div>
            <button onClick={() => loadData(true)} disabled={isSyncing} className="px-3 py-2.5 min-h-11 rounded-lg text-sm font-medium bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shrink-0" title="Tải lại danh mục dược quốc gia">
              <RotateCw className={`w-4 h-4 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} /><span>{isSyncing ? 'Đang nạp...' : 'Cập nhật'}</span>
            </button>
          </div>
          {syncNotice && <p role="status" className="text-sm text-slate-600">{syncNotice}</p>}
          {cacheStatus === 'checking' && <p role="status" className="text-xs text-slate-500">Đang kiểm tra dữ liệu trong CSDL…</p>}
          {cacheStatus === 'updated' && <p role="status" className="text-xs text-teal-700">Dữ liệu đã được đồng bộ từ CSDL.</p>}
          {cacheStatus === 'current' && <p role="status" className="text-xs text-teal-700">Dữ liệu đã được xác nhận còn khớp với CSDL.</p>}
          {cacheStatus === 'static' && <p role="status" className="text-xs text-amber-800">Đang tra cứu danh mục DAV canonical đã đồng bộ lên web. Tồn kho bệnh viện cần API trực tiếp nên chưa hiển thị tại đây.</p>}
          {cacheStatus === 'offline' && <p role="status" className="text-xs text-amber-700">Chưa kết nối được CSDL; đang hiển thị lần tải gần nhất. Bấm Cập nhật để thử lại.</p>}
          <p className="text-xs text-slate-500">Danh mục tra cứu được đồng bộ từ bản DAV chuẩn hóa, cập nhật ngày 30/10/2026. Thông tin tương tác hiển thị theo nguyên văn nguồn chuyên luận; không tự suy diễn thành chống chỉ định phối hợp.</p>
            <NationalDrugTabs selectedGroup={selectedGroup} onSelectGroup={(g) => { setSelectedGroup(g); setPage(1); }} groupStats={groupStats} totalCount={totalCount} />
        </div>

        <div className="flex-1 overflow-auto bg-white p-2 sm:p-3">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-sm flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
              <span>Đang truy vấn CSDL 55.000 thuốc Cục Quản lý Dược...</span>
            </div>
          ) : displayedDrugs.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">Không tìm thấy thuốc nào phù hợp với bộ lọc hiện tại.</div>
          ) : (
              <div className="bg-white rounded-lg border border-slate-200 overflow-auto">
              <table className="w-full min-w-[1300px] table-fixed text-left text-sm border-collapse">
                <colgroup>
                  <col style={{ width: '220px' }} />
                  <col className="w-[32%]" style={{ minWidth: '340px' }} />
                  <col className="w-[42%]" style={{ minWidth: '420px' }} />
                  <col style={{ width: '260px' }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-sm">
                    <th className="py-3 px-4 whitespace-nowrap border-r border-slate-200">SĐK</th>
                    <th className="py-3 px-4 border-r border-slate-200">Tên thuốc</th>
                    <th className="py-3 px-4 border-r border-slate-200">Hoạt chất · Hàm lượng</th>
                    <th className="py-3 px-4">Dạng bào chế</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayedDrugs.map((d) => (
                    <NationalDrugTableRow key={d.id} drug={d}
                      onOpenSafetyGuide={(name) => { onClose(); onSelectMedication?.(name); }}
                      onOpenDavDetail={(drug) => setSelectedDrugForDav(drug)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 text-sm shrink-0">
          <div className="text-slate-500"><span className="font-medium text-slate-900">{totalCount.toLocaleString('vi-VN')}</span> kết quả · Trang {page}/{totalPages}</div>
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
