/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Dược Bệnh Viện: Quản lý Kho Dược Nội Trú, Ngoại Trú & Vật tư y tế (FEFO)
 */

import React, { useState, useMemo } from 'react';
import { InventoryBatch } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { RestockProposalModal } from '../../Modals/RestockProposalModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import {
  PharmacyHeaderRibbon,
  WarehouseFilter,
  CommodityFilter,
  StatusFilter,
} from './Pharmacy/PharmacyHeaderRibbon';
import { PharmacyLegalBanner } from './Pharmacy/PharmacyLegalBanner';
import { PharmacyBatchRow } from './Pharmacy/PharmacyBatchRow';
import { PharmacyBatchCard } from './Pharmacy/PharmacyBatchCard';

interface FefoInventoryTabProps {
  batches: InventoryBatch[];
  onDispatchBatch: (batchId: string, quantity: number) => void;
  onRestockBatches?: (batchIds: string[]) => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
}

export const FefoInventoryTab: React.FC<FefoInventoryTabProps> = ({
  batches,
  onDispatchBatch,
  onRestockBatches,
  onOpenPrintForm,
  isAudioMuted,
}) => {
  const [warehouse, setWarehouse] = useState<WarehouseFilter>('all');
  const [commodity, setCommodity] = useState<CommodityFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);

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
      const isSupply =
        batch.commodityType === 'medical_supply' ||
        batch.category === 'Vật tư tiêu hao' ||
        batch.category === 'Chỉ phẫu thuật & Khâu';

      if (commodity === 'medication' && isSupply) return false;
      if (commodity === 'medical_supply' && !isSupply) return false;

      // 3. Trạng thái FEFO / Mức Min
      if (status === 'near_expiry' && !batch.isNearExpiry) return false;
      if (status === 'low_stock' && !(batch.isLowStock || batch.currentStock <= batch.minThreshold)) return false;

      // 4. Tìm kiếm từ khóa
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          batch.itemName.toLowerCase().includes(q) ||
          batch.batchNumber.toLowerCase().includes(q) ||
          batch.warehouseLocation.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [batches, warehouse, commodity, status, searchQuery]);

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
        warehouse={warehouse}
        setWarehouse={setWarehouse}
        commodity={commodity}
        setCommodity={setCommodity}
        status={status}
        setStatus={setStatus}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        totalCount={batches.length}
        nearExpiryCount={nearExpiryBatches.length}
        lowStockCount={lowStockBatches.length}
        onOpenPrintForm={onOpenPrintForm}
        onOpenRestock={() => setIsRestockModalOpen(true)}
      />

      <PharmacyLegalBanner warehouse={warehouse} />

      {/* Mobile View */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5 pb-8">
        {filteredBatches.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-sm shadow-2xs">
            Không tìm thấy mặt hàng nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          filteredBatches.map((batch) => (
            <PharmacyBatchCard
              key={batch.id}
              batch={batch}
              onQuickDispatch={handleQuickDispatch}
              onOpenRestock={() => setIsRestockModalOpen(true)}
            />
          ))
        )}
      </div>

      {/* Desktop View */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden flex-col shadow-xs">
        <div className="overflow-auto flex-1 pb-4">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr className="font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-3">Mặt hàng y tế</th>
                <th className="py-3 px-3 whitespace-nowrap">Số lô sản xuất</th>
                <th className="py-3 px-3 whitespace-nowrap">Hạn dùng (EXP)</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Tồn kho / Định mức</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Trạng thái</th>
                <th className="py-3 px-3 whitespace-nowrap">Vị trí kho GSP</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch) => (
                <PharmacyBatchRow
                  key={batch.id}
                  batch={batch}
                  onQuickDispatch={handleQuickDispatch}
                  onOpenRestock={() => setIsRestockModalOpen(true)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <RestockProposalModal
        isOpen={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        lowStockBatches={lowStockBatches}
        onConfirmRestock={(ids) => onRestockBatches?.(ids)}
        onOpenPrintForm={onOpenPrintForm}
        isAudioMuted={isAudioMuted}
      />
    </div>
  );
};
