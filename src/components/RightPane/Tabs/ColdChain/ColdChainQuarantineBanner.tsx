/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Khu vực Biệt Trữ Cách Ly Lô Vắc Xin (TT 36/2018 & WHO PQS) (<=200 LOC)
 */

import React from 'react';
import { ShieldAlert, FlaskConical, Clock, FileCheck2 } from 'lucide-react';
import { ColdChainMonitorState } from '../../../../types/clinical';

interface ColdChainQuarantineBannerProps {
  coldChainState: ColdChainMonitorState;
  onReleaseQuarantine?: () => void;
}

export const ColdChainQuarantineBanner: React.FC<ColdChainQuarantineBannerProps> = ({
  coldChainState,
  onReleaseQuarantine,
}) => {
  return (
    <div className="bg-white border border-amber-300 rounded-lg p-4 shadow-2xs text-xs sm:text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
          <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-wide">
            Khu vực biệt trữ cách ly lô vắc xin (chuẩn GSP &amp; WHO PQS)
          </span>
        </div>
        <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-600" />
          Trạng thái: Đang biệt trữ (chờ thẩm định)
        </span>
      </div>

      <p className="text-slate-600 text-xs sm:text-sm mb-3.5 leading-relaxed">
        Do sự cố ngắt điện lưới khiến nhiệt độ buồng tăng vọt lên <strong>11.0°C</strong> (vượt ngưỡng 2.0°C - 8.0°C), toàn bộ <strong>{coldChainState.totalVaccineDoses.toLocaleString()} liều sinh phẩm &amp; vắc xin</strong> đã được tự động niêm phong biệt trữ theo Điều 12 Thông tư 36/2018/TT-BYT nhằm thẩm định tính toàn vẹn hoạt tính sinh học trước khi đưa trở lại tiêm chủng.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3.5">
        <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200">
          <span className="text-xs text-slate-500 font-semibold block">1. Chỉ thị nhiệt độ lọ vắc xin (VVM)</span>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-emerald-500 inline-block border border-emerald-600" />
            <span className="font-bold text-slate-900 text-sm sm:text-base">Cấp độ 1 (Đạt chuẩn)</span>
          </div>
          <span className="text-xs text-emerald-700 font-medium block mt-1">Hình vuông trong sáng màu hơn vòng ngoài (An toàn)</span>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200">
          <span className="text-xs text-slate-500 font-semibold block">2. Nhiệt độ động học trung bình (MKT)</span>
          <div className="flex items-center gap-2 mt-1.5">
            <FlaskConical className="w-4 h-4 text-slate-600" />
            <span className="font-bold text-slate-900 font-mono text-sm sm:text-base">5.6°C (Đạt chuẩn)</span>
          </div>
          <span className="text-xs text-teal-700 font-medium block mt-1">Nằm trong giới hạn bảo toàn kháng nguyên &lt; 8.0°C</span>
        </div>

        <div className="bg-slate-50 p-3.5 rounded-md border border-slate-200">
          <span className="text-xs text-slate-500 font-semibold block">3. Thời gian phơi nhiễm sự cố</span>
          <div className="flex items-center gap-2 mt-1.5">
            <Clock className="w-4 h-4 text-slate-600" />
            <span className="font-bold text-slate-900 font-mono text-sm sm:text-base">12 phút</span>
          </div>
          <span className="text-xs text-slate-600 font-medium block mt-1">Nằm trong ngưỡng cho phép (&lt; 30 phút theo WHO PQS)</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200">
        <span className="text-xs text-slate-500 italic">
          * Thẩm quyền ký duyệt: Dược sĩ phụ trách QA hoặc Ban Giám Đốc bệnh viện (yêu cầu chữ ký kép theo GSP).
        </span>
        {onReleaseQuarantine && (
          <button
            onClick={onReleaseQuarantine}
            className="inline-flex items-center gap-2 h-8.5 px-3.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition shadow-xs cursor-pointer active:scale-98"
          >
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <span>Ký lệnh giải phóng lô vắc xin</span>
          </button>
        )}
      </div>
    </div>
  );
};
