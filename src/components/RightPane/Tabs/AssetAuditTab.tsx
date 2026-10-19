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
      {/* 1. Unified Clinical Command Ribbon */}
      <div className="bg-white p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl border border-slate-200/90 shadow-2xs shrink-0 space-y-2">
        {/* Row 1: Title, Legal Basis, Key Stat Badges, Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap sm:flex-nowrap">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 whitespace-nowrap">
              Kiểm Kê &amp; Quản Lý Tài Sản
            </h2>
            <span className="text-xs font-mono text-slate-500 border-l border-slate-200 pl-2 hidden md:inline">
              NĐ 151/2017 &amp; NĐ 114/2024
            </span>
            {/* Subtle inline summary */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 sm:border-l sm:border-slate-200 sm:pl-2">
              <span className="text-slate-500 font-mono text-xs">{assets.length} máy</span>
              {misallocatedAssets.length > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  {misallocatedAssets.length} lệch khoa
                </span>
              )}
              {liquidationAssets.length > 0 && (
                <span className="inline-flex items-center gap-1 font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  {liquidationAssets.length} thanh lý
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => onOpenPrintForm?.('TSC_ANNUAL_AUDIT')}
              className="inline-flex items-center gap-1 h-8 px-2 sm:px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-xs sm:text-sm transition shadow-2xs cursor-pointer active:scale-98"
              title="In Biên bản kiểm kê tài sản cố định & TBYT định kỳ (Mẫu 05-TSC Thông tư 23/2023/TT-BTC & Nghị định 151/2017)"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
              <span className="hidden sm:inline">In Mẫu 05-TSC</span>
              <span className="sm:hidden">Mẫu 05</span>
            </button>

            <button
              onClick={() => onOpenPrintForm?.('TSC_HANDOVER_TRANSFER')}
              className="inline-flex items-center gap-1 h-8 px-2 sm:px-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 hover:border-slate-400 font-semibold text-xs sm:text-sm transition shadow-2xs cursor-pointer active:scale-98"
              title="In Biên bản bàn giao, tiếp nhận tài sản công TBYT (Mẫu 01/TSC-BBGN Nghị định 151/2017 & NĐ 114/2024)"
            >
              <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-700" />
              <span className="hidden sm:inline">In Mẫu 01/TSC</span>
              <span className="sm:hidden">Mẫu 01</span>
            </button>

            <button
              onClick={handleScanClick}
              className="inline-flex items-center gap-1 h-8 px-2.5 sm:px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm transition shrink-0 shadow-2xs cursor-pointer active:scale-98"
              title="Mô phỏng máy đọc mã vạch QR kiểm đếm máy thở tại buồng bệnh"
            >
              <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-400" />
              <span className="hidden sm:inline">Quét QR đối soát</span>
              <span className="sm:hidden">Quét QR</span>
            </button>
          </div>
        </div>

        {/* Row 2: Search Input & Status Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm mã tài sản, tên máy, khoa phòng..."
              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-500 focus:bg-white text-slate-800 placeholder-slate-400 shadow-2xs transition"
            />
          </div>

          <div className="flex items-center gap-1 text-xs bg-slate-100/80 p-0.5 rounded-lg overflow-x-auto max-w-full scrollbar-none whitespace-nowrap">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả ({assets.length})
            </button>
            <button
              onClick={() => setFilterMode('misallocated')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                filterMode === 'misallocated' ? 'bg-white text-amber-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lệch khoa ({misallocatedAssets.length})
            </button>
            <button
              onClick={() => setFilterMode('liquidation')}
              className={`px-2.5 py-1 rounded-md text-xs sm:text-sm font-medium transition cursor-pointer shrink-0 ${
                filterMode === 'liquidation' ? 'bg-white text-rose-800 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chờ thanh lý ({liquidationAssets.length})
            </button>
          </div>
        </div>
      </div>

      {/* 2A. Mobile Card-Based List (md:hidden) - Modern, touch-friendly, no horizontal cut-off */}
      <div className="md:hidden flex-1 overflow-y-auto space-y-3 pr-0.5">
        {filteredAssets.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Không tìm thấy tài sản thiết bị nào phù hợp với bộ lọc.
          </div>
        ) : (
          filteredAssets.map((asset) => {
            return (
              <div
                key={asset.id}
                className="bg-white rounded-xl border border-slate-200/90 p-3.5 shadow-xs space-y-3 hover:border-slate-300 transition"
              >
                {/* Card Top: Code + Risk Class */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/70">
                      {asset.code}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      SN: {asset.serialNumber}
                    </span>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
                        asset.riskClass === 'D'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : asset.riskClass === 'C'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-teal-50 text-teal-700 border-teal-200'
                      }`}
                    >
                      Loại {asset.riskClass}
                    </span>
                  </div>
                </div>

                {/* Device Name & Model */}
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-snug">
                    {asset.deviceName}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Model: <span className="font-medium text-slate-700">{asset.model}</span>
                  </p>
                </div>

                {/* Audit Location Status */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60 space-y-2">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-500 font-medium">Khoa sổ sách:</span>
                    <span className="font-semibold text-slate-800">{asset.registeredDepartment}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-slate-500 font-medium">Vị trí thực tế:</span>
                    {asset.isMisallocated ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-md border border-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        Lệch: {asset.actualDepartment}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        Trùng khớp ({asset.actualDepartment})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 text-slate-500">
                    <span>Hao mòn: <strong className="text-slate-800 font-mono text-xs sm:text-sm">{asset.depreciationRatePercent}%</strong> ({asset.operatingYears} năm)</span>
                    {asset.pendingLiquidation ? (
                      <span className="text-rose-600 font-bold">Chờ thanh lý</span>
                    ) : (
                      <span className="text-emerald-700 font-medium">Hoạt động tốt</span>
                    )}
                  </div>
                </div>

                {/* Mobile Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => onOpenPrintForm?.('TSC_HANDOVER_TRANSFER', asset)}
                    className="flex-1 h-9 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-teal-700" />
                    <span>In Mẫu 01</span>
                  </button>
                  {asset.isMisallocated ? (
                    <button
                      onClick={() => handleTransfer(asset.id, asset.actualDepartment)}
                      className="flex-2 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer active:scale-98"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Xác nhận điều chuyển</span>
                    </button>
                  ) : !asset.pendingLiquidation && asset.operatingYears >= 8 ? (
                    <button
                      onClick={() => handleLiquidation(asset.id)}
                      className="flex-2 h-9 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-98"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Đề xuất thanh lý</span>
                    </button>
                  ) : (
                    <div className="flex-2 h-9 flex items-center justify-center text-xs sm:text-sm font-medium text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200">
                      Đã đối soát QR
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 2B. Desktop Table (hidden md:flex) - Sticky Thead, Isolated Scroll Body */}
      <div className="hidden md:flex flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-left text-sm min-w-[880px]">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <th className="py-3 px-4 whitespace-nowrap">Mã tài sản</th>
                <th className="py-3 px-4 whitespace-nowrap">Thiết bị &amp; Cấp rủi ro</th>
                <th className="py-3 px-4 whitespace-nowrap">Đối soát vị trí (Sổ sách ➔ Thực tế)</th>
                <th className="py-3 px-4 whitespace-nowrap">Hao mòn &amp; Hiện trạng</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => {
                return (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-800 whitespace-nowrap">
                      <span className="font-bold text-sm block">{asset.code}</span>
                      <span className="text-xs text-slate-500">SN: {asset.serialNumber}</span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold text-sm text-slate-900 block">{asset.deviceName}</span>
                      <span className="text-xs text-slate-500">
                        Model: <span className="text-slate-700 font-medium">{asset.model}</span> · <span className="font-semibold text-slate-700">Loại {asset.riskClass}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          Sổ: {asset.registeredDepartment}
                        </span>
                        {asset.isMisallocated ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 w-fit">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Lệch: {asset.actualDepartment}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Quét: {asset.actualDepartment}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm text-slate-800 font-bold">{asset.depreciationRatePercent}%</span>
                          <span className="text-xs text-slate-500">({asset.operatingYears} năm)</span>
                        </div>
                        {asset.pendingLiquidation ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 w-fit">
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            Chờ thanh lý
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Đang hoạt động tốt</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => onOpenPrintForm?.('TSC_HANDOVER_TRANSFER', asset)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-slate-100 transition cursor-pointer"
                          title="In Biên bản bàn giao tài sản cho thiết bị này (Mẫu 01/TSC-BBGN)"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {asset.isMisallocated ? (
                          <button
                            onClick={() => handleTransfer(asset.id, asset.actualDepartment)}
                            className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap"
                            title="Xác nhận cập nhật vị trí mới trên sổ sách kế toán theo NĐ 151"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            <span>Điều chuyển</span>
                          </button>
                        ) : !asset.pendingLiquidation && asset.operatingYears >= 8 ? (
                          <button
                            onClick={() => handleLiquidation(asset.id)}
                            className={`inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition shadow-2xs cursor-pointer active:scale-98 whitespace-nowrap ${
                              currentUserRole === 'director'
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-300 hover:border-rose-300'
                            }`}
                            title={currentUserRole === 'director'
                              ? "Lập tờ trình hội đồng thanh lý tài sản nhà nước (Thẩm quyền Giám Đốc NĐ 151/2017)"
                              : "Thẩm quyền ký duyệt thanh lý thuộc Ban Giám Đốc theo NĐ 151/2017. Bấm để mở hộp thoại xác thực/chuyển vai trò ký."}
                          >
                            {currentUserRole === 'director' ? (
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>{currentUserRole === 'director' ? 'Thanh lý' : 'Đề xuất thanh lý'}</span>
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-800 font-semibold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md whitespace-nowrap">
                            <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
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

