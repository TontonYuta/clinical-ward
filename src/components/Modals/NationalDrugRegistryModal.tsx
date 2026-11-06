/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng Tra Cứu Dữ Liệu Dược Quốc Gia (55.000 SĐK Cục QLD & Kho BV) (<=200 LOC)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  SlidersHorizontal,
  ArrowUpRight,
} from 'lucide-react';
import { MasterMedication } from '../../types/medication';
import { getNationalDrugRegistryApi } from '../../services/api';
import { SearchField, EmptyState } from '../ui/Workspace';
import { REGISTRY_TABS } from './NationalDrugRegistry/NationalDrugTabs';
import { NationalDrugTabs } from './NationalDrugRegistry/NationalDrugTabs';
import { queryOfflineRegistry } from './NationalDrugRegistry/offlineRegistry';
import { DavDrugDetailModal } from './DavDrugDetailModal';
import { PHARMACOLOGICAL_GROUPS } from '../../utils/clinical/pharmacologicalClassification';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import {
  getCachedRegistryPage,
  saveCachedRegistryPage,
  RegistryPageKey,
} from '../../utils/storage/registryPageCache';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedication?: (medName: string) => void;
  initialSearch?: string;
}

const PAGE_SIZE = 12;
export const NationalDrugRegistryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSelectMedication,
  initialSearch = '',
}) => {
  useModalDismiss(isOpen, onClose);
  const [showFilters, setShowFilters] = useState(false);
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
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [groupStats, setGroupStats] = useState<Record<string, number>>({});
  const [hospitalStockDrugCount, setHospitalStockDrugCount] = useState(0);
  const [cacheStatus, setCacheStatus] = useState<
    'none' | 'checking' | 'current' | 'updated' | 'offline' | 'static'
  >('none');
  const [selectedDrugForDav, setSelectedDrugForDav] = useState<MasterMedication | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchInput(initialSearch);
      setSearch(initialSearch.trim());
      setPage(1);
    }
  }, [isOpen, initialSearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadData = useCallback(
    async (isManualSync = false) => {
      const key: RegistryPageKey = {
        search,
        group: selectedGroup,
        pharmGroup,
        page,
        pageSize: PAGE_SIZE,
        onlyInWarehouse,
      };
      const cached = getCachedRegistryPage(key);
      if (!isManualSync && cached) {
        const cachedResponse = cached.response;
        const mappedCache = cachedResponse.items.map((i) => ({
          ...i,
          id: i.id,
          nationalCode: i.national_code,
          brandName: i.brand_name,
          activeIngredient: i.active_ingredient,
          dosageForm: i.dosage_form,
          standardUnit: i.standard_unit || 'Viên',
          group: i.group || 'Thuốc điều trị chuyên khoa',
          hospitalStockByUnit: i.hospital_stock_by_unit.map((stock) => ({
            unit: stock.unit,
            quantity: stock.quantity,
            batchCount: stock.batch_count,
          })),
          hospitalStockCount: i.hospital_stock_by_unit.reduce(
            (sum, stock) => sum + (stock.unit === (i.standard_unit || 'Viên') ? stock.quantity : 0),
            0,
          ),
          isControlled: !!i.is_controlled,
          isHighAlert: !!i.is_high_alert,
          isCrashCart: !!i.is_crash_cart,
          defaultDoseQty: 1,
          wardStockCount: 0,
          searchAliases: [i.brand_name.toLowerCase()],
        })) as MasterMedication[];
        setDrugs(mappedCache);
        setTotalCount(cachedResponse.total);
        setTotalPages(cachedResponse.total_pages);
        setGroupStats(cachedResponse.group_stats);
        setHospitalStockDrugCount(cachedResponse.hospital_stock_drug_count);
        setCacheStatus('checking');
        setLoading(false);
      } else if (isManualSync) {
        setIsSyncing(true);
        setSyncNotice(null);
      } else setLoading(true);
      let loaded = false;
      try {
        const data = await getNationalDrugRegistryApi({
          search,
          group: selectedGroup,
          pharmGroup,
          page,
          pageSize: PAGE_SIZE,
          onlyInWarehouse,
        });
        if (data && Array.isArray(data.items)) {
          const mapped: MasterMedication[] = data.items.map((i: any) => ({
            ...i,
            id: i.id,
            nationalCode: i.national_code || i.nationalCode,
            brandName: i.brand_name || i.brandName,
            activeIngredient: i.active_ingredient || i.activeIngredient,
            dosageForm: i.dosage_form || i.dosageForm,
            standardUnit: i.standard_unit || i.standardUnit || 'Viên',
            group: i.group || 'Thuốc điều trị chuyên khoa',
            hospitalStockByUnit: (i.hospital_stock_by_unit || []).map((stock: any) => ({
              unit: stock.unit,
              quantity: stock.quantity,
              batchCount: stock.batch_count,
            })),
            hospitalStockCount: (i.hospital_stock_by_unit || []).reduce(
              (total: number, stock: { quantity: number; unit: string }) =>
                total +
                (stock.unit === (i.standard_unit || i.standardUnit || 'Viên') ? stock.quantity : 0),
              0,
            ),
            isControlled: !!(i.is_controlled ?? i.isControlled),
            isHighAlert: !!(i.is_high_alert ?? i.isHighAlert),
            isCrashCart: !!(i.is_crash_cart ?? i.isCrashCart),
            defaultDoseQty: 1,
            wardStockCount: 0,
            searchAliases: [((i.brand_name || i.brandName || '') as string).toLowerCase()],
            packagingSpec: i.packaging_spec || i.packagingSpec,
            standardPharmacopeia: i.standard_pharmacopeia || i.standardPharmacopeia,
            shelfLife: i.shelf_life || i.shelfLife,
            manufacturer: i.manufacturer,
            country: i.country,
            applicantName: i.applicant_name || i.applicantName,
            approvalDecision: i.approval_decision || i.approvalDecision,
            hdsdPath: i.hdsd_path || i.hdsdPath,
            labelPath: i.label_path || i.labelPath,
            atcCode: i.atc_code || i.atcCode,
            drugClass: i.drug_class || i.drugClass,
            clinicalSource: i.clinical_source || i.clinicalSource,
          }));
          setDrugs(mapped);
          setTotalCount(data.total ?? mapped.length);
          setTotalPages(data.total_pages || 1);
          setHospitalStockDrugCount(data.hospital_stock_drug_count ?? 0);
          if (data.group_stats) setGroupStats(data.group_stats);
          saveCachedRegistryPage(key, data);
          setCacheStatus(
            cached &&
              cached.response.inventory_revision === data.inventory_revision &&
              cached.response.registry_revision === data.registry_revision
              ? 'current'
              : cached
                ? 'updated'
                : 'none',
          );
          if (isManualSync) {
            setSyncNotice(`Đã cập nhật ${data.total.toLocaleString()} kết quả`);
            setTimeout(() => setSyncNotice(null), 3500);
          }
          loaded = true;
        }
      } catch {
        setCacheStatus('offline');
      }

      if (!loaded) {
        try {
          if (onlyInWarehouse)
            throw new Error('Warehouse inventory requires the authoritative database');
          const off = await queryOfflineRegistry(
            search,
            selectedGroup,
            pharmGroup,
            page,
            PAGE_SIZE,
          );
          setDrugs(off.items);
          setTotalCount(off.total);
          setTotalPages(off.totalPages);
          setGroupStats(off.groupStats);
          setHospitalStockDrugCount(0);
          setCacheStatus('static');
          if (isManualSync) {
            setSyncNotice(
              'Danh mục DAV bản chuẩn hóa đã được tải. API nghiệp vụ chưa cung cấp trạng thái tồn kho trực tiếp.',
            );
            setTimeout(() => setSyncNotice(null), 5000);
          }
        } catch {
          setDrugs([]);
          setTotalCount(0);
          setTotalPages(1);
          setHospitalStockDrugCount(0);
          setCacheStatus('offline');
          setSyncNotice('Không tải được danh mục thuốc. Kiểm tra kết nối hoặc thử lại.');
        }
      }
      setLoading(false);
      setIsSyncing(false);
    },
    [search, selectedGroup, pharmGroup, page, onlyInWarehouse],
  );

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, loadData]);

  const inWarehouseCount = hospitalStockDrugCount;
  const displayedDrugs = drugs;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tra cứu thuốc"
      className="clinical-modal-overlay fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-0 sm:p-6"
    >
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl border-0 sm:border border-slate-300 w-full sm:w-[96vw] max-w-6xl lg:max-w-7xl h-[100dvh] sm:h-[86vh] flex flex-col overflow-hidden animate-in fade-in duration-150">
        <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-950 text-lg sm:text-xl">Tra cứu thuốc</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              data-testid="btn-close-national-registry"
              aria-label="Đóng"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 shrink-0">
          <div className="workspace-toolbar">
            <SearchField
              value={searchInput}
              onChange={setSearchInput}
              label="Tìm trong danh mục thuốc"
              placeholder="Tên thuốc, hoạt chất, số đăng ký…"
            />
            <button
              type="button"
              className="button-secondary"
              aria-expanded={showFilters}
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal size={16} />
              Bộ lọc{selectedGroup !== 'all' || pharmGroup !== 'all' || onlyInWarehouse ? ' •' : ''}
            </button>
            <button
              type="button"
              className="icon-action"
              aria-label="Cập nhật danh mục"
              onClick={() => loadData(true)}
              disabled={isSyncing}
            >
              <RotateCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            </button>
            {showFilters && (
              <div className="workspace-filters">
                <label>
                  Phân nhóm
                  <select
                    className="workspace-select"
                    aria-label="Phân nhóm thuốc"
                    value={selectedGroup}
                    onChange={(e) => {
                      setSelectedGroup(e.target.value);
                      setPage(1);
                    }}
                  >
                    {REGISTRY_TABS.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nhóm dược lý
                  <select
                    className="workspace-select"
                    aria-label="Nhóm dược lý tra cứu"
                    data-testid="registry-pharm-select"
                    value={pharmGroup}
                    onChange={(e) => {
                      setPharmGroup(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="all">Tất cả nhóm dược lý</option>
                    {PHARMACOLOGICAL_GROUPS.map((g) => (
                      <option key={g.key} value={g.key}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="!flex-row items-center self-end min-h-10">
                  <input
                    type="checkbox"
                    checked={onlyInWarehouse}
                    onChange={(e) => {
                      setOnlyInWarehouse(e.target.checked);
                      setPage(1);
                    }}
                  />
                  Chỉ có trong kho bệnh viện ({inWarehouseCount})
                </label>
              </div>
            )}
          </div>
          {syncNotice && (
            <p role="status" className="record-sub mt-3">
              {syncNotice}
            </p>
          )}
          <p role="status" className="record-sub mt-3">
            {cacheStatus === 'static'
              ? 'Danh mục cục bộ · chưa đối chiếu tồn kho trực tiếp'
              : cacheStatus === 'offline'
                ? 'Mất kết nối · đang dùng dữ liệu đã lưu'
                : cacheStatus === 'checking'
                  ? 'Đang kiểm tra phiên bản dữ liệu'
                  : cacheStatus === 'updated' || cacheStatus === 'current'
                    ? 'Danh mục đã đối chiếu với máy chủ'
                    : 'Tra cứu thông tin thuốc · tồn kho được hiển thị khi có dữ liệu'}
          </p>
        </div>
        <div className="registry-results thin-scrollbar">
          {loading ? (
            <EmptyState title="Đang tải danh mục thuốc…" />
          ) : displayedDrugs.length === 0 ? (
            <EmptyState title="Không tìm thấy thuốc phù hợp" />
          ) : (
            <div className="registry-grid">
              {displayedDrugs.map((drug) => (
                <article className="registry-card" key={drug.id}>
                  <div className="flex justify-between gap-3">
                    <div>
                      <span className="record-sub record-mono">
                        {drug.nationalCode || 'Chưa có SĐK'}
                      </span>
                      <button
                        type="button"
                        className="record-link !mt-2"
                        onClick={() => setSelectedDrugForDav(drug)}
                      >
                        {drug.brandName}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="icon-action shrink-0"
                      aria-label={`Xem ${drug.brandName}`}
                      onClick={() => setSelectedDrugForDav(drug)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <p className="record-sub mt-3">
                    {drug.activeIngredient}
                    {drug.concentration &&
                    drug.concentration.trim() !== drug.activeIngredient?.trim()
                      ? ` · ${drug.concentration}`
                      : ''}
                  </p>
                  <p className="record-sub">{drug.dosageForm || 'Chưa có dạng bào chế'}</p>
                  {!!drug.hospitalStockByUnit?.length && (
                    <p className="registry-stock">
                      Kho BV:{' '}
                      {drug.hospitalStockByUnit
                        .map((stock) => `${stock.quantity.toLocaleString('vi-VN')} ${stock.unit}`)
                        .join(' · ')}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-3 text-sm shrink-0">
          <div className="text-slate-500">
            <span className="font-medium text-slate-900">{totalCount.toLocaleString('vi-VN')}</span>{' '}
            kết quả
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-slate-50 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-700">
              Trang <span className="font-bold text-slate-900">{page}</span> / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-30 cursor-pointer hover:bg-slate-50 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <DavDrugDetailModal
        isOpen={!!selectedDrugForDav}
        onClose={() => setSelectedDrugForDav(null)}
        drug={selectedDrugForDav}
      />
    </div>
  );
};
