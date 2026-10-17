/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Wrench, ShieldCheck, CheckCircle2, FileSignature, Check, Printer } from 'lucide-react';
import { EquipmentTicket } from '../../types/clinical';
import { clinicalAudio } from '../../utils/audio';
import { PrintableFormType } from './PrintableFormModal';

interface EquipmentHandoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: EquipmentTicket | null;
  onConfirmResolved: (ticketId: string) => void;
  onOpenPrintForm?: (formType: PrintableFormType, ticket?: EquipmentTicket) => void;
  isAudioMuted: boolean;
}

export const EquipmentHandoverModal: React.FC<EquipmentHandoverModalProps> = ({
  isOpen,
  onClose,
  ticket,
  onConfirmResolved,
  onOpenPrintForm,
  isAudioMuted,
}) => {
  const [testResult, setTestResult] = useState('Đạt 100% tiêu chuẩn an toàn điện & áp lực thở');
  const [isDone, setIsDone] = useState(false);

  if (!isOpen || !ticket) return null;

  const handleConfirm = () => {
    if (!isAudioMuted) clinicalAudio.playSuccessChime();
    setIsDone(true);
    setTimeout(() => {
      onConfirmResolved(ticket.id);
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
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="h-14 px-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Biên Bản Thử Tải, Kiểm Định &amp; Bàn Giao Thiết Bị</h2>
              <span className="text-[11px] text-slate-400 font-mono">
                Điều 34, 55 NĐ 98/2021/NĐ-CP &amp; Tiêu chuẩn IEC 60601-1
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Device Profile */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-slate-900 text-sm">{ticket.code}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                Thiết bị y tế Loại {ticket.riskClass} (Xâm lấn khẩn cấp)
              </span>
            </div>
            <div className="text-sm font-bold text-slate-900">{ticket.deviceName}</div>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200 text-slate-600">
              <div>Số serial: <strong className="text-slate-800 font-mono">{ticket.serialNumber}</strong></div>
              <div>Model: <strong className="text-slate-800">{ticket.deviceModel}</strong></div>
              <div>Vị trí khoa phòng: <strong className="text-slate-800">{ticket.location}</strong></div>
              <div>Hạn dán tem kiểm định: <strong className="text-slate-800">{ticket.nextInspectionDue}</strong></div>
            </div>
          </div>

          {/* Issue & Resolution */}
          <div className="space-y-1.5">
            <span className="font-bold text-slate-900 block text-xs">Sự cố đã được xử lý:</span>
            <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-950 font-medium">
              ✓ Đã thay thế phụ kiện: <strong>{ticket.accessoryIssue}</strong>. Vệ sinh đường khí và khử khuẩn đạt chuẩn y tế.
            </div>
          </div>

          {/* Test Protocol */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-900 block text-xs">
              Kết quả thử tải áp lực &amp; kiểm tra an toàn dòng rò điện:
            </label>
            <input
              type="text"
              value={testResult}
              onChange={(e) => setTestResult(e.target.value)}
              className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:border-teal-700 font-medium"
            />
          </div>

          {/* Handover Signatures */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Kỹ sư y sinh thực hiện:</span>
              <strong className="text-slate-800">{ticket.assignedEngineer}</strong>
              <span className="text-[10px] text-slate-500 block">Phòng Vật tư - TBYT</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block font-semibold">Bác sĩ / ĐD Trưởng ca tiếp nhận:</span>
              <strong className="text-teal-800">Bác sĩ Khoa Lâm Sàng tiếp nhận</strong>
              <span className="text-[10px] text-slate-500 block">Sẵn sàng vận hành buồng bệnh</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="h-16 px-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono">
            Biên bản số: BB-BG-{ticket.code} · Ngày: {todayStr}
          </div>
          <div className="flex items-center gap-2">
            {onOpenPrintForm && ticket && (
              <button
                type="button"
                onClick={() => onOpenPrintForm('EQUIPMENT_HANDOVER_INSPECT', ticket)}
                className="h-9 px-3 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Xem & in biên bản kiểm định an toàn điện A4 chuẩn Nghị định 98/2021"
              >
                <Printer className="w-3.5 h-3.5 text-teal-700" />
                <span>Xem bản in A4</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              disabled={isDone}
              className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-98"
            >
              {isDone ? (
                <>
                  <CheckCircle2 className="w-4 h-4 animate-spin" />
                  <span>Đang ghi nhận bàn giao...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Ký Nghiệm Thu &amp; Bàn Giao Lâm Sàng</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
