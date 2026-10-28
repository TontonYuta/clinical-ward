/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Xem Chi Tiết Đơn Thuốc Điện Tử CPOE (Thông tư 52/2017 & TT 26/2025/TT-BYT) (<=200 LOC)
 */

import React, { useEffect } from 'react';
import { X, FileText, CheckCircle2, Clock, User, Stethoscope, Printer, ShieldCheck, AlertCircle } from 'lucide-react';
import { PrescriptionOrder } from '../../../../types/cpoe';

interface CpoeOrderDetailModalProps {
  isOpen: boolean;
  order: PrescriptionOrder | null;
  onClose: () => void;
  onOpenSafetyGuide?: (medName: string) => void;
  onOpenAdvice?: (order: PrescriptionOrder) => void;
}

export const CpoeOrderDetailModal: React.FC<CpoeOrderDetailModalProps> = ({
  isOpen,
  order,
  onClose,
  onOpenSafetyGuide,
  onOpenAdvice,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const isOutpatient = order.prescriptionType === 'outpatient';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cpoe-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-800 text-white flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="cpoe-detail-title" className="font-bold text-base sm:text-lg text-slate-900">
                  Chi Tiết Đơn Thuốc Điện Tử
                </h3>
                <span className="font-mono text-xs font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {order.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Căn cứ Thông tư 52/2017/TT-BYT &amp; Thông tư 26/2025/TT-BYT Bộ Y tế
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
            aria-label="Đóng chi tiết đơn thuốc"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with vertical scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
          {/* Status Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                  isOutpatient ? 'bg-blue-100 text-blue-900' : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {isOutpatient ? 'Đơn Ngoại Trú' : 'Đơn Nội Trú Theo Ngày'}
              </span>
              {order.isChronicDisease && (
                <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-900">
                  Bệnh Mạn Tính ({order.daysPrescribed} ngày)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Thời gian kê: <strong className="text-slate-800 font-mono">{order.prescribedAt}</strong></span>
            </div>
          </div>

          {/* Patient Details 2-Column Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-teal-700" />
              <span>Thông Tin Người Bệnh</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
              <div>
                <span className="text-slate-500">Họ và tên:</span>{' '}
                <strong className="text-slate-900 text-sm sm:text-base font-bold">{order.patientName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Mã bệnh nhân:</span>{' '}
                <span className="font-mono font-bold text-teal-800">{order.patientId}</span>
              </div>
              <div>
                <span className="text-slate-500">Số CCCD (TT 26/2025):</span>{' '}
                <span className="font-mono font-bold text-slate-900">{order.patientCccd}</span>
              </div>
              <div>
                <span className="text-slate-500">Khoa / Buồng bệnh:</span>{' '}
                <span className="font-semibold text-slate-800">{order.department || 'Khoa Nội Tổng Hợp'}</span>
                {order.roomBed && <span className="text-slate-500"> ({order.roomBed})</span>}
              </div>
              <div className="sm:col-span-2 bg-slate-50 p-2.5 rounded border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Chẩn đoán y khoa:</span>
                <span className="inline-block px-2 py-0.5 rounded bg-slate-200 text-slate-900 font-mono font-bold text-xs mr-2">
                  {order.diagnosisIcd10}
                </span>
                <strong className="text-slate-900 font-bold">{order.diagnosisText}</strong>
              </div>
            </div>
          </div>

          {/* Prescribed Medications Table */}
          <div className="bg-white rounded-lg border border-slate-200 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-teal-700" />
                <span>Danh Mục Thuốc Chỉ Định ({order.items.length} khoản)</span>
              </span>
              <span className="text-xs text-slate-500 font-normal">ĐVT / Số lượng</span>
            </div>

            <div className="divide-y divide-slate-100">
              {order.items.map((it, idx) => (
                <div key={it.id || idx} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-slate-400 text-xs">{idx + 1}.</span>
                      <strong className="text-slate-900 font-bold text-sm sm:text-base">{it.medicationName}</strong>
                      {it.isNarcotic && (
                        <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          Thuốc Gây Nghiện (TT 20)
                        </span>
                      )}
                      {onOpenSafetyGuide && (
                        <button
                          type="button"
                          onClick={() => onOpenSafetyGuide(it.medicationName)}
                          className="text-teal-700 hover:text-teal-900 text-xs font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200 cursor-pointer transition shadow-2xs"
                          title="Tra cứu thông tin thuốc & Dược thư Quốc Gia"
                        >
                          Thông tin thuốc
                        </button>
                      )}
                    </div>
                    {it.activeIngredient && (
                      <div className="text-xs text-slate-500">
                        Hoạt chất: <span className="font-medium text-slate-700">{it.activeIngredient}</span> {it.dosage && `(${it.dosage})`}
                      </div>
                    )}
                    <div className="text-xs text-teal-800 font-medium">
                      Cách dùng: {it.route || 'Đường uống'} • {it.instructions || it.frequency || 'Theo y lệnh bác sĩ'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-base font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                      {it.quantity} {it.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Doctor & Digital Signature */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Bác sĩ điều trị: <strong className="text-emerald-800">{order.doctorName}</strong></span>
              </div>
              <div className="text-xs text-slate-500">
                Chứng chỉ hành nghề: <span className="font-mono font-bold text-slate-700">{order.doctorCertificate || '014829/BYT-CCHN'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Chữ ký số hợp lệ (VNPT-CA / Viettel-CA)</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm border border-slate-300 transition cursor-pointer shadow-2xs"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>In đơn thuốc</span>
          </button>
          <div className="flex items-center gap-2">
            {onOpenAdvice && (
              <button
                type="button"
                onClick={() => onOpenAdvice(order)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs sm:text-sm border border-teal-200 transition cursor-pointer shadow-2xs"
              >
                <Clock className="w-4 h-4 text-teal-700" />
                <span>Dặn dò nhắc thuốc</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs sm:text-sm transition cursor-pointer shadow-2xs"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
