/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useLayoutEffect } from 'react';
import { MedicalFormsWorkspace } from './PrintableForms/MedicalFormsWorkspace';
import { FORM_PRESENTATION } from './PrintableForms/formModel';
import {
  DebtRecord,
  EquipmentTicket,
  InventoryBatch,
  AssetAuditRecord,
  ColdChainMonitorState,
  UserRole,
} from '../../types/clinical';
import { FormDocument } from './PrintableForms/FormDocument';
import { isReturnedControlledDebt, lowStockBatches as selectLowStock } from './PrintableForms/documentParts';

export type PrintableFormType =
  | 'TT20_AMPOULE_DESTRUCTION'
  | 'TT22_RESTOCK_PROPOSAL'
  | 'TSC_HANDOVER_TRANSFER'
  | 'EMERGENCY_BORROW_TICKET'
  | 'EQUIPMENT_HANDOVER_INSPECT'
  | 'TSC_ANNUAL_AUDIT'
  | 'COLD_CHAIN_INCIDENT_REPORT'
  | 'SHIFT_HANDOVER_RECORD';

export const ALL_PRINTABLE_FORMS: { id: PrintableFormType; shortLabel: string; codeLabel: string }[] = [
  { id: 'TT20_AMPOULE_DESTRUCTION', shortLabel: 'Đối chiếu và đề nghị hủy vỏ thuốc', codeLabel: '1. Vỏ thuốc' },
  { id: 'TT22_RESTOCK_PROPOSAL', shortLabel: 'Đề nghị bổ sung thuốc / vật tư', codeLabel: '2. Dự trù' },
  { id: 'TSC_HANDOVER_TRANSFER', shortLabel: 'Dự thảo bàn giao tài sản', codeLabel: '3. Bàn giao tài sản' },
  { id: 'EMERGENCY_BORROW_TICKET', shortLabel: 'Dự thảo phiếu mượn khẩn', codeLabel: '4. Phiếu mượn' },
  { id: 'EQUIPMENT_HANDOVER_INSPECT', shortLabel: 'Ghi nhận kiểm tra thiết bị', codeLabel: '5. Kiểm tra thiết bị' },
  { id: 'TSC_ANNUAL_AUDIT', shortLabel: 'Dự thảo đối chiếu tài sản', codeLabel: '6. Kiểm kê tài sản' },
  { id: 'COLD_CHAIN_INCIDENT_REPORT', shortLabel: 'Ghi nhận sự cố bảo quản lạnh', codeLabel: '7. Chuỗi lạnh' },
  { id: 'SHIFT_HANDOVER_RECORD', shortLabel: 'Dự thảo bàn giao ca trực', codeLabel: '8. Bàn giao ca' },
];

interface PrintableFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormType?: PrintableFormType;
  selectedDebtRecord?: DebtRecord | null;
  selectedEquipmentTicket?: EquipmentTicket | null;
  selectedAssetRecord?: AssetAuditRecord | null;
  debts: DebtRecord[];
  tickets: EquipmentTicket[];
  batches: InventoryBatch[];
  assets: AssetAuditRecord[];
  coldChainState?: ColdChainMonitorState;
  currentUserRole: UserRole;
}

export const PrintableFormModal: React.FC<PrintableFormModalProps> = ({
  isOpen,
  onClose,
  initialFormType = 'TT20_AMPOULE_DESTRUCTION',
  selectedDebtRecord,
  selectedEquipmentTicket,
  selectedAssetRecord,
  debts,
  tickets,
  batches,
  assets,
  coldChainState,
  currentUserRole,
}) => {
  const [activeFormType, setActiveFormType] = useState<PrintableFormType>(initialFormType);
  const [activeDebtId, setActiveDebtId] = useState<string>(selectedDebtRecord?.id || '');
  const [activeTicketId, setActiveTicketId] = useState<string>(selectedEquipmentTicket?.id || '');
  const [activeAssetId, setActiveAssetId] = useState<string>(selectedAssetRecord?.id || '');

  useLayoutEffect(() => {
    if (!isOpen) return;
    setActiveFormType(initialFormType);
    setActiveDebtId(selectedDebtRecord?.id || '');
    setActiveTicketId(selectedEquipmentTicket?.id || '');
    setActiveAssetId(selectedAssetRecord?.id || '');
  }, [isOpen, initialFormType, selectedDebtRecord?.id, selectedEquipmentTicket?.id, selectedAssetRecord?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Current selections
  const currentDebt = debts.find((d) => d.id === activeDebtId);
  const currentTicket = tickets.find((t) => t.id === activeTicketId);
  const currentAsset = assets.find((a) => a.id === activeAssetId);

  // Narcotic debts for destruction form
  const narcoticDebts = debts.filter(isReturnedControlledDebt);

  // Low stock batches for restock proposal
  const lowStockBatches = selectLowStock(batches);

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Download raw document
  const handleDownloadHtml = () => {
    const docEl = document.getElementById('printable-medical-document');
    if (!docEl) return;
    const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Du_Thao_${activeFormType}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Times New Roman', Times, serif; font-size: 11.5px; line-height: 1.35; }
    #printable-medical-document { width: 100%; max-width: 100%; margin: 0 auto; padding: 0; box-sizing: border-box; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #000; padding: 4px 6px; font-size: 11px; vertical-align: middle; }
    th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: bold; }
    .italic { font-style: italic; }
    .uppercase { text-transform: uppercase; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; border: none; }
    .header-table td { border: none; padding: 1px 2px; vertical-align: top; }
    .sig-table { width: 100%; border-collapse: collapse; margin-top: 14px; border: none; page-break-inside: avoid; }
    .sig-table td { border: none; vertical-align: top; text-align: center; font-size: 11px; }
    .page-break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
  </style>
</head>
<body>
  <div id="printable-medical-document">
    ${docEl.innerHTML}
  </div>
</body>
</html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Du_Thao_${activeFormType}_${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sourceKind = FORM_PRESENTATION[activeFormType].source;
  const sourceReady =
    sourceKind === 'aggregate' ||
    Boolean(
      sourceKind === 'debt' ? currentDebt : sourceKind === 'ticket' ? currentTicket : currentAsset,
    );
  const sourcePicker =
    sourceKind === 'debt' ? (
      <label className="forms-source-picker">
        Hồ sơ xuất mượn
        <select
          aria-label="Hồ sơ xuất mượn"
          value={activeDebtId}
          onChange={(e) => setActiveDebtId(e.target.value)}
        >
          <option value="">Chọn phiếu xuất mượn…</option>
          {debts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code} · {d.patientName} · {d.itemName} ({d.quantity}) · {d.patientRoom}
            </option>
          ))}
        </select>
      </label>
    ) : sourceKind === 'ticket' ? (
      <label className="forms-source-picker">
        Hồ sơ sự cố / thiết bị
        <select
          aria-label="Hồ sơ sự cố hoặc thiết bị"
          value={activeTicketId}
          onChange={(e) => setActiveTicketId(e.target.value)}
        >
          <option value="">Chọn phiếu thiết bị…</option>
          {tickets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} · {t.deviceName} · Serial: {t.serialNumber} · {t.location}
            </option>
          ))}
        </select>
      </label>
    ) : sourceKind === 'asset' ? (
      <label className="forms-source-picker">
        Tài sản bàn giao
        <select
          aria-label="Tài sản bàn giao"
          value={activeAssetId}
          onChange={(e) => setActiveAssetId(e.target.value)}
        >
          <option value="">Chọn tài sản…</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.code} · {asset.deviceName} · Serial: {asset.serialNumber} ·{' '}
              {asset.registeredDepartment}
            </option>
          ))}
        </select>
      </label>
    ) : null;
  const contextSummary =
    sourceKind !== 'aggregate'
      ? sourceReady
        ? 'Dữ liệu lấy từ hồ sơ đang chọn. Kiểm tra tên, mã và số lượng trong bản xem trước.'
        : 'Chưa có hồ sơ được chọn.'
      : activeFormType === 'TT22_RESTOCK_PROPOSAL'
        ? `${lowStockBatches.length} lô dưới tồn tối thiểu cần đối chiếu.`
        : activeFormType === 'TT20_AMPOULE_DESTRUCTION'
          ? `${narcoticDebts.length} dòng thuốc trong danh sách nguồn. Cần đối chiếu vỏ thực tế đã thu hồi.`
          : activeFormType === 'TSC_ANNUAL_AUDIT'
            ? `${assets.length} thiết bị trong danh sách kiểm kê.`
            : activeFormType === 'COLD_CHAIN_INCIDENT_REPORT'
              ? `Nhiệt độ ghi nhận: ${Number.isFinite(coldChainState?.currentTemp) ? coldChainState?.currentTemp : 'Chưa ghi'}°C. Đối chiếu nhật ký và từng lô sinh phẩm.`
              : `${debts.filter((d) => d.status === 'debt').length} phiếu còn nợ và ${tickets.length} phiếu thiết bị trong dữ liệu hiện có.`;

  return (
    <MedicalFormsWorkspace
      activeForm={activeFormType}
      onFormChange={setActiveFormType}
      forms={ALL_PRINTABLE_FORMS}
      sourcePicker={sourcePicker}
      sourceReady={sourceReady}
      contextSummary={contextSummary}
      onPrint={handlePrint}
      onDownload={handleDownloadHtml}
      onClose={onClose}
    >
      <FormDocument formType={activeFormType} data={{ debt: currentDebt, ticket: currentTicket, asset: currentAsset, debts, tickets, batches, assets, coldChainState }} />
    </MedicalFormsWorkspace>
  );
};
