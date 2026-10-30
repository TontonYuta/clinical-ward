/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ vắc xin Mobile chuẩn hành chính Dược lâm sàng (<=200 LOC)
 */

import React from 'react';
import { Eye, Printer, Snowflake, SunMedium } from 'lucide-react';
import { VaccineBatchItem } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface ColdChainVaccineCardProps {
  item: VaccineBatchItem;
  index: number;
  isQuarantined: boolean;
  onSelectVaccine: (item: VaccineBatchItem) => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
}

export const ColdChainVaccineCard: React.FC<ColdChainVaccineCardProps> = ({
  item,
  index,
  isQuarantined,
  onSelectVaccine,
  onOpenPrintForm,
}) => {
  const effectivelyQuarantined = isQuarantined || item.status === 'quarantined';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3 shadow-2xs space-y-2 text-xs">
      {/* Row 1: STT, Tên Vắc xin & Trạng thái */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-1.5">
          <span className="font-mono text-2xs text-slate-400 font-semibold shrink-0 mt-0.5">
            #{index + 1}
          </span>
          <button
            type="button"
            onClick={() => onSelectVaccine(item)}
            className="font-bold text-slate-900 text-left hover:text-teal-700 leading-snug line-clamp-2 cursor-pointer"
          >
            {item.name}
          </button>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold border shrink-0 ${
            effectivelyQuarantined
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              effectivelyQuarantined ? 'bg-amber-600' : 'bg-emerald-600'
            }`}
          />
          {effectivelyQuarantined ? 'Biệt trữ' : 'Sẵn sàng'}
        </span>
      </div>

      {/* Row 2: Lot, Expiry, Quantity */}
      <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-md border border-slate-100 text-2xs">
        <div>
          <span className="text-slate-400 block">Số Lô:</span>
          <span className="font-mono font-bold text-slate-900 truncate block">{item.batchNumber}</span>
        </div>
        <div>
          <span className="text-slate-400 block">Hạn Dùng:</span>
          <span className="font-mono font-medium text-slate-700 block">{item.expiryDate}</span>
        </div>
        <div>
          <span className="text-slate-400 block">Cơ Số Tồn:</span>
          <span className="font-mono font-bold text-teal-800 block">
            {item.quantity.toLocaleString()} {item.unit}
          </span>
        </div>
      </div>

      {/* Row 3: GSP conditions & VVM */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 text-2xs text-slate-600 pt-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-slate-700">{item.storageCondition}</span>
          {item.isFreezeSensitive && (
            <span className="inline-flex items-center gap-0.5 text-blue-700">
              <Snowflake className="w-3 h-3 text-blue-500" />
              Tránh đông
            </span>
          )}
          {item.isLightSensitive && (
            <span className="inline-flex items-center gap-0.5 text-amber-700">
              <SunMedium className="w-3 h-3 text-amber-500" />
              Tránh quang
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 font-semibold text-emerald-700 shrink-0">
          <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block border border-emerald-600" />
          <span>VVM Cấp {item.vvmStage}</span>
        </div>
      </div>

      {/* Row 4: Actions */}
      <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-100">
        <button
          type="button"
          onClick={() => onSelectVaccine(item)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-2xs transition cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          <span>Xem chi tiết</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenPrintForm?.('COLD_CHAIN_INCIDENT_REPORT')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-2xs transition cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Biên bản</span>
        </button>
      </div>
    </div>
  );
};
