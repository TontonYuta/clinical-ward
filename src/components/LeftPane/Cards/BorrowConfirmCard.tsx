/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { formatInlineMarkdown } from '../ChatMarkdown';

interface BorrowConfirmCardProps {
  data: {
    item_name: string;
    quantity?: number;
    quantity_str?: string;
    patient_name: string;
    patient_room: string;
    clinical_reason?: string;
    is_narcotic?: boolean;
  };
}

export const BorrowConfirmCard: React.FC<BorrowConfirmCardProps> = ({ data }) => {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Thuốc/Vật tư:</span>
        <span className="font-bold text-slate-900">{formatInlineMarkdown(data.item_name)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Số lượng:</span>
        <span className="font-bold text-slate-900 font-mono">
          {data.quantity_str || `${data.quantity} đơn vị`}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Bệnh nhân:</span>
        <span className="font-semibold text-slate-900">{formatInlineMarkdown(data.patient_name)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Vị trí cấp cứu:</span>
        <span className="font-medium text-slate-800">{data.patient_room}</span>
      </div>
      {data.clinical_reason && (
        <div className="text-slate-600">
          <span className="text-slate-500">Chỉ định: </span>
          <span className="font-semibold text-slate-800">
            {formatInlineMarkdown(data.clinical_reason)}
          </span>
        </div>
      )}
      {data.is_narcotic && (
        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Bắt buộc thu hồi vỏ ống sau tiêm</span>
        </div>
      )}
    </div>
  );
};
