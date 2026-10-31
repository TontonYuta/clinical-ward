/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị chi tiết An toàn sử dụng thuốc & Đối chứng Dược Thư 2015 (<=200 LOC)
 */

import React from 'react';
import { FileText, ExternalLink, ShieldCheck } from 'lucide-react';

interface MedicationSafetyDetailsCardProps {
  data: any;
}

export const MedicationSafetyDetailsCard: React.FC<MedicationSafetyDetailsCardProps> = ({ data }) => {
  const pdfUrl = data.citationUrl || (data.pdfDocument ? `/pdf/${data.pdfDocument}${data.pdfPage ? `#page=${data.pdfPage.toString().split(/[-–\s]+/)[0]}` : ''}` : null);

  return (
    <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-300 text-xs">
      <div className="font-bold text-slate-900 text-sm flex items-center justify-between pb-1 border-b border-slate-200">
        <span>{data.tallMan || data.medName}</span>
        {data.allergyClass && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
            {data.allergyClass}
          </span>
        )}
      </div>

      {data.officialSource && (
        <div className="p-2 rounded bg-slate-50 border border-slate-200 text-slate-800 space-y-1">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span className="font-semibold text-slate-900">📚 {data.officialSource}</span>
            {data.pdfPage && (
              <span className="font-mono font-bold text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded">
                Trang {data.pdfPage}
              </span>
            )}
          </div>
          {pdfUrl && (
            <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between">
              <span className="text-[11px] text-slate-600 flex items-center gap-1 font-mono">
                <FileText className="w-3 h-3 text-red-600" />
                {data.pdfDocument || 'Duoc_Thu_Quoc_Gia_Viet_Nam.pdf'}
              </span>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-black text-white font-bold text-[10px] transition cursor-pointer"
              >
                <span>Mở PDF</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          )}
        </div>
      )}

      {data.activeIngredients && (
        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-slate-800 leading-snug">
          <strong className="text-slate-900 block font-semibold mb-0.5">🧪 Thành phần:</strong>
          <span className="font-mono text-[11px] text-slate-900">{data.activeIngredients}</span>
        </div>
      )}

      {data.indications && data.indications.length > 0 && (
        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-slate-800 leading-snug">
          <strong className="text-slate-900 block font-semibold mb-0.5">🎯 Chỉ định điều trị:</strong>
          <ul className="list-disc list-inside space-y-0.5 text-slate-700">
            {data.indications.slice(0, 2).map((ind: string, i: number) => (
              <li key={i}>{ind}</li>
            ))}
          </ul>
        </div>
      )}

      {data.allergyWarning && (
        <div className="bg-slate-50 p-2 rounded border border-slate-200 text-slate-800 leading-snug">
          <strong className="block font-semibold mb-0.5 text-slate-900">⚠️ Lưu ý an toàn & Dị ứng:</strong>
          <div className="text-slate-700">{data.allergyWarning}</div>
          {data.crossReactivities && data.crossReactivities.length > 0 && (
            <div className="text-[11px] text-slate-600 mt-1 font-medium">
              Dị ứng chéo: {data.crossReactivities.slice(0, 3).join(', ')}
            </div>
          )}
        </div>
      )}

      {(data.standardDosing || data.dosage) && (
        <div className="text-slate-700">
          <strong className="text-slate-900">Liều dùng:</strong> {data.standardDosing || data.dosage}
        </div>
      )}

      {data.antidote && (
        <div className="text-slate-900 font-semibold bg-slate-100 p-1.5 rounded border border-slate-300 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-700 shrink-0" />
          <span>Giải độc: {data.antidote}</span>
        </div>
      )}
    </div>
  );
};
