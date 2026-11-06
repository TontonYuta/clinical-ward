/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Quản Lý Kho Dược Bệnh Viện & Công Bố Dược Phẩm (FEFO) (<=200 LOC)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { InventoryBatch, UserRole } from '../../../types/clinical';
import { expiryState } from '../../ui/workspaceStatus';
import { EmptyState } from '../../ui/Workspace';
import { BatchDispatchModal } from '../../Modals/BatchDispatchModal';
import { dispatchHoldReason } from './Pharmacy/dispatchModel';
import { RestockProposalModal } from '../../Modals/RestockProposalModal';
import { NationalDrugRegistryModal } from '../../Modals/NationalDrugRegistryModal';
import { DavDrugDetailModal } from '../../Modals/DavDrugDetailModal';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import {
  PharmacyHeaderRibbon,
  WarehouseFilter,
  StatusFilter,
} from './Pharmacy/PharmacyHeaderRibbon';
import { PharmacyBatchRow } from './Pharmacy/PharmacyBatchRow';
import { PharmacyBatchCard } from './Pharmacy/PharmacyBatchCard';
import {
  resolvePharmacologicalGroup,
  PharmacologicalGroupKey,
} from '../../../utils/clinical/pharmacologicalClassification';

interface FefoInventoryTabProps {
  currentUserRole?: UserRole;
  operatorName?: string;
  batches: InventoryBatch[];
  onDispatchBatch: (batchId: string, quantity: number) => void;
  onRestockBatches?: (batchIds: string[]) => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
  onOpenSafetyGuide?: (medName: string) => void;
}

export const FefoInventoryTab: React.FC<FefoInventoryTabProps> = ({
  currentUserRole = 'nurse',
  operatorName,
  batches,
  onDispatchBatch,
  onRestockBatches,
  onOpenPrintForm,
  isAudioMuted,
  onOpenSafetyGuide,
}) => {
  const [warehouse, setWarehouse] = useState<WarehouseFilter>(() =>
    typeof window !== 'undefined'
      ? (sessionStorage.getItem('fefo_warehouse') as WarehouseFilter) || 'all'
      : 'all',
  );
  const [status, setStatus] = useState<StatusFilter>(() =>
    typeof window !== 'undefined'
      ? (sessionStorage.getItem('fefo_status') as StatusFilter) || 'all'
      : 'all',
  );
  const [pharmGroup, setPharmGroup] = useState<PharmacologicalGroupKey>(() =>
    typeof window !== 'undefined'
      ? (sessionStorage.getItem('fefo_pharm_group') as PharmacologicalGroupKey) || 'all'
      : 'all',
  );
  const [location, setLocation] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('fefo_location') || 'all' : 'all',
  );
  const locations = useMemo(
    () =>
      [...new Set(batches.map((b) => b.warehouseLocation.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      ),
    [batches],
  );
  const [searchQuery, setSearchQuery] = useState(() =>
    typeof window !== 'undefined' ? sessionStorage.getItem('fefo_search') || '' : '',
  );
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isRegistryModalOpen, setIsRegistryModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<InventoryBatch | null>(null);
  const [dispatchBatchId, setDispatchBatchId] = useState<string | null>(null);
  const dispatchBatch = batches.find(batch => batch.id === dispatchBatchId);
  const canManageInventory = currentUserRole === 'pharmacist' || currentUserRole === 'director';
  useEffect(() => { if (!canManageInventory) { setDispatchBatchId(null); setIsRestockModalOpen(false); } }, [canManageInventory]);

  useEffect(() => {
    try {
      sessionStorage.setItem('fefo_warehouse', warehouse);
      sessionStorage.setItem('fefo_status', status);
      sessionStorage.setItem('fefo_pharm_group', pharmGroup);
      sessionStorage.setItem('fefo_search', searchQuery);
      sessionStorage.setItem('fefo_location', location);
    } catch {}
  }, [warehouse, status, pharmGroup, searchQuery, location]);

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      // 1. Phân loại Kho
      if (warehouse === 'inpatient') {
        const isIp =
          batch.warehouseType === 'inpatient_central' || batch.warehouseType === 'ward_emergency';
        if (!isIp && batch.warehouseType) return false;
      } else if (warehouse === 'outpatient') {
        if (batch.warehouseType !== 'outpatient_pharmacy') return false;
      }

      if (location !== 'all' && batch.warehouseLocation.trim() !== location) return false;

      // 2. Trạng thái FEFO / Mức Min
      if (status === 'expired' && expiryState(batch.expiryDate) !== 'expired') return false;
      if (status === 'near_expiry' && expiryState(batch.expiryDate) !== 'near') return false;
      if (status === 'low_stock' && !(batch.isLowStock || batch.currentStock <= batch.minThreshold))
        return false;

      // 3. Phân nhóm tác dụng dược lý lâm sàng (ATC WHO & DTQG)
      if (pharmGroup !== 'all') {
        const grp = resolvePharmacologicalGroup(
          batch.atcCode,
          `${batch.itemName} ${batch.activeIngredient}`,
          batch.pharmacologicalClass || batch.category,
        );
        if (grp.key !== pharmGroup) return false;
      }

      // 4. Tìm kiếm từ khóa hành chính
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
  }, [batches, warehouse, location, status, pharmGroup, searchQuery]);

  const nearExpiryBatches = useMemo(
    () => batches.filter((b) => expiryState(b.expiryDate) === 'near'),
    [batches],
  );
  const lowStockBatches = useMemo(
    () => batches.filter((b) => b.isLowStock || b.currentStock <= b.minThreshold),
    [batches],
  );

  const handleQuickDispatch = (batch: InventoryBatch) => {
    if (canManageInventory && !dispatchHoldReason(batch)) setDispatchBatchId(batch.id);
  };

  return (
    <div className="workspace-page">
      <PharmacyHeaderRibbon
        warehouse={warehouse}
        setWarehouse={setWarehouse}
        status={status}
        setStatus={setStatus}
        pharmacologicalGroup={pharmGroup}
        setPharmacologicalGroup={setPharmGroup}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        nearExpiryCount={nearExpiryBatches.length}
        locations={locations}
        location={location}
        setLocation={setLocation}
        onOpenNationalRegistry={() => setIsRegistryModalOpen(true)}
        onOpenRestock={canManageInventory && onRestockBatches ? () => setIsRestockModalOpen(true) : undefined}
      />

      <div className="mobile-records">
        {filteredBatches.length ? (
          filteredBatches.map((batch, index) => (
            <PharmacyBatchCard
              key={batch.id}
              index={index}
              batch={batch}
              onSelectBatch={setSelectedBatch}
              onQuickDispatch={canManageInventory ? handleQuickDispatch : undefined}
            />
          ))
        ) : (
          <EmptyState title="Không tìm thấy lô thuốc" />
        )}
      </div>
      <div className="workspace-list desktop-records">
        <div className="list-caption">
          <strong>
            Danh mục lô thuốc <span className="record-mono">/ {filteredBatches.length}</span>
          </strong>
          <span>Mở tên thuốc để xem hồ sơ đầy đủ</span>
        </div>
        <div className="workspace-table-scroll">
          <table className="workspace-table">
            <colgroup>
              <col style={{ width: '26%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '22%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Thuốc & hàm lượng</th>
                <th>Lô / Hạn dùng</th>
                <th>Tồn kho</th>
                <th>Vị trí</th>
                <th>Chú ý</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch, index) => (
                <PharmacyBatchRow
                  key={batch.id}
                  index={index}
                  batch={batch}
                  onSelectBatch={setSelectedBatch}
                  onQuickDispatch={canManageInventory ? handleQuickDispatch : undefined}
                />
              ))}
            </tbody>
          </table>
          {filteredBatches.length === 0 && (
            <EmptyState
              title="Không tìm thấy lô thuốc"
              description="Thử từ khóa khác hoặc đặt lại bộ lọc."
            />
          )}
        </div>
      </div>

      <RestockProposalModal
        isOpen={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        lowStockBatches={lowStockBatches}
        onConfirmRestock={(ids) => onRestockBatches?.(ids)}
        operatorName={operatorName}
        onOpenPrintForm={onOpenPrintForm}
        isAudioMuted={isAudioMuted}
      />
      <NationalDrugRegistryModal
        isOpen={isRegistryModalOpen}
        onClose={() => setIsRegistryModalOpen(false)}
        onSelectMedication={onOpenSafetyGuide}
      />
      {selectedBatch && (
        <DavDrugDetailModal
          isOpen={selectedBatch !== null}
          onClose={() => setSelectedBatch(null)}
          batch={selectedBatch}
        />
      )}
      {canManageInventory && dispatchBatch && <BatchDispatchModal key={dispatchBatch.id} batch={dispatchBatch} onClose={() => setDispatchBatchId(null)} onContinue={onDispatchBatch} />}
    </div>
  );
};
