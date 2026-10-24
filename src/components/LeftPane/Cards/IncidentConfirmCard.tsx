/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { formatInlineMarkdown } from '../ChatMarkdown';

interface IncidentConfirmCardProps {
  data: {
    device_name: string;
    risk_class?: string;
    urgency?: string;
    location: string;
    accessory_issue?: string;
  };
}

export const IncidentConfirmCard: React.FC<IncidentConfirmCardProps> = ({ data }) => {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Thiết bị:</span>
        <span className="font-bold text-slate-900">{formatInlineMarkdown(data.device_name)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Rủi ro (NĐ 98/2021):</span>
        <span
          className={`px-2 py-0.5 rounded-md text-xs font-bold ${
            data.risk_class === 'D'
              ? 'bg-rose-100 text-rose-800 border border-rose-300'
              : 'bg-amber-100 text-amber-800'
          }`}
        >
          Loại {data.risk_class || 'C'} (Ưu tiên {data.urgency === 'urgent' ? 'P1 Khẩn cấp' : 'P2'})
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500">Vị trí sự cố:</span>
        <span className="font-medium text-slate-800">{data.location}</span>
      </div>
      {data.accessory_issue && (
        <div className="text-slate-600">
          <span className="text-slate-500">Mô tả lỗi: </span>
          <span className="font-semibold text-slate-800">
            {formatInlineMarkdown(data.accessory_issue)}
          </span>
        </div>
      )}
    </div>
  );
};
