/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thẻ hiển thị Thu hồi vỏ thuốc & Thanh toán nợ trong Chatbot (<=80 LOC)
 */

import React from 'react';
import { Pill, User, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DebtSettleCardProps {
  data: any;
}

export const DebtSettleCard: React.FC<DebtSettleCardProps> = ({ data }) => {
  return (
    <div className="space-y-2.5 bg-white p-3 rounded-lg border border-slate-300 text-xs">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
        <span className="font-bold text-slate-900 text-sm">{data.itemName}</span>
        <span className="font-mono text-2xs bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-200">
          {data.code}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-slate-700 bg-slate-50 p-2 rounded border border-slate-200 text-2xs">
        <div>
          <span className="text-slate-500 block">Số lượng mượn:</span>
          <strong className="font-mono text-slate-900">{data.quantity}</strong>
        </div>
        <div>
          <span className="text-slate-500 block">Bệnh nhân:</span>
          <strong className="text-slate-900 truncate block">{data.patientName} ({data.patientRoom})</strong>
        </div>
      </div>

      <div className="flex items-center justify-between text-2xs pt-1 border-t border-slate-100">
        <span className="text-slate-500 flex items-center gap-1">
          <User className="w-3 h-3 text-slate-400" />
          <span>Mượn bởi: <strong>{data.borrowerName}</strong></span>
        </span>
        {data.isNarcotic && (
          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
            <AlertCircle className="w-3 h-3" /> Thu hồi vỏ TT 20
          </span>
        )}
      </div>
    </div>
  );
};
