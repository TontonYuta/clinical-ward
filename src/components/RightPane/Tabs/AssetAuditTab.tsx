/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Kiểm Kê Tài Sản Máy Móc Thiết Bị NĐ 151/2017 & NĐ 114/2024 (<=200 LOC)
 */

import React, { useState } from 'react';
import { AssetAuditRecord, UserRole } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import { AssetAuditHeaderRibbon } from './AssetAudit/AssetAuditHeaderRibbon';
import { AssetAuditLegalBanner } from './AssetAudit/AssetAuditLegalBanner';
import { AssetAuditCard } from './AssetAudit/AssetAuditCard';
import { AssetAuditRow } from './AssetAudit/AssetAuditRow';

interface AssetAuditTabProps {
  assets: AssetAuditRecord[];
  onConfirmTransfer: (id: string, newDept: string) => void;
  onRequestLiquidation: (id: string, reason: string) => void;
  onSimulateQrScan: () => void;
  onOpenPrintForm?: (formType: PrintableFormType, asset?: AssetAuditRecord) => void;
  isAudioMuted: boolean;
  currentUserRole?: UserRole;
}

export const AssetAuditTab: React.FC<AssetAuditTabProps> = ({
  assets,
  onConfirmTransfer,
  onRequestLiquidation,
  onSimulateQrScan,
  onOpenPrintForm,
  isAudioMuted,
  currentUserRole = 'biomedical_engineer',
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'misallocated' | 'liquidation'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const misallocatedAssets = assets.filter((a) => a.isMisallocated);
  const liquidationAssets = assets.filter((a) => a.pendingLiquidation);

  const filteredAssets = assets.filter((item) => {
    let matchesMode = true;
    if (filterMode === 'misallocated') matchesMode = item.isMisallocated;
    if (filterMode === 'liquidation') matchesMode = item.pendingLiquidation;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery.trim() ||
      item.deviceName.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.serialNumber.toLowerCase().includes(q) ||
      item.registeredDepartment.toLowerCase().includes(q) ||
      item.actualDepartment.toLowerCase().includes(q);
    return matchesMode && matchesSearch;
  });

  const handleTransfer = (id: string, dept: string) => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onConfirmTransfer(id, dept);
  };

  const handleLiquidation = (id: string) => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onRequestLiquidation(id, 'Hỏng nát ngưng dùng trên 12 tháng, chi phí sửa vượt giá trị còn lại');
  };

  const handleScanClick = () => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onSimulateQrScan();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2.5 w-full">
      {/* 1. Command Ribbon */}
      <AssetAuditHeaderRibbon
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
        totalCount={assets.length}
        misallocatedCount={misallocatedAssets.length}
        liquidationCount={liquidationAssets.length}
        onOpenPrintForm={onOpenPrintForm}
        onScanClick={handleScanClick}
      />

      {/* 2. Legal Framework Banner */}
      <AssetAuditLegalBanner />

      {/* 3A. Mobile Card-Based List */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5 pb-8">
        {filteredAssets.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-sm shadow-2xs">
            Không tìm thấy tài sản thiết bị nào phù hợp với bộ lọc.
          </div>
        ) : (
          filteredAssets.map((asset) => (
            <AssetAuditCard
              key={asset.id}
              asset={asset}
              onOpenPrintForm={onOpenPrintForm}
              onTransfer={handleTransfer}
              onLiquidation={handleLiquidation}
            />
          ))
        )}
      </div>

      {/* 3B. Desktop Table */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden flex-col shadow-xs">
        <div className="flex-1 min-h-0 overflow-auto pb-24">
          <table className="w-full text-left text-sm min-w-[720px] border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr className="font-semibold text-xs tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap border-r border-slate-200">Mã tài sản</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Thiết bị &amp; cấp rủi ro</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Đối soát vị trí (sổ sách ➔ thực tế)</th>
                <th className="py-3 px-3.5 whitespace-nowrap border-r border-slate-200">Hao mòn &amp; hiện trạng</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <AssetAuditRow
                  key={asset.id}
                  asset={asset}
                  currentUserRole={currentUserRole}
                  onOpenPrintForm={onOpenPrintForm}
                  onTransfer={handleTransfer}
                  onLiquidation={handleLiquidation}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
