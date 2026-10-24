/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Dự Trù Bổ Sung Thuốc & Vật Tư Cạn Kho (VBHN 07 & Mẫu 01/TT22)
 */

import React, { useState } from 'react';
import { X, Boxes, AlertTriangle, Send, CheckCircle2, Printer } from 'lucide-react';
import { InventoryBatch } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { PrintableFormType } from './PrintableFormModal';
import { useModalDismiss } from '../../hooks/useModalDismiss';

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
  useModalDismiss(isOpen, onClose);
  const [urgencyReason, setUrgencyReason] = useState('Chạm cơ số an toàn tối thiểu, nguy cơ gián đoạn cấp cứu');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    setIsSubmitted(true);
    setTimeout(() => {
      onConfirmRestock(lowStockBatches.map((b) => b.id));
      onClose();
    }, 700);
  };

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="h-14 px-4 bg-teal-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">Dự Trù Bổ Sung Thuốc &amp; Vật Tư</h2>
              <span className="text-[11px] text-teal-200 font-mono">Mẫu 01 · VBHN 07/VBHN-BYT</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-teal-200 hover:text-white hover:bg-teal-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Căn cứ nghiệp vụ Dược BV (VBHN 07):</strong> Khi tồn kho chạm hoặc thấp hơn mức Min, Dược sĩ lập Phiếu dự trù bổ sung trình Hội đồng Thuốc &amp; Điều trị phê duyệt nhập hàng khẩn.
            </div>
          </div>

          <div>
            <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider mb-2 text-slate-500">
              Danh mục chạm mức Min cần bổ sung ({lowStockBatches.length} mặt hàng):
            </span>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b font-semibold">
                    <th className="py-2.5 px-3">Tên thuốc / Quy cách</th>
                    <th className="py-2.5 px-2 text-center">Tồn kho</th>
                    <th className="py-2.5 px-2 text-center">Min / Max</th>
                    <th className="py-2.5 px-3 text-right">SL Đề xuất</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockBatches.length > 0 ? (
                    lowStockBatches.map((batch) => {
                      const neededQty = Math.max(0, batch.maxThreshold - batch.currentStock);
                      return (
                        <tr key={batch.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3">
                            <span className="font-bold text-slate-900 block">{batch.itemName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">Lô: {batch.batchNumber}</span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-rose-600">
                            {batch.currentStock} {batch.unit}
                          </td>
                          <td className="py-2 px-2 text-center font-mono text-slate-500">
                            {batch.minThreshold} - {batch.maxThreshold}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-teal-800">
                            +{neededQty} {batch.unit}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400">
                        Tất cả các mặt hàng đều đạt cơ số an toàn trên mức Min.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-900 block text-xs mb-1">Lý do đề xuất &amp; Ưu tiên cung ứng:</label>
            <input
              type="text"
              value={urgencyReason}
              onChange={(e) => setUrgencyReason(e.target.value)}
              className="w-full h-8 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden"
            />
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Nơi gửi phê duyệt:</span>
              <strong className="text-slate-800">Hội Đồng Thuốc &amp; Ban Giám Đốc</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block font-semibold">Người lập phiếu:</span>
              <strong className="text-teal-800">DS. Nguyễn Bích Ngọc (Kho Dược)</strong>
            </div>
          </div>
        </div>

        <div className="p-3 sm:px-5 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between text-xs">
          <div className="text-slate-500 font-mono hidden sm:inline">Số phiếu: DT-KD-{new Date().getFullYear()}/042 · Ngày: {todayStr}</div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onOpenPrintForm && (
              <button
                type="button"
                onClick={() => onOpenPrintForm('TT22_RESTOCK_PROPOSAL')}
                className="h-8.5 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-teal-700" />
                <span>In Mẫu 01</span>
              </button>
            )}
            <button onClick={onClose} className="h-8.5 px-3.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold">Đóng</button>
            <button
              onClick={handleConfirm}
              disabled={lowStockBatches.length === 0 || isSubmitted}
              className="h-8.5 px-4 rounded-lg bg-teal-800 hover:bg-teal-900 disabled:opacity-50 text-white font-bold flex items-center gap-1.5"
            >
              {isSubmitted ? (
                <>
                  <CheckCircle2 className="w-4 h-4 animate-spin" />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Gửi Phiếu Dự Trù</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
