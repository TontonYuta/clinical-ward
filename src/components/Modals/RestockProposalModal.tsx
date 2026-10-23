/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Boxes, AlertTriangle, Send, CheckCircle2, FileText, Printer } from 'lucide-react';
import { InventoryBatch } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { PrintableFormType } from './PrintableFormModal';

interface RestockProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockBatches: InventoryBatch[];
  onConfirmRestock: (batchIds: string[]) => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
}

export const RestockProposalModal: React.FC<RestockProposalModalProps> = ({
  isOpen,
  onClose,
  lowStockBatches,
  onConfirmRestock,
  onOpenPrintForm,
  isAudioMuted,
}) => {
  const [urgencyReason, setUrgencyReason] = useState('Chạm cơ số an toàn tối thiểu, nguy cơ đứt gãy cung ứng cấp cứu');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    setIsSubmitted(true);
    setTimeout(() => {
      onConfirmRestock(lowStockBatches.map(b => b.id));
      onClose();
    }, 700);
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="min-h-14 py-3 px-3.5 sm:px-5 bg-teal-900 text-white flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30 shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold truncate">Dự Trù Bổ Sung Thuốc &amp; Vật Tư</h2>
              <span className="text-[11px] text-teal-200 font-mono truncate block">
                Mẫu 01 · Thông tư 22/2011/TT-BYT
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-teal-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Alert Notice */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Căn cứ nghiệp vụ Dược bệnh viện:</strong> Khi lượng tồn thực tế chạm hoặc thấp hơn định mức tối thiểu (Min Threshold), Dược sĩ kho có trách nhiệm lập Phiếu dự trù bổ sung chuyển Hội đồng Thuốc &amp; Điều trị và Giám đốc bệnh viện phê duyệt nhập hàng khẩn cấp.
            </div>
          </div>

          {/* Table / Cards of items to restock */}
          <div>
            <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider mb-2 text-slate-500">
              Danh mục mặt hàng cạn kho cần dự trù bổ sung ({lowStockBatches.length} mặt hàng):
            </span>

            {/* Mobile View: Cards */}
            <div className="sm:hidden space-y-2">
              {lowStockBatches.length > 0 ? (
                lowStockBatches.map((batch) => {
                  const neededQty = Math.max(0, batch.maxThreshold - batch.currentStock);
                  return (
                    <div key={batch.id} className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-slate-900 font-bold text-xs block">{batch.itemName}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">Số lô: {batch.batchNumber}</span>
                        </div>
                        <span className="shrink-0 font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded text-xs border border-teal-200">
                          +{neededQty} {batch.unit}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                        <span className="text-slate-600">
                          Hiện còn: <strong className="text-rose-600">{batch.currentStock} {batch.unit}</strong>
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          Định mức: {batch.minThreshold} - {batch.maxThreshold}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
                  Hiện tại tất cả các mặt hàng đều đạt cơ số an toàn.
                </div>
              )}
            </div>

            {/* Desktop View: Full Table */}
            <div className="hidden sm:block border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm min-w-[500px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold text-xs">
                    <th className="py-2.5 px-3.5">Tên thuốc / Quy cách</th>
                    <th className="py-2.5 px-3 text-center">Tồn kho hiện tại</th>
                    <th className="py-2.5 px-3 text-center">Định mức Min</th>
                    <th className="py-2.5 px-3 text-center">Định mức Max</th>
                    <th className="py-2.5 px-3.5 text-right">SL Đề xuất bổ sung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockBatches.length > 0 ? (
                    lowStockBatches.map((batch) => {
                      const neededQty = Math.max(0, batch.maxThreshold - batch.currentStock);
                      return (
                        <tr key={batch.id} className="hover:bg-slate-50 transition">
                          <td className="py-2.5 px-3.5">
                            <span className="font-bold text-slate-900 block">{batch.itemName}</span>
                            <span className="text-xs text-slate-400 font-mono">Số lô: {batch.batchNumber}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-rose-600">
                            {batch.currentStock} {batch.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {batch.minThreshold}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600">
                            {batch.maxThreshold}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-teal-800">
                            +{neededQty} {batch.unit}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400">
                        Hiện tại tất cả các mặt hàng đều đạt cơ số an toàn trên mức Min.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block text-xs">
              Lý do đề xuất &amp; Mức độ ưu tiên cung ứng:
            </label>
            <input
              type="text"
              value={urgencyReason}
              onChange={(e) => setUrgencyReason(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-teal-700"
            />
          </div>

          {/* Destination */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 block font-semibold">Nơi gửi phê duyệt:</span>
              <strong className="text-slate-800">Hội Đồng Thuốc &amp; ĐT · Ban Giám Đốc</strong>
            </div>
            <div className="sm:text-right">
              <span className="text-[11px] text-slate-400 block font-semibold">Người lập phiếu:</span>
              <strong className="text-teal-800">DS. Nguyễn Bích Ngọc (Kho Dược)</strong>
            </div>
          </div>
        </div>

        {/* Footer - Responsive Action Controls */}
        <div className="p-3 sm:px-5 sm:py-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
          {/* Mobile Footer */}
          <div className="sm:hidden space-y-2">
            <div className="text-[11px] text-slate-500 font-mono text-center">
              Số phiếu: DT-KD-{new Date().getFullYear()}/042 · Ngày: {todayStr}
            </div>
            <button
              onClick={handleConfirm}
              disabled={lowStockBatches.length === 0 || isSubmitted}
              className="w-full h-11 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {isSubmitted ? (
                <>
                  <CheckCircle2 className="w-4 h-4 animate-spin" />
                  <span>Đang gửi phê duyệt...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Gửi Phiếu Dự Trù Cung Ứng (TT 22)</span>
                </>
              )}
            </button>
            <div className="flex items-center gap-2">
              {onOpenPrintForm && (
                <button
                  type="button"
                  onClick={() => onOpenPrintForm('TT22_RESTOCK_PROPOSAL')}
                  className="flex-1 h-9 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Xem & in phiếu dự trù A4"
                >
                  <Printer className="w-3.5 h-3.5 text-teal-700" />
                  <span>Xem bản in A4</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 h-9 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>

          {/* Desktop Footer */}
          <div className="hidden sm:flex items-center justify-between">
            <div className="text-xs text-slate-500 font-mono">
              Số phiếu: DT-KD-{new Date().getFullYear()}/042 · Ngày: {todayStr}
            </div>
            <div className="flex items-center gap-2">
              {onOpenPrintForm && (
                <button
                  type="button"
                  onClick={() => onOpenPrintForm('TT22_RESTOCK_PROPOSAL')}
                  className="h-9 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Xem & in phiếu dự trù A4 chuẩn Mẫu 01/TT22 Thông tư 22/2011/TT-BYT"
                >
                  <Printer className="w-3.5 h-3.5 text-teal-700" />
                  <span>Xem bản in A4</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="h-9 px-4 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={handleConfirm}
                disabled={lowStockBatches.length === 0 || isSubmitted}
                className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                {isSubmitted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 animate-spin" />
                    <span>Đang gửi phê duyệt...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Gửi Phiếu Dự Trù Cung Ứng (TT 22)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
