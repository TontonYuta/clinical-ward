/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Danh mục sinh phẩm & vắc xin trong buồng bảo quản GSP (<=200 LOC)
 */

import React from 'react';
import { Package } from 'lucide-react';

interface ColdChainInventoryListProps {
  isQuarantined: boolean;
  totalDoses: number;
}

const INVENTORY_ITEMS = [
  {
    name: 'Vắc xin Dại tinh chế (Verorab)',
    quantity: '450 liều',
    batch: 'VR-2409',
    safeRange: 'Dải bảo quản: 2°C - 8°C (Không để đông băng)',
  },
  {
    name: 'Kháng độc tố Uốn ván (SAT 1500 UI)',
    quantity: '500 ống',
    batch: 'ST-9921',
    safeRange: 'Dải bảo quản: 2°C - 8°C (Tránh ánh sáng)',
  },
  {
    name: 'Vắc xin Viêm gan B tái tổ hợp',
    quantity: '300 liều',
    batch: 'HB-8812',
    safeRange: 'Dải bảo quản: 2°C - 8°C (Nhạy cảm nhiệt đông)',
  },
];

export const ColdChainInventoryList: React.FC<ColdChainInventoryListProps> = ({
  isQuarantined,
  totalDoses,
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-3.5 shadow-2xs">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
        <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-600" />
          Danh mục sinh phẩm &amp; vắc xin đang bảo quản (Tổng: {totalDoses.toLocaleString()} liều)
        </span>
        <span className="text-xs text-slate-600 font-semibold">Kho lạnh dược lâm sàng GSP</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs sm:text-sm">
        {INVENTORY_ITEMS.map((item) => (
          <div key={item.batch} className="p-3 rounded-md bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs sm:text-sm">{item.name}</span>
              {isQuarantined && (
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  Biệt trữ
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Số lượng: <strong className="text-slate-800 font-semibold">{item.quantity}</strong> · Lô: {item.batch}
            </div>
            <div
              className={`text-xs font-medium mt-1.5 ${
                isQuarantined ? 'text-amber-800 font-bold' : 'text-emerald-700'
              }`}
            >
              {isQuarantined ? 'Đang biệt trữ chờ thẩm định VVM' : item.safeRange}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
