/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  QrCode,
  Search,
  AlertTriangle,
  FileCheck2,
  Trash2,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Lock,
  Printer
} from 'lucide-react';
import { AssetAuditRecord, UserRole } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { PrintableFormType } from '../../Modals/PrintableFormModal';

interface AssetAuditTabProps {
  assets: AssetAuditRecord[];
  onConfirmTransfer: (id: string, newDept: string) => void;
  onRequestLiquidation: (id: string, reason: string) => void;
  onSimulateQrScan: () => void;
  onOpenPrintForm?: (formType: PrintableFormType, asset?: AssetAuditRecord) => void;
  isAudioMuted: boolean;
  currentUserRole?: UserRole;
}

export const AssetAuditTab: React.FC<AssetAuditTabProps> = ({
  assets,
  onConfirmTransfer,
  onRequestLiquidation,
  onSimulateQrScan,
  onOpenPrintForm,
  isAudioMuted,
  currentUserRole = 'biomedical_engineer'
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'misallocated' | 'liquidation'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const misallocatedAssets = assets.filter(a => a.isMisallocated);
  const liquidationAssets = assets.filter(a => a.pendingLiquidation);
  const matchedAssets = assets.filter(a => !a.isMisallocated && a.condition === 'operational');

  const filteredAssets = assets.filter(item => {
    let matchesMode = true;
    if (filterMode === 'misallocated') matchesMode = item.isMisallocated;
    if (filterMode === 'liquidation') matchesMode = item.pendingLiquidation;

    const matchesSearch =
      item.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.registeredDepartment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.actualDepartment.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMode && matchesSearch;
  });

  const handleTransfer = (id: string, dept: string) => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onConfirmTransfer(id, dept);
  };

  const handleLiquidation = (id: string) => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onRequestLiquidation(id, 'Hỏng nát ngưng dùng trên 12 tháng, chi phí sửa vượt giá trị còn lại');
  };

  const handleScanClick = () => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    onSimulateQrScan();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2 w-full">
      {/* 1. Slim Integrated Executive Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white px-3 py-2 rounded-lg border border-slate-200/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 whitespace-nowrap">
            Kiểm Kê &amp; Quản Lý Tài Sản
          </h2>
          <span className="text-[11px] font-mono text-slate-400 border-l border-slate-200 pl-2 hidden md:inline">
            Căn cứ: NĐ 151/2017 &amp; NĐ 114/2024
          </span>
          {/* Subtle inline summary */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 border-l border-slate-200 pl-2.5">
            <span className="text-slate-500 font-mono text-[11px]">{assets.length} máy</span>
            <span className="text-slate-300">·</span>
            {misallocatedAssets.length > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                {misallocatedAssets.length} lệch khoa
              </span>
            )}
            {liquidationAssets.length > 0 && (
              <span className="inline-flex items-center gap-1 font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                {liquidationAssets.length} chờ thanh lý
              </span>
            )}
            <span className="text-slate-400 font-medium">·</span>
            <span className="text-slate-500 text-[11px]">{matchedAssets.length} đúng vị trí</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onOpenPrintForm?.('TSC_ANNUAL_AUDIT')}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-xs transition shadow-2xs cursor-pointer active:scale-98"
            title="In Biên bản kiểm kê tài sản cố định & TBYT định kỳ (Mẫu 05-TSC Thông tư 23/2023/TT-BTC & Nghị định 151/2017)"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">In Mẫu 05-TSC Kiểm Kê</span>
          </button>

          <button
            onClick={() => onOpenPrintForm?.('TSC_HANDOVER_TRANSFER')}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-xs transition shadow-2xs cursor-pointer active:scale-98"
            title="In Biên bản bàn giao, tiếp nhận tài sản công TBYT (Mẫu 01/TSC-BBGN Nghị định 151/2017 & NĐ 114/2024)"
          >
            <Printer className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">In Mẫu 01/TSC Điều Chuyển</span>
          </button>

          <button
            onClick={handleScanClick}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition shrink-0 shadow-2xs cursor-pointer active:scale-98"
            title="Mô phỏng máy đọc mã vạch QR kiểm đếm máy thở tại buồng bệnh"
          >
            <QrCode className="w-3.5 h-3.5 text-teal-400" />
            <span>Quét QR đối soát buồng</span>
          </button>
        </div>
      </div>


      {/* 3. Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm mã tài sản, tên máy, khoa phòng..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:border-slate-400 text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({assets.length})
          </button>
          <button
            onClick={() => setFilterMode('misallocated')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterMode === 'misallocated' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lệch buồng phòng ({misallocatedAssets.length})
          </button>
          <button
            onClick={() => setFilterMode('liquidation')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
              filterMode === 'liquidation' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Chờ thanh lý ({liquidationAssets.length})
          </button>
        </div>
      </div>

      {/* 2. Isolated Scrollable Table (Sticky Thead) */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 font-semibold">
                <th className="py-2.5 px-3.5 whitespace-nowrap">Mã tài sản</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Thiết bị &amp; Cấp rủi ro</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Đối soát vị trí (Sổ sách ➔ Thực tế)</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Hao mòn &amp; Hiện trạng</th>
                <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => {
                return (
                  <tr key={asset.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-2.5 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                      <span className="font-semibold block">{asset.code}</span>
                      <span className="text-[10px] text-slate-400">SN: {asset.serialNumber}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-900 block">{asset.deviceName}</span>
                      <span className="text-[10px] text-slate-400">
                        Model: {asset.model} · Loại {asset.riskClass}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          Sổ: {asset.registeredDepartment}
                        </span>
                        {asset.isMisallocated ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 w-fit">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                            Lệch: {asset.actualDepartment}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Quét: {asset.actualDepartment}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-slate-800 font-semibold">{asset.depreciationRatePercent}%</span>
                          <span className="text-[10px] text-slate-400">({asset.operatingYears} năm)</span>
                        </div>
                        {asset.pendingLiquidation ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 w-fit">
                            <Trash2 className="w-2.5 h-2.5" />
                            Chờ thanh lý
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Đang hoạt động tốt</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => onOpenPrintForm?.('TSC_HANDOVER_TRANSFER', asset)}
                          className="p-1 rounded text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                          title="In Biên bản bàn giao tài sản cho thiết bị này (Mẫu 01/TSC-BBGN)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {asset.isMisallocated ? (
                          <button
                            onClick={() => handleTransfer(asset.id, asset.actualDepartment)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                            title="Xác nhận cập nhật vị trí mới trên sổ sách kế toán theo NĐ 151"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            <span>Điều chuyển</span>
                          </button>
                        ) : !asset.pendingLiquidation && asset.operatingYears >= 8 ? (
                          currentUserRole === 'director' ? (
                            <button
                              onClick={() => handleLiquidation(asset.id)}
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                              title="Lập tờ trình hội đồng thanh lý tài sản nhà nước (Thẩm quyền Giám Đốc NĐ 151/2017)"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>Thanh lý</span>
                            </button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200 text-xs font-medium whitespace-nowrap"
                              title="Theo NĐ 151/2017 & NĐ 114/2024, thẩm quyền ký tờ trình thanh lý tài sản thuộc Ban Giám Đốc"
                            >
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>Chờ Giám đốc duyệt thanh lý</span>
                            </span>
                          )
                        ) : (
                          <span className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded whitespace-nowrap">
                            <FileCheck2 className="w-3 h-3 text-emerald-600" />
                            Đúng vị trí sổ sách
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

