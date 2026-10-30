/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Danh mục sinh phẩm & vắc xin trong buồng bảo quản GSP (<=200 LOC)
 */

import React from 'react';

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
    <section className="bg-white py-4">
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-200 flex-wrap gap-2">
        <span className="text-sm sm:text-base font-semibold text-slate-900 flex items-center gap-2">
          Danh mục sinh phẩm &amp; vắc xin đang bảo quản (Tổng: {totalDoses.toLocaleString()} liều)
        </span>
        <span className="text-xs sm:text-sm text-slate-500">Kho lạnh dược lâm sàng GSP</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5 gap-y-3 text-xs sm:text-sm">
        {INVENTORY_ITEMS.map((item) => (
          <div key={item.batch} className="py-3 border-b border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="font-bold text-slate-900 text-sm sm:text-base leading-snug">{item.name}</span>
              {isQuarantined && (
                <span className="text-xs font-semibold text-amber-800 shrink-0">
                  Biệt trữ
                </span>
              )}
            </div>
            <div className="text-xs sm:text-sm text-slate-600">
              Số lượng: <strong className="text-slate-900 font-bold">{item.quantity}</strong> · Lô: <strong className="font-mono text-slate-800">{item.batch}</strong>
            </div>
            <div
              className={`text-xs sm:text-sm font-semibold pt-1 ${
                isQuarantined ? 'text-amber-800 font-semibold' : 'text-slate-500 font-normal'
              }`}
            >
              {isQuarantined ? 'Đang biệt trữ chờ thẩm định VVM' : item.safeRange}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
