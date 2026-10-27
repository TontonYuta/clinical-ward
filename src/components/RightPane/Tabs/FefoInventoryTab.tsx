/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Quản Lý Kho Dược Bệnh Viện & Công Bố Dược Phẩm (FEFO) (<=200 LOC)
 */

import React, { useState, useMemo } from 'react';
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
  const [warehouse, setWarehouse] = useState<WarehouseFilter>('all');
  const [commodity, setCommodity] = useState<CommodityFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [pharmGroup, setPharmGroup] = useState<PharmacologicalGroupKey>('all');
  const [davFilter, setDavFilter] = useState<DavRegulatoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isRegistryModalOpen, setIsRegistryModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      // 1. Phân loại Kho
      if (warehouse === 'inpatient') {
        const isIp = batch.warehouseType === 'inpatient_central' || batch.warehouseType === 'ward_emergency';
        if (!isIp && batch.warehouseType) return false;
      } else if (warehouse === 'outpatient') {
        if (batch.warehouseType !== 'outpatient_pharmacy') return false;
      }

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
  }, [batches, warehouse, commodity, status, pharmGroup, davFilter, searchQuery]);

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
    <div className="flex flex-col h-full overflow-hidden space-y-2.5 w-full">
      <PharmacyHeaderRibbon
        warehouse={warehouse} setWarehouse={setWarehouse}
        commodity={commodity} setCommodity={setCommodity}
        status={status} setStatus={setStatus}
        pharmacologicalGroup={pharmGroup} setPharmacologicalGroup={setPharmGroup}
        davFilter={davFilter} setDavFilter={setDavFilter}
        searchQuery={searchQuery} setSearchQuery={setSearchQuery}
        totalCount={batches.length} nearExpiryCount={nearExpiryBatches.length} lowStockCount={lowStockBatches.length}
        onOpenPrintForm={onOpenPrintForm} onOpenRestock={() => setIsRestockModalOpen(true)}
        onOpenNationalRegistry={() => setIsRegistryModalOpen(true)}
        onOpenSafetyGuide={onOpenSafetyGuide}
      />

      {/* Mobile View: Danh sách phẳng hành chính */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-2.5 pr-0.5 pb-8">
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
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden flex-col shadow-2xs">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-slate-700">
              <tr className="font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3 text-center w-12">STT</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Số Đăng Ký (SĐK)</th>
                <th className="py-2.5 px-3 min-w-[200px]">Tên Thuốc & Hoạt Chất</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Dạng Bào Chế & Quy Cách</th>
                <th className="py-2.5 px-3 min-w-[140px]">Cơ Sở Sản Xuất</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Số Lô &amp; Hạn dùng</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap">Tồn Kho BV</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
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
        onSelectMedication={onOpenSafetyGuide} inventoryBatches={batches}
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
