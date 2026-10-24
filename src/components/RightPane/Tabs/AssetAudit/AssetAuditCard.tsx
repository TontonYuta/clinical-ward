/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ di động hiển thị tài sản kiểm kê thiết bị (<=200 LOC)
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Trash2, ArrowRightLeft } from 'lucide-react';
import { AssetAuditRecord } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface AssetAuditCardProps {
  asset: AssetAuditRecord;
  onOpenPrintForm?: (formType: PrintableFormType, asset?: AssetAuditRecord) => void;
  onTransfer: (id: string, dept: string) => void;
  onLiquidation: (id: string) => void;
}

export const AssetAuditCard: React.FC<AssetAuditCardProps> = ({
  asset,
  onTransfer,
  onLiquidation,
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs space-y-3 hover:border-slate-300 transition">
      {/* Card Top: Code + Risk Class */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/70">
            {asset.code}
          </span>
          <span className="text-xs text-slate-500 font-mono">SN: {asset.serialNumber}</span>
        </div>
        <div>
          <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded border ${
              asset.riskClass === 'D'
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : asset.riskClass === 'C'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-teal-50 text-teal-700 border-teal-200'
            }`}
          >
            Loại {asset.riskClass}
          </span>
        </div>
      </div>

      {/* Device Name & Model */}
      <div>
        <h3 className="font-bold text-base text-slate-900 leading-snug">{asset.deviceName}</h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Model: <span className="font-medium text-slate-700">{asset.model}</span>
        </p>
      </div>

      {/* Audit Location Status */}
      <div className="bg-slate-50 rounded-md p-3 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-slate-500 font-medium">Khoa sổ sách:</span>
          <span className="font-semibold text-slate-800">{asset.registeredDepartment}</span>
        </div>
        <div className="flex items-center justify-between text-xs sm:text-sm">
          <span className="text-slate-500 font-medium">Vị trí thực tế:</span>
          {asset.isMisallocated ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              Lệch: {asset.actualDepartment}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Trùng khớp ({asset.actualDepartment})
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 text-slate-500">
          <span>
            Hao mòn: <strong className="text-slate-800 font-mono text-xs sm:text-sm">{asset.depreciationRatePercent}%</strong> ({asset.operatingYears} năm)
          </span>
          {asset.pendingLiquidation ? (
            <span className="text-rose-600 font-bold">Chờ thanh lý</span>
          ) : (
            <span className="text-emerald-700 font-medium">Hoạt động tốt</span>
          )}
        </div>
      </div>

      {/* Mobile Actions */}
      <div className="pt-1 border-t border-slate-100">
        {asset.isMisallocated ? (
          <button
            onClick={() => onTransfer(asset.id, asset.actualDepartment)}
            className="w-full h-8.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>Xác nhận điều chuyển</span>
          </button>
        ) : !asset.pendingLiquidation && asset.operatingYears >= 8 ? (
          <button
            onClick={() => onLiquidation(asset.id)}
            className="w-full h-8.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Đề xuất thanh lý</span>
          </button>
        ) : (
          <div className="w-full h-8.5 flex items-center justify-center text-xs font-medium text-emerald-800 bg-emerald-50 rounded-md border border-emerald-200">
            Đã đối soát mã QR
          </div>
        )}
      </div>
    </div>
  );
};
