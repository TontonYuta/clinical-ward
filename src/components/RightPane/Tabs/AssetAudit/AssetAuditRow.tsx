/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Dòng bảng kiểm kê tài sản máy móc thiết bị y tế (<=200 LOC)
 */

import React from 'react';
import { Building2, AlertTriangle, CheckCircle2, Trash2, ArrowRightLeft, Lock, Printer } from 'lucide-react';
import { AssetAuditRecord, UserRole } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface AssetAuditRowProps {
  asset: AssetAuditRecord;
  currentUserRole?: UserRole;
  onOpenPrintForm?: (formType: PrintableFormType, asset?: AssetAuditRecord) => void;
  onTransfer: (id: string, dept: string) => void;
  onLiquidation: (id: string) => void;
}

export const AssetAuditRow: React.FC<AssetAuditRowProps> = ({
  asset,
  currentUserRole,
  onOpenPrintForm,
  onTransfer,
  onLiquidation,
}) => {
  return (
    <tr className="odd:bg-white even:bg-slate-50/70 hover:bg-slate-100/60 transition-colors border-b border-slate-200">
      <td className="py-2.5 px-4 font-mono text-slate-800 whitespace-nowrap border-r border-slate-200">
        <span className="font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-300 block w-fit">
          {asset.code}
        </span>
        <span className="text-xs text-slate-500 font-medium block mt-1">SN: {asset.serialNumber}</span>
      </td>
      <td className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-200">
        <span className="font-bold text-sm text-slate-900 block leading-snug">{asset.deviceName}</span>
        <span className="text-xs text-slate-500 font-medium block mt-0.5">
          Model: <span className="text-slate-700 font-semibold">{asset.model}</span> · <span className="font-bold text-slate-700">Loại {asset.riskClass}</span>
        </span>
      </td>
      <td className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-200">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            Sổ sách: <strong className="text-slate-900">{asset.registeredDepartment}</strong>
          </span>
          {asset.isMisallocated ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 w-fit">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Lệch: {asset.actualDepartment}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Khớp thực tế: {asset.actualDepartment}
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-200">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs sm:text-sm text-slate-900 font-bold">{asset.depreciationRatePercent}%</span>
            <span className="text-xs text-slate-500 font-medium">({asset.operatingYears} năm)</span>
          </div>
          {asset.pendingLiquidation ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-300 w-fit">
              <Trash2 className="w-3 h-3 text-rose-600" />
              Chờ thanh lý
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">Đang hoạt động tốt</span>
          )}
        </div>
      </td>
      <td className="py-2.5 px-4 text-right whitespace-nowrap">
        <div className="inline-flex items-center gap-2 justify-end">
          <button
            onClick={() => onOpenPrintForm?.('TSC_HANDOVER_TRANSFER', asset)}
            className="w-8 h-8 rounded-md border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer flex items-center justify-center"
            title="In biên bản bàn giao tài sản cho thiết bị này (Mẫu 01-TSC)"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
          {asset.isMisallocated ? (
            <button
              onClick={() => onTransfer(asset.id, asset.actualDepartment)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold transition cursor-pointer active:scale-98 whitespace-nowrap"
              title="Xác nhận cập nhật vị trí mới trên sổ sách kế toán theo NĐ 151"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Điều chuyển</span>
            </button>
          ) : !asset.pendingLiquidation && asset.operatingYears >= 8 && (
            <button
              onClick={() => onLiquidation(asset.id)}
              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold transition cursor-pointer active:scale-98 whitespace-nowrap ${
                currentUserRole === 'director'
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-300 hover:border-rose-300'
              }`}
              title={
                currentUserRole === 'director'
                  ? 'Lập tờ trình hội đồng thanh lý tài sản nhà nước (NĐ 151/2017)'
                  : 'Thẩm quyền ký duyệt thanh lý thuộc Ban Giám Đốc theo NĐ 151/2017.'
              }
            >
              {currentUserRole === 'director' ? (
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{currentUserRole === 'director' ? 'Thanh lý' : 'Đề xuất thanh lý'}</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
