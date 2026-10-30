/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Quản Lý Kho Dược Bệnh Viện & Công Bố Dược Phẩm (FEFO) (<=200 LOC)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { InventoryBatch } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { RestockProposalModal } from '../../Modals/RestockProposalModal';
import { NationalDrugRegistryModal } from '../../Modals/NationalDrugRegistryModal';
import { DavDrugDetailModal } from '../../Modals/DavDrugDetailModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import {
  PharmacyHeaderRibbon,
  WarehouseFilter,
  CommodityFilter,
  StatusFilter,
  DavRegulatoryFilter,
} from './Pharmacy/PharmacyHeaderRibbon';
import { PharmacyBatchRow } from './Pharmacy/PharmacyBatchRow';
import { PharmacyBatchCard } from './Pharmacy/PharmacyBatchCard';
import { resolvePharmacologicalGroup, PharmacologicalGroupKey } from '../../../utils/clinical/pharmacologicalClassification';

interface FefoInventoryTabProps {
  batches: InventoryBatch[];
  onDispatchBatch: (batchId: string, quantity: number) => void;
  onRestockBatches?: (batchIds: string[]) => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
  onOpenSafetyGuide?: (medName: string) => void;
}

export const FefoInventoryTab: React.FC<FefoInventoryTabProps> = ({
  batches, onDispatchBatch, onRestockBatches, onOpenPrintForm, isAudioMuted, onOpenSafetyGuide,
}) => {
  const [warehouse, setWarehouse] = useState<WarehouseFilter>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('fefo_warehouse') as WarehouseFilter) || 'all' : 'all'));
  const [commodity, setCommodity] = useState<CommodityFilter>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('fefo_commodity') as CommodityFilter) || 'all' : 'all'));
  const [status, setStatus] = useState<StatusFilter>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('fefo_status') as StatusFilter) || 'all' : 'all'));
  const [pharmGroup, setPharmGroup] = useState<PharmacologicalGroupKey>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('fefo_pharm_group') as PharmacologicalGroupKey) || 'all' : 'all'));
  const [davFilter, setDavFilter] = useState<DavRegulatoryFilter>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('fefo_dav_filter') as DavRegulatoryFilter) || 'all' : 'all'));
  const [location, setLocation] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('fefo_location') || 'all' : 'all'));
  const locations = useMemo(() => [...new Set(batches.map((b) => b.warehouseLocation.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi')), [batches]);
  const [searchQuery, setSearchQuery] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('fefo_search') || '' : ''));
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isRegistryModalOpen, setIsRegistryModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('fefo_warehouse', warehouse);
      sessionStorage.setItem('fefo_commodity', commodity);
      sessionStorage.setItem('fefo_status', status);
      sessionStorage.setItem('fefo_pharm_group', pharmGroup);
      sessionStorage.setItem('fefo_dav_filter', davFilter);
      sessionStorage.setItem('fefo_search', searchQuery);
      sessionStorage.setItem('fefo_location', location);
    } catch {}
  }, [warehouse, commodity, status, pharmGroup, davFilter, searchQuery, location]);

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      // 1. Phân loại Kho
      if (warehouse === 'inpatient') {
        const isIp = batch.warehouseType === 'inpatient_central' || batch.warehouseType === 'ward_emergency';
        if (!isIp && batch.warehouseType) return false;
      } else if (warehouse === 'outpatient') {
        if (batch.warehouseType !== 'outpatient_pharmacy') return false;
      }

      if (location !== 'all' && batch.warehouseLocation.trim() !== location) return false;

      // 2. Bóc tách Thuốc vs Vật tư y tế
      const isSupply = batch.commodityType === 'medical_supply' || batch.category === 'Vật tư tiêu hao' || batch.category === 'Chỉ phẫu thuật & Khâu';
      if (commodity === 'medication' && isSupply) return false;
      if (commodity === 'medical_supply' && !isSupply) return false;

      // 3. Trạng thái FEFO / Mức Min
      if (status === 'near_expiry' && !batch.isNearExpiry) return false;
      if (status === 'low_stock' && !(batch.isLowStock || batch.currentStock <= batch.minThreshold)) return false;

      // 4. Phân nhóm tác dụng dược lý lâm sàng (ATC WHO & DTQG)
      if (pharmGroup !== 'all') {
        const grp = resolvePharmacologicalGroup(
          batch.atcCode,
          `${batch.itemName} ${batch.activeIngredient}`,
          batch.pharmacologicalClass || batch.category
        );
        if (grp.key !== pharmGroup) return false;
      }

      // 5. Phân loại theo Quy chế Cổng Dược Quốc Gia (DAV BYT)
      if (davFilter === 'controlled' && !batch.isControlledSubstance) return false;
      if (davFilter === 'emergency' && batch.warehouseType !== 'ward_emergency' && !batch.category.includes('cấp cứu')) return false;
      if (davFilter === 'cold_chain' && !batch.category.includes('Chuỗi lạnh') && !batch.storageCondition?.includes('2°C')) return false;
      if (davFilter === 'high_alert' && !batch.category.includes('nguy cơ cao')) return false;
      if (davFilter === 'iv_fluid' && !batch.category.includes('Dịch truyền')) return false;

      // 6. Tìm kiếm từ khóa hành chính
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          batch.itemName.toLowerCase().includes(q) ||
          batch.batchNumber.toLowerCase().includes(q) ||
          batch.warehouseLocation.toLowerCase().includes(q) ||
          (batch.registrationNumber && batch.registrationNumber.toLowerCase().includes(q)) ||
          (batch.nationalCode && batch.nationalCode.toLowerCase().includes(q)) ||
          (batch.activeIngredient && batch.activeIngredient.toLowerCase().includes(q)) ||
          (batch.manufacturer && batch.manufacturer.toLowerCase().includes(q)) ||
          (batch.dosageForm && batch.dosageForm.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [batches, warehouse, location, commodity, status, pharmGroup, davFilter, searchQuery]);

  const nearExpiryBatches = useMemo(() => batches.filter((b) => b.isNearExpiry), [batches]);
  const lowStockBatches = useMemo(
    () => batches.filter((b) => b.isLowStock || b.currentStock <= b.minThreshold),
    [batches]
  );

  const handleQuickDispatch = (batch: InventoryBatch) => {
    const dispatchQty = Math.min(10, batch.currentStock);
    if (dispatchQty <= 0) return;
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onDispatchBatch(batch.id, dispatchQty);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden gap-1.5 w-full">
      <PharmacyHeaderRibbon
        warehouse={warehouse} setWarehouse={setWarehouse}
        commodity={commodity} setCommodity={setCommodity}
        status={status} setStatus={setStatus}
        pharmacologicalGroup={pharmGroup} setPharmacologicalGroup={setPharmGroup}
        davFilter={davFilter} setDavFilter={setDavFilter}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        nearExpiryCount={nearExpiryBatches.length} locations={locations} location={location} setLocation={setLocation}
        onOpenNationalRegistry={() => setIsRegistryModalOpen(true)}
      />

      {/* Mobile View: Danh sách phẳng hành chính */}
      <div className="md:hidden flex-1 overflow-y-auto px-1 pb-8">
        {filteredBatches.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
            Không tìm thấy thuốc hoặc vật tư y tế phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredBatches.map((batch, idx) => (
            <PharmacyBatchCard
              key={batch.id} index={idx} batch={batch}
              onQuickDispatch={handleQuickDispatch} onOpenRestock={() => setIsRestockModalOpen(true)}
              onOpenSafetyGuide={onOpenSafetyGuide} onSelectBatch={(b) => setSelectedBatch(b)}
            />
          ))
        )}
      </div>

      {/* Desktop View: Bảng công bố dược phẩm hành chính (Chuẩn DAV dichvucong.dav.gov.vn) */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white border-y border-slate-200 overflow-hidden flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 w-full">
          <table className="w-full min-w-[900px] table-fixed text-left text-sm border-collapse">
            <colgroup><col className="w-10" /><col className="w-32" /><col className="w-[30%]" /><col className="w-[14%]" /><col className="w-40" /><col className="w-32" /><col className="w-36" /></colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr className="font-semibold text-sm tracking-normal">
                <th className="py-2 px-2.5 text-center border-r border-slate-200">STT</th>
                <th className="py-2 px-2.5 border-r border-slate-200">SĐK</th>
                <th className="py-2 px-2.5 border-r border-slate-200">Tên thuốc &amp; hoạt chất</th>
                <th className="py-2 px-2.5 border-r border-slate-200">Dạng bào chế</th>
                <th className="py-2 px-2.5 border-r border-slate-200">Số lô &amp; hạn dùng</th>
                <th className="py-2 px-2.5 text-center border-r border-slate-200">Tồn kho</th>
                <th className="py-2 px-2.5 border-r border-slate-200">Vị trí</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-medium text-sm">
                    Không tìm thấy thuốc khớp với tiêu chí tra cứu.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch, idx) => (
                  <PharmacyBatchRow
                    key={batch.id} index={idx} batch={batch}
                    onQuickDispatch={handleQuickDispatch} onOpenRestock={() => setIsRestockModalOpen(true)}
                    onOpenSafetyGuide={onOpenSafetyGuide} onSelectBatch={(b) => setSelectedBatch(b)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RestockProposalModal
        isOpen={isRestockModalOpen} onClose={() => setIsRestockModalOpen(false)}
        lowStockBatches={lowStockBatches} onConfirmRestock={(ids) => onRestockBatches?.(ids)}
        onOpenPrintForm={onOpenPrintForm} isAudioMuted={isAudioMuted}
      />
      <NationalDrugRegistryModal
        isOpen={isRegistryModalOpen} onClose={() => setIsRegistryModalOpen(false)}
        onSelectMedication={onOpenSafetyGuide}
      />
      {selectedBatch && (
        <DavDrugDetailModal
          isOpen={selectedBatch !== null}
          onClose={() => setSelectedBatch(null)}
          batch={selectedBatch}
          onQuickDispatch={handleQuickDispatch}
        />
      )}
    </div>
  );
};
