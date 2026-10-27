/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị chi tiết An toàn sử dụng thuốc Dược Thư (<=200 LOC)
 */

import React from 'react';

interface MedicationSafetyDetailsCardProps {
  data: any;
}

export const MedicationSafetyDetailsCard: React.FC<MedicationSafetyDetailsCardProps> = ({ data }) => {
  return (
    <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200 text-xs">
      <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
        <span>{data.tallMan || data.medName}</span>
        {data.allergyClass && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
            {data.allergyClass}
          </span>
        )}
      </div>

      {data.officialSource && (
        <div className="text-[11px] text-teal-900 bg-teal-50 px-2 py-1 rounded border border-teal-200 font-medium">
          📚 {data.officialSource}
        </div>
      )}

      {data.activeIngredients && (
        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-slate-800 leading-snug">
          <strong className="text-slate-900 block font-semibold mb-0.5">🧪 Thành phần:</strong>
          <span className="font-mono text-[11px] text-teal-900">{data.activeIngredients}</span>
        </div>
      )}

      {data.indications && data.indications.length > 0 && (
        <div className="bg-blue-50/80 p-2 rounded border border-blue-200 text-slate-800 leading-snug">
          <strong className="text-blue-900 block font-semibold mb-0.5">🎯 Chỉ định:</strong>
          <ul className="list-disc list-inside space-y-0.5">
            {data.indications.slice(0, 2).map((ind: string, i: number) => (
              <li key={i}>{ind}</li>
            ))}
          </ul>
        </div>
      )}

      {data.allergyWarning && (
        <div className="bg-rose-50 p-2 rounded border border-rose-200 text-rose-900 leading-snug">
          <strong className="block font-semibold mb-0.5">⚠️ Dị ứng:</strong>
          <div>{data.allergyWarning}</div>
          {data.crossReactivities && data.crossReactivities.length > 0 && (
            <div className="text-[11px] text-rose-700 mt-1">
              Dị ứng chéo: {data.crossReactivities.slice(0, 3).join(', ')}
            </div>
          )}
        </div>
      )}

      <div className="text-slate-600">
        <strong>Liều dùng:</strong> {data.standardDosing}
      </div>

      {data.antidote && (
        <div className="text-emerald-800 font-semibold bg-emerald-50 p-1.5 rounded border border-emerald-200">
          🛡️ <strong>Giải độc:</strong> {data.antidote}
        </div>
      )}
    </div>
  );
};
