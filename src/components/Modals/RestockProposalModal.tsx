/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Boxes, AlertTriangle, Send, CheckCircle2, FileText } from 'lucide-react';
import { InventoryBatch } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';

interface RestockProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockBatches: InventoryBatch[];
  onConfirmRestock: (batchIds: string[]) => void;
  isAudioMuted: boolean;
}

export const RestockProposalModal: React.FC<RestockProposalModalProps> = ({
  isOpen,
  onClose,
  lowStockBatches,
  onConfirmRestock,
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="h-14 px-5 bg-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Phiếu Dự Trù Bổ Sung Cơ Số Thuốc &amp; Vật Tư Kho Dược</h2>
              <span className="text-[11px] text-teal-200 font-mono">
                Mẫu số 01/TT22 · Điều 7 Thông tư 22/2011/TT-BYT &amp; GSP TT 36
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-teal-200 hover:text-white hover:bg-teal-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Alert Notice */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Căn cứ nghiệp vụ Dược bệnh viện:</strong> Khi lượng tồn thực tế chạm hoặc thấp hơn định mức tối thiểu (Min Threshold), Dược sĩ kho có trách nhiệm lập Phiếu dự trù bổ sung chuyển Hội đồng Thuốc &amp; Điều trị và Giám đốc bệnh viện phê duyệt nhập hàng khẩn cấp.
            </div>
          </div>

          {/* Table of items to restock */}
          <div>
            <span className="font-bold text-slate-900 block text-[11px] uppercase tracking-wider mb-1.5">
              Danh mục mặt hàng cạn kho cần dự trù bổ sung ({lowStockBatches.length} mặt hàng):
            </span>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 font-semibold">
                    <th className="py-2 px-3">Tên thuốc / Quy cách</th>
                    <th className="py-2 px-3 text-center">Tồn kho hiện tại</th>
                    <th className="py-2 px-3 text-center">Định mức Min</th>
                    <th className="py-2 px-3 text-center">Định mức Max</th>
                    <th className="py-2 px-3 text-right">SL Đề xuất bổ sung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockBatches.length > 0 ? (
                    lowStockBatches.map((batch) => {
                      const neededQty = Math.max(0, batch.maxThreshold - batch.currentStock);
                      return (
                        <tr key={batch.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 block">{batch.itemName}</span>
                            <span className="text-[10px] text-slate-400">Số lô: {batch.batchNumber}</span>
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
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-800">
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
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Nơi gửi phê duyệt:</span>
              <strong className="text-slate-800">Hội Đồng Thuốc &amp; Điều Trị · Ban Giám Đốc Bệnh Viện</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold">Người lập phiếu:</span>
              <strong className="text-teal-800">DS. Nguyễn Bích Ngọc (Kho Dược)</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 px-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono">
            Số phiếu: DT-KD-{new Date().getFullYear()}/042 · Ngày: {todayStr}
          </div>
          <div className="flex items-center gap-2">
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
  );
};
