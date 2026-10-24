/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { formatInlineMarkdown } from '../ChatMarkdown';

export const ColdChainStatusCard: React.FC<{ data: { temperature: number; mkt: number } }> = ({ data }) => (
  <div className="grid grid-cols-2 gap-2 text-xs">
    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
      <span className="text-slate-500 block">Nhiệt độ hiện tại:</span>
      <span className="text-base font-bold text-teal-800 font-mono">{data.temperature}°C</span>
    </div>
    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
      <span className="text-slate-500 block">Chỉ số MKT:</span>
      <span className="text-base font-bold text-slate-800 font-mono">{data.mkt}°C</span>
    </div>
  </div>
);

export const AuditIntegrityCard: React.FC<{ data: { genesis: string } }> = ({ data }) => (
  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1.5">
    <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
      <ShieldCheck className="w-4 h-4" />
      <span>Chuỗi băm HMAC-SHA256 hợp lệ 100%</span>
    </div>
    <div className="text-slate-500">
      Khối khởi tạo: <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800 border border-slate-200">{data.genesis}</code>
    </div>
  </div>
);

export const OcrInvoiceCard: React.FC<{
  data: {
    supplier: string;
    invoiceNumber: string;
    invoiceDate: string;
    totalAmount: string;
    items?: Array<{ name: string; batch?: string; batchNumber?: string; expiry?: string; expiryDate?: string; quantity: number; unit: string }>;
  };
}> = ({ data }) => (
  <div className="space-y-2">
    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1.5">
      <div className="flex justify-between text-slate-600">
        <span>Nhà cung ứng:</span>
        <span className="font-bold text-slate-900">{data.supplier}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Số hóa đơn / Ngày:</span>
        <span className="font-mono text-slate-800 font-semibold">{data.invoiceNumber} ({data.invoiceDate})</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Tổng giá trị chứng từ:</span>
        <span className="font-bold text-indigo-700 font-mono">{data.totalAmount}</span>
      </div>
    </div>
    {data.items && (
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
          Danh mục bóc tách tự động ({data.items.length} mặt hàng):
        </span>
        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
          {data.items.map((it, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between text-xs">
              <div className="truncate max-w-[200px]">
                <div className="font-bold text-slate-900 truncate">{it.name}</div>
                <div className="text-slate-500 font-mono text-xs">Lô: {it.batch || it.batchNumber} • Hạn: {it.expiry || it.expiryDate}</div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 text-xs">
                  +{it.quantity} {it.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export const BiomedicalDiagnosticsCard: React.FC<{
  data: {
    model: string;
    diagnosis: string;
    checklist?: string[];
  };
}> = ({ data }) => (
  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-2">
    <div className="flex justify-between items-center">
      <span className="text-slate-500">Model thiết bị:</span>
      <span className="font-bold text-slate-900 font-mono">{data.model}</span>
    </div>
    <div className="text-slate-700">
      <span className="text-slate-500">Chẩn đoán sự cố: </span>
      <span className="font-semibold text-rose-700">{data.diagnosis}</span>
    </div>
    {data.checklist && (
      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-slate-600 text-xs">
        <span className="font-bold text-slate-800 block">Checklist kỹ thuật IEC 60601-1:</span>
        {data.checklist.map((c, idx) => (
          <div key={idx} className="leading-snug">• {c}</div>
        ))}
      </div>
    )}
  </div>
);
