/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Bảng danh mục sinh phẩm & vắc xin Desktop chuẩn Kho Dược GSP (<=200 LOC)
 */

import React from 'react';
import { Eye, Printer, Snowflake, SunMedium } from 'lucide-react';
import { VaccineBatchItem } from '../../../../types/clinical';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';

interface ColdChainVaccineTableProps {
  vaccines: VaccineBatchItem[];
  isQuarantined: boolean;
  onSelectVaccine: (item: VaccineBatchItem) => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
}

export const ColdChainVaccineTable: React.FC<ColdChainVaccineTableProps> = ({
  vaccines,
  isQuarantined,
  onSelectVaccine,
  onOpenPrintForm,
}) => {
  if (vaccines.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
        Không tìm thấy vắc xin hoặc sinh phẩm nào phù hợp với bộ lọc hiện tại.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="overflow-x-auto thin-scrollbar flex-1 min-h-0">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-2xs font-semibold text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3 text-center w-12 border-r border-slate-100">STT</th>
              <th className="py-2.5 px-3 border-r border-slate-100">Số Lô & Hạn Dùng</th>
              <th className="py-2.5 px-3.5 border-r border-slate-100">Tên Vắc Xin / Sinh Phẩm & Hoạt Chất</th>
              <th className="py-2.5 px-3 text-center border-r border-slate-100">Cơ Số Tồn</th>
              <th className="py-2.5 px-3 border-r border-slate-100">Bảo Quản GSP</th>
              <th className="py-2.5 px-3 border-r border-slate-100">Chỉ Thị VVM</th>
              <th className="py-2.5 px-3 border-r border-slate-100">Trạng Thái</th>
              <th className="py-2.5 px-3 text-center w-24">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {vaccines.map((item, idx) => {
              const effectivelyQuarantined = isQuarantined || item.status === 'quarantined';

              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/80 transition-colors border-b border-slate-100"
                >
                  {/* 1. STT */}
                  <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-2xs border-r border-slate-100">
                    {idx + 1}
                  </td>

                  {/* 2. Số Lô & Hạn Dùng */}
                  <td className="py-2.5 px-3 border-r border-slate-100 whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-900 block">{item.batchNumber}</span>
                    <span className="text-2xs text-slate-500 font-mono">HD: {item.expiryDate}</span>
                  </td>

                  {/* 3. Tên Vắc Xin & Hoạt Chất */}
                  <td className="py-2.5 px-3.5 border-r border-slate-100">
                    <button
                      type="button"
                      onClick={() => onSelectVaccine(item)}
                      className="font-bold text-slate-900 hover:text-teal-700 hover:underline text-left cursor-pointer transition block"
                    >
                      {item.name}
                    </button>
                    <span className="text-2xs text-slate-500 block truncate max-w-xs mt-0.5">
                      {item.genericName} · {item.manufacturer}
                    </span>
                  </td>

                  {/* 4. Cơ Số Tồn */}
                  <td className="py-2.5 px-3 text-center border-r border-slate-100 whitespace-nowrap">
                    <span className="font-mono font-bold text-slate-900 text-xs block">
                      {item.quantity.toLocaleString()}
                    </span>
                    <span className="text-2xs text-slate-500">{item.unit}</span>
                  </td>

                  {/* 5. Bảo Quản GSP */}
                  <td className="py-2.5 px-3 border-r border-slate-100">
                    <span className="font-medium text-slate-800 block text-xs">{item.storageCondition}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.isFreezeSensitive && (
                        <span className="inline-flex items-center gap-0.5 text-2xs text-blue-700 font-medium">
                          <Snowflake className="w-3 h-3 text-blue-500" />
                          Tránh đông đá
                        </span>
                      )}
                      {item.isLightSensitive && (
                        <span className="inline-flex items-center gap-0.5 text-2xs text-amber-700 font-medium">
                          <SunMedium className="w-3 h-3 text-amber-500" />
                          Tránh ánh sáng
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 6. Chỉ Thị VVM */}
                  <td className="py-2.5 px-3 border-r border-slate-100 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block border border-emerald-600 shrink-0" />
                      <span className="font-semibold text-slate-800 text-xs">Cấp {item.vvmStage} (Đạt)</span>
                    </div>
                    <span className="text-2xs text-slate-400 block mt-0.5">WHO PQS E006</span>
                  </td>

                  {/* 7. Trạng Thái */}
                  <td className="py-2.5 px-3 border-r border-slate-100 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold border ${
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
                  </td>

                  {/* 8. Thao Tác */}
                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => onSelectVaccine(item)}
                        title="Xem thông số kỹ thuật vắc xin"
                        className="p-1 rounded text-slate-500 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenPrintForm?.('COLD_CHAIN_INCIDENT_REPORT')}
                        title="In biên bản sự cố chuỗi lạnh"
                        className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
